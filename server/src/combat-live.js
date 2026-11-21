import { WebSocket, WebSocketServer } from 'ws';

import { readEncounter } from './combat.js';

export const combatLivePath = (campaignSlug) =>
    `/api/campaigns/${encodeURIComponent(campaignSlug)}/combat/live`;

const COMBAT_LIVE_PATTERN = /^\/api\/campaigns\/([^/]+)\/combat\/live$/;

export const HEARTBEAT_MS = 30 * 1000;

// Clients only listen; anything they send is ignored, so inbound frames stay tiny.
const MAX_INBOUND_PAYLOAD = 1024;

const rejectUpgrade = (socket, status, reason) => {
    socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
};

/*
 * Pushes a campaign's combat encounter to every tracker open in that campaign. Clients receive the
 * current encounter as soon as they connect, then every encounter the API saves in their campaign.
 * Messages are `{ "type": "encounter", "encounter": IEncounter }`.
 *
 * `resolveAccess(req, campaignSlug)` returns `{ campaignId }` or `{ status, reason }`; it is shared
 * with the REST session/membership lookups so the two channels cannot drift.
 */
export const createCombatLive = (
    combatCollection,
    { resolveAccess, appOrigin = null, heartbeatMs = HEARTBEAT_MS } = {}
) => {
    const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_INBOUND_PAYLOAD });
    const alive = new WeakMap();
    const rooms = new Map();

    const send = (socket, encounter) => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'encounter', encounter }));
        }
    };

    const publish = (campaignId, encounter) => {
        const room = rooms.get(campaignId);
        if (room === undefined) {
            return;
        }

        for (const socket of room) {
            send(socket, encounter);
        }
    };

    wss.on('connection', async (socket, req, campaignId) => {
        alive.set(socket, true);
        socket.on('pong', () => alive.set(socket, true));
        socket.on('error', () => socket.terminate());

        if (!rooms.has(campaignId)) {
            rooms.set(campaignId, new Set());
        }
        rooms.get(campaignId).add(socket);

        socket.on('close', () => {
            const room = rooms.get(campaignId);
            if (room === undefined) {
                return;
            }

            room.delete(socket);
            if (room.size === 0) {
                rooms.delete(campaignId);
            }
        });

        try {
            send(socket, await readEncounter(combatCollection, campaignId));
        } catch (error) {
            console.error(error);
            socket.close(1011, 'Could not read the encounter.');
        }
    });

    // Drops connections that stopped answering pings, and keeps idle ones open through proxies.
    const heartbeat = setInterval(() => {
        for (const socket of wss.clients) {
            if (alive.get(socket) === false) {
                socket.terminate();
                continue;
            }

            alive.set(socket, false);
            socket.ping();
        }
    }, heartbeatMs);
    heartbeat.unref();

    const attach = (server) => {
        const upgrade = async (req, socket, head) => {
            const { pathname } = new URL(req.url ?? '/', 'http://localhost');
            const match = COMBAT_LIVE_PATTERN.exec(pathname);
            if (match === null) {
                rejectUpgrade(socket, 404, 'Not Found');
                return;
            }

            const origin = req.headers.origin;
            if (typeof origin === 'string' && origin !== '' && appOrigin !== null && origin !== appOrigin) {
                rejectUpgrade(socket, 403, 'Forbidden');
                return;
            }

            let campaignSlug;
            try {
                campaignSlug = decodeURIComponent(match[1]);
            } catch {
                rejectUpgrade(socket, 404, 'Not Found');
                return;
            }

            let access;
            try {
                access = await resolveAccess(req, campaignSlug);
            } catch (error) {
                console.error(error);
                rejectUpgrade(socket, 500, 'Internal Server Error');
                return;
            }

            if (access.campaignId === undefined) {
                rejectUpgrade(socket, access.status ?? 401, access.reason ?? 'Unauthorized');
                return;
            }

            wss.handleUpgrade(req, socket, head, (client) => {
                wss.emit('connection', client, req, access.campaignId);
            });
        };

        server.on('upgrade', (req, socket, head) => {
            upgrade(req, socket, head).catch((error) => {
                console.error(error);
                rejectUpgrade(socket, 500, 'Internal Server Error');
            });
        });
    };

    const close = () => {
        clearInterval(heartbeat);
        for (const socket of wss.clients) {
            socket.terminate();
        }
        rooms.clear();
        wss.close();
    };

    return { publish, attach, close };
};

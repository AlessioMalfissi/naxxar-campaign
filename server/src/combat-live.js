import { WebSocket, WebSocketServer } from 'ws';

import { isAuthenticatedRequest } from './auth.js';
import { readEncounter } from './combat.js';

export const COMBAT_LIVE_PATH = '/api/combat/live';

export const HEARTBEAT_MS = 30 * 1000;

// Clients only listen; anything they send is ignored, so inbound frames stay tiny.
const MAX_INBOUND_PAYLOAD = 1024;

const rejectUpgrade = (socket, status, reason) => {
    socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
};

/*
 * Pushes the combat encounter to every open tracker over a websocket. A client receives the current
 * encounter as soon as it connects (which also covers anything missed while it was disconnected), then
 * every encounter the API saves. Messages are `{ "type": "encounter", "encounter": IEncounter }`.
 */
export const createCombatLive = (collection, { heartbeatMs = HEARTBEAT_MS } = {}) => {
    const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_INBOUND_PAYLOAD });
    const alive = new WeakMap();

    const send = (socket, encounter) => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'encounter', encounter }));
        }
    };

    const publish = (encounter) => {
        for (const socket of wss.clients) {
            send(socket, encounter);
        }
    };

    wss.on('connection', async (socket) => {
        alive.set(socket, true);
        socket.on('pong', () => alive.set(socket, true));
        socket.on('error', () => socket.terminate());

        try {
            send(socket, await readEncounter(collection));
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

    const attach = (server, { sessionSecret }) => {
        server.on('upgrade', (req, socket, head) => {
            const { pathname } = new URL(req.url ?? '/', 'http://localhost');
            if (pathname !== COMBAT_LIVE_PATH) {
                rejectUpgrade(socket, 404, 'Not Found');
                return;
            }
            if (!isAuthenticatedRequest(req, sessionSecret)) {
                rejectUpgrade(socket, 401, 'Unauthorized');
                return;
            }

            wss.handleUpgrade(req, socket, head, (client) => wss.emit('connection', client, req));
        });
    };

    const close = () => {
        clearInterval(heartbeat);
        for (const socket of wss.clients) {
            socket.terminate();
        }
        wss.close();
    };

    return { publish, attach, close };
};

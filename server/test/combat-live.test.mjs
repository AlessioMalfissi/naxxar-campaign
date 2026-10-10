import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import request from 'supertest';
import { WebSocket } from 'ws';

import { createApp } from '../src/app.js';
import { ENCOUNTER_ID } from '../src/combat.js';
import { COMBAT_LIVE_PATH, createCombatLive } from '../src/combat-live.js';
import { createFakeCollection } from '../test-utils/fake-collection.mjs';

const PASSWORD = 'campaign-test-password';
const SECRET = 'test-secret';

const goblin = {
    id: 'goblin-1',
    name: 'Goblin 1',
    kind: 'enemy',
    entryId: null,
    initiative: 12,
    initiativeNudge: 0,
    color: null,
    hp: null,
    maxHp: null,
    ac: null,
    conditions: []
};

const startServer = async (t, docs = []) => {
    const combat = createFakeCollection(docs);
    const combatLive = createCombatLive(combat);
    const app = createApp(
        {
            entries: createFakeCollection([]),
            inventory: createFakeCollection([]),
            purses: createFakeCollection([]),
            combat
        },
        { appPassword: PASSWORD, sessionSecret: SECRET, combatLive }
    );

    const server = app.listen(0);
    await once(server, 'listening');
    combatLive.attach(server, { sessionSecret: SECRET });

    t.after(() => {
        combatLive.close();
        server.close();
    });

    const login = await request(server).post('/api/auth/login').send({ password: PASSWORD });
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const { port } = server.address();

    return { server, cookie, url: `ws://127.0.0.1:${port}` };
};

// Resolves with the socket once open, buffering every message it receives from the first frame on.
const connect = async (url, headers = {}) => {
    const socket = new WebSocket(url, { headers });
    const messages = [];
    const waiters = [];

    socket.on('message', (data) => {
        const message = JSON.parse(data.toString());
        const waiter = waiters.shift();
        if (waiter === undefined) {
            messages.push(message);
        } else {
            waiter(message);
        }
    });

    await once(socket, 'open');

    const next = () =>
        messages.length > 0 ? Promise.resolve(messages.shift()) : new Promise((resolve) => waiters.push(resolve));

    return { socket, next };
};

const rejectionStatus = (url, headers = {}) =>
    new Promise((resolve) => {
        const socket = new WebSocket(url, { headers });
        socket.on('unexpected-response', (req, res) => {
            resolve(res.statusCode);
            socket.terminate();
        });
        socket.on('error', () => undefined);
    });

test('the combat socket refuses a connection without a session', async (t) => {
    const { url } = await startServer(t);

    assert.equal(await rejectionStatus(`${url}${COMBAT_LIVE_PATH}`), 401);
});

test('the combat socket refuses a forged session cookie', async (t) => {
    const { url } = await startServer(t);

    assert.equal(
        await rejectionStatus(`${url}${COMBAT_LIVE_PATH}`, { Cookie: 'naxxar_session=authenticated.forged' }),
        401
    );
});

test('websocket upgrades on any other path are refused', async (t) => {
    const { url, cookie } = await startServer(t);

    assert.equal(await rejectionStatus(`${url}/api/entries`, { Cookie: cookie }), 404);
});

test('the combat socket sends the current encounter as soon as it connects', async (t) => {
    const { url, cookie } = await startServer(t, [
        { _id: ENCOUNTER_ID, revision: 3, round: 2, turnId: 'goblin-1', combatants: [goblin] }
    ]);
    const { socket, next } = await connect(`${url}${COMBAT_LIVE_PATH}`, { Cookie: cookie });
    t.after(() => socket.terminate());

    assert.deepEqual(await next(), {
        type: 'encounter',
        encounter: { revision: 3, round: 2, turnId: 'goblin-1', combatants: [goblin] }
    });
});

test('the combat socket sends an empty encounter when none was saved', async (t) => {
    const { url, cookie } = await startServer(t);
    const { socket, next } = await connect(`${url}${COMBAT_LIVE_PATH}`, { Cookie: cookie });
    t.after(() => socket.terminate());

    assert.deepEqual(await next(), {
        type: 'encounter',
        encounter: { revision: 0, round: 0, turnId: null, combatants: [] }
    });
});

test('every connected tracker receives each saved encounter', async (t) => {
    const { server, url, cookie } = await startServer(t);
    const first = await connect(`${url}${COMBAT_LIVE_PATH}`, { Cookie: cookie });
    const second = await connect(`${url}${COMBAT_LIVE_PATH}`, { Cookie: cookie });
    t.after(() => {
        first.socket.terminate();
        second.socket.terminate();
    });
    await first.next();
    await second.next();

    const saved = await request(server)
        .put('/api/combat')
        .set('Cookie', cookie)
        .send({ round: 1, turnId: 'goblin-1', combatants: [goblin] });

    const expected = { type: 'encounter', encounter: saved.body };
    assert.equal(saved.body.revision, 1);
    assert.deepEqual(await first.next(), expected);
    assert.deepEqual(await second.next(), expected);
});

test('saves are pushed in revision order', async (t) => {
    const { server, url, cookie } = await startServer(t);
    const { socket, next } = await connect(`${url}${COMBAT_LIVE_PATH}`, { Cookie: cookie });
    t.after(() => socket.terminate());
    await next();

    await Promise.all(
        [0, 1, 2].map((round) =>
            request(server).put('/api/combat').set('Cookie', cookie).send({ round, combatants: [goblin] })
        )
    );

    const revisions = [];
    for (let index = 0; index < 3; index += 1) {
        revisions.push((await next()).encounter.revision);
    }
    assert.deepEqual(revisions, [1, 2, 3]);
});

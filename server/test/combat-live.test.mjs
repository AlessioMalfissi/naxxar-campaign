import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import request from 'supertest';
import { WebSocket } from 'ws';

import { combatLivePath, createCombatLive } from '../src/combat-live.js';
import { resolveCampaignAccess } from '../src/campaign-access.js';
import { encounterId } from '../src/combat.js';
import { resolveSession } from '../src/sessions.js';
import { addCampaign, addUser, buildApp, campaignPath } from './helpers.mjs';

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
    legendaryActions: { max: 0, remaining: 0 },
    legendaryResistances: { max: 0, remaining: 0 },
    conditions: [],
    dead: false
};

const buildFixture = async () => {
    const context = buildApp({
        services: {
            combatLiveFactory: (collections) =>
                createCombatLive(collections.combat, {
                    resolveAccess: async (req, slug) => {
                        const auth = await resolveSession(req, {
                            sessions: collections.sessions,
                            users: collections.users
                        });
                        if (auth === null) {
                            return { status: 401, reason: 'Unauthorized' };
                        }

                        const access = await resolveCampaignAccess(
                            { campaigns: collections.campaigns, memberships: collections.memberships },
                            auth.user,
                            slug
                        );
                        return access === null ? { status: 404, reason: 'Not Found' } : { campaignId: access.doc._id };
                    }
                })
        }
    });

    const dm = await addUser(context.users, { email: 'dm@example.com' });
    const player = await addUser(context.users, { email: 'player@example.com', displayName: 'Player' });
    const superAdmin = await addUser(context.users, {
        email: 'admin@example.com',
        displayName: 'Super Admin',
        isSuperAdmin: true
    });
    const campaign = await addCampaign(context.campaigns, context.memberships, { dm, players: [player] });
    const other = await addCampaign(context.campaigns, context.memberships, { slug: 'other', name: 'Other', dm });

    const server = context.app.listen(0);
    await once(server, 'listening');
    context.combatLive.attach(server);

    const login = async (email) => {
        const response = await request(server).post('/api/auth/login').send({ email, password: 'password123' });
        return response.headers['set-cookie'][0].split(';')[0];
    };

    const { port } = server.address();

    return {
        ...context,
        server,
        url: `ws://127.0.0.1:${port}`,
        dmCookie: await login('dm@example.com'),
        playerCookie: await login('player@example.com'),
        superAdminCookie: await login('admin@example.com'),
        campaign,
        other
    };
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

const withServer = (fixture, t) => {
    t.after(() => {
        fixture.combatLive.close();
        fixture.server.close();
    });
    return fixture;
};

test('the socket refuses a connection without a session', async (t) => {
    const fixture = withServer(await buildFixture(), t);

    assert.equal(await rejectionStatus(`${fixture.url}${combatLivePath('naxxar')}`), 401);
});

test('the socket refuses a forged session cookie', async (t) => {
    const fixture = withServer(await buildFixture(), t);

    assert.equal(
        await rejectionStatus(`${fixture.url}${combatLivePath('naxxar')}`, {
            Cookie: 'naxxar_session=forged'
        }),
        401
    );
});

test('a non-member gets a 404, as does an unknown campaign', async (t) => {
    const fixture = withServer(await buildFixture(), t);

    assert.equal(
        await rejectionStatus(`${fixture.url}${combatLivePath('other-campaign')}`, {
            Cookie: fixture.playerCookie
        }),
        404
    );
    assert.equal(await rejectionStatus(`${fixture.url}/api/entries`, { Cookie: fixture.dmCookie }), 404);
});

test('a super admin can open the live socket for a campaign they have not joined', async (t) => {
    const fixture = withServer(await buildFixture(), t);
    const { socket, next } = await connect(`${fixture.url}${combatLivePath('other')}`, {
        Cookie: fixture.superAdminCookie
    });
    t.after(() => socket.terminate());

    assert.deepEqual(await next(), {
        type: 'encounter',
        encounter: { revision: 0, round: 0, turnId: null, combatants: [] }
    });
});

test('the socket sends that campaign’s current encounter on connect', async (t) => {
    const fixture = withServer(await buildFixture(), t);
    await fixture.combat.insertOne({
        _id: encounterId(fixture.campaign._id),
        campaignId: fixture.campaign._id,
        revision: 3,
        round: 2,
        turnId: 'goblin-1',
        combatants: [goblin]
    });

    const { socket, next } = await connect(`${fixture.url}${combatLivePath('naxxar')}`, {
        Cookie: fixture.dmCookie
    });
    t.after(() => socket.terminate());

    assert.deepEqual(await next(), {
        type: 'encounter',
        encounter: { revision: 3, round: 2, turnId: 'goblin-1', combatants: [goblin] }
    });
});

test('the socket sends an empty encounter when none was saved', async (t) => {
    const fixture = withServer(await buildFixture(), t);
    const { socket, next } = await connect(`${fixture.url}${combatLivePath('naxxar')}`, {
        Cookie: fixture.dmCookie
    });
    t.after(() => socket.terminate());

    assert.deepEqual(await next(), {
        type: 'encounter',
        encounter: { revision: 0, round: 0, turnId: null, combatants: [] }
    });
});

test('a websocket in campaign A never receives campaign B’s encounter', async (t) => {
    const fixture = withServer(await buildFixture(), t);
    const first = await connect(`${fixture.url}${combatLivePath('naxxar')}`, { Cookie: fixture.dmCookie });
    const second = await connect(`${fixture.url}${combatLivePath('other')}`, { Cookie: fixture.dmCookie });
    t.after(() => {
        first.socket.terminate();
        second.socket.terminate();
    });
    await first.next();
    await second.next();

    const saved = await request(fixture.server)
        .put(campaignPath(fixture.campaign, '/combat'))
        .set('Cookie', fixture.dmCookie)
        .send({ round: 1, turnId: 'goblin-1', combatants: [goblin] });

    assert.equal(saved.body.revision, 1);
    assert.deepEqual(await first.next(), { type: 'encounter', encounter: saved.body });

    // The other campaign only sees its own empty snapshot; nothing arrives after it.
    const raced = await Promise.race([
        second.next().then((message) => message),
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 150))
    ]);
    assert.equal(raced, 'timeout');
});

test('players are members and receive live updates', async (t) => {
    const fixture = withServer(await buildFixture(), t);
    const tracker = await connect(`${fixture.url}${combatLivePath('naxxar')}`, {
        Cookie: fixture.playerCookie
    });
    t.after(() => tracker.socket.terminate());
    await tracker.next();

    await request(fixture.server)
        .put(campaignPath(fixture.campaign, '/combat'))
        .set('Cookie', fixture.dmCookie)
        .send({ round: 1, combatants: [goblin] });

    const pushed = await tracker.next();
    assert.equal(pushed.encounter.revision, 1);
});

test('saves are pushed in revision order', async (t) => {
    const fixture = withServer(await buildFixture(), t);
    const { socket, next } = await connect(`${fixture.url}${combatLivePath('naxxar')}`, {
        Cookie: fixture.dmCookie
    });
    t.after(() => socket.terminate());
    await next();

    await Promise.all(
        [0, 1, 2].map((round) =>
            request(fixture.server)
                .put(campaignPath(fixture.campaign, '/combat'))
                .set('Cookie', fixture.dmCookie)
                .send({ round, combatants: [goblin] })
        )
    );

    const revisions = [];
    for (let index = 0; index < 3; index += 1) {
        revisions.push((await next()).encounter.revision);
    }
    assert.deepEqual(revisions, [1, 2, 3]);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { encounterId, MAX_COMBATANTS } from '../src/combat.js';
import { addCampaign, addUser, buildApp, campaignPath } from './helpers.mjs';

const goblin = (overrides = {}) => ({
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
    dead: false,
    ...overrides
});

const buildFixture = async () => {
    const context = buildApp();
    const dm = await addUser(context.users, { email: 'dm@example.com' });
    const player = await addUser(context.users, { email: 'player@example.com', displayName: 'Player' });
    const campaign = await addCampaign(context.campaigns, context.memberships, { dm, players: [player] });
    const other = await addCampaign(context.campaigns, context.memberships, { slug: 'other', name: 'Other', dm });

    return { ...context, dm, player, campaign, other };
};

const loginAs = async (app, email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: 'password123' });
    return agent;
};

test('GET returns an empty encounter when none was saved', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.get(campaignPath(context.campaign, '/combat'));
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { revision: 0, round: 0, turnId: null, combatants: [] });
});

test('GET returns the saved encounter without internal fields', async () => {
    const context = await buildFixture();
    await context.combat.insertOne({
        _id: encounterId(context.campaign._id),
        campaignId: context.campaign._id,
        revision: 4,
        round: 2,
        turnId: 'goblin-1',
        combatants: [goblin()],
        updatedAt: '2026-10-01T00:00:00.000Z'
    });
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.get(campaignPath(context.campaign, '/combat'));
    assert.deepEqual(response.body, { revision: 4, round: 2, turnId: 'goblin-1', combatants: [goblin()] });
});

test('GET fills in defaults for encounters saved before those fields existed', async () => {
    const { initiativeNudge, color, dead, legendaryActions, legendaryResistances, ...legacy } = goblin();
    const context = await buildFixture();
    await context.combat.insertOne({
        _id: encounterId(context.campaign._id),
        campaignId: context.campaign._id,
        round: 0,
        turnId: null,
        combatants: [legacy]
    });
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.get(campaignPath(context.campaign, '/combat'));
    assert.equal(response.body.combatants[0].dead, false);
    assert.deepEqual(response.body.combatants[0].legendaryActions, { max: 0, remaining: 0 });
    assert.deepEqual(response.body.combatants[0].legendaryResistances, { max: 0, remaining: 0 });
    assert.equal(response.body.combatants[0].initiativeNudge, 0);
    assert.equal(response.body.combatants[0].color, null);
});

test('PUT stores the encounter and bumps its revision', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent
        .put(campaignPath(context.campaign, '/combat'))
        .send({ round: 1, turnId: 'goblin-1', combatants: [goblin()] });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
        revision: 1,
        round: 1,
        turnId: 'goblin-1',
        combatants: [goblin()]
    });
    assert.equal(context.combat.dump().length, 1);
});

test('each campaign has its own encounter and revision sequence', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    const first = await agent
        .put(campaignPath(context.campaign, '/combat'))
        .send({ round: 0, combatants: [] });
    const second = await agent
        .put(campaignPath(context.other, '/combat'))
        .send({ round: 0, combatants: [] });

    assert.equal(first.body.revision, 1);
    assert.equal(second.body.revision, 1);

    const again = await agent
        .put(campaignPath(context.campaign, '/combat'))
        .send({ round: 1, combatants: [] });
    assert.equal(again.body.revision, 2);
    assert.equal((await agent.get(campaignPath(context.other, '/combat'))).body.revision, 1);
});

test('saves within one campaign are serialized and ignored client revisions are replaced', async () => {
    const context = await buildFixture();
    await context.combat.insertOne({
        _id: encounterId(context.campaign._id),
        campaignId: context.campaign._id,
        revision: 7,
        round: 0,
        turnId: null,
        combatants: []
    });
    const agent = await loginAs(context.app, 'dm@example.com');
    const encounter = { revision: 100, round: 0, turnId: null, combatants: [goblin()] };

    const [first, second] = await Promise.all([
        agent.put(campaignPath(context.campaign, '/combat')).send(encounter),
        agent.put(campaignPath(context.campaign, '/combat')).send(encounter)
    ]);

    assert.deepEqual([first.body.revision, second.body.revision].sort(), [8, 9]);
});

test('onSaved receives the campaign id and revision in order', async () => {
    const saved = [];
    const context = buildApp({
        services: { combatLive: { publish: (campaignId, encounter) => saved.push({ campaignId, encounter }) } }
    });
    const dm = await addUser(context.users, { email: 'dm@example.com' });
    const campaign = await addCampaign(context.campaigns, context.memberships, { dm });
    const agent = await loginAs(context.app, 'dm@example.com');

    await Promise.all([
        agent.put(campaignPath(campaign, '/combat')).send({ round: 0, combatants: [] }),
        agent.put(campaignPath(campaign, '/combat')).send({ round: 1, combatants: [goblin()] })
    ]);

    assert.deepEqual(
        saved.map(({ campaignId, encounter }) => [campaignId, encounter.revision]),
        [
            [campaign._id, 1],
            [campaign._id, 2]
        ]
    );
});

test('an invalid encounter is not reported to onSaved', async () => {
    const saved = [];
    const context = buildApp({
        services: { combatLive: { publish: (...args) => saved.push(args) } }
    });
    const dm = await addUser(context.users, { email: 'dm@example.com' });
    const campaign = await addCampaign(context.campaigns, context.memberships, { dm });
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.put(campaignPath(campaign, '/combat')).send({ round: 1 });
    assert.equal(response.status, 400);
    assert.equal(saved.length, 0);
});

test('normalization trims combatants, clamps values and drops blank conditions', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent
        .put(campaignPath(context.campaign, '/combat'))
        .send({
            round: -3,
            turnId: 'missing',
            combatants: [
                {
                    id: ' tessaly ',
                    name: '  Tessaly Oakhand ',
                    kind: 'player',
                    entryId: ' players:tessaly-oakhand ',
                    initiative: '14.7',
                    initiativeNudge: '2.9',
                    color: '#AABBCC',
                    hp: -4,
                    maxHp: '',
                    ac: 'tough',
                    conditions: [
                        { name: ' Prone ', rounds: null, description: '   ' },
                        { name: 'Poisoned', rounds: 0 },
                        { name: '  ' },
                        { name: 'Hexed', rounds: 2, description: ` ${'x'.repeat(600)} ` }
                    ]
                }
            ]
        });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
        revision: 1,
        round: 0,
        turnId: null,
        combatants: [
            {
                id: 'tessaly',
                name: 'Tessaly Oakhand',
                kind: 'player',
                entryId: 'players:tessaly-oakhand',
                initiative: 14,
                initiativeNudge: 2,
                color: '#aabbcc',
                dead: false,
                hp: 0,
                maxHp: null,
                ac: null,
                legendaryActions: { max: 0, remaining: 0 },
                legendaryResistances: { max: 0, remaining: 0 },
                conditions: [
                    { name: 'Prone', rounds: null },
                    { name: 'Poisoned', rounds: 1 },
                    { name: 'Hexed', rounds: 2, description: 'x'.repeat(500) }
                ]
            }
        ]
    });
});

test('enemies never keep hit points or armour class', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent
        .put(campaignPath(context.campaign, '/combat'))
        .send({ round: 0, combatants: [goblin({ kind: 'dragon', hp: 7, maxHp: 7, ac: 15 })] });

    assert.deepEqual(response.body.combatants[0], goblin());
});

test('legendary pools are clamped to their maximum', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.put(campaignPath(context.campaign, '/combat')).send({
        round: 0,
        combatants: [
            goblin({
                legendaryActions: { max: 3, remaining: 5 },
                legendaryResistances: { max: '4.9', remaining: -2 }
            }),
            goblin({ id: 'goblin-2', name: 'Goblin 2', legendaryActions: { max: '12' } })
        ]
    });

    assert.deepEqual(response.body.combatants[0].legendaryActions, { max: 3, remaining: 3 });
    assert.deepEqual(response.body.combatants[0].legendaryResistances, { max: 4, remaining: 0 });
    assert.deepEqual(response.body.combatants[1].legendaryActions, { max: 10, remaining: 10 });
});

test('PUT rejects a body without a combatant list, a nameless combatant, duplicates and oversize encounters', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');
    const base = campaignPath(context.campaign, '/combat');

    assert.equal((await agent.put(base).send({ round: 1 })).status, 400);
    assert.equal(
        (await agent.put(base).send({ round: 0, combatants: [goblin({ name: ' ' })] })).status,
        400
    );
    assert.equal((await agent.put(base).send({ round: 0, combatants: [goblin(), goblin()] })).status, 400);

    const combatants = Array.from({ length: MAX_COMBATANTS + 1 }, (_, index) => goblin({ id: `goblin-${index}` }));
    assert.equal((await agent.put(base).send({ round: 0, combatants })).status, 400);
});

test('players can read combat but not write it', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'player@example.com');

    assert.equal((await agent.get(campaignPath(context.campaign, '/combat'))).status, 200);
    assert.equal(
        (await agent.put(campaignPath(context.campaign, '/combat')).send({ round: 0, combatants: [] })).status,
        403
    );
});

test('combat requires a session', async () => {
    const context = await buildFixture();
    const response = await request(context.app).get(campaignPath(context.campaign, '/combat'));

    assert.equal(response.status, 401);
});

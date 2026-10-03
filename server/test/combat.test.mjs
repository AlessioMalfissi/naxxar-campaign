import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { ENCOUNTER_ID, MAX_COMBATANTS } from '../src/combat.js';
import { createFakeCollection } from '../test-utils/fake-collection.mjs';

const PASSWORD = 'campaign-test-password';

const buildApp = (docs = []) => {
    const combat = createFakeCollection(docs);
    const app = createApp(
        {
            entries: createFakeCollection([]),
            inventory: createFakeCollection([]),
            purses: createFakeCollection([]),
            combat
        },
        { appPassword: PASSWORD, sessionSecret: 'test-secret' }
    );
    return { app, combat };
};

const authedAgent = async (app) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ password: PASSWORD });
    return agent;
};

const goblin = (overrides = {}) => ({
    id: 'goblin-1',
    name: 'Goblin 1',
    kind: 'enemy',
    entryId: null,
    initiative: 12,
    hp: null,
    maxHp: null,
    ac: null,
    conditions: [],
    ...overrides
});

test('GET /api/combat returns an empty encounter when none was saved', async () => {
    const { app } = buildApp();
    const agent = await authedAgent(app);
    const response = await agent.get('/api/combat');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { round: 0, turnId: null, combatants: [] });
});

test('GET /api/combat requires a session', async () => {
    const { app } = buildApp();
    const response = await request(app).get('/api/combat');

    assert.equal(response.status, 401);
});

test('GET /api/combat returns the saved encounter without internal fields', async () => {
    const { app } = buildApp([
        {
            _id: ENCOUNTER_ID,
            round: 2,
            turnId: 'goblin-1',
            combatants: [goblin()],
            updatedAt: '2026-10-01T00:00:00.000Z'
        }
    ]);
    const agent = await authedAgent(app);
    const response = await agent.get('/api/combat');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { round: 2, turnId: 'goblin-1', combatants: [goblin()] });
});

test('PUT /api/combat stores the encounter and returns it', async () => {
    const { app, combat } = buildApp();
    const agent = await authedAgent(app);
    const encounter = { round: 1, turnId: 'goblin-1', combatants: [goblin()] };
    const response = await agent.put('/api/combat').send(encounter);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, encounter);
    assert.equal(combat.dump().length, 1);

    const listed = await agent.get('/api/combat');
    assert.deepEqual(listed.body, encounter);
});

test('PUT /api/combat normalizes combatant fields, drops blank conditions and caps descriptions', async () => {
    const { app } = buildApp();
    const agent = await authedAgent(app);
    const response = await agent.put('/api/combat').send({
        round: -3,
        turnId: 'missing',
        combatants: [
            {
                id: ' tessaly ',
                name: '  Tessaly Oakhand ',
                kind: 'player',
                entryId: ' players:tessaly-oakhand ',
                initiative: '14.7',
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
        round: 0,
        turnId: null,
        combatants: [
            {
                id: 'tessaly',
                name: 'Tessaly Oakhand',
                kind: 'player',
                entryId: 'players:tessaly-oakhand',
                initiative: 14,
                hp: 0,
                maxHp: null,
                ac: null,
                conditions: [
                    { name: 'Prone', rounds: null },
                    { name: 'Poisoned', rounds: 1 },
                    { name: 'Hexed', rounds: 2, description: 'x'.repeat(500) }
                ]
            }
        ]
    });
});

test('PUT /api/combat keeps player stats', async () => {
    const { app } = buildApp();
    const agent = await authedAgent(app);
    const player = goblin({ id: 'tessaly', name: 'Tessaly Oakhand', kind: 'player', hp: 20, maxHp: 24, ac: 16 });
    const response = await agent.put('/api/combat').send({ round: 0, combatants: [player] });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.combatants[0], player);
});

test('PUT /api/combat stores enemies without hit points or armour class', async () => {
    const { app } = buildApp();
    const agent = await authedAgent(app);
    const response = await agent.put('/api/combat').send({
        round: 0,
        combatants: [goblin({ kind: 'dragon', hp: 7, maxHp: 7, ac: 15 })]
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.combatants[0], goblin());
});

test('PUT /api/combat rejects a body without a combatant list', async () => {
    const { app } = buildApp();
    const agent = await authedAgent(app);
    const response = await agent.put('/api/combat').send({ round: 1 });

    assert.equal(response.status, 400);
});

test('PUT /api/combat rejects a combatant without a name', async () => {
    const { app } = buildApp();
    const agent = await authedAgent(app);
    const response = await agent.put('/api/combat').send({ round: 0, combatants: [goblin({ name: ' ' })] });

    assert.equal(response.status, 400);
});

test('PUT /api/combat rejects duplicate combatant ids', async () => {
    const { app } = buildApp();
    const agent = await authedAgent(app);
    const response = await agent.put('/api/combat').send({ round: 0, combatants: [goblin(), goblin()] });

    assert.equal(response.status, 400);
});

test('PUT /api/combat rejects an oversized encounter', async () => {
    const { app } = buildApp();
    const agent = await authedAgent(app);
    const combatants = Array.from({ length: MAX_COMBATANTS + 1 }, (_, index) => goblin({ id: `goblin-${index}` }));
    const response = await agent.put('/api/combat').send({ round: 0, combatants });

    assert.equal(response.status, 400);
});

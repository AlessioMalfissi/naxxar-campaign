import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { createFakeCollection } from '../test-utils/fake-collection.mjs';

const PASSWORD = 'campaign-test-password';

const buildApp = (docs = []) =>
    createApp(
        { entries: createFakeCollection([]), inventory: createFakeCollection(docs), purses: createFakeCollection([]) },
        { appPassword: PASSWORD, sessionSecret: 'test-secret' }
    );

const authedAgent = async (app) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ password: PASSWORD });
    return agent;
};

const sampleItem = (overrides = {}) => ({
    _id: 'a5c8f9d0-1111-4a2b-9c3d-000000000001',
    name: 'Potion of healing',
    description: 'Restores 2d4+2 hit points.',
    quantity: 3,
    owner: 'party',
    rarity: 'common',
    status: 'magic',
    forSale: false,
    imp: false,
    impTag: '',
    updatedAt: '2026-08-25T00:00:00.000Z',
    ...overrides
});

test('GET /api/inventory lists items sorted by name', async () => {
    const app = buildApp([
        sampleItem({ _id: 'id-2', name: 'Rope, 50ft' }),
        sampleItem({ _id: 'id-1', name: 'Bag of holding' })
    ]);
    const agent = await authedAgent(app);
    const response = await agent.get('/api/inventory');

    assert.equal(response.status, 200);
    assert.equal(response.body.length, 2);
    assert.equal(response.body[0].name, 'Bag of holding');
    assert.equal(response.body[0].id, 'id-1');
});

test('GET /api/inventory requires a session', async () => {
    const app = buildApp([sampleItem()]);
    const response = await request(app).get('/api/inventory');

    assert.equal(response.status, 401);
});

test('POST /api/inventory creates an item defaulting owner to party, quantity to 1, rarity to none and status to mundane', async () => {
    const app = buildApp([]);
    const agent = await authedAgent(app);
    const response = await agent.post('/api/inventory').send({ name: 'Torch' });

    assert.equal(response.status, 201);
    assert.equal(response.body.name, 'Torch');
    assert.equal(response.body.quantity, 1);
    assert.equal(response.body.owner, 'party');
    assert.equal(response.body.description, '');
    assert.equal(response.body.rarity, 'none');
    assert.equal(response.body.status, 'mundane');
    assert.equal(response.body.forSale, false);
    assert.equal(response.body.imp, false);
    assert.equal(response.body.impTag, '');
});

test('POST /api/inventory stores the supplied quantity, owner, description, rarity, status and flags', async () => {
    const app = buildApp([]);
    const agent = await authedAgent(app);
    const response = await agent.post('/api/inventory').send({
        name: 'Potion of healing',
        description: 'Restores 2d4+2 hit points.',
        quantity: 5,
        owner: 'players:tessaly-oakhand',
        rarity: 'common',
        status: 'magic',
        forSale: true,
        imp: true,
        impTag: ' Cromwell '
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.quantity, 5);
    assert.equal(response.body.owner, 'players:tessaly-oakhand');
    assert.equal(response.body.description, 'Restores 2d4+2 hit points.');
    assert.equal(response.body.rarity, 'common');
    assert.equal(response.body.status, 'magic');
    assert.equal(response.body.forSale, true);
    assert.equal(response.body.imp, true);
    assert.equal(response.body.impTag, 'Cromwell');
});

test('POST /api/inventory falls back to a default rarity and status for an invalid value', async () => {
    const app = buildApp([]);
    const agent = await authedAgent(app);
    const response = await agent
        .post('/api/inventory')
        .send({ name: 'Torch', rarity: 'mythical', status: 'cursed' });

    assert.equal(response.status, 201);
    assert.equal(response.body.rarity, 'none');
    assert.equal(response.body.status, 'mundane');
});

test('POST /api/inventory rejects an empty name', async () => {
    const app = buildApp([]);
    const agent = await authedAgent(app);

    const empty = await agent.post('/api/inventory').send({ name: '' });
    assert.equal(empty.status, 400);

    const blank = await agent.post('/api/inventory').send({ name: '   ' });
    assert.equal(blank.status, 400);
});

test('POST /api/inventory falls back to a default quantity for a negative or non-integer value', async () => {
    const app = buildApp([]);
    const agent = await authedAgent(app);
    const response = await agent.post('/api/inventory').send({ name: 'Torch', quantity: -3 });

    assert.equal(response.status, 201);
    assert.equal(response.body.quantity, 1);
});

test('PATCH /api/inventory/:id updates the quantity', async () => {
    const app = buildApp([sampleItem()]);
    const agent = await authedAgent(app);
    const response = await agent.patch(`/api/inventory/${sampleItem()._id}`).send({ quantity: 7 });

    assert.equal(response.status, 200);
    assert.equal(response.body.quantity, 7);
    assert.equal(response.body.owner, 'party');
    assert.notEqual(response.body.updatedAt, sampleItem().updatedAt);
});

test('PATCH /api/inventory/:id reassigns the owner to a player', async () => {
    const app = buildApp([sampleItem()]);
    const agent = await authedAgent(app);
    const response = await agent
        .patch(`/api/inventory/${sampleItem()._id}`)
        .send({ owner: 'players:tessaly-oakhand' });

    assert.equal(response.status, 200);
    assert.equal(response.body.owner, 'players:tessaly-oakhand');
    assert.equal(response.body.quantity, sampleItem().quantity);
});

test('PATCH /api/inventory/:id updates the rarity and status', async () => {
    const app = buildApp([sampleItem({ rarity: 'none', status: 'mundane' })]);
    const agent = await authedAgent(app);
    const response = await agent
        .patch(`/api/inventory/${sampleItem()._id}`)
        .send({ rarity: 'legendary', status: 'attuned' });

    assert.equal(response.status, 200);
    assert.equal(response.body.rarity, 'legendary');
    assert.equal(response.body.status, 'attuned');
});

test('PATCH /api/inventory/:id keeps the existing rarity and status when given an invalid value', async () => {
    const app = buildApp([sampleItem({ rarity: 'rare', status: 'attuned' })]);
    const agent = await authedAgent(app);
    const response = await agent
        .patch(`/api/inventory/${sampleItem()._id}`)
        .send({ rarity: 'mythical', status: 'cursed' });

    assert.equal(response.status, 200);
    assert.equal(response.body.rarity, 'rare');
    assert.equal(response.body.status, 'attuned');
});

test('PATCH /api/inventory/:id updates the forSale and imp flags', async () => {
    const app = buildApp([sampleItem({ forSale: false, imp: false })]);
    const agent = await authedAgent(app);
    const response = await agent
        .patch(`/api/inventory/${sampleItem()._id}`)
        .send({ forSale: true, imp: true });

    assert.equal(response.status, 200);
    assert.equal(response.body.forSale, true);
    assert.equal(response.body.imp, true);
});

test('PATCH /api/inventory/:id updates the impTag, trimming whitespace', async () => {
    const app = buildApp([sampleItem({ impTag: '' })]);
    const agent = await authedAgent(app);
    const response = await agent
        .patch(`/api/inventory/${sampleItem()._id}`)
        .send({ impTag: ' Cromwell ' });

    assert.equal(response.status, 200);
    assert.equal(response.body.impTag, 'Cromwell');
});

test('PATCH /api/inventory/:id keeps the existing impTag when not supplied', async () => {
    const app = buildApp([sampleItem({ impTag: 'Cromwell' })]);
    const agent = await authedAgent(app);
    const response = await agent.patch(`/api/inventory/${sampleItem()._id}`).send({ quantity: 2 });

    assert.equal(response.status, 200);
    assert.equal(response.body.impTag, 'Cromwell');
});

test('PATCH /api/inventory/:id 404s when the item does not exist', async () => {
    const app = buildApp([]);
    const agent = await authedAgent(app);
    const response = await agent.patch('/api/inventory/missing').send({ quantity: 2 });

    assert.equal(response.status, 404);
});

test('DELETE /api/inventory/:id removes the item', async () => {
    const collection = createFakeCollection([sampleItem()]);
    const app = createApp(
        { entries: createFakeCollection([]), inventory: collection, purses: createFakeCollection([]) },
        { appPassword: PASSWORD, sessionSecret: 'test-secret' }
    );
    const agent = await authedAgent(app);
    const response = await agent.delete(`/api/inventory/${sampleItem()._id}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { id: sampleItem()._id });
    assert.equal(collection.dump().length, 0);
});

test('DELETE /api/inventory/:id is idempotent when nothing matches', async () => {
    const app = buildApp([]);
    const agent = await authedAgent(app);
    const response = await agent.delete('/api/inventory/missing');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { id: 'missing' });
});

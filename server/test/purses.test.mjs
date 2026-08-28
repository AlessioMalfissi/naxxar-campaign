import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { createFakeCollection } from '../test-utils/fake-collection.mjs';

const PASSWORD = 'campaign-test-password';

const buildApp = (docs = []) =>
    createApp(
        { entries: createFakeCollection([]), inventory: createFakeCollection([]), purses: createFakeCollection(docs) },
        { appPassword: PASSWORD, sessionSecret: 'test-secret' }
    );

const authedAgent = async (app) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ password: PASSWORD });
    return agent;
};

test('GET /api/purses lists purses by owner', async () => {
    const app = buildApp([
        { _id: 'party', gold: 120, updatedAt: '2026-08-25T00:00:00.000Z' },
        { _id: 'players:tessaly-oakhand', gold: 15, updatedAt: '2026-08-25T00:00:00.000Z' }
    ]);
    const agent = await authedAgent(app);
    const response = await agent.get('/api/purses');

    assert.equal(response.status, 200);
    assert.equal(response.body.length, 2);
    assert.deepEqual(
        response.body.find((purse) => purse.owner === 'party'),
        { owner: 'party', gold: 120 }
    );
});

test('GET /api/purses requires a session', async () => {
    const app = buildApp([]);
    const response = await request(app).get('/api/purses');

    assert.equal(response.status, 401);
});

test('PUT /api/purses/:owner creates a purse when none exists', async () => {
    const app = buildApp([]);
    const agent = await authedAgent(app);
    const response = await agent.put('/api/purses/party').send({ gold: 50 });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { owner: 'party', gold: 50 });

    const listed = await agent.get('/api/purses');
    assert.equal(listed.body.length, 1);
});

test('PUT /api/purses/:owner updates an existing purse', async () => {
    const app = buildApp([{ _id: 'players:tessaly-oakhand', gold: 15, updatedAt: '2026-08-25T00:00:00.000Z' }]);
    const agent = await authedAgent(app);
    const response = await agent.put('/api/purses/players:tessaly-oakhand').send({ gold: 42 });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { owner: 'players:tessaly-oakhand', gold: 42 });
});

test('PUT /api/purses/:owner floors a fractional gold value', async () => {
    const app = buildApp([]);
    const agent = await authedAgent(app);
    const response = await agent.put('/api/purses/party').send({ gold: 12.9 });

    assert.equal(response.status, 200);
    assert.equal(response.body.gold, 12);
});

test('PUT /api/purses/:owner rejects a negative or non-numeric gold value', async () => {
    const app = buildApp([]);
    const agent = await authedAgent(app);

    const negative = await agent.put('/api/purses/party').send({ gold: -5 });
    assert.equal(negative.status, 400);

    const notANumber = await agent.put('/api/purses/party').send({ gold: 'lots' });
    assert.equal(notANumber.status, 400);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { createFakeCollection } from '../test-utils/fake-collection.mjs';

const PASSWORD = 'campaign-test-password';

const buildApp = () =>
    createApp(
        { entries: createFakeCollection([]), inventory: createFakeCollection([]), purses: createFakeCollection([]) },
        { appPassword: PASSWORD, sessionSecret: 'test-secret' }
    );

test('createApp refuses to start without an appPassword', () => {
    assert.throws(
        () =>
            createApp({
                entries: createFakeCollection([]),
                inventory: createFakeCollection([]),
                purses: createFakeCollection([])
            }),
        /appPassword/
    );
});

test('GET /api/auth/me reports unauthenticated with no session cookie', async () => {
    const app = buildApp();
    const response = await request(app).get('/api/auth/me');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { authenticated: false });
});

test('POST /api/auth/login rejects the wrong password', async () => {
    const app = buildApp();
    const response = await request(app).post('/api/auth/login').send({ password: 'wrong' });

    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'Incorrect password.');
});

test('POST /api/auth/login sets a session cookie for the right password, and /me reflects it', async () => {
    const app = buildApp();
    const agent = request.agent(app);

    const login = await agent.post('/api/auth/login').send({ password: PASSWORD });
    assert.equal(login.status, 200);
    assert.deepEqual(login.body, { authenticated: true });

    const me = await agent.get('/api/auth/me');
    assert.deepEqual(me.body, { authenticated: true });
});

test('POST /api/auth/logout clears the session so /me goes back to unauthenticated', async () => {
    const app = buildApp();
    const agent = request.agent(app);

    await agent.post('/api/auth/login').send({ password: PASSWORD });
    const logout = await agent.post('/api/auth/logout');
    assert.equal(logout.status, 200);

    const me = await agent.get('/api/auth/me');
    assert.deepEqual(me.body, { authenticated: false });
});

test('GET /api/entries requires a session and rejects a tampered cookie', async () => {
    const app = buildApp();

    const anonymous = await request(app).get('/api/entries');
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.body.error, 'Sign in required.');

    const tampered = await request(app).get('/api/entries').set('Cookie', 'naxxar_session=authenticated.not-a-real-signature');
    assert.equal(tampered.status, 401);
});

test('GET /api/entries succeeds once logged in', async () => {
    const app = buildApp();
    const agent = request.agent(app);

    await agent.post('/api/auth/login').send({ password: PASSWORD });
    const response = await agent.get('/api/entries');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, []);
});

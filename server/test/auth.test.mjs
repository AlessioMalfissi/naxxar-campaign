import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { HttpError } from '../src/http-error.js';
import { passThroughRateLimiters } from '../src/rate-limit.js';
import { addCampaign, addUser, buildApp, fakePasswords, login, TEST_CONFIG } from './helpers.mjs';

const setup = async () => {
    const context = buildApp();
    const user = await addUser(context.users, { email: 'dm@example.com', password: 'password123' });
    const campaign = await addCampaign(context.campaigns, context.memberships, { dm: user });
    return { ...context, user, campaign };
};

test('createApp refuses to start without a config or password service', () => {
    const collections = {
        users: null,
        sessions: null,
        campaigns: null,
        memberships: null,
        invites: null,
        passwordResets: null,
        entries: null,
        inventory: null,
        purses: null,
        combat: null
    };

    assert.throws(() => createApp(collections, { passwords: fakePasswords() }), /config/);
    assert.throws(() => createApp(collections, { config: TEST_CONFIG }), /password service/);
});

test('GET /api/auth/me returns 200 with a null user when anonymous', async () => {
    const { app } = await setup();
    const response = await request(app).get('/api/auth/me');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { user: null, campaigns: [] });
    assert.equal(response.headers['cache-control'], 'no-store');
});

test('POST /api/auth/login sets a session cookie and returns the user and campaigns', async () => {
    const { app, user, campaign } = await setup();
    const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'DM@example.com', password: 'password123' });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.user, {
        id: user._id,
        email: 'dm@example.com',
        displayName: 'Dungeon Master'
    });
    assert.deepEqual(response.body.campaigns, [
        { id: campaign._id, slug: 'naxxar', name: 'Naxxar', role: 'dm' }
    ]);
    assert.match(response.headers['set-cookie'][0], /naxxar_session=/);
    assert.match(response.headers['set-cookie'][0], /HttpOnly/);
    assert.match(response.headers['set-cookie'][0], /SameSite=Lax/);
});

test('a wrong password and an unknown email return the same 401 body', async () => {
    const { app } = await setup();

    const wrongPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: 'dm@example.com', password: 'wrong-password' });
    const unknownEmail = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
    assert.equal(wrongPassword.body.error, 'Incorrect email or password.');
});

test('a user without a password hash cannot sign in with a password', async () => {
    const { app, users } = await setup();
    await addUser(users, { email: 'google@example.com', password: null });

    const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'google@example.com', password: 'password123' });

    assert.equal(response.status, 401);
});

test('GET /api/auth/me reflects the signed-in user', async () => {
    const { app, user, campaign } = await setup();
    const { agent } = await login(app);

    const response = await agent.get('/api/auth/me');
    assert.equal(response.status, 200);
    assert.equal(response.body.user.id, user._id);
    assert.deepEqual(response.body.campaigns, [
        { id: campaign._id, slug: 'naxxar', name: 'Naxxar', role: 'dm' }
    ]);
});

test('a tampered session cookie is treated as anonymous', async () => {
    const { app } = await setup();
    const response = await request(app).get('/api/auth/me').set('Cookie', 'naxxar_session=tampered');

    assert.deepEqual(response.body, { user: null, campaigns: [] });
});

test('POST /api/auth/logout deletes the session and clears the cookie', async () => {
    const { app, sessions } = await setup();
    const { agent } = await login(app);
    assert.equal(sessions.dump().length, 1);

    const response = await agent.post('/api/auth/logout');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true });
    assert.equal(sessions.dump().length, 0);

    const me = await agent.get('/api/auth/me');
    assert.deepEqual(me.body, { user: null, campaigns: [] });
});

test('login rate limiting returns 429 once the injected limiter blocks', async () => {
    let calls = 0;
    const limited = (req, res, next) => {
        calls += 1;
        next(calls > 1 ? new HttpError(429, 'Too many attempts. Try again later.') : undefined);
    };
    const { app } = await setup();
    const limitedApp = buildApp({
        services: { rateLimiters: { ...passThroughRateLimiters, login: limited } }
    });
    await addUser(limitedApp.users, { email: 'dm@example.com', password: 'password123' });

    const first = await request(limitedApp.app)
        .post('/api/auth/login')
        .send({ email: 'dm@example.com', password: 'password123' });
    const second = await request(limitedApp.app)
        .post('/api/auth/login')
        .send({ email: 'dm@example.com', password: 'password123' });

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.ok(app !== null);
});

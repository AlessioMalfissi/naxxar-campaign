import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { addCampaign, addUser, buildApp } from './helpers.mjs';

const buildGoogleApp = (verify) => {
    const context = buildApp({
        config: { googleClientId: 'test-client-id.apps.googleusercontent.com' },
        services: { google: { verify } }
    });
    return context;
};

const googlePayload = (overrides = {}) => ({
    sub: 'google-sub-1',
    email: 'dm@example.com',
    emailVerified: true,
    name: 'Dungeon Master',
    ...overrides
});

test('Google sign-in is 503 when no client id is configured', async () => {
    const context = buildApp({ services: { google: { verify: async () => googlePayload() } } });

    const response = await request(context.app).post('/api/auth/google').send({ credential: 'token' });
    assert.equal(response.status, 503);
});

test('Google sign-in never creates an account for an unknown email', async () => {
    const context = buildGoogleApp(async () => googlePayload({ email: 'stranger@example.com' }));

    const response = await request(context.app).post('/api/auth/google').send({ credential: 'token' });
    assert.equal(response.status, 403);
    assert.match(response.body.error, /invite/i);
    assert.equal(context.users.dump().length, 0);
});

test('Google sign-in links an existing password account with no googleSub', async () => {
    const context = buildGoogleApp(async () => googlePayload());
    const user = await addUser(context.users, { email: 'dm@example.com' });
    await addCampaign(context.campaigns, context.memberships, { dm: user });

    const response = await request(context.app).post('/api/auth/google').send({ credential: 'token' });
    assert.equal(response.status, 200);
    assert.equal(response.body.user.id, user._id);
    assert.equal((await context.users.findOne({ _id: user._id })).googleSub, 'google-sub-1');
    assert.match(response.headers['set-cookie'][0], /naxxar_session=/);
});

test('a second Google sign-in resolves the account by sub, not email', async () => {
    const context = buildGoogleApp(async () => googlePayload({ email: 'renamed@example.com' }));
    const user = await addUser(context.users, { email: 'dm@example.com' });
    await context.users.replaceOne({ _id: user._id }, { ...user, googleSub: 'google-sub-1' });

    const response = await request(context.app).post('/api/auth/google').send({ credential: 'token' });
    assert.equal(response.status, 200);
    assert.equal(response.body.user.id, user._id);
});

test('an unverified Google email is rejected', async () => {
    const context = buildGoogleApp(async () => googlePayload({ emailVerified: false }));

    const response = await request(context.app).post('/api/auth/google').send({ credential: 'token' });
    assert.equal(response.status, 401);
});

test('a Google email linked to a different sub is a 409', async () => {
    const context = buildGoogleApp(async () => googlePayload());
    await addUser(context.users, { email: 'dm@example.com', googleSub: 'another-sub' });

    const response = await request(context.app).post('/api/auth/google').send({ credential: 'token' });
    assert.equal(response.status, 409);
});

test('a verifier exception is a 401', async () => {
    const context = buildGoogleApp(async () => {
        throw new Error('bad token');
    });

    const response = await request(context.app).post('/api/auth/google').send({ credential: 'token' });
    assert.equal(response.status, 401);
});

test('a missing credential is a 401', async () => {
    const context = buildGoogleApp(async () => googlePayload());

    const response = await request(context.app).post('/api/auth/google').send({});
    assert.equal(response.status, 401);
});

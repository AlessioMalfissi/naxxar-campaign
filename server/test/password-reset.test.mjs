import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { hashToken } from '../src/sessions.js';
import { addCampaign, addUser, buildApp, login } from './helpers.mjs';

const setup = async ({ mailer } = {}) => {
    const sent = [];
    const context = buildApp({
        services: {
            mailer: mailer ?? {
                sendPasswordReset: async (message) => {
                    sent.push(message);
                }
            }
        }
    });
    const user = await addUser(context.users, { email: 'dm@example.com', password: 'password123' });
    await addCampaign(context.campaigns, context.memberships, { dm: user });
    const { agent } = await login(context.app);
    return { ...context, user, sent, agent };
};

const tokenFrom = (message) => {
    const match = /\/reset-password\/([A-Za-z0-9_-]{43})/.exec(message.resetUrl);
    assert.notEqual(match, null);
    return match[1];
};

test('forgot-password always returns the same generic 202', async () => {
    const { app } = await setup();

    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'dm@example.com' });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    const invalid = await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' });

    assert.equal(known.status, 202);
    assert.equal(unknown.status, 202);
    assert.equal(invalid.status, 202);
    assert.deepEqual(known.body, { ok: true });
    assert.deepEqual(unknown.body, known.body);
});

test('forgot-password stores one reset token and emails the link', async () => {
    const { app, passwordResets, sent, user } = await setup();

    await request(app).post('/api/auth/forgot-password').send({ email: 'dm@example.com' });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'dm@example.com');

    const token = tokenFrom(sent[0]);
    const reset = await passwordResets.findOne({ _id: hashToken(token) });
    assert.equal(reset.userId, user._id);
    assert.equal(reset.usedAt, null);
});

test('a valid reset token changes the password and revokes every session', async () => {
    const { app, sent, sessions, users, user } = await setup();
    await request(app).post('/api/auth/forgot-password').send({ email: 'dm@example.com' });
    const token = tokenFrom(sent[0]);

    const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: 'brand-new-password' });
    assert.equal(response.status, 200);
    assert.equal(sessions.dump().length, 0);

    const updated = await users.findOne({ _id: user._id });
    assert.equal(updated.passwordHash, 'fake:brand-new-password');

    const oldPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: 'dm@example.com', password: 'password123' });
    const newPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: 'dm@example.com', password: 'brand-new-password' });
    assert.equal(oldPassword.status, 401);
    assert.equal(newPassword.status, 200);
});

test('a reset token cannot be used twice', async () => {
    const { app, sent } = await setup();
    await request(app).post('/api/auth/forgot-password').send({ email: 'dm@example.com' });
    const token = tokenFrom(sent[0]);

    await request(app).post('/api/auth/reset-password').send({ token, password: 'brand-new-password' });
    const second = await request(app).post('/api/auth/reset-password').send({ token, password: 'another-password' });

    assert.equal(second.status, 400);
});

test('an expired reset token is rejected', async () => {
    const { app, passwordResets } = await setup();
    const token = 'a'.repeat(43);
    await passwordResets.insertOne({
        _id: hashToken(token),
        userId: 'user-1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        usedAt: null
    });

    const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, password: 'brand-new-password' });
    assert.equal(response.status, 400);
});

test('a weak password is rejected before the token is burned', async () => {
    const { app, sent, passwordResets } = await setup();
    await request(app).post('/api/auth/forgot-password').send({ email: 'dm@example.com' });
    const token = tokenFrom(sent[0]);

    const response = await request(app).post('/api/auth/reset-password').send({ token, password: 'short' });
    assert.equal(response.status, 400);
    assert.equal((await passwordResets.findOne({ _id: hashToken(token) })).usedAt, null);
});

test('a malformed token is a 400', async () => {
    const { app } = await setup();

    const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'nope', password: 'brand-new-password' });
    assert.equal(response.status, 400);
});

test('a mailer failure does not change the 202 response', async () => {
    const { app } = await setup({
        mailer: {
            sendPasswordReset: async () => {
                throw new Error('smtp down');
            }
        }
    });

    const response = await request(app).post('/api/auth/forgot-password').send({ email: 'dm@example.com' });
    assert.equal(response.status, 202);
});

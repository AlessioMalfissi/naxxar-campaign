import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { createSessionToken, hashToken } from '../src/sessions.js';
import { addCampaign, addUser, buildApp, campaignPath, login } from './helpers.mjs';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const insertInvite = async (invites, campaignId, { usedAt = null, expiresAt } = {}) => {
    const { token, tokenHash } = createSessionToken();
    await invites.insertOne({
        _id: tokenHash,
        campaignId,
        createdBy: 'dm-user',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt ?? new Date(Date.now() + INVITE_TTL_MS).toISOString(),
        usedAt,
        usedBy: null
    });
    return token;
};

const buildFixture = async ({ withGoogle = false } = {}) => {
    const verify = async () => ({
        sub: 'google-sub-1',
        email: 'google@example.com',
        emailVerified: true,
        name: 'Google Player'
    });
    const context = buildApp({
        config: withGoogle ? { googleClientId: 'test-client-id' } : {},
        services: { google: withGoogle ? { verify } : null }
    });

    const dm = await addUser(context.users, { email: 'dm@example.com' });
    const player = await addUser(context.users, { email: 'player@example.com', displayName: 'Player' });
    const campaign = await addCampaign(context.campaigns, context.memberships, { dm, players: [player] });

    return { ...context, dm, player, campaign, verify };
};

test('preview returns the campaign name, slug and expiry for a valid invite', async () => {
    const context = await buildFixture();
    const token = await insertInvite(context.invites, context.campaign._id);

    const response = await request(context.app).get(`/api/invites/${token}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
        campaignName: 'Naxxar',
        campaignSlug: 'naxxar',
        expiresAt: (await context.invites.findOne({ _id: hashToken(token) })).expiresAt
    });
    assert.equal(response.headers['cache-control'], 'no-store');
});

test('preview distinguishes unknown (404) from used and expired (410)', async () => {
    const context = await buildFixture();
    const used = await insertInvite(context.invites, context.campaign._id, { usedAt: '2026-01-01T00:00:00.000Z' });
    const expired = await insertInvite(context.invites, context.campaign._id, {
        expiresAt: new Date(Date.now() - 1000).toISOString()
    });

    assert.equal((await request(context.app).get('/api/invites/unknown-token')).status, 404);
    assert.equal((await request(context.app).get(`/api/invites/${used}`)).status, 410);
    assert.equal((await request(context.app).get(`/api/invites/${expired}`)).status, 410);
});

test('the DM can create an invite and list invite status; the token is shown once', async () => {
    const context = await buildFixture();
    const { agent } = await login(context.app);
    const base = campaignPath(context.campaign, '/invites');

    const created = await agent.post(base);
    assert.equal(created.status, 201);
    assert.match(created.body.invite.url, /\/invite\/[A-Za-z0-9_-]{43}$/);

    const token = created.body.invite.url.split('/invite/')[1];
    const stored = context.invites.dump();
    assert.equal(stored.length, 1);
    assert.equal(stored[0]._id, hashToken(token));
    assert.equal(JSON.stringify(stored).includes(token), false);

    const listed = await agent.get(base);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.invites.length, 1);
    assert.equal(listed.body.invites[0].status, 'active');
    assert.equal(JSON.stringify(listed.body).includes(token), false);
    assert.equal('url' in listed.body.invites[0], false);
});

test('a player cannot create or list invites', async () => {
    const context = await buildFixture();
    const { agent } = await login(context.app, { email: 'player@example.com' });
    const base = campaignPath(context.campaign, '/invites');

    assert.equal((await agent.post(base)).status, 403);
    assert.equal((await agent.get(base)).status, 403);
});

test('a super admin can create and list invites for a campaign they have not joined', async () => {
    const context = await buildFixture();
    await addUser(context.users, {
        email: 'admin@example.com',
        displayName: 'Super Admin',
        isSuperAdmin: true
    });
    const { agent } = await login(context.app, { email: 'admin@example.com' });
    const base = campaignPath(context.campaign, '/invites');

    const created = await agent.post(base);
    assert.equal(created.status, 201);
    assert.match(created.body.invite.url, /\/invite\/[A-Za-z0-9_-]{43}$/);

    const listed = await agent.get(base);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.invites.length, 1);
});

test('invite status reports used and expired', async () => {
    const context = await buildFixture();
    await insertInvite(context.invites, context.campaign._id, { usedAt: '2026-01-01T00:00:00.000Z' });
    await insertInvite(context.invites, context.campaign._id, {
        expiresAt: new Date(Date.now() - 1000).toISOString()
    });
    const { agent } = await login(context.app);

    const listed = await agent.get(campaignPath(context.campaign, '/invites'));
    assert.deepEqual(listed.body.invites.map((invite) => invite.status).sort(), ['expired', 'used']);
});

test('password registration creates an account, a player membership, and a session', async () => {
    const context = await buildFixture();
    const token = await insertInvite(context.invites, context.campaign._id);

    const response = await request(context.app)
        .post(`/api/invites/${token}/register`)
        .send({ displayName: 'New Player', email: 'new@example.com', password: 'password123' });

    assert.equal(response.status, 201);
    assert.equal(response.body.user.email, 'new@example.com');
    assert.deepEqual(response.body.campaign, {
        id: context.campaign._id,
        slug: 'naxxar',
        name: 'Naxxar',
        role: 'player'
    });
    assert.equal(response.body.campaigns.length, 1);
    assert.match(response.headers['set-cookie'][0], /naxxar_session=/);

    const user = await context.users.findOne({ emailNormalized: 'new@example.com' });
    assert.equal(user.passwordHash, 'fake:password123');
    const membership = await context.memberships.findOne({ _id: `${context.campaign._id}:${user._id}` });
    assert.equal(membership.role, 'player');
    assert.equal((await context.invites.findOne({ _id: hashToken(token) })).usedBy, user._id);
});

test('registration with an existing email returns 409 and leaves the invite unused', async () => {
    const context = await buildFixture();
    const token = await insertInvite(context.invites, context.campaign._id);

    const response = await request(context.app)
        .post(`/api/invites/${token}/register`)
        .send({ displayName: 'Impostor', email: 'player@example.com', password: 'password123' });

    assert.equal(response.status, 409);
    assert.equal((await context.invites.findOne({ _id: hashToken(token) })).usedAt, null);
});

test('registration validates the display name, email and password before consuming the invite', async () => {
    const context = await buildFixture();
    const token = await insertInvite(context.invites, context.campaign._id);
    const base = `/api/invites/${token}/register`;

    assert.equal(
        (await request(context.app).post(base).send({ displayName: '', email: 'a@b.co', password: 'password123' }))
            .status,
        400
    );
    assert.equal(
        (await request(context.app).post(base).send({ displayName: 'A', email: 'nope', password: 'password123' }))
            .status,
        400
    );
    assert.equal(
        (await request(context.app).post(base).send({ displayName: 'A', email: 'a@b.co', password: 'short' })).status,
        400
    );
    assert.equal((await context.invites.findOne({ _id: hashToken(token) })).usedAt, null);
});

test('a used or expired invite cannot register an account', async () => {
    const context = await buildFixture();
    const used = await insertInvite(context.invites, context.campaign._id, { usedAt: '2026-01-01T00:00:00.000Z' });
    const expired = await insertInvite(context.invites, context.campaign._id, {
        expiresAt: new Date(Date.now() - 1000).toISOString()
    });

    for (const token of [used, expired]) {
        const response = await request(context.app)
            .post(`/api/invites/${token}/register`)
            .send({ displayName: 'New', email: 'new@example.com', password: 'password123' });
        assert.equal(response.status, 410);
    }
    assert.equal(context.users.dump().length, 2);
});

test('two parallel registrations consume the invite exactly once', async () => {
    const context = await buildFixture();
    const token = await insertInvite(context.invites, context.campaign._id);

    const responses = await Promise.all(
        ['first@example.com', 'second@example.com'].map((email) =>
            request(context.app)
                .post(`/api/invites/${token}/register`)
                .send({ displayName: 'Racer', email, password: 'password123' })
        )
    );

    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 410]);
});

test('Google registration creates a passwordless user and a player membership', async () => {
    const context = await buildFixture({ withGoogle: true });
    const token = await insertInvite(context.invites, context.campaign._id);

    const response = await request(context.app).post(`/api/invites/${token}/google`).send({ credential: 'token' });
    assert.equal(response.status, 201);

    const user = await context.users.findOne({ googleSub: 'google-sub-1' });
    assert.equal(user.passwordHash, null);
    assert.equal(user.email, 'google@example.com');
    const membership = await context.memberships.findOne({ _id: `${context.campaign._id}:${user._id}` });
    assert.equal(membership.role, 'player');
});

test('Google registration links an existing password account with no googleSub', async () => {
    const context = await buildFixture({ withGoogle: true });
    const existing = await addUser(context.users, { email: 'google@example.com', displayName: 'Existing' });
    const token = await insertInvite(context.invites, context.campaign._id);

    const response = await request(context.app).post(`/api/invites/${token}/google`).send({ credential: 'token' });
    assert.equal(response.status, 201);
    assert.equal(response.body.user.id, existing._id);
    assert.equal((await context.users.findOne({ _id: existing._id })).googleSub, 'google-sub-1');
});

test('Google registration for an existing member signs in without burning the invite', async () => {
    const context = await buildFixture({ withGoogle: true });
    const member = await addUser(context.users, {
        email: 'google@example.com',
        googleSub: 'google-sub-1',
        displayName: 'Already Here'
    });
    await context.memberships.insertOne({
        _id: `${context.campaign._id}:${member._id}`,
        campaignId: context.campaign._id,
        userId: member._id,
        role: 'player',
        createdAt: new Date().toISOString()
    });
    const token = await insertInvite(context.invites, context.campaign._id);

    const response = await request(context.app).post(`/api/invites/${token}/google`).send({ credential: 'token' });
    assert.equal(response.status, 200);
    assert.equal((await context.invites.findOne({ _id: hashToken(token) })).usedAt, null);
});

test('Google registration without configuration is a 503 before consuming the invite', async () => {
    const context = await buildFixture();
    const token = await insertInvite(context.invites, context.campaign._id);

    const response = await request(context.app).post(`/api/invites/${token}/google`).send({ credential: 'token' });
    assert.equal(response.status, 503);
    assert.equal((await context.invites.findOne({ _id: hashToken(token) })).usedAt, null);
});

test('an existing user accepts an invite and becomes a player', async () => {
    const context = await buildFixture();
    const newcomer = await addUser(context.users, { email: 'newcomer@example.com', displayName: 'Newcomer' });
    const token = await insertInvite(context.invites, context.campaign._id);

    const agent = request.agent(context.app);
    await agent.post('/api/auth/login').send({ email: 'newcomer@example.com', password: 'password123' });
    const response = await agent.post(`/api/invites/${token}/accept`);

    assert.equal(response.status, 200);
    assert.equal(response.body.campaign.role, 'player');
    assert.equal(
        (await context.memberships.findOne({ _id: `${context.campaign._id}:${newcomer._id}` })).role,
        'player'
    );
    assert.equal((await context.invites.findOne({ _id: hashToken(token) })).usedAt !== null, true);
});

test('accepting as an existing member is idempotent and does not consume the invite', async () => {
    const context = await buildFixture();
    const token = await insertInvite(context.invites, context.campaign._id);
    const { agent } = await login(context.app, { email: 'player@example.com' });

    const response = await agent.post(`/api/invites/${token}/accept`);
    assert.equal(response.status, 200);
    assert.equal((await context.invites.findOne({ _id: hashToken(token) })).usedAt, null);
});

test('accept requires a session', async () => {
    const context = await buildFixture();
    const token = await insertInvite(context.invites, context.campaign._id);

    const response = await request(context.app).post(`/api/invites/${token}/accept`);
    assert.equal(response.status, 401);
});

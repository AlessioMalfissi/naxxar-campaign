import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { passThroughRateLimiters } from '../src/rate-limit.js';
import { createFakeCollection } from '../test-utils/fake-collection.mjs';
import { normalizeEmail } from '../src/users.js';

export const TEST_CONFIG = {
    port: 0,
    mongoUri: 'mongodb://127.0.0.1:27017',
    mongoDb: 'naxxar_test',
    staticDir: null,
    appOrigin: 'http://localhost:57571',
    appOriginConfigured: true,
    googleClientId: null,
    smtpUrl: null,
    mailFrom: 'Naxxar <test@example.com>',
    trustProxy: false,
    cookieSecure: false,
    nodeEnv: 'test',
    isProduction: false,
    inMemoryDb: false,
    devDmEmail: 'dm@naxxar.local',
    devDmPassword: 'app',
    devCampaignName: 'Naxxar'
};

// Fast, deterministic password service for route tests. The real Argon2 module is exercised in
// passwords.test.mjs.
export const fakePasswords = (overrides = {}) => ({
    hash: async (password) => `fake:${password}`,
    verify: async (hash, password) => hash === `fake:${password}`,
    verifyDummy: async () => false,
    isValidPassword: (value) => typeof value === 'string' && value.length >= 8 && value.length <= 128,
    ...overrides
});

export const buildApp = ({ collections: overrides = {}, services = {}, config = {} } = {}) => {
    const collections = {
        users: createFakeCollection([]),
        sessions: createFakeCollection([]),
        campaigns: createFakeCollection([]),
        memberships: createFakeCollection([]),
        invites: createFakeCollection([]),
        passwordResets: createFakeCollection([]),
        entries: createFakeCollection([]),
        inventory: createFakeCollection([]),
        purses: createFakeCollection([]),
        combat: createFakeCollection([]),
        ...overrides
    };

    const combatLive = services.combatLiveFactory
        ? services.combatLiveFactory(collections)
        : (services.combatLive ?? null);

    const app = createApp(collections, {
        config: { ...TEST_CONFIG, ...config },
        passwords: services.passwords ?? fakePasswords(),
        google: services.google ?? null,
        mailer: services.mailer ?? { sendPasswordReset: async () => undefined },
        combatLive,
        rateLimiters: services.rateLimiters ?? passThroughRateLimiters
    });

    return { app, combatLive, ...collections, collections };
};

export const addUser = async (
    users,
    {
        email = 'dm@example.com',
        displayName = 'Dungeon Master',
        password = 'password123',
        googleSub = null,
        isSuperAdmin = false
    } = {}
) => {
    const now = new Date().toISOString();
    const user = {
        _id: randomUUID(),
        email,
        emailNormalized: normalizeEmail(email),
        displayName,
        passwordHash: password === null ? null : `fake:${password}`,
        googleSub,
        ...(isSuperAdmin ? { isSuperAdmin: true } : {}),
        createdAt: now,
        updatedAt: now
    };

    await users.insertOne(user);
    return user;
};

export const addMember = async (memberships, campaign, user, role = 'player') => {
    const membership = {
        _id: `${campaign._id}:${user._id}`,
        campaignId: campaign._id,
        userId: user._id,
        role,
        createdAt: new Date().toISOString()
    };

    await memberships.insertOne(membership);
    return membership;
};

export const addCampaign = async (
    campaigns,
    memberships,
    { slug = 'naxxar', name = 'Naxxar', dm = null, players = [] } = {}
) => {
    const now = new Date().toISOString();
    const campaign = {
        _id: randomUUID(),
        slug,
        name,
        createdBy: dm?._id ?? null,
        createdAt: now,
        updatedAt: now
    };

    await campaigns.insertOne(campaign);
    if (dm !== null) {
        await addMember(memberships, campaign, dm, 'dm');
    }
    for (const player of players) {
        await addMember(memberships, campaign, player, 'player');
    }

    return campaign;
};

// A DM + campaign + one player, the common fixture for campaign-scoped tests.
export const buildCampaignFixture = async () => {
    const context = buildApp();
    const dm = await addUser(context.users, { email: 'dm@example.com', displayName: 'Dungeon Master' });
    const player = await addUser(context.users, {
        email: 'player@example.com',
        displayName: 'Player One',
        password: 'password123'
    });
    const campaign = await addCampaign(context.campaigns, context.memberships, {
        dm,
        players: [player]
    });

    return { ...context, dm, player, campaign };
};

export const login = async (app, { email = 'dm@example.com', password = 'password123' } = {}) => {
    const agent = request.agent(app);
    const response = await agent.post('/api/auth/login').send({ email, password });
    if (response.status !== 200) {
        throw new Error(`Login failed: ${response.status} ${JSON.stringify(response.body)}`);
    }

    return { agent, body: response.body };
};

export const campaignPath = (campaign, suffix = '') => `/api/campaigns/${campaign.slug}${suffix}`;

export const makeEntry = (campaignId, section, slug, overrides = {}) => ({
    _id: `${campaignId}:${section}:${slug}`,
    campaignId,
    section,
    slug,
    path: `assets/codex/${section}/${slug}.md`,
    title: overrides.title ?? slug,
    status: overrides.status ?? 'Alive',
    tags: overrides.tags ?? [],
    favourite: false,
    visibility: overrides.visibility ?? 'revealed',
    author: 'DM',
    updatedAt: '2026-08-25T00:00:00.000Z',
    fields: {},
    excerpt: overrides.excerpt ?? '',
    body: overrides.body ?? `# ${overrides.title ?? slug}\n\nBody.`,
    ...overrides
});

import { randomUUID } from 'node:crypto';

import { createInMemoryCollection } from './in-memory-collection.js';
import { hashPassword } from './passwords.js';
import { buildSeedEntries } from './seed.js';
import { slugify } from './slugify.js';

// Dev-only stand-in for connectToMongo: same collection API, seeded from server/seed-data so the
// app has content on first load. Everything is lost when the dev server restarts.
export const createInMemoryDb = async ({
    devDmEmail = 'dm@naxxar.local',
    devDmPassword = 'app',
    devCampaignName = 'Naxxar',
    now = new Date().toISOString()
} = {}) => {
    const userId = randomUUID();
    const campaignId = randomUUID();
    const slug = slugify(devCampaignName) || 'naxxar';

    const user = {
        _id: userId,
        email: devDmEmail,
        emailNormalized: devDmEmail.trim().toLowerCase(),
        displayName: 'Dungeon Master',
        passwordHash: await hashPassword(devDmPassword),
        googleSub: null,
        createdAt: now,
        updatedAt: now
    };
    const campaign = {
        _id: campaignId,
        slug,
        name: devCampaignName,
        createdBy: userId,
        createdAt: now,
        updatedAt: now
    };
    const membership = {
        _id: `${campaignId}:${userId}`,
        campaignId,
        userId,
        role: 'dm',
        createdAt: now
    };

    return {
        users: createInMemoryCollection([user]),
        sessions: createInMemoryCollection(),
        campaigns: createInMemoryCollection([campaign]),
        memberships: createInMemoryCollection([membership]),
        invites: createInMemoryCollection(),
        passwordResets: createInMemoryCollection(),
        entries: createInMemoryCollection(await buildSeedEntries(campaignId)),
        inventory: createInMemoryCollection(),
        purses: createInMemoryCollection(),
        combat: createInMemoryCollection(),
        devUser: { email: devDmEmail, password: devDmPassword, campaignSlug: slug }
    };
};

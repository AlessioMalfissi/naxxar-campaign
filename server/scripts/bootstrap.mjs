import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { loadConfig } from '../src/config.js';
import { connectToMongo } from '../src/db.js';
import { hashPassword, isValidPassword } from '../src/passwords.js';
import { slugify } from '../src/slugify.js';
import { normalizeEmail } from '../src/users.js';

const readFlag = (name) => {
    const index = process.argv.indexOf(`--${name}`);
    return index === -1 ? null : process.argv[index + 1] ?? null;
};

const readPassword = () => {
    const fromFlag = readFlag('password');
    if (fromFlag !== null) {
        return fromFlag;
    }

    const fromEnv = process.env.BOOTSTRAP_PASSWORD;
    if (typeof fromEnv === 'string' && fromEnv !== '') {
        return fromEnv;
    }

    return null;
};

const requireFlag = (name) => {
    const value = readFlag(name);
    if (value === null || value === '') {
        throw new Error(`--${name} is required.`);
    }

    return value;
};

const upsertMembership = async (memberships, { campaignId, userId, role }) => {
    const id = `${campaignId}:${userId}`;
    const existing = await memberships.findOne({ _id: id });
    if (existing !== null && existing.role !== role) {
        throw new Error(`That user already has the "${existing.role}" role in this campaign.`);
    }
    if (existing !== null) {
        return false;
    }

    await memberships.insertOne({
        _id: id,
        campaignId,
        userId,
        role,
        createdAt: new Date().toISOString()
    });
    return true;
};

const run = async () => {
    const command = process.argv[2];
    const config = loadConfig();
    const db = await connectToMongo({ uri: config.mongoUri, dbName: config.mongoDb });

    try {
        if (command === 'user') {
            const email = requireFlag('email');
            const name = requireFlag('name');
            const password = readPassword();
            if (password !== null && !isValidPassword(password)) {
                throw new Error('Password must be 8-128 characters.');
            }

            const existing = await db.users.findOne({ emailNormalized: normalizeEmail(email) });
            const now = new Date().toISOString();

            if (existing === null) {
                await db.users.insertOne({
                    _id: randomUUID(),
                    email: email.trim(),
                    emailNormalized: normalizeEmail(email),
                    displayName: name.trim(),
                    passwordHash: password === null ? null : await hashPassword(password),
                    googleSub: null,
                    createdAt: now,
                    updatedAt: now
                });
                console.log(`Created user ${email}.`);
                return;
            }

            const updated = {
                ...existing,
                displayName: name.trim(),
                passwordHash: password === null ? existing.passwordHash : await hashPassword(password),
                updatedAt: now
            };
            await db.users.replaceOne({ _id: existing._id }, updated);
            if (password !== null) {
                await db.sessions.deleteMany({ userId: existing._id });
                console.log(`Updated ${email} and revoked its sessions.`);
            } else {
                console.log(`Updated ${email}.`);
            }
            return;
        }

        if (command === 'campaign') {
            const slug = slugify(requireFlag('slug'));
            const name = requireFlag('name');
            const dmEmail = requireFlag('dm-email');
            const user = await db.users.findOne({ emailNormalized: normalizeEmail(dmEmail) });
            if (user === null) {
                throw new Error(`No user exists for ${dmEmail}. Create it with "user" first.`);
            }

            let campaign = await db.campaigns.findOne({ slug });
            const now = new Date().toISOString();
            if (campaign === null) {
                campaign = {
                    _id: randomUUID(),
                    slug,
                    name: name.trim(),
                    createdBy: user._id,
                    createdAt: now,
                    updatedAt: now
                };
                await db.campaigns.insertOne(campaign);
                console.log(`Created campaign ${slug}.`);
            } else {
                console.log(`Campaign ${slug} already exists.`);
            }

            const added = await upsertMembership(db.memberships, {
                campaignId: campaign._id,
                userId: user._id,
                role: 'dm'
            });
            console.log(added ? `Made ${dmEmail} the DM of ${slug}.` : `${dmEmail} is already the DM of ${slug}.`);
            return;
        }

        if (command === 'reset-password') {
            const email = requireFlag('email');
            const password = readPassword();
            if (password === null || !isValidPassword(password)) {
                throw new Error('Password must be 8-128 characters (use --password or BOOTSTRAP_PASSWORD).');
            }

            const user = await db.users.findOne({ emailNormalized: normalizeEmail(email) });
            if (user === null) {
                throw new Error(`No user exists for ${email}.`);
            }

            await db.users.replaceOne(
                { _id: user._id },
                {
                    ...user,
                    passwordHash: await hashPassword(password),
                    updatedAt: new Date().toISOString()
                }
            );
            const revoked = await db.sessions.deleteMany({ userId: user._id });
            console.log(`Reset the password for ${email} and revoked ${revoked.deletedCount ?? 0} session(s).`);
            return;
        }

        throw new Error(
            'Usage: bootstrap.mjs user|campaign|reset-password --flags... (see server/README.md)'
        );
    } finally {
        await db.client.close();
    }
};

await run().catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
});

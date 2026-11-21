import { MongoClient } from 'mongodb';

export const connectToMongo = async ({ uri, dbName }) => {
    const client = new MongoClient(uri);
    await client.connect();

    const db = client.db(dbName);

    const users = db.collection('users');
    await users.createIndex({ emailNormalized: 1 }, { unique: true });
    await users.createIndex({ googleSub: 1 }, { unique: true, partialFilterExpression: { googleSub: { $type: 'string' } } });

    const sessions = db.collection('sessions');
    await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await sessions.createIndex({ userId: 1 });

    const campaigns = db.collection('campaigns');
    await campaigns.createIndex({ slug: 1 }, { unique: true });

    const memberships = db.collection('memberships');
    await memberships.createIndex({ campaignId: 1 });
    await memberships.createIndex({ userId: 1 });

    const invites = db.collection('invites');
    await invites.createIndex({ campaignId: 1, createdAt: -1 });

    const passwordResets = db.collection('password_resets');
    await passwordResets.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await passwordResets.createIndex({ userId: 1 });

    const entries = db.collection('entries');
    await entries.createIndex({ campaignId: 1, section: 1, status: 1 });
    await entries.createIndex({ campaignId: 1, tags: 1 });

    const inventory = db.collection('inventory');
    await inventory.createIndex({ campaignId: 1, name: 1 });

    const purses = db.collection('purses');
    const combat = db.collection('combat');

    return {
        client,
        users,
        sessions,
        campaigns,
        memberships,
        invites,
        passwordResets,
        entries,
        inventory,
        purses,
        combat
    };
};

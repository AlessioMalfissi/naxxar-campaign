import 'dotenv/config';

import { loadConfig } from '../src/config.js';
import { connectToMongo } from '../src/db.js';

// One-shot migration of the legacy, campaign-less documents into a single campaign. Mongo `_id`
// values are immutable, so entries/purses/combat are inserted under their new id and the old one is
// deleted. Inventory keeps its UUID and only gains `campaignId`.

const readFlag = (name) => {
    const index = process.argv.indexOf(`--${name}`);
    return index === -1 ? null : process.argv[index + 1] ?? null;
};

const hasFlag = (name) => process.argv.includes(`--${name}`);

const migrateCollection = async ({ collection, campaignId, buildId, label, dryRun }) => {
    const docs = await collection.find({ campaignId: { $exists: false } }).toArray();
    let migrated = 0;
    let skipped = 0;

    for (const doc of docs) {
        const nextId = buildId(doc);
        if (nextId === null) {
            skipped += 1;
            continue;
        }

        if (doc._id === nextId) {
            if (!dryRun) {
                await collection.replaceOne({ _id: doc._id }, { ...doc, campaignId });
            }
            migrated += 1;
            continue;
        }

        if (!dryRun) {
            const existing = await collection.findOne({ _id: nextId });
            if (existing === null) {
                const { _id, ...rest } = doc;
                await collection.insertOne({ _id: nextId, ...rest, campaignId });
            }
            await collection.deleteOne({ _id: doc._id });
        }
        migrated += 1;
    }

    console.log(`${label}: scanned ${docs.length}, migrated ${migrated}, skipped ${skipped}${dryRun ? ' (dry run)' : ''}`);
};

const run = async () => {
    const slug = readFlag('campaign');
    if (slug === null || slug === '') {
        throw new Error('Pass --campaign <slug>.');
    }
    const dryRun = hasFlag('dry-run');
    const config = loadConfig();
    const db = await connectToMongo({ uri: config.mongoUri, dbName: config.mongoDb });

    try {
        const campaign = await db.campaigns.findOne({ slug });
        if (campaign === null) {
            throw new Error(`Campaign "${slug}" does not exist. Run bootstrap.mjs campaign first.`);
        }
        const campaignId = campaign._id;

        await migrateCollection({
            collection: db.entries,
            campaignId,
            label: 'entries',
            dryRun,
            buildId: (doc) =>
                typeof doc.section === 'string' && typeof doc.slug === 'string'
                    ? `${campaignId}:${doc.section}:${doc.slug}`
                    : null
        });

        await migrateCollection({
            collection: db.inventory,
            campaignId,
            label: 'inventory',
            dryRun,
            buildId: (doc) => doc._id
        });

        await migrateCollection({
            collection: db.purses,
            campaignId,
            label: 'purses',
            dryRun,
            buildId: (doc) => {
                const owner = typeof doc.owner === 'string' && doc.owner !== '' ? doc.owner : doc._id;
                return typeof owner === 'string' && owner !== '' ? `${campaignId}:${owner}` : null;
            }
        });

        await migrateCollection({
            collection: db.combat,
            campaignId,
            label: 'combat',
            dryRun,
            buildId: () => `${campaignId}:current`
        });

        if (dryRun) {
            console.log('Dry run complete - no documents were written.');
        }
    } finally {
        await db.client.close();
    }
};

await run().catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
});

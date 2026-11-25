import 'dotenv/config';

import { loadConfig } from '../src/config.js';
import { connectToMongo } from '../src/db.js';
import { buildSeedEntries } from '../src/seed.js';
import { normalizeEmail } from '../src/users.js';

const readFlag = (name) => {
    const index = process.argv.indexOf(`--${name}`);
    return index === -1 ? null : (process.argv[index + 1] ?? null);
};

const seed = async () => {
    const config = loadConfig();
    const { client, campaigns, memberships, entries, users } = await connectToMongo({
        uri: config.mongoUri,
        dbName: config.mongoDb
    });

    try {
        const slug = readFlag('campaign');
        const dmEmail = readFlag('dm-email');

        let campaign = null;
        if (slug !== null) {
            campaign = await campaigns.findOne({ slug });
        } else if (dmEmail !== null) {
            const user = await users.findOne({ emailNormalized: normalizeEmail(dmEmail) });
            const membership = user === null ? null : await memberships.findOne({ userId: user._id, role: 'dm' });
            if (membership !== null) {
                campaign = await campaigns.findOne({ _id: membership.campaignId });
            }
        } else {
            throw new Error('Pass --campaign <slug> (or --dm-email <email> to pick that user’s DM campaign).');
        }

        if (campaign === null) {
            throw new Error(
                slug === null
                    ? `No DM campaign found for ${dmEmail}. Run bootstrap.mjs campaign first.`
                    : `Campaign "${slug}" does not exist. Create it with bootstrap.mjs campaign first.`
            );
        }

        const docs = await buildSeedEntries(campaign._id);
        for (const entry of docs) {
            await entries.replaceOne({ _id: entry._id }, entry, { upsert: true });
        }

        console.log(`Seeded ${docs.length} entries into campaign "${campaign.slug}" (${config.mongoDb}.entries).`);
    } finally {
        await client.close();
    }
};

await seed().catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
});

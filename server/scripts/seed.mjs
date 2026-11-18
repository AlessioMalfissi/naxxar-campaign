import 'dotenv/config';

import { loadConfig } from '../src/config.js';
import { connectToMongo } from '../src/db.js';
import { buildSeedEntries } from '../src/seed.js';

const seed = async () => {
    const config = loadConfig();
    const { client, collection } = await connectToMongo({ uri: config.mongoUri, dbName: config.mongoDb });

    try {
        const entries = await buildSeedEntries();
        for (const entry of entries) {
            await collection.replaceOne({ _id: entry._id }, entry, { upsert: true });
        }

        console.log(`Seeded ${entries.length} entries into ${config.mongoDb}.entries`);
    } finally {
        await client.close();
    }
};

await seed();

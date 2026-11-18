import 'dotenv/config';

import { createApp } from './app.js';
import { createCombatLive } from './combat-live.js';
import { loadConfig } from './config.js';
import { connectToMongo } from './db.js';
import { createInMemoryDb } from './in-memory-db.js';

const config = loadConfig();

if (config.appPassword === null) {
    console.error('APP_PASSWORD must be set - see server/.env.example.');
    process.exit(1);
}

const start = async () => {
    if (config.inMemoryDb) {
        console.warn('[dev] In-memory database seeded from server/seed-data - changes reset on restart.');
    }

    const { collection, inventoryCollection, pursesCollection, combatCollection } = config.inMemoryDb
        ? await createInMemoryDb()
        : await connectToMongo({
              uri: config.mongoUri,
              dbName: config.mongoDb
          });
    const combatLive = createCombatLive(combatCollection);
    const app = createApp(
        {
            entries: collection,
            inventory: inventoryCollection,
            purses: pursesCollection,
            combat: combatCollection
        },
        {
            staticDir: config.staticDir,
            appPassword: config.appPassword,
            sessionSecret: config.sessionSecret,
            combatLive
        }
    );

    const server = app.listen(config.port, () => {
        console.log(`naxxar-campaign API listening on http://localhost:${config.port}`);
    });
    // Same fallback createApp applies, so the socket accepts exactly the cookies the API does.
    combatLive.attach(server, { sessionSecret: config.sessionSecret || config.appPassword });
};

start().catch((error) => {
    console.error('Failed to start the naxxar-campaign API', error);
    process.exitCode = 1;
});

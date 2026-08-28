import 'dotenv/config';

import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectToMongo } from './db.js';

const config = loadConfig();

if (config.appPassword === null) {
    console.error('APP_PASSWORD must be set - see server/.env.example.');
    process.exit(1);
}

const start = async () => {
    const { collection, inventoryCollection, pursesCollection } = await connectToMongo({
        uri: config.mongoUri,
        dbName: config.mongoDb
    });
    const app = createApp(
        { entries: collection, inventory: inventoryCollection, purses: pursesCollection },
        {
            staticDir: config.staticDir,
            appPassword: config.appPassword,
            sessionSecret: config.sessionSecret
        }
    );

    app.listen(config.port, () => {
        console.log(`naxxar-campaign API listening on http://localhost:${config.port}`);
    });
};

start().catch((error) => {
    console.error('Failed to start the naxxar-campaign API', error);
    process.exitCode = 1;
});

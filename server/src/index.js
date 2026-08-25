import 'dotenv/config';

import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectToMongo } from './db.js';

const config = loadConfig();

const start = async () => {
    const { collection } = await connectToMongo({ uri: config.mongoUri, dbName: config.mongoDb });
    const app = createApp(collection, { staticDir: config.staticDir });

    app.listen(config.port, () => {
        console.log(`naxxar-campaign API listening on http://localhost:${config.port}`);
    });
};

start().catch((error) => {
    console.error('Failed to start the naxxar-campaign API', error);
    process.exitCode = 1;
});

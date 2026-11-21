// Loaded only by the `dev` script, before src/index.js. A real .env file (read here first) or the
// shell environment always wins; these values only fill the gap on a fresh clone, where there is no
// server/.env yet. The port matches proxy.conf.json so `pn run dev` works out of the box.
import 'dotenv/config';

const defaults = {
    PORT: '3000'
};

for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]) {
        process.env[key] = value;
        console.warn(`[dev] ${key} is not set - using the local development value "${value}".`);
    }
}

// No URI means there is no Mongo to reach, so fall back to the in-memory database instead of failing
// on 127.0.0.1:27017. Set MONGODB_URI in server/.env to use a real database in dev, or
// DEV_IN_MEMORY_DB=0 to force a local Mongo.
if (!process.env.MONGODB_URI && process.env.DEV_IN_MEMORY_DB === undefined) {
    process.env.DEV_IN_MEMORY_DB = '1';
    console.warn('[dev] MONGODB_URI is not set - falling back to the in-memory database.');
}

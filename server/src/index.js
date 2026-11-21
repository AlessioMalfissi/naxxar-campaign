import 'dotenv/config';

import { createApp } from './app.js';
import { createCombatLive } from './combat-live.js';
import { loadConfig, validateProductionConfig } from './config.js';
import { connectToMongo } from './db.js';
import { createGoogleVerifier } from './google.js';
import { createInMemoryDb } from './in-memory-db.js';
import { createMailer } from './mailer.js';
import { createPasswordService } from './passwords.js';
import { createRateLimiters } from './rate-limit.js';
import { resolveSession } from './sessions.js';

const config = loadConfig();

const missing = validateProductionConfig(config);
if (missing.length > 0) {
    console.error(`Production requires ${missing.join(' and ')} - see server/.env.example.`);
    process.exit(1);
}

const passwords = createPasswordService();
const google = config.googleClientId === null ? null : createGoogleVerifier({ clientId: config.googleClientId });
const mailer = createMailer({ smtpUrl: config.smtpUrl, mailFrom: config.mailFrom, nodeEnv: config.nodeEnv });
const rateLimiters = createRateLimiters();

const start = async () => {
    if (config.inMemoryDb) {
        console.warn('[dev] In-memory database seeded from server/seed-data - changes reset on restart.');
    }

    const db = config.inMemoryDb
        ? await createInMemoryDb({
              devDmEmail: config.devDmEmail,
              devDmPassword: config.devDmPassword,
              devCampaignName: config.devCampaignName
          })
        : await connectToMongo({ uri: config.mongoUri, dbName: config.mongoDb });

    if (db.devUser !== undefined) {
        console.warn(
            `[dev] Sign in with ${db.devUser.email} / ${db.devUser.password} (campaign "${db.devUser.campaignSlug}").`
        );
    }

    const combatLive = createCombatLive(db.combat, {
        appOrigin: config.appOrigin,
        resolveAccess: async (req, campaignSlug) => {
            const auth = await resolveSession(req, { sessions: db.sessions, users: db.users });
            if (auth === null) {
                return { status: 401, reason: 'Unauthorized' };
            }

            const campaign = await db.campaigns.findOne({ slug: campaignSlug });
            if (campaign === null) {
                return { status: 404, reason: 'Not Found' };
            }

            const membership = await db.memberships.findOne({ _id: `${campaign._id}:${auth.user._id}` });
            if (membership === null) {
                return { status: 404, reason: 'Not Found' };
            }

            return { campaignId: campaign._id };
        }
    });

    const app = createApp(db, { config, passwords, google, mailer, combatLive, rateLimiters });

    const server = app.listen(config.port, () => {
        console.log(`naxxar-campaign API listening on http://localhost:${config.port}`);
    });
    combatLive.attach(server);
};

start().catch((error) => {
    console.error('Failed to start the naxxar-campaign API', error);
    process.exitCode = 1;
});

import express from 'express';
import { join, resolve } from 'node:path';

import { createAuthRouter } from './auth.js';
import { createCampaignsRouter, createCampaignRouter } from './campaigns.js';
import { HttpError } from './http-error.js';
import { createInvitesRouter } from './invites.js';
import { passThroughRateLimiters } from './rate-limit.js';
import { loadSession, originCheck, requireAuth } from './sessions.js';

export const createApp = (
    { users, sessions, campaigns, memberships, invites, passwordResets, entries, inventory, purses, combat },
    { config, passwords, google = null, mailer = null, combatLive = null, rateLimiters = passThroughRateLimiters } = {}
) => {
    if (config === undefined || config === null || typeof config.appOrigin !== 'string') {
        throw new Error('createApp requires a config with an appOrigin.');
    }
    if (passwords === undefined || passwords === null) {
        throw new Error('createApp requires a password service.');
    }

    const app = express();

    if (config.trustProxy) {
        app.set('trust proxy', config.trustProxy);
    }

    app.use(express.json());
    app.use(originCheck(config.appOrigin));
    app.use(loadSession({ sessions, users }));

    app.get('/api/config', (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json({ googleClientId: config.googleClientId ?? null });
    });

    app.use(
        '/api/auth',
        createAuthRouter({
            users,
            sessions,
            passwordResets,
            passwords,
            google,
            mailer,
            memberships,
            campaigns,
            config,
            rateLimiters
        })
    );
    app.use(
        '/api/invites',
        createInvitesRouter({
            invites,
            users,
            campaigns,
            memberships,
            sessions,
            passwords,
            google,
            config,
            rateLimiters,
            requireAuth
        })
    );
    app.use('/api/campaigns', requireAuth, createCampaignsRouter({ campaigns, memberships }));
    app.use(
        '/api/campaigns/:campaignSlug',
        requireAuth,
        createCampaignRouter({
            campaigns,
            memberships,
            invites,
            users,
            entries,
            inventory,
            purses,
            combat,
            config,
            combatLive
        })
    );

    if (config.staticDir !== null && config.staticDir !== undefined) {
        const absoluteStaticDir = resolve(config.staticDir);
        app.use(express.static(absoluteStaticDir));
        app.get(/^(?!\/api\/).*/, (req, res) => {
            res.sendFile(join(absoluteStaticDir, 'index.html'));
        });
    }

    app.use((req, res) => {
        res.status(404).json({ error: 'Not found.' });
    });

    // Express only recognizes this as error-handling middleware because it declares 4 params.
    app.use((error, req, res, next) => {
        const status = error instanceof HttpError ? error.status : 500;
        if (status === 500) {
            console.error(error);
        }

        res.status(status).json({ error: status === 500 ? 'Something went wrong.' : error.message });
    });

    return app;
};

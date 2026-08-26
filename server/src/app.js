import cors from 'cors';
import express from 'express';
import { join, resolve } from 'node:path';

import { createAuthRouter, requireAuth } from './auth.js';
import { createEntriesRouter } from './entries.js';
import { HttpError } from './http-error.js';

export const createApp = (collection, { staticDir = null, appPassword, sessionSecret } = {}) => {
    if (typeof appPassword !== 'string' || appPassword === '') {
        throw new Error('createApp requires a non-empty appPassword.');
    }

    const secret = typeof sessionSecret === 'string' && sessionSecret !== '' ? sessionSecret : appPassword;

    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use('/api/auth', createAuthRouter({ appPassword, sessionSecret: secret }));
    app.use('/api/entries', requireAuth(secret), createEntriesRouter(collection));

    if (staticDir !== null) {
        const absoluteStaticDir = resolve(staticDir);
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

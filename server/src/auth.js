import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';

import { HttpError } from './http-error.js';

const COOKIE_NAME = 'naxxar_session';
const SESSION_VALUE = 'authenticated';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const sign = (value, secret) => createHmac('sha256', secret).update(value).digest('hex');

const buildCookieValue = (secret) => `${SESSION_VALUE}.${sign(SESSION_VALUE, secret)}`;

const safeEqual = (a, b) => {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};

const isValidCookie = (raw, secret) => {
    if (typeof raw !== 'string') {
        return false;
    }

    const [value, signature] = raw.split('.');
    return value === SESSION_VALUE && typeof signature === 'string' && safeEqual(signature, sign(SESSION_VALUE, secret));
};

const parseCookies = (header) => {
    const cookies = {};
    if (typeof header !== 'string') {
        return cookies;
    }

    for (const part of header.split(';')) {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }

        cookies[part.slice(0, separatorIndex).trim()] = decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }

    return cookies;
};

const passwordMatches = (candidate, expected) =>
    typeof candidate === 'string' && candidate !== '' && safeEqual(candidate, expected);

export const createAuthRouter = ({ appPassword, sessionSecret }) => {
    const router = Router();

    router.post('/login', (req, res, next) => {
        try {
            const { password } = req.body ?? {};
            if (!passwordMatches(password, appPassword)) {
                throw new HttpError(401, 'Incorrect password.');
            }

            res.cookie(COOKIE_NAME, buildCookieValue(sessionSecret), {
                httpOnly: true,
                sameSite: 'lax',
                maxAge: MAX_AGE_MS
            });
            res.json({ authenticated: true });
        } catch (error) {
            next(error);
        }
    });

    router.post('/logout', (req, res) => {
        res.clearCookie(COOKIE_NAME);
        res.json({ authenticated: false });
    });

    router.get('/me', (req, res) => {
        res.json({ authenticated: isValidCookie(parseCookies(req.headers.cookie)[COOKIE_NAME], sessionSecret) });
    });

    return router;
};

export const requireAuth = (sessionSecret) => (req, res, next) => {
    if (!isValidCookie(parseCookies(req.headers.cookie)[COOKIE_NAME], sessionSecret)) {
        next(new HttpError(401, 'Sign in required.'));
        return;
    }

    next();
};

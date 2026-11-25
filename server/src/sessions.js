import { createHash, randomBytes } from 'node:crypto';

import { HttpError } from './http-error.js';

export const SESSION_COOKIE_NAME = 'naxxar_session';
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const parseCookies = (header) => {
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

export const createSessionToken = () => {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: hashToken(token) };
};

// Only well-formed tokens are hashed; the session/invite/reset id is always the hash, never the token.
export const hashToken = (token) => {
    if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
        return null;
    }

    const bytes = Buffer.from(token, 'base64url');
    if (bytes.length !== 32 || bytes.toString('base64url') !== token) {
        return null;
    }

    return createHash('sha256').update(token).digest('hex');
};

export const createSession = async (sessions, userId, { now = new Date() } = {}) => {
    const { token, tokenHash } = createSessionToken();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();
    const session = { _id: tokenHash, userId, createdAt, expiresAt };

    await sessions.insertOne(session);
    return { token, session };
};

export const setSessionCookie = (res, token, { secure = false } = {}) => {
    res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: SESSION_DURATION_MS
    });
};

export const clearSessionCookie = (res, { secure = false } = {}) => {
    res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
};

export const getSessionToken = (req) => parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME];

// The TTL index cleans up asynchronously, so every lookup also checks the expiry itself.
export const resolveSession = async (req, { sessions, users }) => {
    const token = getSessionToken(req);
    const tokenHash = hashToken(token);
    if (tokenHash === null) {
        return null;
    }

    const session = await sessions.findOne({ _id: tokenHash });
    if (session === null) {
        return null;
    }
    if (typeof session.expiresAt !== 'string' || Date.parse(session.expiresAt) <= Date.now()) {
        return null;
    }

    const user = await users.findOne({ _id: session.userId });
    if (user === null) {
        return null;
    }

    return { user, session };
};

export const loadSession =
    ({ sessions, users }) =>
    async (req, res, next) => {
        try {
            req.auth = await resolveSession(req, { sessions, users });
            next();
        } catch (error) {
            next(error);
        }
    };

export const requireAuth = (req, res, next) => {
    if (req.auth === null || req.auth === undefined) {
        next(new HttpError(401, 'Sign in required.'));
        return;
    }

    next();
};

export const revokeUserSessions = (sessions, userId) => sessions.deleteMany({ userId });

export const revokeSession = async (sessions, token) => {
    const tokenHash = hashToken(token);
    if (tokenHash === null) {
        return 0;
    }

    const result = await sessions.deleteOne({ _id: tokenHash });
    return result.deletedCount ?? 0;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Same-origin deployment: reject unsafe requests that explicitly come from another origin. Requests
// with neither Origin nor Sec-Fetch-Site (curl, supertest, some proxies) are allowed.
export const originCheck = (appOrigin) => (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
        next();
        return;
    }

    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin !== '') {
        if (origin === appOrigin) {
            next();
            return;
        }

        next(new HttpError(403, 'Cross-origin request rejected.'));
        return;
    }

    const fetchSite = req.headers['sec-fetch-site'];
    if (typeof fetchSite === 'string' && fetchSite !== '' && fetchSite !== 'same-origin' && fetchSite !== 'none') {
        next(new HttpError(403, 'Cross-origin request rejected.'));
        return;
    }

    next();
};

export const noStore = (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
};

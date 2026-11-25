import { Router } from 'express';

import { loadCampaignSummaries } from './campaigns.js';
import { HttpError } from './http-error.js';
import {
    clearSessionCookie,
    createSession,
    createSessionToken,
    getSessionToken,
    hashToken,
    noStore,
    revokeSession,
    revokeUserSessions,
    setSessionCookie
} from './sessions.js';
import { findUserByEmail, isValidEmail, normalizeEmail, setGoogleSub, setPasswordHash, toPublicUser } from './users.js';

export const PASSWORD_RESET_DURATION_MS = 60 * 60 * 1000;

const GENERIC_LOGIN_ERROR = 'Incorrect email or password.';
const GENERIC_GOOGLE_ERROR = 'Google sign-in failed.';

const readString = (value) => (typeof value === 'string' ? value.trim() : '');

const authPayload = async (user, { memberships, campaigns }) => ({
    user: toPublicUser(user),
    campaigns: await loadCampaignSummaries(user._id, { memberships, campaigns })
});

const startSession = async (res, sessions, user, { secure }) => {
    const { token } = await createSession(sessions, user._id);
    setSessionCookie(res, token, { secure });
};

export const createAuthRouter = ({
    users,
    sessions,
    passwordResets,
    passwords,
    google = null,
    mailer = null,
    memberships,
    campaigns,
    config,
    rateLimiters
}) => {
    const router = Router();
    router.use(noStore);

    router.post('/login', rateLimiters.login, async (req, res, next) => {
        try {
            const body = req.body ?? {};
            const email = readString(body.email);
            const password = typeof body.password === 'string' ? body.password : '';

            if (email === '' || password === '') {
                throw new HttpError(401, GENERIC_LOGIN_ERROR);
            }

            const user = await findUserByEmail(users, email);
            if (user === null || typeof user.passwordHash !== 'string' || user.passwordHash === '') {
                // Spend the same time as a real verification so timing does not reveal the account.
                await passwords.verifyDummy();
                throw new HttpError(401, GENERIC_LOGIN_ERROR);
            }

            const matches = await passwords.verify(user.passwordHash, password);
            if (!matches) {
                throw new HttpError(401, GENERIC_LOGIN_ERROR);
            }

            await startSession(res, sessions, user, { secure: config.cookieSecure });
            res.json(await authPayload(user, { memberships, campaigns }));
        } catch (error) {
            next(error);
        }
    });

    router.post('/google', rateLimiters.googleLogin, async (req, res, next) => {
        try {
            if (google === null || config.googleClientId === null) {
                throw new HttpError(503, 'Google sign-in is not configured.');
            }

            const credential = (req.body ?? {}).credential;
            if (typeof credential !== 'string' || credential === '') {
                throw new HttpError(401, GENERIC_GOOGLE_ERROR);
            }

            let payload;
            try {
                payload = await google.verify(credential);
            } catch {
                throw new HttpError(401, GENERIC_GOOGLE_ERROR);
            }
            if (!payload.emailVerified || !isValidEmail(payload.email)) {
                throw new HttpError(401, GENERIC_GOOGLE_ERROR);
            }

            let user = await users.findOne({ googleSub: payload.sub });
            if (user === null) {
                const byEmail = await findUserByEmail(users, payload.email);
                if (byEmail === null) {
                    // Login never creates accounts; registration happens only through an invite.
                    throw new HttpError(403, 'No account exists for this email. Ask your DM for an invite.');
                }
                if (byEmail.googleSub !== null && byEmail.googleSub !== payload.sub) {
                    throw new HttpError(409, 'This email is linked to another sign-in method.');
                }

                user = byEmail.googleSub === null ? await setGoogleSub(users, byEmail, payload.sub) : byEmail;
            }

            await startSession(res, sessions, user, { secure: config.cookieSecure });
            res.json(await authPayload(user, { memberships, campaigns }));
        } catch (error) {
            next(error);
        }
    });

    router.post('/logout', async (req, res, next) => {
        try {
            await revokeSession(sessions, getSessionToken(req));
            clearSessionCookie(res, { secure: config.cookieSecure });
            res.json({ ok: true });
        } catch (error) {
            next(error);
        }
    });

    router.get('/me', async (req, res, next) => {
        try {
            if (req.auth === null || req.auth === undefined) {
                res.json({ user: null, campaigns: [] });
                return;
            }

            res.json(await authPayload(req.auth.user, { memberships, campaigns }));
        } catch (error) {
            next(error);
        }
    });

    router.post('/forgot-password', rateLimiters.passwordReset, async (req, res, next) => {
        try {
            const email = readString((req.body ?? {}).email);
            if (isValidEmail(email)) {
                const user = await findUserByEmail(users, email);
                if (user !== null) {
                    const { token } = createSessionToken();
                    const now = new Date();
                    await passwordResets.insertOne({
                        _id: hashToken(token),
                        userId: user._id,
                        createdAt: now.toISOString(),
                        expiresAt: new Date(now.getTime() + PASSWORD_RESET_DURATION_MS).toISOString(),
                        usedAt: null
                    });

                    try {
                        await mailer?.sendPasswordReset({
                            to: user.email,
                            resetUrl: `${config.appOrigin}/reset-password/${token}`
                        });
                    } catch (error) {
                        // Delivery problems must not reveal whether the account exists.
                        console.error('[auth] could not send a password reset email', error);
                    }
                }
            }

            res.status(202).json({ ok: true });
        } catch (error) {
            next(error);
        }
    });

    router.post('/reset-password', rateLimiters.passwordReset, async (req, res, next) => {
        try {
            const body = req.body ?? {};
            const token = typeof body.token === 'string' ? body.token : '';
            const password = typeof body.password === 'string' ? body.password : '';
            const tokenHash = hashToken(token);

            if (!passwords.isValidPassword(password)) {
                throw new HttpError(400, 'Password must be 8-128 characters.');
            }
            if (tokenHash === null) {
                throw new HttpError(400, 'This reset link is invalid or has expired.');
            }

            const reset = await passwordResets.findOne({ _id: tokenHash });
            if (reset === null || reset.usedAt !== null) {
                throw new HttpError(400, 'This reset link is invalid or has expired.');
            }
            if (typeof reset.expiresAt !== 'string' || Date.parse(reset.expiresAt) <= Date.now()) {
                throw new HttpError(400, 'This reset link is invalid or has expired.');
            }

            // Burn the token first; if the update fails the user requests a new link, which is safer
            // than leaving a reusable token behind.
            const consumed = await passwordResets.replaceOne(
                { _id: tokenHash, usedAt: null },
                { ...reset, usedAt: new Date().toISOString() },
                { upsert: false }
            );
            if ((consumed.matchedCount ?? 0) === 0) {
                throw new HttpError(400, 'This reset link is invalid or has expired.');
            }

            const user = await users.findOne({ _id: reset.userId });
            if (user === null) {
                throw new HttpError(400, 'This reset link is invalid or has expired.');
            }

            await setPasswordHash(users, user, await passwords.hash(password));
            await passwordResets.deleteMany({ userId: user._id });
            await revokeUserSessions(sessions, user._id);

            res.json({ ok: true });
        } catch (error) {
            next(error);
        }
    });

    return router;
};

import { Router } from 'express';

import { loadCampaignSummaries, toCampaignSummary } from './campaigns.js';
import { HttpError } from './http-error.js';
import { createSession, createSessionToken, hashToken, noStore, setSessionCookie } from './sessions.js';
import {
    createUser,
    findUserByEmail,
    isValidDisplayName,
    isValidEmail,
    normalizeEmail,
    setGoogleSub,
    toPublicUser
} from './users.js';

export const INVITE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const createInviteToken = () => createSessionToken().token;

const loadInvite = async (invites, token) => {
    const tokenHash = hashToken(token);
    if (tokenHash === null) {
        throw new HttpError(404, 'Invite not found.');
    }

    const invite = await invites.findOne({ _id: tokenHash });
    if (invite === null) {
        throw new HttpError(404, 'Invite not found.');
    }
    if (invite.usedAt !== null) {
        throw new HttpError(410, 'This invite has already been used.');
    }
    if (typeof invite.expiresAt !== 'string' || Date.parse(invite.expiresAt) <= Date.now()) {
        throw new HttpError(410, 'This invite has expired.');
    }

    return { invite, tokenHash };
};

const consumeInvite = async (invites, invite, tokenHash, userId) => {
    const now = new Date().toISOString();
    const result = await invites.replaceOne(
        { _id: tokenHash, usedAt: null },
        { ...invite, usedAt: now, usedBy: userId },
        { upsert: false }
    );

    if ((result.matchedCount ?? 0) === 0) {
        throw new HttpError(410, 'This invite has already been used.');
    }

    return { ...invite, usedAt: now, usedBy: userId };
};

const isMember = async (memberships, campaignId, userId) =>
    (await memberships.findOne({ _id: `${campaignId}:${userId}` })) !== null;

const addPlayerMembership = async (memberships, campaignId, userId) => {
    const now = new Date().toISOString();
    await memberships.replaceOne(
        { _id: `${campaignId}:${userId}` },
        { _id: `${campaignId}:${userId}`, campaignId, userId, role: 'player', createdAt: now },
        { upsert: true }
    );
};

const requireCampaign = async (campaigns, campaignId) => {
    const campaign = await campaigns.findOne({ _id: campaignId });
    if (campaign === null) {
        throw new HttpError(404, 'Campaign not found.');
    }

    return campaign;
};

const authPayload = async (user, { memberships, campaigns }) => ({
    user: toPublicUser(user),
    campaigns: await loadCampaignSummaries(user._id, { memberships, campaigns })
});

const signIn = async (res, sessions, user, { secure }) => {
    const { token } = await createSession(sessions, user._id);
    setSessionCookie(res, token, { secure });
};

const displayNameFromGoogle = (payload, supplied) => {
    if (isValidDisplayName(supplied)) {
        return supplied.trim();
    }
    if (typeof payload.name === 'string' && payload.name.trim() !== '') {
        return payload.name.trim();
    }

    const localPart = normalizeEmail(payload.email).split('@')[0] ?? '';
    return localPart === '' ? 'Adventurer' : localPart;
};

export const createInvitesRouter = ({
    invites,
    users,
    campaigns,
    memberships,
    sessions,
    passwords,
    google = null,
    config,
    rateLimiters,
    requireAuth
}) => {
    const router = Router();
    router.use(noStore);

    router.get('/:token', rateLimiters.invite, async (req, res, next) => {
        try {
            const { invite } = await loadInvite(invites, req.params.token);
            const campaign = await requireCampaign(campaigns, invite.campaignId);

            res.json({
                campaignName: campaign.name,
                campaignSlug: campaign.slug,
                expiresAt: invite.expiresAt
            });
        } catch (error) {
            next(error);
        }
    });

    router.post('/:token/register', rateLimiters.invite, async (req, res, next) => {
        try {
            const { invite, tokenHash } = await loadInvite(invites, req.params.token);
            const campaign = await requireCampaign(campaigns, invite.campaignId);

            const body = req.body ?? {};
            const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
            const email = typeof body.email === 'string' ? body.email.trim() : '';
            const password = typeof body.password === 'string' ? body.password : '';

            if (!isValidDisplayName(displayName)) {
                throw new HttpError(400, 'Display name must be 1-80 characters.');
            }
            if (!isValidEmail(email)) {
                throw new HttpError(400, 'Enter a valid email address.');
            }
            if (!passwords.isValidPassword(password)) {
                throw new HttpError(400, 'Password must be 8-128 characters.');
            }

            if ((await findUserByEmail(users, email)) !== null) {
                throw new HttpError(409, 'An account already exists for this email. Sign in to join.');
            }

            // Consume before creating anything so two parallel registrations cannot both succeed.
            await consumeInvite(invites, invite, tokenHash, null);

            let user;
            try {
                user = await createUser(users, {
                    email,
                    displayName,
                    passwordHash: await passwords.hash(password)
                });
            } catch (error) {
                console.error('[invites] registration lost the unique-email race', error);
                throw new HttpError(409, 'An account already exists for this email. Sign in to join.');
            }

            await addPlayerMembership(memberships, campaign._id, user._id);
            await invites.replaceOne(
                { _id: tokenHash },
                { ...invite, usedAt: new Date().toISOString(), usedBy: user._id },
                { upsert: false }
            );
            await signIn(res, sessions, user, { secure: config.cookieSecure });

            res.status(201).json({
                ...(await authPayload(user, { memberships, campaigns })),
                campaign: toCampaignSummary(campaign, 'player')
            });
        } catch (error) {
            next(error);
        }
    });

    router.post('/:token/google', rateLimiters.invite, async (req, res, next) => {
        try {
            if (google === null || config.googleClientId === null) {
                throw new HttpError(503, 'Google sign-in is not configured.');
            }

            const { invite, tokenHash } = await loadInvite(invites, req.params.token);
            const campaign = await requireCampaign(campaigns, invite.campaignId);
            const credential = (req.body ?? {}).credential;
            if (typeof credential !== 'string' || credential === '') {
                throw new HttpError(400, 'A Google credential is required.');
            }

            let payload;
            try {
                payload = await google.verify(credential);
            } catch {
                throw new HttpError(401, 'Google sign-in failed.');
            }
            if (!payload.emailVerified || !isValidEmail(payload.email)) {
                throw new HttpError(401, 'Google sign-in failed.');
            }

            let user = await users.findOne({ googleSub: payload.sub });
            if (user === null) {
                user = await findUserByEmail(users, payload.email);
                if (user !== null && user.googleSub !== null && user.googleSub !== payload.sub) {
                    throw new HttpError(409, 'This email is linked to another sign-in method.');
                }
            }

            if (user !== null && (await isMember(memberships, campaign._id, user._id))) {
                await signIn(res, sessions, user, { secure: config.cookieSecure });
                res.json({
                    ...(await authPayload(user, { memberships, campaigns })),
                    campaign: toCampaignSummary(campaign, 'player')
                });
                return;
            }

            await consumeInvite(invites, invite, tokenHash, user?._id ?? null);

            if (user === null) {
                user = await createUser(users, {
                    email: payload.email,
                    displayName: displayNameFromGoogle(payload, (req.body ?? {}).displayName),
                    passwordHash: null,
                    googleSub: payload.sub
                });
            } else if (user.googleSub === null) {
                user = await setGoogleSub(users, user, payload.sub);
            }

            await addPlayerMembership(memberships, campaign._id, user._id);
            await invites.replaceOne(
                { _id: tokenHash },
                { ...invite, usedAt: new Date().toISOString(), usedBy: user._id },
                { upsert: false }
            );
            await signIn(res, sessions, user, { secure: config.cookieSecure });

            res.status(201).json({
                ...(await authPayload(user, { memberships, campaigns })),
                campaign: toCampaignSummary(campaign, 'player')
            });
        } catch (error) {
            next(error);
        }
    });

    router.post('/:token/accept', rateLimiters.invite, requireAuth, async (req, res, next) => {
        try {
            const { invite, tokenHash } = await loadInvite(invites, req.params.token);
            const campaign = await requireCampaign(campaigns, invite.campaignId);
            const userId = req.auth.user._id;

            if (await isMember(memberships, campaign._id, userId)) {
                res.json({ campaign: toCampaignSummary(campaign, 'player') });
                return;
            }

            await consumeInvite(invites, invite, tokenHash, userId);
            await addPlayerMembership(memberships, campaign._id, userId);
            res.json({ campaign: toCampaignSummary(campaign, 'player') });
        } catch (error) {
            next(error);
        }
    });

    return router;
};

export const createCampaignInvitesRouter = ({ invites, config }) => {
    const router = Router();

    router.get('/', async (req, res, next) => {
        try {
            const docs = await invites.find({ campaignId: req.campaign.doc._id }).sort({ createdAt: -1 }).toArray();
            const now = Date.now();

            res.json({
                invites: docs.map((doc) => ({
                    createdAt: doc.createdAt,
                    expiresAt: doc.expiresAt,
                    usedAt: doc.usedAt,
                    status:
                        doc.usedAt !== null
                            ? 'used'
                            : typeof doc.expiresAt === 'string' && Date.parse(doc.expiresAt) <= now
                              ? 'expired'
                              : 'active'
                }))
            });
        } catch (error) {
            next(error);
        }
    });

    router.post('/', async (req, res, next) => {
        try {
            const token = createInviteToken();
            const tokenHash = hashToken(token);
            const now = new Date();
            const invite = {
                _id: tokenHash,
                campaignId: req.campaign.doc._id,
                createdBy: req.auth.user._id,
                createdAt: now.toISOString(),
                expiresAt: new Date(now.getTime() + INVITE_DURATION_MS).toISOString(),
                usedAt: null,
                usedBy: null
            };

            await invites.insertOne(invite);
            res.status(201).json({
                invite: {
                    url: `${config.appOrigin}/invite/${token}`,
                    expiresAt: invite.expiresAt
                }
            });
        } catch (error) {
            next(error);
        }
    });

    return router;
};

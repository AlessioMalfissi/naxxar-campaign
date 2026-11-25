import { randomUUID } from 'node:crypto';
import { Router } from 'express';

import { createCombatRouter } from './combat.js';
import { createEntriesRouter } from './entries.js';
import { createInventoryRouter } from './inventory.js';
import { createCampaignInvitesRouter } from './invites.js';
import { HttpError } from './http-error.js';
import { createPursesRouter } from './purses.js';
import { loadCampaignAccess, requireCampaignDm } from './campaign-access.js';
import { slugify } from './slugify.js';

export const MAX_CAMPAIGN_NAME_LENGTH = 80;
export const MIN_CAMPAIGN_NAME_LENGTH = 2;

export const toCampaignSummary = (campaign, role) => ({
    id: campaign._id,
    slug: campaign.slug,
    name: campaign.name,
    role
});

export const loadCampaignSummaries = async (userId, { memberships, campaigns }) => {
    const rows = await memberships.find({ userId }).toArray();
    if (rows.length === 0) {
        return [];
    }

    const docs = await campaigns.find({ _id: { $in: rows.map((row) => row.campaignId) } }).toArray();
    const byId = new Map(docs.map((doc) => [doc._id, doc]));

    return rows
        .map((row) => {
            const campaign = byId.get(row.campaignId);
            return campaign === undefined ? null : toCampaignSummary(campaign, row.role);
        })
        .filter((summary) => summary !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
};

const findAvailableSlug = async (campaigns, base) => {
    let candidate = base;
    let suffix = 2;

    while ((await campaigns.findOne({ slug: candidate })) !== null) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
        if (suffix > 500) {
            throw new HttpError(409, 'Could not create a unique campaign address.');
        }
    }

    return candidate;
};

const normalizeCampaignName = (value) => (typeof value === 'string' ? value.trim() : '');

export const createCampaignsRouter = ({ campaigns, memberships }) => {
    const router = Router();

    router.get('/', async (req, res, next) => {
        try {
            res.json(await loadCampaignSummaries(req.auth.user._id, { memberships, campaigns }));
        } catch (error) {
            next(error);
        }
    });

    router.post('/', async (req, res, next) => {
        try {
            const name = normalizeCampaignName((req.body ?? {}).name);
            if (name.length < MIN_CAMPAIGN_NAME_LENGTH || name.length > MAX_CAMPAIGN_NAME_LENGTH) {
                throw new HttpError(
                    400,
                    `Campaign name must be ${MIN_CAMPAIGN_NAME_LENGTH}-${MAX_CAMPAIGN_NAME_LENGTH} characters.`
                );
            }

            const baseSlug = slugify(name);
            if (baseSlug === '') {
                throw new HttpError(400, 'Campaign name must contain at least one letter or number.');
            }

            const slug = await findAvailableSlug(campaigns, baseSlug);
            const now = new Date().toISOString();
            const campaign = {
                _id: randomUUID(),
                slug,
                name,
                createdBy: req.auth.user._id,
                createdAt: now,
                updatedAt: now
            };
            await campaigns.insertOne(campaign);

            await memberships.insertOne({
                _id: `${campaign._id}:${req.auth.user._id}`,
                campaignId: campaign._id,
                userId: req.auth.user._id,
                role: 'dm',
                createdAt: now
            });

            res.status(201).json({ campaign: toCampaignSummary(campaign, 'dm') });
        } catch (error) {
            next(error);
        }
    });

    return router;
};

export const createCampaignRouter = ({
    campaigns,
    memberships,
    invites,
    users,
    entries,
    inventory,
    purses,
    combat,
    config,
    combatLive = null
}) => {
    const router = Router({ mergeParams: true });

    router.use(loadCampaignAccess({ campaigns, memberships }));

    router.get('/', (req, res) => {
        res.json({ campaign: toCampaignSummary(req.campaign.doc, req.campaign.role) });
    });

    router.get('/members', async (req, res, next) => {
        try {
            const campaignId = req.campaign.doc._id;
            const rows = await memberships.find({ campaignId }).toArray();
            const memberUsers =
                rows.length === 0 ? [] : await users.find({ _id: { $in: rows.map((row) => row.userId) } }).toArray();
            const byId = new Map(memberUsers.map((user) => [user._id, user]));
            const showEmail = req.campaign.role === 'dm';

            const members = rows
                .map((row) => {
                    const user = byId.get(row.userId);
                    if (user === undefined) {
                        return null;
                    }

                    const member = {
                        userId: user._id,
                        displayName: user.displayName,
                        role: row.role,
                        joinedAt: row.createdAt
                    };
                    return showEmail ? { ...member, email: user.email } : member;
                })
                .filter((member) => member !== null)
                .sort((a, b) => a.displayName.localeCompare(b.displayName));

            res.json({ members });
        } catch (error) {
            next(error);
        }
    });

    router.use('/invites', requireCampaignDm, createCampaignInvitesRouter({ invites, config }));

    router.use('/entries', createEntriesRouter(entries));
    router.use('/inventory', createInventoryRouter(inventory));
    router.use('/purses', createPursesRouter(purses));
    router.use('/combat', createCombatRouter(combat, { onSaved: combatLive?.publish }));

    return router;
};

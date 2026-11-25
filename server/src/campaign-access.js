import { HttpError } from './http-error.js';

// Shared by REST middleware and the live combat socket. A super admin gets DM access to every
// campaign, including campaigns they have not joined; the membership check remains mandatory for
// everyone else.
export const resolveCampaignAccess = async ({ campaigns, memberships }, user, slug) => {
    const campaign = slug === '' ? null : await campaigns.findOne({ slug });
    if (campaign === null) {
        return null;
    }

    if (user.isSuperAdmin === true) {
        return { doc: campaign, role: 'dm', isSuperAdmin: true };
    }

    const membership = await memberships.findOne({ _id: `${campaign._id}:${user._id}` });
    if (membership === null) {
        return null;
    }

    return { doc: campaign, role: membership.role, isSuperAdmin: false };
};

export const loadCampaignAccess =
    ({ campaigns, memberships }) =>
    async (req, res, next) => {
        try {
            const slug = typeof req.params.campaignSlug === 'string' ? req.params.campaignSlug : '';
            const access = await resolveCampaignAccess({ campaigns, memberships }, req.auth.user, slug);
            if (access === null) {
                // A non-member must not be able to tell a missing campaign from an unjoined one.
                throw new HttpError(404, 'Campaign not found.');
            }

            req.campaign = access;
            next();
        } catch (error) {
            next(error);
        }
    };

export const requireCampaignMember = (req, res, next) => {
    if (req.campaign === undefined || req.campaign === null) {
        next(new HttpError(404, 'Campaign not found.'));
        return;
    }

    next();
};

export const requireCampaignDm = (req, res, next) => {
    if (req.campaign === undefined || req.campaign === null) {
        next(new HttpError(404, 'Campaign not found.'));
        return;
    }
    if (req.campaign.role !== 'dm') {
        next(new HttpError(403, 'Only the DM can change campaign content.'));
        return;
    }

    next();
};

// Used inside handlers that have already run through loadCampaignAccess.
export const assertCampaignDm = (req) => {
    if (req.campaign === undefined || req.campaign === null) {
        throw new HttpError(404, 'Campaign not found.');
    }
    if (req.campaign.role !== 'dm') {
        throw new HttpError(403, 'Only the DM can change campaign content.');
    }
};

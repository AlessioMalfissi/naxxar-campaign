import { Router } from 'express';

import { assertCampaignDm } from './campaign-access.js';
import { HttpError } from './http-error.js';
import { buildEntryQuery } from './query.js';
import { isValidSection } from './sections.js';
import { slugify } from './slugify.js';

export const buildEntryId = (campaignId, section, slug) => `${campaignId}:${section}:${slug}`;

const toPublicId = (campaignId, storedId) => {
    const prefix = `${campaignId}:`;
    return storedId.startsWith(prefix) ? storedId.slice(prefix.length) : storedId;
};

const toPublicEntry = (doc, campaignId) => {
    const { _id, campaignId: _campaignId, ...rest } = doc;
    return { id: toPublicId(campaignId, _id), ...rest };
};

const toSummary = (entry) => {
    const { body, ...summary } = entry;
    return summary;
};

// Removes `:::dm ... :::` blocks. An unterminated block drops everything that follows so a missing
// closing marker cannot leak DM notes.
export const stripDmBlocks = (body) => {
    if (typeof body !== 'string') {
        return body;
    }

    const output = [];
    let insideDmBlock = false;

    for (const line of body.split('\n')) {
        const trimmed = line.trim();
        if (!insideDmBlock && /^:::dm\b/i.test(trimmed)) {
            insideDmBlock = true;
            continue;
        }
        if (insideDmBlock) {
            if (/^:::\s*$/.test(trimmed)) {
                insideDmBlock = false;
            }
            continue;
        }

        output.push(line);
    }

    if (insideDmBlock && output.length > 0 && output[output.length - 1] !== '') {
        output.push('');
    }

    return output.join('\n');
};

const parseTags = (raw) =>
    typeof raw === 'string' && raw.trim() !== ''
        ? raw
              .split(',')
              .map((tag) => tag.trim())
              .filter((tag) => tag !== '')
        : [];

const normalizeTags = (value) =>
    Array.isArray(value) ? value.filter((tag) => typeof tag === 'string' && tag.trim() !== '') : [];

const normalizeFields = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).map(([key, fieldValue]) => [key, String(fieldValue)]))
        : {};

const normalizeVisibility = (value, fallback) => (value === 'dm' || value === 'revealed' ? value : fallback);

export const createEntriesRouter = (collection) => {
    const router = Router();

    router.get('/', async (req, res, next) => {
        try {
            const campaignId = req.campaign.doc._id;
            const forPlayer = req.campaign.role !== 'dm';
            const filter = buildEntryQuery({
                section: typeof req.query.section === 'string' ? req.query.section : undefined,
                status: typeof req.query.status === 'string' ? req.query.status : undefined,
                visibility: typeof req.query.visibility === 'string' ? req.query.visibility : undefined,
                tags: parseTags(req.query.tags),
                query: typeof req.query.query === 'string' ? req.query.query : undefined
            });

            filter.campaignId = campaignId;
            if (forPlayer) {
                // Never trust a client-supplied visibility filter to reveal DM entries.
                filter.visibility = { $ne: 'dm' };
            }

            const docs = await collection.find(filter).sort({ title: 1 }).toArray();
            res.json(docs.map((doc) => toSummary(toPublicEntry(doc, campaignId))));
        } catch (error) {
            next(error);
        }
    });

    router.get('/:section/:slug', async (req, res, next) => {
        try {
            const campaignId = req.campaign.doc._id;
            const { section, slug } = req.params;
            const doc = await collection.findOne({ _id: buildEntryId(campaignId, section, slug) });
            if (doc === null) {
                throw new HttpError(404, 'Entry not found.');
            }
            if (req.campaign.role !== 'dm') {
                if (doc.visibility === 'dm') {
                    throw new HttpError(404, 'Entry not found.');
                }

                res.json({ ...toPublicEntry(doc, campaignId), body: stripDmBlocks(doc.body) });
                return;
            }

            res.json(toPublicEntry(doc, campaignId));
        } catch (error) {
            next(error);
        }
    });

    router.post('/', async (req, res, next) => {
        try {
            assertCampaignDm(req);
            const campaignId = req.campaign.doc._id;
            const body = req.body ?? {};

            if (!isValidSection(body.section)) {
                throw new HttpError(400, 'A valid section is required.');
            }
            if (typeof body.title !== 'string' || body.title.trim().length < 2) {
                throw new HttpError(400, 'Title must be at least two characters.');
            }

            const title = body.title.trim();
            const slug = slugify(title);
            if (slug === '') {
                throw new HttpError(400, 'Title must contain at least one letter or number.');
            }

            const id = buildEntryId(campaignId, body.section, slug);
            const existing = await collection.findOne({ _id: id });
            if (existing !== null) {
                throw new HttpError(409, 'That name is already taken in this section.');
            }

            const now = new Date().toISOString();
            const entry = {
                _id: id,
                campaignId,
                section: body.section,
                slug,
                path: `assets/codex/${body.section}/${slug}.md`,
                title,
                status: typeof body.status === 'string' ? body.status : '',
                tags: normalizeTags(body.tags),
                favourite: false,
                visibility: normalizeVisibility(body.visibility, 'dm'),
                author: typeof body.author === 'string' && body.author.trim() !== '' ? body.author.trim() : 'DM',
                updatedAt: now,
                fields: normalizeFields(body.fields),
                excerpt: '',
                body: `# ${title}\n\n`
            };

            await collection.insertOne(entry);
            res.status(201).json(toPublicEntry(entry, campaignId));
        } catch (error) {
            next(error);
        }
    });

    router.put('/:section/:slug', async (req, res, next) => {
        try {
            assertCampaignDm(req);
            const campaignId = req.campaign.doc._id;
            const { section, slug } = req.params;
            const id = buildEntryId(campaignId, section, slug);
            const existing = await collection.findOne({ _id: id });
            if (existing === null) {
                throw new HttpError(404, 'Entry not found.');
            }

            const payload = req.body ?? {};
            const entry = {
                _id: id,
                campaignId,
                section,
                slug,
                path: existing.path,
                title:
                    typeof payload.title === 'string' && payload.title.trim() !== '' ? payload.title : existing.title,
                status: typeof payload.status === 'string' ? payload.status : existing.status,
                tags: payload.tags === undefined ? existing.tags : normalizeTags(payload.tags),
                favourite: typeof payload.favourite === 'boolean' ? payload.favourite : existing.favourite,
                visibility: normalizeVisibility(payload.visibility, existing.visibility),
                author:
                    typeof payload.author === 'string' && payload.author.trim() !== ''
                        ? payload.author
                        : existing.author,
                updatedAt: new Date().toISOString(),
                fields: payload.fields === undefined ? existing.fields : normalizeFields(payload.fields),
                excerpt: typeof payload.excerpt === 'string' ? payload.excerpt : existing.excerpt,
                body: typeof payload.body === 'string' ? payload.body : existing.body
            };

            await collection.replaceOne({ _id: id }, entry);
            res.json(toPublicEntry(entry, campaignId));
        } catch (error) {
            next(error);
        }
    });

    router.delete('/:section/:slug', async (req, res, next) => {
        try {
            assertCampaignDm(req);
            const campaignId = req.campaign.doc._id;
            const { section, slug } = req.params;
            await collection.deleteOne({ _id: buildEntryId(campaignId, section, slug) });
            res.json({ id: `${section}:${slug}` });
        } catch (error) {
            next(error);
        }
    });

    return router;
};

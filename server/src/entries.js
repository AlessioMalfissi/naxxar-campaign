import { Router } from 'express';

import { HttpError } from './http-error.js';
import { buildEntryQuery } from './query.js';
import { isValidSection } from './sections.js';
import { slugify } from './slugify.js';

const buildId = (section, slug) => `${section}:${slug}`;

const toPublicEntry = (doc) => {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
};

const toSummary = (entry) => {
    const { body, ...summary } = entry;
    return summary;
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
            const filter = buildEntryQuery({
                section: typeof req.query.section === 'string' ? req.query.section : undefined,
                status: typeof req.query.status === 'string' ? req.query.status : undefined,
                visibility: typeof req.query.visibility === 'string' ? req.query.visibility : undefined,
                tags: parseTags(req.query.tags),
                query: typeof req.query.query === 'string' ? req.query.query : undefined
            });

            const docs = await collection.find(filter).sort({ title: 1 }).toArray();
            res.json(docs.map((doc) => toSummary(toPublicEntry(doc))));
        } catch (error) {
            next(error);
        }
    });

    router.get('/:section/:slug', async (req, res, next) => {
        try {
            const { section, slug } = req.params;
            const doc = await collection.findOne({ _id: buildId(section, slug) });
            if (doc === null) {
                throw new HttpError(404, 'Entry not found.');
            }

            res.json(toPublicEntry(doc));
        } catch (error) {
            next(error);
        }
    });

    router.post('/', async (req, res, next) => {
        try {
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

            const id = buildId(body.section, slug);
            const existing = await collection.findOne({ _id: id });
            if (existing !== null) {
                throw new HttpError(409, 'That name is already taken in this section.');
            }

            const now = new Date().toISOString();
            const entry = {
                _id: id,
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
            res.status(201).json(toPublicEntry(entry));
        } catch (error) {
            next(error);
        }
    });

    router.put('/:section/:slug', async (req, res, next) => {
        try {
            const { section, slug } = req.params;
            const id = buildId(section, slug);
            const existing = await collection.findOne({ _id: id });
            if (existing === null) {
                throw new HttpError(404, 'Entry not found.');
            }

            const payload = req.body ?? {};
            const entry = {
                _id: id,
                section,
                slug,
                path: existing.path,
                title: typeof payload.title === 'string' && payload.title.trim() !== '' ? payload.title : existing.title,
                status: typeof payload.status === 'string' ? payload.status : existing.status,
                tags: payload.tags === undefined ? existing.tags : normalizeTags(payload.tags),
                favourite: typeof payload.favourite === 'boolean' ? payload.favourite : existing.favourite,
                visibility: normalizeVisibility(payload.visibility, existing.visibility),
                author: typeof payload.author === 'string' && payload.author.trim() !== '' ? payload.author : existing.author,
                updatedAt: new Date().toISOString(),
                fields: payload.fields === undefined ? existing.fields : normalizeFields(payload.fields),
                excerpt: typeof payload.excerpt === 'string' ? payload.excerpt : existing.excerpt,
                body: typeof payload.body === 'string' ? payload.body : existing.body
            };

            await collection.replaceOne({ _id: id }, entry);
            res.json(toPublicEntry(entry));
        } catch (error) {
            next(error);
        }
    });

    router.delete('/:section/:slug', async (req, res, next) => {
        try {
            const { section, slug } = req.params;
            const id = buildId(section, slug);
            await collection.deleteOne({ _id: id });
            res.json({ id });
        } catch (error) {
            next(error);
        }
    });

    return router;
};

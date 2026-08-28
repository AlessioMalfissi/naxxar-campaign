import { Router } from 'express';

import { HttpError } from './http-error.js';

const normalizeGold = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
};

const toPublicPurse = (doc) => ({ owner: doc._id, gold: doc.gold });

export const createPursesRouter = (collection) => {
    const router = Router();

    router.get('/', async (req, res, next) => {
        try {
            const docs = await collection.find({}).toArray();
            res.json(docs.map(toPublicPurse));
        } catch (error) {
            next(error);
        }
    });

    router.put('/:owner', async (req, res, next) => {
        try {
            const { owner } = req.params;
            const gold = normalizeGold((req.body ?? {}).gold);
            if (gold === null) {
                throw new HttpError(400, 'Gold must be a non-negative number.');
            }

            const purse = { _id: owner, gold, updatedAt: new Date().toISOString() };
            await collection.replaceOne({ _id: owner }, purse, { upsert: true });
            res.json(toPublicPurse(purse));
        } catch (error) {
            next(error);
        }
    });

    return router;
};

import { randomUUID } from 'node:crypto';
import { Router } from 'express';

import { HttpError } from './http-error.js';

export const PARTY_OWNER = 'party';

// D&D 5.5e (2024) magic item rarity tiers, plus "none" for mundane gear that has no rarity.
export const ITEM_RARITIES = ['none', 'common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact'];

export const ITEM_STATUSES = ['mundane', 'non-attuned', 'attuned', 'magic'];

const toPublicItem = (doc) => {
    const { _id, ...rest } = doc;
    return { id: _id, ...rest };
};

const normalizeQuantity = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const normalizeOwner = (value, fallback) =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;

const normalizeRarity = (value, fallback) => (ITEM_RARITIES.includes(value) ? value : fallback);

const normalizeStatus = (value, fallback) => (ITEM_STATUSES.includes(value) ? value : fallback);

const normalizeFlag = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

export const createInventoryRouter = (collection) => {
    const router = Router();

    router.get('/', async (req, res, next) => {
        try {
            const docs = await collection.find({}).sort({ name: 1 }).toArray();
            res.json(docs.map(toPublicItem));
        } catch (error) {
            next(error);
        }
    });

    router.post('/', async (req, res, next) => {
        try {
            const body = req.body ?? {};
            const name = typeof body.name === 'string' ? body.name.trim() : '';
            if (name === '') {
                throw new HttpError(400, 'Name is required.');
            }

            const item = {
                _id: randomUUID(),
                name,
                description: typeof body.description === 'string' ? body.description.trim() : '',
                quantity: normalizeQuantity(body.quantity, 1),
                owner: normalizeOwner(body.owner, PARTY_OWNER),
                rarity: normalizeRarity(body.rarity, 'none'),
                status: normalizeStatus(body.status, 'mundane'),
                forSale: normalizeFlag(body.forSale, false),
                imp: normalizeFlag(body.imp, false),
                updatedAt: new Date().toISOString()
            };

            await collection.insertOne(item);
            res.status(201).json(toPublicItem(item));
        } catch (error) {
            next(error);
        }
    });

    router.patch('/:id', async (req, res, next) => {
        try {
            const { id } = req.params;
            const existing = await collection.findOne({ _id: id });
            if (existing === null) {
                throw new HttpError(404, 'Item not found.');
            }

            const payload = req.body ?? {};
            const item = {
                _id: id,
                name:
                    typeof payload.name === 'string' && payload.name.trim() !== ''
                        ? payload.name.trim()
                        : existing.name,
                description:
                    typeof payload.description === 'string' ? payload.description.trim() : existing.description,
                quantity:
                    payload.quantity === undefined
                        ? existing.quantity
                        : normalizeQuantity(payload.quantity, existing.quantity),
                owner: payload.owner === undefined ? existing.owner : normalizeOwner(payload.owner, existing.owner),
                rarity:
                    payload.rarity === undefined ? existing.rarity : normalizeRarity(payload.rarity, existing.rarity),
                status:
                    payload.status === undefined ? existing.status : normalizeStatus(payload.status, existing.status),
                forSale:
                    payload.forSale === undefined ? existing.forSale : normalizeFlag(payload.forSale, existing.forSale),
                imp: payload.imp === undefined ? existing.imp : normalizeFlag(payload.imp, existing.imp),
                updatedAt: new Date().toISOString()
            };

            await collection.replaceOne({ _id: id }, item);
            res.json(toPublicItem(item));
        } catch (error) {
            next(error);
        }
    });

    router.delete('/:id', async (req, res, next) => {
        try {
            const { id } = req.params;
            await collection.deleteOne({ _id: id });
            res.json({ id });
        } catch (error) {
            next(error);
        }
    });

    return router;
};

import { Router } from 'express';

import { HttpError } from './http-error.js';

// The table runs one fight at a time, so the whole tracker is a single document.
export const ENCOUNTER_ID = 'current';

export const COMBATANT_KINDS = ['player', 'enemy'];

export const MAX_COMBATANTS = 100;

const MAX_CONDITIONS = 30;

const MAX_CONDITION_DESCRIPTION = 500;

const MAX_NAME_LENGTH = 100;

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const EMPTY_ENCOUNTER = { revision: 0, round: 0, turnId: null, combatants: [] };

// Encounters saved before colours, nudges and revisions existed read back with their defaults.
export const toPublicEncounter = (doc) => ({
    revision: doc.revision ?? 0,
    round: doc.round,
    turnId: doc.turnId,
    combatants: doc.combatants.map((combatant) => ({ initiativeNudge: 0, color: null, ...combatant }))
});

const normalizeInteger = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

const normalizeOptionalInteger = (value, min) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(min, Math.trunc(parsed)) : null;
};

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

// A colour is a #rrggbb hex; anything else falls back to null, the default colour for the combatant's kind.
const normalizeColor = (value) => (typeof value === 'string' && COLOR_PATTERN.test(value) ? value.toLowerCase() : null);

const normalizeCondition = (value) => {
    const name = normalizeText(value?.name);
    if (name === '') {
        return null;
    }

    const description = normalizeText(value.description).slice(0, MAX_CONDITION_DESCRIPTION);
    const condition = { name, rounds: normalizeOptionalInteger(value.rounds, 1) };
    return description === '' ? condition : { ...condition, description };
};

const normalizeCombatant = (value) => {
    const id = normalizeText(value?.id);
    const name = normalizeText(value?.name).slice(0, MAX_NAME_LENGTH);
    if (id === '' || name === '') {
        throw new HttpError(400, 'Every combatant needs an id and a name.');
    }

    const conditions = Array.isArray(value.conditions) ? value.conditions : [];
    const entryId = normalizeText(value.entryId);
    const kind = COMBATANT_KINDS.includes(value.kind) ? value.kind : 'enemy';
    // Only players track hit points and armour class; enemies never carry them.
    const tracksStats = kind === 'player';

    return {
        id,
        name,
        kind,
        entryId: entryId === '' ? null : entryId,
        initiative: normalizeInteger(value.initiative, 0),
        initiativeNudge: normalizeInteger(value.initiativeNudge, 0),
        color: normalizeColor(value.color),
        hp: tracksStats ? normalizeOptionalInteger(value.hp, 0) : null,
        maxHp: tracksStats ? normalizeOptionalInteger(value.maxHp, 0) : null,
        ac: tracksStats ? normalizeOptionalInteger(value.ac, 0) : null,
        conditions: conditions
            .slice(0, MAX_CONDITIONS)
            .map(normalizeCondition)
            .filter((condition) => condition !== null)
    };
};

export const normalizeEncounter = (body) => {
    if (!Array.isArray(body?.combatants)) {
        throw new HttpError(400, 'Combatants must be a list.');
    }
    if (body.combatants.length > MAX_COMBATANTS) {
        throw new HttpError(400, `An encounter holds at most ${MAX_COMBATANTS} combatants.`);
    }

    const combatants = body.combatants.map(normalizeCombatant);
    if (new Set(combatants.map((combatant) => combatant.id)).size !== combatants.length) {
        throw new HttpError(400, 'Combatant ids must be unique.');
    }

    const turnId = combatants.some((combatant) => combatant.id === body.turnId) ? body.turnId : null;

    return {
        round: Math.max(0, normalizeInteger(body.round, 0)),
        turnId,
        combatants
    };
};

export const readEncounter = async (collection) => {
    const doc = await collection.findOne({ _id: ENCOUNTER_ID });
    return doc === null ? EMPTY_ENCOUNTER : toPublicEncounter(doc);
};

// Runs tasks one after another, so each save reads the revision the previous one wrote.
const createSerialQueue = () => {
    let tail = Promise.resolve();

    return (task) => {
        const run = tail.then(task, task);
        tail = run.catch(() => undefined);
        return run;
    };
};

/*
 * Every save bumps the encounter's revision, so clients can tell a newer snapshot from a stale one
 * whichever channel (HTTP response or live socket) delivers it first. `onSaved` receives each saved
 * encounter in revision order.
 */
export const createCombatRouter = (collection, { onSaved = () => undefined } = {}) => {
    const router = Router();
    const enqueue = createSerialQueue();

    router.get('/', async (req, res, next) => {
        try {
            res.json(await readEncounter(collection));
        } catch (error) {
            next(error);
        }
    });

    router.put('/', async (req, res, next) => {
        try {
            const normalized = normalizeEncounter(req.body ?? {});
            const saved = await enqueue(async () => {
                const current = await readEncounter(collection);
                const encounter = {
                    _id: ENCOUNTER_ID,
                    ...normalized,
                    revision: current.revision + 1,
                    updatedAt: new Date().toISOString()
                };

                await collection.replaceOne({ _id: ENCOUNTER_ID }, encounter, { upsert: true });
                const published = toPublicEncounter(encounter);
                onSaved(published);
                return published;
            });

            res.json(saved);
        } catch (error) {
            next(error);
        }
    });

    return router;
};

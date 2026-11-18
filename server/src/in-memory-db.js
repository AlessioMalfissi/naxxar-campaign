import { createInMemoryCollection } from './in-memory-collection.js';
import { buildSeedEntries } from './seed.js';

// Dev-only stand-in for connectToMongo: same collection API, seeded from server/seed-data so the
// app has content on first load. Everything is lost when the dev server restarts.
export const createInMemoryDb = async () => ({
    collection: createInMemoryCollection(await buildSeedEntries()),
    inventoryCollection: createInMemoryCollection(),
    pursesCollection: createInMemoryCollection(),
    combatCollection: createInMemoryCollection()
});

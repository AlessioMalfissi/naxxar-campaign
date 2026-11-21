import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createFakeCollection } from '../test-utils/fake-collection.mjs';

const docs = [
    { _id: 'a', role: 'dm', tags: ['ally'], optional: 'set' },
    { _id: 'b', role: 'player', tags: ['enemy'] }
];

test('filters with $in', async () => {
    const collection = createFakeCollection(docs);
    const rows = await collection.find({ role: { $in: ['dm'] } }).toArray();

    assert.deepEqual(rows.map((row) => row._id), ['a']);
    assert.deepEqual(await collection.find({ role: { $in: ['dm', 'player'] } }).toArray(), docs);
});

test('filters with $ne, including documents missing the field', async () => {
    const collection = createFakeCollection(docs);
    const rows = await collection.find({ role: { $ne: 'dm' } }).toArray();

    assert.deepEqual(rows.map((row) => row._id), ['b']);
    assert.deepEqual(await collection.find({ usedAt: { $ne: null } }).toArray(), []);
});

test('filters with $exists true and false', async () => {
    const collection = createFakeCollection(docs);

    assert.deepEqual((await collection.find({ optional: { $exists: true } }).toArray()).map((row) => row._id), ['a']);
    assert.deepEqual((await collection.find({ optional: { $exists: false } }).toArray()).map((row) => row._id), [
        'b'
    ]);
});

test('deleteMany removes every matching document', async () => {
    const collection = createFakeCollection(docs);
    const result = await collection.deleteMany({ role: { $in: ['dm', 'player'] } });

    assert.equal(result.deletedCount, 2);
    assert.equal(collection.dump().length, 0);
});

test('deleteMany leaves non-matching documents alone', async () => {
    const collection = createFakeCollection(docs);
    const result = await collection.deleteMany({ _id: 'a' });

    assert.equal(result.deletedCount, 1);
    assert.deepEqual(collection.dump().map((row) => row._id), ['b']);
});

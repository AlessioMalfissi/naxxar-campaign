import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildEntryQuery } from '../src/query.js';

test('builds an empty filter with no criteria', () => {
    assert.deepEqual(buildEntryQuery({}), {});
    assert.deepEqual(buildEntryQuery(), {});
});

test('filters by exact section, status and visibility', () => {
    const filter = buildEntryQuery({ section: 'npcs', status: 'Alive', visibility: 'dm' });
    assert.deepEqual(filter, { section: 'npcs', status: 'Alive', visibility: 'dm' });
});

test('requires every requested tag to be present', () => {
    const filter = buildEntryQuery({ tags: ['ally', 'silver-ledger'] });
    assert.deepEqual(filter.tags, { $all: ['ally', 'silver-ledger'] });
});

test('builds a case-insensitive title/excerpt search', () => {
    const filter = buildEntryQuery({ query: 'silver' });

    assert.equal(filter.$or.length, 2);
    assert.ok(filter.$or[0].title.test('The Silver Ledger'));
    assert.ok(filter.$or[1].excerpt.test('a SILVER coin'));
    assert.ok(!filter.$or[0].title.test('unrelated'));
});

test('escapes regex metacharacters in the search query', () => {
    const filter = buildEntryQuery({ query: 'silver (ledger)' });

    assert.ok(filter.$or[0].title.test('The Silver (Ledger) Bank'));
    assert.doesNotThrow(() => filter.$or[0].title.test('anything'));
});

test('ignores a blank search query', () => {
    const filter = buildEntryQuery({ query: '   ' });
    assert.equal('$or' in filter, false);
});

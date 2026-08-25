import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { createFakeCollection } from '../test-utils/fake-collection.mjs';

const sampleEntry = (overrides = {}) => ({
    _id: 'npcs:vaelith-corrun',
    section: 'npcs',
    slug: 'vaelith-corrun',
    path: 'assets/codex/npcs/vaelith-corrun.md',
    title: 'Vaelith Corrun',
    status: 'Alive',
    tags: ['ally'],
    favourite: false,
    visibility: 'dm',
    author: 'DM',
    updatedAt: '2026-08-25T00:00:00.000Z',
    fields: { race: 'Half-elf' },
    excerpt: 'Broker of debts.',
    body: '# Who he is\n\nBroker of debts.',
    ...overrides
});

test('GET /api/entries lists summaries without the body', async () => {
    const app = createApp(createFakeCollection([sampleEntry()]));
    const response = await request(app).get('/api/entries');

    assert.equal(response.status, 200);
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].id, 'npcs:vaelith-corrun');
    assert.equal('body' in response.body[0], false);
});

test('GET /api/entries filters by status', async () => {
    const app = createApp(
        createFakeCollection([
            sampleEntry(),
            sampleEntry({ _id: 'npcs:grum', slug: 'grum', title: 'Grum', status: 'Dead', tags: ['merchant'] })
        ])
    );

    const response = await request(app).get('/api/entries').query({ status: 'Alive' });

    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].id, 'npcs:vaelith-corrun');
});

test('GET /api/entries filters by comma-separated tags and free-text query', async () => {
    const app = createApp(
        createFakeCollection([
            sampleEntry(),
            sampleEntry({ _id: 'npcs:grum', slug: 'grum', title: 'Grum', tags: ['merchant'], excerpt: 'A shady dealer.' })
        ])
    );

    const byTag = await request(app).get('/api/entries').query({ tags: 'merchant' });
    assert.equal(byTag.body.length, 1);
    assert.equal(byTag.body[0].id, 'npcs:grum');

    const byQuery = await request(app).get('/api/entries').query({ query: 'shady' });
    assert.equal(byQuery.body.length, 1);
    assert.equal(byQuery.body[0].id, 'npcs:grum');
});

test('GET /api/entries/:section/:slug returns the full entry', async () => {
    const app = createApp(createFakeCollection([sampleEntry()]));
    const response = await request(app).get('/api/entries/npcs/vaelith-corrun');

    assert.equal(response.status, 200);
    assert.equal(response.body.body, '# Who he is\n\nBroker of debts.');
});

test('GET /api/entries/:section/:slug 404s when the entry is missing', async () => {
    const app = createApp(createFakeCollection([]));
    const response = await request(app).get('/api/entries/npcs/missing');

    assert.equal(response.status, 404);
    assert.equal(response.body.error, 'Entry not found.');
});

test('POST /api/entries creates an entry with a slugified title', async () => {
    const app = createApp(createFakeCollection([]));
    const response = await request(app)
        .post('/api/entries')
        .send({ section: 'places', title: 'Emberfall Road', status: 'Visited' });

    assert.equal(response.status, 201);
    assert.equal(response.body.id, 'places:emberfall-road');
    assert.equal(response.body.body, '# Emberfall Road\n\n');
    assert.equal(response.body.favourite, false);
    assert.equal(response.body.visibility, 'dm');
});

test('POST /api/entries stores the supplied tags, visibility and fields', async () => {
    const app = createApp(createFakeCollection([]));
    const response = await request(app).post('/api/entries').send({
        section: 'npcs',
        title: 'Grum the Broker',
        status: 'Alive',
        tags: ['merchant', 'ally'],
        visibility: 'revealed',
        fields: { race: 'Dwarf' }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body.tags, ['merchant', 'ally']);
    assert.equal(response.body.visibility, 'revealed');
    assert.deepEqual(response.body.fields, { race: 'Dwarf' });
});

test('POST /api/entries rejects a duplicate slug in the same section', async () => {
    const app = createApp(createFakeCollection([sampleEntry()]));
    const response = await request(app)
        .post('/api/entries')
        .send({ section: 'npcs', title: 'Vaelith Corrun', status: 'Alive' });

    assert.equal(response.status, 409);
    assert.equal(response.body.error, 'That name is already taken in this section.');
});

test('POST /api/entries rejects an invalid section or a too-short title', async () => {
    const app = createApp(createFakeCollection([]));

    const badSection = await request(app).post('/api/entries').send({ section: 'dragons', title: 'Smaug' });
    assert.equal(badSection.status, 400);

    const shortTitle = await request(app).post('/api/entries').send({ section: 'npcs', title: 'A' });
    assert.equal(shortTitle.status, 400);
});

test('PUT /api/entries/:section/:slug updates an existing entry and stamps updatedAt', async () => {
    const app = createApp(createFakeCollection([sampleEntry()]));
    const response = await request(app)
        .put('/api/entries/npcs/vaelith-corrun')
        .send({ ...sampleEntry(), status: 'Dead', body: '# Who he is\n\nUpdated.' });

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'Dead');
    assert.equal(response.body.body, '# Who he is\n\nUpdated.');
    assert.notEqual(response.body.updatedAt, sampleEntry().updatedAt);
});

test('PUT /api/entries/:section/:slug 404s when the entry does not exist', async () => {
    const app = createApp(createFakeCollection([]));
    const response = await request(app).put('/api/entries/npcs/missing').send({ title: 'Ghost' });

    assert.equal(response.status, 404);
});

test('DELETE /api/entries/:section/:slug removes the entry', async () => {
    const collection = createFakeCollection([sampleEntry()]);
    const app = createApp(collection);
    const response = await request(app).delete('/api/entries/npcs/vaelith-corrun');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { id: 'npcs:vaelith-corrun' });
    assert.equal(collection.dump().length, 0);
});

test('DELETE /api/entries/:section/:slug is idempotent when nothing matches', async () => {
    const app = createApp(createFakeCollection([]));
    const response = await request(app).delete('/api/entries/npcs/missing');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { id: 'npcs:missing' });
});

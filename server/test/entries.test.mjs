import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { stripDmBlocks } from '../src/entries.js';
import { addCampaign, addUser, buildApp, campaignPath, login, makeEntry } from './helpers.mjs';

const buildFixture = async () => {
    const context = buildApp();
    const dm = await addUser(context.users, { email: 'dm@example.com' });
    const player = await addUser(context.users, { email: 'player@example.com', displayName: 'Player' });
    const campaign = await addCampaign(context.campaigns, context.memberships, { dm, players: [player] });
    const other = await addCampaign(context.campaigns, context.memberships, {
        slug: 'other',
        name: 'Other',
        dm
    });

    return { ...context, dm, player, campaign, other };
};

const loginAs = async (app, email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: 'password123' });
    return agent;
};

const sampleEntry = (campaignId, overrides = {}) =>
    makeEntry(campaignId, 'npcs', 'vaelith-corrun', {
        title: 'Vaelith Corrun',
        status: 'Alive',
        tags: ['ally'],
        visibility: 'revealed',
        excerpt: 'Broker of debts.',
        body: '# Who he is\n\nBroker of debts.',
        ...overrides
    });

test('the same section and slug in two campaigns are two independent entries', async () => {
    const context = await buildFixture();
    await context.entries.insertOne(sampleEntry(context.campaign._id, { body: '# Campaign one\n' }));
    await context.entries.insertOne(
        sampleEntry(context.other._id, { body: '# Campaign two\n' })
    );
    const agent = await loginAs(context.app, 'dm@example.com');

    const first = await agent.get(campaignPath(context.campaign, '/entries/npcs/vaelith-corrun'));
    const second = await agent.get(campaignPath(context.other, '/entries/npcs/vaelith-corrun'));

    assert.equal(first.body.id, 'npcs:vaelith-corrun');
    assert.equal(second.body.id, 'npcs:vaelith-corrun');
    assert.equal(first.body.body, '# Campaign one\n');
    assert.equal(second.body.body, '# Campaign two\n');
});

test('GET entries lists summaries without the body, scoped to the campaign', async () => {
    const context = await buildFixture();
    await context.entries.insertOne(sampleEntry(context.campaign._id));
    await context.entries.insertOne(makeEntry(context.other._id, 'npcs', 'other-only', { title: 'Other only' }));
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.get(campaignPath(context.campaign, '/entries'));
    assert.equal(response.status, 200);
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].id, 'npcs:vaelith-corrun');
    assert.equal('body' in response.body[0], false);
    assert.equal('campaignId' in response.body[0], false);
});

test('GET entries filters by status, tags and free-text query', async () => {
    const context = await buildFixture();
    await context.entries.insertOne(sampleEntry(context.campaign._id));
    await context.entries.insertOne(
        sampleEntry(context.campaign._id, {
            _id: `${context.campaign._id}:npcs:grum`,
            slug: 'grum',
            title: 'Grum',
            status: 'Dead',
            tags: ['merchant'],
            excerpt: 'A shady dealer.'
        })
    );
    const agent = await loginAs(context.app, 'dm@example.com');
    const base = campaignPath(context.campaign, '/entries');

    assert.equal((await agent.get(base).query({ status: 'Alive' })).body.length, 1);
    assert.equal((await agent.get(base).query({ tags: 'merchant' })).body[0].id, 'npcs:grum');
    assert.equal((await agent.get(base).query({ query: 'shady' })).body[0].id, 'npcs:grum');
});

test('a player never receives a visibility:dm entry in the list', async () => {
    const context = await buildFixture();
    await context.entries.insertOne(sampleEntry(context.campaign._id));
    await context.entries.insertOne(
        sampleEntry(context.campaign._id, {
            _id: `${context.campaign._id}:npcs:secret`,
            slug: 'secret',
            title: 'Secret',
            visibility: 'dm'
        })
    );
    const agent = await loginAs(context.app, 'player@example.com');

    const response = await agent.get(campaignPath(context.campaign, '/entries'));
    assert.deepEqual(response.body.map((entry) => entry.id), ['npcs:vaelith-corrun']);

    const forced = await agent
        .get(campaignPath(context.campaign, '/entries'))
        .query({ visibility: 'dm' });
    assert.deepEqual(forced.body.map((entry) => entry.id), ['npcs:vaelith-corrun']);
});

test('a player gets a 404 for a DM-only entry and cannot read :::dm blocks', async () => {
    const context = await buildFixture();
    await context.entries.insertOne(
        sampleEntry(context.campaign._id, {
            body: '# Public\n\nEveryone knows this.\n\n:::dm\nA secret only the DM knows.\n:::\n\nAfter the block.'
        })
    );
    const agent = await loginAs(context.app, 'player@example.com');

    const response = await agent.get(campaignPath(context.campaign, '/entries/npcs/vaelith-corrun'));
    assert.equal(response.status, 200);
    assert.equal(response.body.body.includes('secret only the DM knows'), false);
    assert.equal(response.body.body.includes('After the block.'), true);

    await context.entries.replaceOne(
        { _id: `${context.campaign._id}:npcs:vaelith-corrun` },
        sampleEntry(context.campaign._id, { visibility: 'dm' })
    );
    const hidden = await agent.get(campaignPath(context.campaign, '/entries/npcs/vaelith-corrun'));
    assert.equal(hidden.status, 404);
});

test('the DM still sees :::dm content', async () => {
    const context = await buildFixture();
    await context.entries.insertOne(
        sampleEntry(context.campaign._id, { body: '# Public\n\n:::dm\nSecret.\n:::\n' })
    );
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.get(campaignPath(context.campaign, '/entries/npcs/vaelith-corrun'));
    assert.match(response.body.body, /Secret\./);
});

test('stripDmBlocks drops an unterminated DM block to the end', () => {
    assert.equal(stripDmBlocks('before\n:::dm\nsecret\nstill secret'), 'before\n');
    assert.equal(stripDmBlocks(':::dm\n secret\n:::\nafter'), 'after');
    assert.equal(stripDmBlocks('no blocks'), 'no blocks');
});

test('POST creates an entry with a campaign-scoped id and a slugified title', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent
        .post(campaignPath(context.campaign, '/entries'))
        .send({ section: 'places', title: 'Emberfall Road', status: 'Visited' });

    assert.equal(response.status, 201);
    assert.equal(response.body.id, 'places:emberfall-road');
    assert.equal(response.body.body, '# Emberfall Road\n\n');
    assert.equal(response.body.favourite, false);
    assert.equal(response.body.visibility, 'dm');
    assert.equal(
        (await context.entries.findOne({ _id: `${context.campaign._id}:places:emberfall-road` })).campaignId,
        context.campaign._id
    );
});

test('POST rejects a duplicate slug in the same campaign and section', async () => {
    const context = await buildFixture();
    await context.entries.insertOne(sampleEntry(context.campaign._id));
    const agent = await loginAs(context.app, 'dm@example.com');

    const duplicate = await agent
        .post(campaignPath(context.campaign, '/entries'))
        .send({ section: 'npcs', title: 'Vaelith Corrun' });
    assert.equal(duplicate.status, 409);

    // The same title in another campaign is not a duplicate.
    const elsewhere = await agent
        .post(campaignPath(context.other, '/entries'))
        .send({ section: 'npcs', title: 'Vaelith Corrun' });
    assert.equal(elsewhere.status, 201);
});

test('POST validates the section and title', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');
    const base = campaignPath(context.campaign, '/entries');

    assert.equal((await agent.post(base).send({ section: 'dragons', title: 'Smaug' })).status, 400);
    assert.equal((await agent.post(base).send({ section: 'npcs', title: 'A' })).status, 400);
});

test('PUT updates an entry and DELETE removes it, scoped to the campaign', async () => {
    const context = await buildFixture();
    await context.entries.insertOne(sampleEntry(context.campaign._id));
    const agent = await loginAs(context.app, 'dm@example.com');

    const updated = await agent
        .put(campaignPath(context.campaign, '/entries/npcs/vaelith-corrun'))
        .send({ status: 'Dead', body: '# Updated\n' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.status, 'Dead');
    assert.equal(updated.body.body, '# Updated\n');

    const deleted = await agent.delete(campaignPath(context.campaign, '/entries/npcs/vaelith-corrun'));
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.body, { id: 'npcs:vaelith-corrun' });
    assert.equal(context.entries.dump().length, 0);
});

test('a cross-campaign entry id behaves as missing', async () => {
    const context = await buildFixture();
    await context.entries.insertOne(sampleEntry(context.other._id));
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.get(campaignPath(context.campaign, '/entries/npcs/vaelith-corrun'));
    assert.equal(response.status, 404);
});

test('DELETE is idempotent', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.delete(campaignPath(context.campaign, '/entries/npcs/missing'));
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { id: 'npcs:missing' });
});

test('entry routes require a session', async () => {
    const context = await buildFixture();
    const response = await request(context.app).get(campaignPath(context.campaign, '/entries'));

    assert.equal(response.status, 401);
});

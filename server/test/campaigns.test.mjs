import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { addCampaign, addUser, buildApp, campaignPath, login, makeEntry } from './helpers.mjs';

test('POST /api/campaigns creates a campaign and makes the creator its DM', async () => {
    const context = buildApp();
    await addUser(context.users, { email: 'dm@example.com' });
    const { agent } = await login(context.app);

    const response = await agent.post('/api/campaigns').send({ name: 'The Silver Marches' });

    assert.equal(response.status, 201);
    assert.equal(response.body.campaign.slug, 'the-silver-marches');
    assert.equal(response.body.campaign.role, 'dm');
    assert.equal(context.campaigns.dump().length, 1);
    assert.equal(context.memberships.dump()[0].role, 'dm');
});

test('POST /api/campaigns appends a suffix when the slug is taken', async () => {
    const context = buildApp();
    const user = await addUser(context.users, { email: 'dm@example.com' });
    await addCampaign(context.campaigns, context.memberships, { slug: 'naxxar', name: 'Naxxar', dm: user });
    const { agent } = await login(context.app);

    const response = await agent.post('/api/campaigns').send({ name: 'Naxxar' });
    assert.equal(response.status, 201);
    assert.equal(response.body.campaign.slug, 'naxxar-2');
});

test('POST /api/campaigns validates the name', async () => {
    const context = buildApp();
    await addUser(context.users, { email: 'dm@example.com' });
    const { agent } = await login(context.app);

    const short = await agent.post('/api/campaigns').send({ name: 'A' });
    const symbols = await agent.post('/api/campaigns').send({ name: '!!!' });

    assert.equal(short.status, 400);
    assert.equal(symbols.status, 400);
});

test('GET /api/campaigns lists only the caller’s campaigns sorted by name', async () => {
    const context = buildApp();
    const dm = await addUser(context.users, { email: 'dm@example.com' });
    const other = await addUser(context.users, { email: 'other@example.com' });
    await addCampaign(context.campaigns, context.memberships, { slug: 'zeta', name: 'Zeta', dm });
    await addCampaign(context.campaigns, context.memberships, { slug: 'alpha', name: 'Alpha', dm });
    await addCampaign(context.campaigns, context.memberships, { slug: 'theirs', name: 'Theirs', dm: other });

    const { agent } = await login(context.app);
    const response = await agent.get('/api/campaigns');

    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.map((campaign) => campaign.name),
        ['Alpha', 'Zeta']
    );
});

test('GET /api/campaigns without a session is a 401', async () => {
    const { app } = buildApp();
    const response = await request(app).get('/api/campaigns');

    assert.equal(response.status, 401);
});

test('GET a campaign returns its summary for a member and 404 for a non-member', async () => {
    const context = buildApp();
    const dm = await addUser(context.users, { email: 'dm@example.com' });
    const stranger = await addUser(context.users, { email: 'stranger@example.com' });
    const campaign = await addCampaign(context.campaigns, context.memberships, { dm });

    const member = await login(context.app);
    const detail = await member.agent.get(campaignPath(campaign));
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body.campaign, {
        id: campaign._id,
        slug: 'naxxar',
        name: 'Naxxar',
        role: 'dm'
    });

    const outsiderAgent = request.agent(context.app);
    await outsiderAgent.post('/api/auth/login').send({ email: 'stranger@example.com', password: 'password123' });
    const hidden = await outsiderAgent.get(campaignPath(campaign));
    assert.equal(hidden.status, 404);
    assert.equal(hidden.body.error, 'Campaign not found.');
    assert.ok(stranger !== null);
});

test('a non-member cannot distinguish a missing campaign from an unjoined one', async () => {
    const context = buildApp();
    await addUser(context.users, { email: 'dm@example.com' });
    const other = await addUser(context.users, { email: 'other@example.com' });
    await addCampaign(context.campaigns, context.memberships, { slug: 'secret', name: 'Secret', dm: other });

    const { agent } = await login(context.app);
    const missing = await agent.get('/api/campaigns/does-not-exist/members');
    const unjoined = await agent.get('/api/campaigns/secret/members');

    assert.equal(missing.status, 404);
    assert.equal(unjoined.status, 404);
    assert.deepEqual(missing.body, unjoined.body);
});

test('a player can read content but writes get a 403', async () => {
    const context = buildApp();
    const dm = await addUser(context.users, { email: 'dm@example.com' });
    const player = await addUser(context.users, { email: 'player@example.com', displayName: 'Player' });
    const campaign = await addCampaign(context.campaigns, context.memberships, { dm, players: [player] });
    await context.entries.insertOne(makeEntry(campaign._id, 'npcs', 'vaelith', { visibility: 'revealed' }));

    const playerAgent = request.agent(context.app);
    await playerAgent.post('/api/auth/login').send({ email: 'player@example.com', password: 'password123' });

    const read = await playerAgent.get(campaignPath(campaign, '/entries/npcs/vaelith'));
    assert.equal(read.status, 200);

    const write = await playerAgent
        .post(campaignPath(campaign, '/entries'))
        .send({ section: 'npcs', title: 'A New NPC' });
    assert.equal(write.status, 403);
    assert.equal(write.body.error, 'Only the DM can change campaign content.');
});

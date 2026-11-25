import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { addCampaign, addUser, buildApp, campaignPath } from './helpers.mjs';

const buildFixture = async () => {
    const context = buildApp();
    const dm = await addUser(context.users, { email: 'dm@example.com' });
    const player = await addUser(context.users, { email: 'player@example.com', displayName: 'Player' });
    const campaign = await addCampaign(context.campaigns, context.memberships, { dm, players: [player] });
    const other = await addCampaign(context.campaigns, context.memberships, { slug: 'other', name: 'Other', dm });

    return { ...context, dm, player, campaign, other };
};

const loginAs = async (app, email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: 'password123' });
    return agent;
};

const item = (campaignId, overrides = {}) => ({
    _id: 'a5c8f9d0-1111-4a2b-9c3d-000000000001',
    campaignId,
    name: 'Potion of healing',
    description: 'Restores 2d4+2 hit points.',
    quantity: 3,
    owner: 'party',
    rarity: 'common',
    status: 'magic',
    forSale: false,
    imp: false,
    impTag: '',
    updatedAt: '2026-08-25T00:00:00.000Z',
    ...overrides
});

test('GET lists only the campaign’s items, sorted by name, without campaignId', async () => {
    const context = await buildFixture();
    await context.inventory.insertOne(item(context.campaign._id, { _id: 'id-2', name: 'Rope, 50ft' }));
    await context.inventory.insertOne(item(context.campaign._id, { _id: 'id-1', name: 'Bag of holding' }));
    await context.inventory.insertOne(item(context.other._id, { _id: 'id-3', name: 'Other item' }));
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.get(campaignPath(context.campaign, '/inventory'));
    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.map((row) => row.name),
        ['Bag of holding', 'Rope, 50ft']
    );
    assert.equal('campaignId' in response.body[0], false);
});

test('inventory requires a session and a membership', async () => {
    const context = await buildFixture();
    const anonymous = await request(context.app).get(campaignPath(context.campaign, '/inventory'));
    assert.equal(anonymous.status, 401);

    const outsider = await addUser(context.users, { email: 'outsider@example.com' });
    assert.ok(outsider !== null);
    const agent = await loginAs(context.app, 'outsider@example.com');
    const hidden = await agent.get(campaignPath(context.campaign, '/inventory'));
    assert.equal(hidden.status, 404);
});

test('POST creates an item scoped to the campaign with the usual defaults', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.post(campaignPath(context.campaign, '/inventory')).send({ name: 'Torch' });

    assert.equal(response.status, 201);
    assert.equal(response.body.name, 'Torch');
    assert.equal(response.body.quantity, 1);
    assert.equal(response.body.owner, 'party');
    assert.equal(response.body.rarity, 'none');
    assert.equal(response.body.status, 'mundane');
    assert.equal('campaignId' in response.body, false);
    assert.equal((await context.inventory.findOne({ _id: response.body.id })).campaignId, context.campaign._id);
});

test('POST stores supplied fields, normalizing rarity, status and impTag', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.post(campaignPath(context.campaign, '/inventory')).send({
        name: 'Potion of healing',
        quantity: 5,
        owner: 'players:tessaly-oakhand',
        rarity: 'common',
        status: 'magic',
        forSale: true,
        imp: true,
        impTag: ' Cromwell '
    });

    assert.equal(response.body.quantity, 5);
    assert.equal(response.body.owner, 'players:tessaly-oakhand');
    assert.equal(response.body.impTag, 'Cromwell');
});

test('POST rejects an empty name', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    assert.equal((await agent.post(campaignPath(context.campaign, '/inventory')).send({ name: '   ' })).status, 400);
});

test('PATCH updates an item in the same campaign and 404s across campaigns', async () => {
    const context = await buildFixture();
    await context.inventory.insertOne(item(context.campaign._id));
    await context.inventory.insertOne(item(context.other._id, { _id: 'other-item' }));
    const agent = await loginAs(context.app, 'dm@example.com');

    const updated = await agent
        .patch(campaignPath(context.campaign, '/inventory/a5c8f9d0-1111-4a2b-9c3d-000000000001'))
        .send({ quantity: 7, rarity: 'legendary', status: 'attuned' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.quantity, 7);
    assert.equal(updated.body.rarity, 'legendary');
    assert.equal(updated.body.status, 'attuned');

    const crossCampaign = await agent
        .patch(campaignPath(context.campaign, '/inventory/other-item'))
        .send({ quantity: 2 });
    assert.equal(crossCampaign.status, 404);
    assert.equal((await context.inventory.findOne({ _id: 'other-item' })).quantity, 3);
});

test('PATCH keeps existing values for an invalid rarity and status', async () => {
    const context = await buildFixture();
    await context.inventory.insertOne(item(context.campaign._id, { rarity: 'rare', status: 'attuned' }));
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent
        .patch(campaignPath(context.campaign, '/inventory/a5c8f9d0-1111-4a2b-9c3d-000000000001'))
        .send({ rarity: 'mythical', status: 'cursed' });

    assert.equal(response.body.rarity, 'rare');
    assert.equal(response.body.status, 'attuned');
});

test('DELETE removes only this campaign’s item and is idempotent', async () => {
    const context = await buildFixture();
    await context.inventory.insertOne(item(context.campaign._id));
    await context.inventory.insertOne(item(context.other._id, { _id: 'other-item' }));
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.delete(
        campaignPath(context.campaign, '/inventory/a5c8f9d0-1111-4a2b-9c3d-000000000001')
    );
    assert.equal(response.status, 200);
    assert.equal((await context.inventory.findOne({ _id: 'other-item' })) !== null, true);

    const again = await agent.delete(campaignPath(context.campaign, '/inventory/missing'));
    assert.equal(again.status, 200);
});

test('a player can read inventory but cannot write it', async () => {
    const context = await buildFixture();
    await context.inventory.insertOne(item(context.campaign._id));
    const agent = await loginAs(context.app, 'player@example.com');

    const read = await agent.get(campaignPath(context.campaign, '/inventory'));
    assert.equal(read.status, 200);

    const write = await agent.post(campaignPath(context.campaign, '/inventory')).send({ name: 'Sword' });
    assert.equal(write.status, 403);

    const patch = await agent
        .patch(campaignPath(context.campaign, '/inventory/a5c8f9d0-1111-4a2b-9c3d-000000000001'))
        .send({ quantity: 2 });
    assert.equal(patch.status, 403);

    const remove = await agent.delete(
        campaignPath(context.campaign, '/inventory/a5c8f9d0-1111-4a2b-9c3d-000000000001')
    );
    assert.equal(remove.status, 403);
});

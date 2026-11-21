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

test('GET lists purses by owner for the campaign only', async () => {
    const context = await buildFixture();
    await context.purses.insertOne({
        _id: `${context.campaign._id}:party`,
        campaignId: context.campaign._id,
        owner: 'party',
        gold: 120
    });
    await context.purses.insertOne({
        _id: `${context.other._id}:party`,
        campaignId: context.other._id,
        owner: 'party',
        gold: 999
    });
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent.get(campaignPath(context.campaign, '/purses'));
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [{ owner: 'party', gold: 120 }]);
});

test('PUT upserts a campaign-composited purse and floors fractional gold', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    const response = await agent
        .put(campaignPath(context.campaign, '/purses/players:tessaly-oakhand'))
        .send({ gold: 12.9 });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { owner: 'players:tessaly-oakhand', gold: 12 });
    assert.deepEqual(context.purses.dump().map((purse) => purse._id), [
        `${context.campaign._id}:players:tessaly-oakhand`
    ]);
});

test('the same owner in two campaigns has independent gold', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    await agent.put(campaignPath(context.campaign, '/purses/party')).send({ gold: 10 });
    await agent.put(campaignPath(context.other, '/purses/party')).send({ gold: 50 });

    assert.deepEqual((await agent.get(campaignPath(context.campaign, '/purses'))).body, [
        { owner: 'party', gold: 10 }
    ]);
    assert.deepEqual((await agent.get(campaignPath(context.other, '/purses'))).body, [
        { owner: 'party', gold: 50 }
    ]);
});

test('PUT rejects a negative or non-numeric gold value', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'dm@example.com');

    assert.equal(
        (await agent.put(campaignPath(context.campaign, '/purses/party')).send({ gold: -5 })).status,
        400
    );
    assert.equal(
        (await agent.put(campaignPath(context.campaign, '/purses/party')).send({ gold: 'lots' })).status,
        400
    );
});

test('players can read purses but cannot change them', async () => {
    const context = await buildFixture();
    const agent = await loginAs(context.app, 'player@example.com');

    assert.equal((await agent.get(campaignPath(context.campaign, '/purses'))).status, 200);
    assert.equal(
        (await agent.put(campaignPath(context.campaign, '/purses/party')).send({ gold: 100 })).status,
        403
    );
});

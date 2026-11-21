import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';

import { addCampaign, addUser, buildApp, campaignPath } from './helpers.mjs';

const buildFixture = async () => {
    const context = buildApp();
    const dm = await addUser(context.users, { email: 'dm@example.com', displayName: 'Dungeon Master' });
    const player = await addUser(context.users, { email: 'player@example.com', displayName: 'Player One' });
    const campaign = await addCampaign(context.campaigns, context.memberships, { dm, players: [player] });
    const otherDm = await addUser(context.users, { email: 'other@example.com', displayName: 'Other DM' });
    const otherPlayer = await addUser(context.users, { email: 'otherplayer@example.com', displayName: 'Other' });
    const otherCampaign = await addCampaign(context.campaigns, context.memberships, {
        slug: 'other',
        name: 'Other',
        dm: otherDm,
        players: [otherPlayer]
    });

    return { ...context, dm, player, campaign, otherCampaign };
};

const loginAs = async (app, email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: 'password123' });
    return agent;
};

test('the DM sees every member including email addresses', async () => {
    const { app, campaign } = await buildFixture();
    const agent = await loginAs(app, 'dm@example.com');

    const response = await agent.get(campaignPath(campaign, '/members'));
    assert.equal(response.status, 200);
    assert.equal(response.body.members.length, 2);
    assert.deepEqual(
        response.body.members.map((member) => member.displayName),
        ['Dungeon Master', 'Player One']
    );
    assert.ok(response.body.members.every((member) => typeof member.email === 'string'));
});

test('players see the roster without email addresses', async () => {
    const { app, campaign } = await buildFixture();
    const agent = await loginAs(app, 'player@example.com');

    const response = await agent.get(campaignPath(campaign, '/members'));
    assert.equal(response.status, 200);
    assert.equal(response.body.members.length, 2);
    assert.ok(response.body.members.every((member) => !('email' in member)));
});

test('members are isolated per campaign', async () => {
    const { app, otherCampaign } = await buildFixture();
    const agent = await loginAs(app, 'other@example.com');

    const response = await agent.get(campaignPath(otherCampaign, '/members'));
    assert.deepEqual(
        response.body.members.map((member) => member.displayName),
        ['Other', 'Other DM']
    );
});

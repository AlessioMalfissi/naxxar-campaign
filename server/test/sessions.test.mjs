import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    createSession,
    createSessionToken,
    hashToken,
    originCheck,
    requireAuth,
    resolveSession,
    revokeUserSessions
} from '../src/sessions.js';
import { createFakeCollection } from '../test-utils/fake-collection.mjs';

const user = { _id: 'user-1', email: 'dm@example.com', displayName: 'DM' };

const collections = () => ({
    sessions: createFakeCollection([]),
    users: createFakeCollection([user])
});

test('a token is 43 base64url characters and hashes to a 64-character hex id', () => {
    const { token, tokenHash } = createSessionToken();

    assert.equal(token.length, 43);
    assert.match(tokenHash, /^[0-9a-f]{64}$/);
    assert.equal(hashToken(token), tokenHash);
});

test('malformed tokens are rejected before hashing', () => {
    assert.equal(hashToken('short'), null);
    assert.equal(hashToken('x'.repeat(43)), null);
    assert.equal(hashToken(undefined), null);
});

test('createSession stores only the hash', async () => {
    const { sessions } = collections();
    const { token, session } = await createSession(sessions, user._id);

    assert.equal(session._id, hashToken(token));
    assert.equal(session.userId, user._id);
    assert.equal(JSON.stringify(sessions.dump()).includes(token), false);
});

test('resolveSession returns the user for a valid cookie', async () => {
    const { sessions, users } = collections();
    const { token } = await createSession(sessions, user._id);
    const req = { headers: { cookie: `naxxar_session=${token}` } };

    const resolved = await resolveSession(req, { sessions, users });
    assert.equal(resolved.user._id, user._id);
});

test('resolveSession rejects a tampered or unknown cookie', async () => {
    const { sessions, users } = collections();
    const req = { headers: { cookie: 'naxxar_session=not-a-real-token' } };

    assert.equal(await resolveSession(req, { sessions, users }), null);
    assert.equal(await resolveSession({ headers: {} }, { sessions, users }), null);
});

test('an expired session is rejected even before the TTL monitor runs', async () => {
    const { sessions, users } = collections();
    const { token, session } = await createSession(sessions, user._id);
    await sessions.replaceOne(
        { _id: session._id },
        { ...session, expiresAt: new Date(Date.now() - 1000).toISOString() }
    );

    const resolved = await resolveSession({ headers: { cookie: `naxxar_session=${token}` } }, { sessions, users });
    assert.equal(resolved, null);
});

test('revokeUserSessions deletes every session for one user only', async () => {
    const { sessions } = collections();
    await createSession(sessions, 'user-1');
    await createSession(sessions, 'user-1');
    await createSession(sessions, 'user-2');

    const result = await revokeUserSessions(sessions, 'user-1');
    assert.equal(result.deletedCount, 2);
    assert.equal(sessions.dump().length, 1);
    assert.equal(sessions.dump()[0].userId, 'user-2');
});

const runOriginCheck = (headers, method = 'POST') => {
    let outcome = null;
    originCheck('https://app.example.com')({ method, headers }, {}, (error) => {
        outcome = error ?? 'next';
    });
    return outcome;
};

test('origin checks accept same-origin, absent headers, and safe methods', () => {
    assert.equal(runOriginCheck({ origin: 'https://app.example.com' }), 'next');
    assert.equal(runOriginCheck({}), 'next');
    assert.equal(runOriginCheck({ 'sec-fetch-site': 'same-origin' }), 'next');
    assert.equal(runOriginCheck({ origin: 'https://evil.example.com' }, 'GET'), 'next');
});

test('origin checks reject cross-origin unsafe requests', () => {
    assert.equal(runOriginCheck({ origin: 'https://evil.example.com' }).status, 403);
    assert.equal(runOriginCheck({ 'sec-fetch-site': 'cross-site' }).status, 403);
});

test('requireAuth rejects anonymous requests', () => {
    let outcome = null;
    requireAuth({}, {}, (error) => {
        outcome = error;
    });
    assert.equal(outcome.status, 401);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    ARGON2_OPTIONS,
    createPasswordService,
    hashPassword,
    isValidPassword,
    verifyPassword
} from '../src/passwords.js';

test('hashes with Argon2id at the OWASP-recommended parameters', async () => {
    const hash = await hashPassword('correct horse battery staple');

    assert.match(hash, /^\$argon2id\$/);
    assert.equal(ARGON2_OPTIONS.memoryCost, 19456);
    assert.equal(ARGON2_OPTIONS.timeCost, 2);
    assert.equal(ARGON2_OPTIONS.parallelism, 1);
});

test('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');

    assert.equal(await verifyPassword(hash, 'correct horse battery staple'), true);
    assert.equal(await verifyPassword(hash, 'wrong password'), false);
});

test('returns false for a malformed hash instead of throwing', async () => {
    assert.equal(await verifyPassword('not-a-hash', 'anything'), false);
    assert.equal(await verifyPassword(null, 'anything'), false);
});

test('two hashes of the same password differ because of the salt', async () => {
    const first = await hashPassword('same password');
    const second = await hashPassword('same password');

    assert.notEqual(first, second);
});

test('enforces the 8-128 character policy', () => {
    assert.equal(isValidPassword('1234567'), false);
    assert.equal(isValidPassword('12345678'), true);
    assert.equal(isValidPassword('x'.repeat(128)), true);
    assert.equal(isValidPassword('x'.repeat(129)), false);
    assert.equal(isValidPassword(12345678), false);
});

test('createPasswordService exposes a working hash/verify pair and a dummy verify', async () => {
    const service = createPasswordService();
    const hash = await service.hash('password123');

    assert.equal(await service.verify(hash, 'password123'), true);
    assert.equal(await service.verify(hash, 'nope'), false);
    assert.equal(await service.verifyDummy(), false);
});

import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import request from 'supertest';

import { buildApp } from './helpers.mjs';

test('GET /api/config is public and exposes only the Google client id', async () => {
    const { app } = buildApp({ config: { googleClientId: 'test-client-id' } });
    const response = await request(app).get('/api/config');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { googleClientId: 'test-client-id' });
    assert.equal(response.headers['cache-control'], 'no-store');
});

test('GET /api/config reports null when Google is not configured', async () => {
    const { app } = buildApp();
    const response = await request(app).get('/api/config');

    assert.deepEqual(response.body, { googleClientId: null });
});

test('an anonymous campaign request is a 401', async () => {
    const { app } = buildApp();
    const response = await request(app).get('/api/campaigns/naxxar/entries');

    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'Sign in required.');
});

test('an unsafe cross-origin request is rejected before routing', async () => {
    const { app } = buildApp();
    const response = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'https://evil.example.com')
        .send({ email: 'dm@example.com', password: 'password123' });

    assert.equal(response.status, 403);
    assert.equal(response.body.error, 'Cross-origin request rejected.');
});

test('a same-origin unsafe request reaches the route', async () => {
    const { app } = buildApp();
    const response = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'http://localhost:57571')
        .send({ email: 'dm@example.com', password: 'password123' });

    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'Incorrect email or password.');
});

test('unknown API paths return a JSON 404', async () => {
    const { app } = buildApp();
    const response = await request(app).get('/api/nope');

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: 'Not found.' });
});

test('the SPA fallback serves index.html for non-API routes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'naxxar-static-'));
    await writeFile(join(directory, 'index.html'), '<html>Naxxar</html>');

    const { app } = buildApp({ config: { staticDir: directory } });
    const response = await request(app).get('/campaigns/naxxar/npcs');

    assert.equal(response.status, 200);
    assert.match(response.text, /Naxxar/);
});

test('the SPA fallback does not swallow /api routes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'naxxar-static-'));
    await writeFile(join(directory, 'index.html'), '<html>Naxxar</html>');

    const { app } = buildApp({ config: { staticDir: directory } });
    const response = await request(app).get('/api/does-not-exist');

    assert.equal(response.status, 404);
    assert.equal(response.type, 'application/json');
});

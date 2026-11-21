import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadConfig, validateProductionConfig } from '../src/config.js';

test('loadConfig derives a secure cookie from an https origin', () => {
    const config = loadConfig({ APP_ORIGIN: 'https://x.test' });

    assert.equal(config.cookieSecure, true);
    assert.equal(config.appOrigin, 'https://x.test');
});

test('loadConfig defaults to the local dev origin and an insecure cookie', () => {
    const config = loadConfig({});

    assert.equal(config.appOrigin, 'http://localhost:57571');
    assert.equal(config.cookieSecure, false);
    assert.equal(config.devDmEmail, 'dm@naxxar.local');
    assert.equal(config.devDmPassword, 'app');
    assert.equal(config.devCampaignName, 'Naxxar');
});

test('loadConfig no longer reads the shared password or session secret', () => {
    const config = loadConfig({ APP_PASSWORD: 'app', SESSION_SECRET: 'secret' });

    assert.equal('appPassword' in config, false);
    assert.equal('sessionSecret' in config, false);
});

test('loadConfig parses TRUST_PROXY', () => {
    assert.equal(loadConfig({ TRUST_PROXY: 'true' }).trustProxy, true);
    assert.equal(loadConfig({ TRUST_PROXY: '1' }).trustProxy, true);
    assert.equal(loadConfig({ TRUST_PROXY: '0' }).trustProxy, false);
});

test('production requires APP_ORIGIN and SMTP_URL', () => {
    const development = loadConfig({ NODE_ENV: 'development' });
    assert.deepEqual(validateProductionConfig(development), []);

    const missing = loadConfig({ NODE_ENV: 'production' });
    assert.deepEqual(validateProductionConfig(missing), ['APP_ORIGIN', 'SMTP_URL']);

    const configured = loadConfig({
        NODE_ENV: 'production',
        APP_ORIGIN: 'https://app.example.com',
        SMTP_URL: 'smtp://localhost:25'
    });
    assert.deepEqual(validateProductionConfig(configured), []);
});

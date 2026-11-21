export const loadConfig = (env = process.env) => {
    const appOrigin = env.APP_ORIGIN ?? 'http://localhost:57571';
    const nodeEnv = env.NODE_ENV ?? 'development';

    return {
        port: Number(env.PORT ?? 8000),
        mongoUri: env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
        mongoDb: env.MONGODB_DB ?? 'naxxar_campaign',
        staticDir: env.STATIC_DIR ?? null,
        appOrigin,
        appOriginConfigured: typeof env.APP_ORIGIN === 'string' && env.APP_ORIGIN !== '',
        googleClientId: env.GOOGLE_CLIENT_ID ?? null,
        smtpUrl: env.SMTP_URL ?? null,
        mailFrom: env.MAIL_FROM ?? 'Naxxar <no-reply@localhost>',
        trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
        cookieSecure: appOrigin.startsWith('https://'),
        nodeEnv,
        isProduction: nodeEnv === 'production',
        inMemoryDb: env.DEV_IN_MEMORY_DB === '1',
        devDmEmail: env.DEV_DM_EMAIL ?? 'dm@naxxar.local',
        devDmPassword: env.DEV_DM_PASSWORD ?? 'app',
        devCampaignName: env.DEV_CAMPAIGN_NAME ?? 'Naxxar'
    };
};

// Production must fail fast rather than silently skip password-reset email or CSRF origin checks.
export const validateProductionConfig = (config) => {
    if (!config.isProduction) {
        return [];
    }

    const missing = [];
    if (!config.appOriginConfigured) {
        missing.push('APP_ORIGIN');
    }
    if (config.smtpUrl === null || config.smtpUrl === '') {
        missing.push('SMTP_URL');
    }

    return missing;
};

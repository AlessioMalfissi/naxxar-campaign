export const loadConfig = (env = process.env) => ({
    port: Number(env.PORT ?? 8000),
    mongoUri: env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
    mongoDb: env.MONGODB_DB ?? 'naxxar_campaign',
    staticDir: env.STATIC_DIR ?? null
});

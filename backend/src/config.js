// All settings come from environment variables so the same image runs on
// a laptop, Staging and Production. See .env.example in the repo root.

const env = process.env;

const config = {
  port: Number(env.PORT) || 3000,
  nodeEnv: env.NODE_ENV || 'development',
  databaseUrl: env.DATABASE_URL || 'postgres://app:app@localhost:5432/urlshortener',
  baseUrl: (env.BASE_URL || 'http://localhost:8080').replace(/\/+$/, ''),
  gitSha: env.GIT_SHA || 'dev',
  buildTime: env.BUILD_TIME || '',
  ipHashSalt: env.IP_HASH_SALT || 'local-dev-salt',
  rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE) || 20,
};

if (config.nodeEnv === 'production' && !env.IP_HASH_SALT) {
  console.warn('IP_HASH_SALT is not set. Set a long random value on Staging and Production.');
}

export default config;

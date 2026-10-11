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
};

export default config;

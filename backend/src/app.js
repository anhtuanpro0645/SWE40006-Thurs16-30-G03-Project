import express from 'express';
import helmet from 'helmet';
import config from './config.js';
import { isDatabaseUp } from './db.js';

// Builds the Express app. It does not call listen(), so tests can import it
// with Supertest. server.js is the file that starts the server.
const app = express();

// The API runs behind Nginx, so trust one proxy hop. Without this every
// request would appear to come from the Nginx container's IP address.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(express.json({ limit: '10kb' }));

// Health check used by Docker, the post-deployment smoke test and monitoring.
// Returns 200 only when the database answers.
app.get('/health', async (req, res) => {
  const dbUp = await isDatabaseUp();
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'error',
    db: dbUp ? 'ok' : 'down',
    version: config.gitSha,
  });
});

// Unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Errors thrown in route handlers (Express 5 also catches rejected promises)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;

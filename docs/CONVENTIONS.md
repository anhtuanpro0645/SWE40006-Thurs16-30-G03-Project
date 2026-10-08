# Team conventions – SWE40006 G03

Shared names and values that more than one person depends on. If you need to change
something here, open a pull request and tell the people it affects. Do not rename
things silently in your own code.

## 1. Versions

| Tool | Version |
|---|---|
| Node.js | 22 LTS (`node:22-alpine` in Docker, `node-version: 22` in GitHub Actions) |
| PostgreSQL | 17 (`postgres:17-alpine`) |
| Package manager | npm, with `package-lock.json` committed. CI uses `npm ci` |

## 2. Folder layout

```
backend/
  src/                 Express app (app.js exports the app, server.js calls listen)
  db/init.sql          Creates the links and clicks tables
  tests/unit/          Vitest unit tests (Vinh)
  tests/integration/   Supertest + PostgreSQL tests (Vinh)
  Dockerfile
frontend/
  src/                 Vue 3 app
  Dockerfile           Builds with Vite, serves with Nginx
tests/e2e/             Playwright tests against Staging (Vinh)
deploy/
  docker-compose.prod.yml   Used on Staging and Production
monitoring/
  prometheus.yml, alert rules, Grafana dashboards (Duc)
docker-compose.yml     Local development (Minh)
```

`app.js` must export the Express app **without** calling `listen()`, so Supertest can
import it in tests. `server.js` imports the app and starts the server.

## 3. npm scripts

CI calls these names exactly. Every `package.json` must provide the ones listed for it.

| Script | backend | frontend | What it does |
|---|---|---|---|
| `npm run dev` | ✔ | ✔ | Run locally with reload |
| `npm start` | ✔ | – | Start the API (`node src/server.js`) |
| `npm run build` | – | ✔ | Build the Vue app with Vite |
| `npm run lint` | ✔ | ✔ | ESLint, fails on errors |
| `npm test` | ✔ | ✔ | Unit tests only, no database needed |
| `npm run test:coverage` | ✔ | – | Unit tests with coverage, fails below the threshold |
| `npm run test:integration` | ✔ | – | Integration tests, needs `DATABASE_URL` |

End-to-end tests: `npx playwright test` inside `tests/e2e/`, using `BASE_URL`.

Coverage threshold: **70% in Week 9, 80% from Week 10** (set in `vitest.config.js`).

## 4. Ports

| Service | Container port | Host port (local and servers) |
|---|---|---|
| web (Nginx + Vue) | 80 | 80 (local: 8080) |
| api (Express) | 3000 | not exposed publicly, Nginx proxies to it |
| db (PostgreSQL) | 5432 | not exposed publicly |
| Prometheus | 9090 | not public |
| Grafana | 3000 | 3001, restricted by security group |
| node_exporter | 9100 | not public |
| cAdvisor | 8080 | not public |

Nginx forwards `/api/*`, `/health` and every single-segment path (`/:code`, for
redirects) to the API. `/metrics` is **not** forwarded publicly; Prometheus scrapes
the API directly on the internal Docker network.

## 5. Environment variables

Real values live in `.env` (never committed) and GitHub Secrets. Commit `.env.example` with placeholder values.

| Variable | Used by | Example |
|---|---|---|
| `PORT` | api | `3000` |
| `NODE_ENV` | api | `development`, `test`, `production` |
| `DATABASE_URL` | api, tests | `postgres://app:app@db:5432/urlshortener` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | db | `app` / *(secret)* / `urlshortener` |
| `BASE_URL` | api, E2E tests | `http://localhost:8080` |
| `IP_HASH_SALT` | api | *(secret, random string)* |
| `RATE_LIMIT_PER_MINUTE` | api | `20` |
| `GIT_SHA` | api, web (build arg) | full commit SHA, set by CI |
| `BUILD_TIME` | api, web (build arg) | ISO 8601 time, set by CI |
| `IMAGE_TAG` | deploy compose | commit SHA of the image to run |

## 6. API endpoints

| Method | Path | Response |
|---|---|---|
| POST | `/api/links` | `201 { "code": "aB3x9Kq", "shortUrl": "...", "originalUrl": "..." }`, `400` invalid URL, `429` rate limited |
| GET | `/:code` | `302` redirect, `404` unknown code |
| GET | `/api/links/:code/stats` | `200 { "code", "totalClicks", "clicksPerDay": [...], "topReferrers": [...] }` |
| GET | `/health` | `200 { "status": "ok", "db": "ok", "version": "<GIT_SHA>" }`, `503` if the database is unreachable |
| GET | `/metrics` | Prometheus text format (internal only) |

Errors always use `{ "error": "<message>" }`.

## 7. Docker images

| Image | Name |
|---|---|
| API | `ghcr.io/anhtuanpro0645/swe40006-api:<commit-sha>` |
| Web | `ghcr.io/anhtuanpro0645/swe40006-web:<commit-sha>` |

The full commit SHA is the only tag we deploy. `latest` is never used on the servers.

## 8. GitHub Secrets

| Secret | Scope | Set by |
|---|---|---|
| `STAGING_HOST`, `STAGING_USER`, `STAGING_SSH_KEY` | `staging` environment | Duc gives values, Tuan stores them |
| `PROD_HOST`, `PROD_USER`, `PROD_SSH_KEY` | `production` environment (required reviewer) | Duc gives values, Tuan stores them |

The database password and `IP_HASH_SALT` live only in the `.env` file on each server.
Send secrets privately, never in issues, pull requests or group chat screenshots.

## 9. Git

- Branches: `feature/<issue>-short-name`, `fix/<issue>-short-name`, `docs/...`, `ci/...`, `chore/...`
- Commits: `feat:`, `fix:`, `test:`, `docs:`, `ci:`, `chore:`
- Pull requests: `Closes #<issue>` in the description, one approval, CI must pass

## 10. Issue dependencies

Start an issue only when the issues it depends on are merged, or agree with the owner
first. If you are waiting, add the `blocked` label.

| Issue | Owner | Depends on | Blocks |
|---|---|---|---|
| #2 App skeleton | Minh | – | #3, #4, #6, #7 |
| #3 Link and redirect API | Minh | #2 | #9, #10, #12 |
| #4 Vitest and coverage | Vinh | #2 | #6, #10 |
| #5 EC2 Staging and Production | Duc | – | #8, #11, #16 |
| #6 CI workflow | Tuan | #2, #4 | #7 |
| #7 Image build, Trivy, GHCR | Tuan, Vinh | #2, #6 | #11 |
| #8 Prometheus and Grafana | Duc | #5 (and #9 for app metrics) | #14 |
| #9 Metrics, stats page, footer | Minh | #3 | #8 |
| #10 Integration tests | Vinh | #3, #4 | – |
| #11 Staging deployment | Tuan | #5, #7 | #12, #16 |
| #12 Playwright E2E | Vinh | #3, #11 | #16 |
| #16 Production with approval | Tuan | #11, #12 | #13, #14 |
| #13 Rollback | Tuan | #16 | #17 |
| #14 Alerts and load test | Duc | #8, #16 | #17 |
| #17 Slides and demo | Whole team | #13, #14 | – |
| #15 Final report | Whole team | everything | – |

**Critical path:** #2 → #4 → #6 → #7 → #11 → #12 → #16 → #13. Anything late on
this path delays the demo, so flag problems early.

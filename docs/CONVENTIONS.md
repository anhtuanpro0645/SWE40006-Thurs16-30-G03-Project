# Team conventions – SWE40006 G03

Shared names and values that more than one person depends on. If you need to change
something here, open a pull request and tell the people it affects. Do not rename
things silently in your own code.

## 1. Versions

| Tool | Version |
|---|---|
| Node.js | 22 LTS (`node:22-alpine` in Docker, `node-version: 22` in GitHub Actions) |
| Express | 5 |
| Vue | 3, built with Vite |
| PostgreSQL | 17 (`postgres:17-alpine`) |
| Package manager | npm, with `package-lock.json` committed. CI uses `npm ci` |

## 2. Folder layout

```
backend/
  src/                 Express app (app.js exports the app, server.js calls listen)
  db/init.sql          Creates the links and clicks tables (IF NOT EXISTS, run by the API on start)
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

**Database schema.** PostgreSQL only runs scripts in `docker-entrypoint-initdb.d` on an
empty volume, so we do not rely on that. The API runs `db/init.sql` every time it starts.
Every statement must be safe to repeat (`CREATE TABLE IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`). Never put `DROP` or destructive changes in this file.

## 3. npm scripts

CI calls these names exactly. Every `package.json` must provide the ones listed for it.

| Script | backend | frontend | What it does |
|---|---|---|---|
| `npm run dev` | ✔ | ✔ | Run locally with reload |
| `npm start` | ✔ | – | Start the API (`node src/server.js`) |
| `npm run build` | – | ✔ | Build the Vue app with Vite |
| `npm run lint` | ✔ | ✔ | ESLint, fails on errors |
| `npm test` | ✔ | ✔ | Unit tests only, no database needed. Backend fails if no tests are found; frontend uses `--passWithNoTests` until it has tests |
| `npm run test:coverage` | ✔ | – | Unit tests with coverage, fails below the threshold |
| `npm run test:integration` | ✔ | – | Integration tests against a real PostgreSQL, needs a local `DATABASE_URL` (the tests refuse any other host) |

End-to-end tests: `npx playwright test` inside `tests/e2e/`, using `BASE_URL`.

Coverage threshold: **80%** for lines, statements, functions and branches (set in
`backend/vitest.config.js`). It was planned as 70% for Week 9, but unit coverage was
already 98% when the tests landed (#21), so 80% applies from the start. New backend
code must come with unit tests, or CI fails when coverage drops below 80%.

CI (`.github/workflows/ci.yml`) runs on every pull request and every push to `main`:

| Job | What it does |
|---|---|
| `backend` | `npm ci`, `lint`, `test:coverage`, then `test:integration` against a `postgres:17-alpine` service; uploads the `backend-coverage` artifact |
| `frontend` | `npm ci`, `lint`, `test`, `build` (runs in parallel with `backend`) |
| `image (api)`, `image (web)` | Builds the image, scans it with Trivy, pushes it to GHCR on `main` only |
| `deploy scripts` | `shellcheck` and the tests for the scripts in `deploy/` (`deploy/tests/`) |
| `build` | Passes only if every job above passed. This is the required check in `protect-main` |
| `deploy (staging)` | `main` only, after `build`: deploys the commit to Staging and runs the `/health` smoke test |
| `e2e` | `main` only, after `deploy (staging)`: runs the Playwright tests in `tests/e2e/` against Staging; uploads the `playwright-report` artifact |
| `deploy (production)` | `main` only, after `e2e`: waits for a reviewer to approve, then deploys the same commit to Production and runs the smoke test |

Manual rollback (`.github/workflows/rollback.yml`, Actions tab, "Manual rollback", Run
workflow): pick `staging` or `production` and paste the full SHA of any commit whose images
are in GHCR. Production still waits for the reviewer's approval. The run is red if the
chosen version is unhealthy, and the version that ran before is put back.

Both deploy jobs use the composite action `.github/actions/deploy-to-server`
(`setup-ssh.sh`, note the running version, copy files, `deploy.sh`, `smoke-test.sh`,
`rollback.sh` if one of those two failed, remove the key), so Staging and Production always
go through the same steps. Deployments to one server never run at the same time (the
`deploy-staging`, `deploy-production` concurrency groups, shared with the manual rollback), so
**a run waiting for Production approval holds the next merges** until it is approved or
rejected: approve or reject promptly. Limitation: a group keeps only one waiting run, so a
newer deployment cancels an older one that is still waiting (GitHub also offers `queue: max`
to keep all of them; not used yet because it has not been tried on this repo). Do not start a
manual rollback while a CI deployment to the same server is waiting, or one of them is cancelled.

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

Nginx routing:

| Path | Goes to |
|---|---|
| `/api/*`, `/health` | API |
| Single segment with no dot, matching `^/[A-Za-z0-9_-]+$` (short codes) | API, for redirects |
| `/metrics` | Blocked (404). Prometheus scrapes the API directly on the internal Docker network |
| Everything else (`/favicon.svg`, `/assets/*`, ...) | Static files, falling back to `index.html` |

Nginx must pass `X-Forwarded-For` and `X-Real-IP` to the API, and Express sets
`trust proxy` to `1`. Otherwise every visitor looks like the Nginx container's IP and the
rate limit is shared by everyone.

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
| `IMAGE_TAG` | deploy compose | full commit SHA of the images to run. Written to `image.env` by `deploy.sh`, never put in `.env` |

## 6. API endpoints

| Method | Path | Response |
|---|---|---|
| POST | `/api/links` | `201 { "code": "aB3x9Kq", "shortUrl": "...", "originalUrl": "..." }`, `400` invalid URL, `429` rate limited |
| GET | `/:code` | `302` redirect, `404` unknown code |
| GET | `/api/links/:code/stats` | `200 { "code", "totalClicks", "clicksPerDay": [...], "topReferrers": [...] }` |
| GET | `/health` | `200 { "status": "ok", "db": "ok", "version": "<GIT_SHA>" }`, or `503 { "status": "error", "db": "down", "version": "<GIT_SHA>" }` if the database is unreachable |
| GET | `/metrics` | Prometheus text format (internal only) |

Errors always use `{ "error": "<message>" }`.

## 7. Docker images and deployment

| Image | Name |
|---|---|
| API | `ghcr.io/anhtuanpro0645/swe40006-api:<commit-sha>` |
| Web | `ghcr.io/anhtuanpro0645/swe40006-web:<commit-sha>` |

The full commit SHA is the only tag we deploy. `latest` is never used on the servers.

- Each image is built once in CI, scanned with Trivy, and the same image is pushed. Images
  are only pushed from `main`, so every image in GHCR passed tests and the scan.
- Trivy fails the build on **CRITICAL** vulnerabilities that have a fix. Unfixed ones are
  listed in the run summary but do not block.
- `GIT_SHA` and `BUILD_TIME` are passed as build arguments, so `/health` and the footer
  show which commit is running.

**On each server** (Staging and Production), everything lives in `/home/deploy/app`:

| File | Written by | Contents |
|---|---|---|
| `docker-compose.prod.yml` | deploy job, every deployment | Copied from `deploy/`. Uses `image:` with `${IMAGE_TAG}`, never `build:` |
| `deploy.sh` | deploy job, every deployment | Copied from `deploy/`. `./deploy.sh <full SHA>` deploys that commit |
| `.env` | Duc, once per server, `chmod 600` | `POSTGRES_USER=app`, `POSTGRES_PASSWORD`, `POSTGRES_DB=urlshortener`, `IP_HASH_SALT`, `BASE_URL=http://<server IP>`, `RATE_LIMIT_PER_MINUTE=20`. Password and salt are random hex, different on each server |
| `image.env` | `deploy.sh` | `IMAGE_TAG=<full SHA>` of the running version |
| `image.env.previous` | `deploy.sh` | The version that ran before it, for rollback (#13) |

`deploy.sh` pulls both images first and only changes `image.env` if the pull worked, so a
failed pull never touches the running containers. It then runs `docker compose up --wait`,
which fails if a container does not become healthy within 180 seconds. A missing value in
`.env` stops the deployment with an error; nothing falls back to a default secret.

If the start fails, `image.env` already holds the new SHA (the containers were being
replaced) and the version that ran before is in `image.env.previous`. Removing old images
afterwards is best effort: if it fails, `deploy.sh` prints a warning but the deployment
still passes.

**Rollback (#13).** Before deploying, the deploy action reads `image.env` on the server
(`deploy/current-sha.sh`). If `deploy.sh` or the smoke test then fails, the action runs
`deploy/rollback.sh`, which redeploys that earlier SHA and checks `/health` reports it. The
job stays red, because the release failed, but the server is healthy again. The deploy job
keeps the compose file that was on the server as `docker-compose.prod.yml.previous` before it
copies the new one, and the rollback puts it back first, so a bad compose change does not
break the rollback too. Nothing is rolled back on the first deployment to a server (there is
no earlier version). The rollback starts only after the failed deployment gives up: a start
that never becomes healthy waits up to 180 seconds first, so allow about 4 to 5 minutes in the
worst case; `rollback.sh` prints how long the rollback itself took. A rollback
is temporary: the next merge to `main` deploys the newest commit again, so revert a bad
commit on `main` to keep the old version running.

After `deploy.sh`, the deploy job runs `deploy/smoke-test.sh http://<server> <SHA>` from the
runner. It passes only when `/health` answers 200 with `version` equal to that SHA (12 tries,
5 seconds apart). It can be run by hand from any machine with `curl` and `jq`.

The stack runs on the Docker network `swe40006-app`. Prometheus (#8) joins that network as
an external network to scrape `api:3000/metrics`.

To check or redeploy by hand on a server:

```bash
cd /home/deploy/app
cat image.env                       # which commit is running
./deploy.sh <full commit SHA>       # deploy a commit whose images are in GHCR
cat image.env.previous              # the version that ran before, to roll back by hand
docker compose --env-file .env --env-file image.env -f docker-compose.prod.yml ps
```

## 8. GitHub Secrets and variables

| Secret | Scope | Set by |
|---|---|---|
| Secrets `STAGING_HOST`, `STAGING_SSH_KEY`, `STAGING_KNOWN_HOSTS` | `staging` environment (`main` only) | Duc gives values, Tuan stores them |
| Secrets `PROD_HOST`, `PROD_SSH_KEY`, `PROD_KNOWN_HOSTS` | `production` environment (`main` only, required reviewer) | Duc gives values, Tuan stores them |
| Variables `STAGING_USER`, `PROD_USER` (both `deploy`) | the same environments, under **Variables** | Tuan |

The SSH user is a variable, not a secret: GitHub hides every secret value in the logs, and
a secret equal to `deploy` turned every "deploy" in the logs (step names, `deploy.sh`) into
`***`.

`*_KNOWN_HOSTS` is the server's `ssh-ed25519` host key line (from `ssh-keygen -F <host>`
after a first login whose fingerprint Duc confirmed). The deploy job keeps strict host
key checking on, so it refuses to connect if the server's key ever changes.

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

# SWE40006 – Group G03 – URL Shortener DevOps Pipeline

Team project for SWE40006 Software Deployment and Evolution (Thursday 16:30 tutorial).
We build a small URL shortener and use it to demonstrate a fully automated DevOps
pipeline across four environments: Development, Testing, Staging and Production.

| Member | Role | GitHub |
|---|---|---|
| Ngoc Anh Tuan Nguyen | Team Lead + CI/CD | @anhtuanpro0645 |
| Ha Minh Nguyen | App Developer | @hmnguyen2805 |
| Vinh Nghiem | Test & QA | @meomoc207 |
| Huu Tran Minh Duc | Infra & Monitoring | @HuuMinhDucTran |

## Repository layout

| Folder | Contents | Owner |
|---|---|---|
| `frontend/` | Vue 3 + Vite front end | Minh |
| `backend/` | Express API, database schema, unit and integration tests | Minh, Vinh (tests) |
| `tests/e2e/` | Playwright end-to-end tests run against Staging | Vinh |
| `deploy/` | Production Compose file and deployment scripts | Duc, Tuan |
| `monitoring/` | Prometheus, Grafana and alert configuration | Duc |
| `.github/` | GitHub Actions workflows, templates, CODEOWNERS | Tuan |
| `docs/` | Project brief, reports and evidence | Whole team |

## How we work

1. Pick an issue on the [project board](https://github.com/users/anhtuanpro0645/projects/1),
   assign yourself and move it to **In Progress**.
2. Update `main` and create a branch named after the issue:
   ```bash
   git switch main
   git pull
   git switch -c feature/<issue-number>-short-name   # or fix/..., docs/...
   ```
3. Commit small, focused changes using prefixes: `feat:`, `fix:`, `test:`, `docs:`, `ci:`, `chore:`.
4. Push and open a pull request. Write `Closes #<issue-number>` in the description.
   Move the card to **In Review**.
5. The pull request needs a passing CI check and one approval. Code owners are requested
   automatically (see `.github/CODEOWNERS`).
6. After merging, the issue closes and the card moves to **Done**.

Direct pushes to `main` are blocked by a repository ruleset.

## Rules

- Never commit secrets (passwords, SSH keys, tokens, `.env` files). Use GitHub Secrets and `.env.example`.
- Save screenshots and logs of your work in the shared evidence folder as you go. The final report needs them.
- If you are stuck waiting on someone, add the `blocked` label to your issue and mention the person.

## Running locally

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) (on Windows, virtualisation must be
enabled in the BIOS and WSL 2 installed).

```bash
docker compose up --build
```

This starts three containers:

| Container | What it runs | Address |
|---|---|---|
| `web` | Nginx serving the Vue app, proxying API calls | http://localhost:8080 |
| `api` | Express API (Node.js 22) | only reachable through `web` |
| `db` | PostgreSQL 17, data kept in the `pgdata` volume | not exposed |

Check it works:

- Open http://localhost:8080. The page should say "API and database are up".
- Open http://localhost:8080/health. It should return `{"status":"ok","db":"ok","version":"dev"}`.

No `.env` file is needed for local use. To change the defaults, copy `.env.example` to `.env` and edit it.

Useful commands:

```bash
docker compose ps              # container status and health
docker compose logs -f api     # follow the API logs
docker compose down            # stop (keeps the database)
docker compose down -v         # stop and delete the database volume
```

To run the API or front end without Docker, see `backend/README.md` and `frontend/README.md`.

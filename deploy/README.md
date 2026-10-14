# Deploy

Files used by the CI deploy jobs (issues #11 and #16). Owners: @HuuMinhDucTran and @anhtuanpro0645.

| File | What it is |
|---|---|
| `docker-compose.prod.yml` | The stack on Staging and Production: `db`, `api` and `web`, using the SHA-tagged images from GHCR |
| `deploy.sh` | Runs on the server: `./deploy.sh <full commit SHA>` pulls that commit's images and restarts the stack |
| `tests/deploy.test.sh` | Tests for `deploy.sh` with a fake `docker` command. CI runs them on every pull request |

The deploy job copies `docker-compose.prod.yml` and `deploy.sh` to `/home/deploy/app` on the
server and runs `deploy.sh` with the commit SHA. What lives on the server, and how to check
or redeploy by hand, is in `docs/CONVENTIONS.md`, section 7.

Run the tests locally (Linux, macOS or WSL):

```bash
bash deploy/tests/deploy.test.sh
```

Never commit server IPs, SSH keys, passwords or the servers' `.env` here. They are stored as
GitHub Secrets or only on the servers.

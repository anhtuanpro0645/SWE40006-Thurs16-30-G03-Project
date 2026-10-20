# Deploy

Files used by the CI deploy jobs (issues #11, #13 and #16). Owners: @HuuMinhDucTran and @anhtuanpro0645.

| File | What it is |
|---|---|
| `docker-compose.prod.yml` | The stack on Staging and Production: `db`, `api` and `web`, using the SHA-tagged images from GHCR |
| `deploy.sh` | Runs on the server: `./deploy.sh <full commit SHA>` pulls that commit's images and restarts the stack |
| `smoke-test.sh` | Runs on the CI runner after a deployment: `./smoke-test.sh http://<server> <full commit SHA>` passes only if `/health` reports that SHA |
| `current-sha.sh` | Runs on the CI runner before a deployment: prints the commit that is running on the server, so a failed deployment can go back to it |
| `rollback.sh` | Runs on the CI runner after a failed deployment: `./rollback.sh http://<server> <previous SHA> <failed SHA>` redeploys the previous commit and checks `/health` |
| `setup-ssh.sh` | Runs on the CI runner before a deployment: writes the key, the server's host key and an SSH config from the environment's secrets, with strict host key checking |
| `tests/deploy.test.sh` | Tests for `deploy.sh` with a fake `docker` command |
| `tests/smoke-test.test.sh` | Tests for `smoke-test.sh` with a fake `curl` command |
| `tests/rollback.test.sh` | Tests for `current-sha.sh` and `rollback.sh` with a fake `ssh` command |
| `tests/setup-ssh.test.sh` | Tests for `setup-ssh.sh` in a temporary home folder |

CI runs `shellcheck` and every test file on every pull request (job `deploy scripts`).
The deploy jobs call these scripts through `.github/actions/deploy-to-server`.

The deploy job copies `docker-compose.prod.yml` and `deploy.sh` to `/home/deploy/app` on the
server and runs `deploy.sh` with the commit SHA. What lives on the server, and how to check
or redeploy by hand, is in `docs/CONVENTIONS.md`, section 7.

Run the tests locally (Linux, macOS or WSL):

```bash
bash deploy/tests/deploy.test.sh
bash deploy/tests/smoke-test.test.sh
bash deploy/tests/setup-ssh.test.sh
bash deploy/tests/rollback.test.sh
```

Never commit server IPs, SSH keys, passwords or the servers' `.env` here. They are stored as
GitHub Secrets or only on the servers.

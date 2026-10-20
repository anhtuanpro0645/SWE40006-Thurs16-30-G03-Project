# Monitoring

Prometheus, node_exporter, cAdvisor and Grafana for the Production server, plus alert rules, the Grafana dashboard and a k6 load test. Owner: @HuuMinhDucTran. Issues #8 and #14.

## What runs where

| Service | Image | Port | Who can reach it |
|---|---|---|---|
| Prometheus | prom/prometheus:v2.53.0 | 9090 | Server localhost only (SSH tunnel) |
| node_exporter | prom/node-exporter:v1.8.2 | 9100 (host network) | Not public, the security group is closed |
| cAdvisor | gcr.io/cadvisor/cadvisor:v0.49.1 | 8080 | Internal Docker network only |
| Grafana | grafana/grafana:11.1.11 | 3001 | Only the IPs allowed in the Production security group |

The Compose project is called `swe40006-monitoring`. It is separate from the app project `swe40006-g03`, so an app deploy never removes these containers.

## Start (on the Production server)

The files live in `/home/deploy/monitoring`, not in `/home/deploy/app`. The folder needs a `.env` file with `GRAFANA_ADMIN_PASSWORD` (see `.env.example`). The real `.env` stays on the server and is never committed.

    cd /home/deploy/monitoring
    docker compose -f docker-compose.monitoring.yml -f docker-compose.app-network.yml up -d

Always pass both files. The second one joins Prometheus to the app's network `swe40006-app`, which is created by the app's own deploy (never create it by hand). With only the first file, Prometheus is recreated without the app network and the `api` target goes DOWN.

Check or stop the stack with the same two `-f` options:

    docker compose -f docker-compose.monitoring.yml -f docker-compose.app-network.yml ps
    docker compose -f docker-compose.monitoring.yml -f docker-compose.app-network.yml down

## Open Prometheus (SSH tunnel)

Prometheus only listens on the server's localhost. From your own computer:

    ssh -i <path-to-deploy-key> -L 9090:localhost:9090 deploy@<production-host>

Leave that window open, then browse to `http://localhost:9090/targets` (all four targets should be UP) and `http://localhost:9090/alerts`.

## Open Grafana

Go to `http://<production-host>:3001` and log in as `admin`. The password is `GRAFANA_ADMIN_PASSWORD` in the `.env` file on the server. If the page does not load, your IP is probably not in the Production security group for port 3001.

The Prometheus data source and the dashboard are provisioned from files, and the dashboard cannot be saved from the Grafana UI (`allowUiUpdates: false`). To change a panel, edit it in Grafana, export it (Share, Export, leave "Export for sharing externally" off) and replace `grafana/dashboards/production.json` in a pull request.

## Dashboard panels (Production Overview)

| Panel | Source | What it shows |
|---|---|---|
| CPU usage (%) | node_exporter | Share of CPU time that is not idle, averaged over all cores |
| RAM used (%) | node_exporter | Memory in use: 1 minus available divided by total |
| Disk I/O | node_exporter | Bytes read and written per second across the server's disks |
| Network traffic | node_exporter | Bytes per second in and out on real network interfaces (loopback, Docker bridges and veth are excluded) |
| Request rate by route | API `/metrics` (`http_requests_total`) | Requests per second for each route pattern, such as `/:code`, `/api/links` and `/health` |
| p95 latency by route | API `/metrics` (`http_request_duration_seconds`) | 95th percentile response time per route, measured by the server over a 5 minute window |

## Alert rules (`alert-rules.yml`)

| Alert | Fires when | Severity |
|---|---|---|
| AppDown | The API cannot be scraped (`up{job="api"} == 0`) for 1 minute | critical |
| HighCpu | CPU is above 80% for 5 minutes | warning |

Prometheus evaluates the rules every 15 seconds and shows them on its Alerts page. In testing, AppDown fired within 2 minutes of stopping the API. No notification channel (email or chat) is configured.

## Load test (`load-test/k6-load-test.js`)

The script creates 5 short links, then opens them with up to 20 virtual users for about 2 minutes. It does not follow the redirects. Run it from your own computer with Docker (PowerShell):

    docker run --rm -i -v "${PWD}/monitoring/load-test:/scripts" -e "BASE_URL=http://<production-host>" grafana/k6 run /scripts/k6-load-test.js

For a short smoke test, add `--vus 2 --duration 15s` after `run`. The test leaves test links and click rows in the Production database, so tell the team first, and do not run it during a deployment or a demo. The test passes when fewer than 1% of requests fail and the client-side p95 stays under 300 ms.

## Files

| File | Purpose |
|---|---|
| `docker-compose.monitoring.yml` | Prometheus, node_exporter, cAdvisor and Grafana |
| `docker-compose.app-network.yml` | Joins Prometheus to the app network |
| `prometheus.yml` | Scrape targets and rule file |
| `alert-rules.yml` | AppDown and HighCpu |
| `grafana/provisioning/datasources/prometheus.yml` | Prometheus data source with a fixed uid that the dashboard refers to |
| `grafana/provisioning/dashboards/dashboard.yml` | Tells Grafana to load dashboards from `/etc/dashboards` |
| `grafana/dashboards/production.json` | The exported dashboard |
| `load-test/k6-load-test.js` | k6 load test |
| `.env.example` | Placeholder only, never put real values in it |

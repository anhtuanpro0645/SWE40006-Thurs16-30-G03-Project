# Frontend

Vue 3 + Vite front end, served by Nginx in production. Owner: @hmnguyen2805.

See issues #2 and #9.

## Files

| Path | Purpose |
|---|---|
| `src/App.vue` | Home page |
| `vite.config.js` | Vite config. In dev mode it proxies `/api` and `/health` to `http://localhost:3000` |
| `nginx.conf` | Nginx config used in the Docker image (static files plus proxy to the API) |
| `Dockerfile` | Builds with Vite, then serves `dist/` with Nginx |

## Nginx routing

| Path | Goes to |
|---|---|
| `/api/*`, `/health` | API |
| `/<code>` (one segment, no dot) | API, for short-link redirects |
| `/metrics` | Blocked (404). Prometheus scrapes the API directly |
| everything else | Static files, falling back to `index.html` |

## Running without Docker

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173, needs the API running on port 3000
```

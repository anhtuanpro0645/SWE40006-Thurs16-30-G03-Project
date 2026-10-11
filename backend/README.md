# Backend

Express API and PostgreSQL schema. Owner: @hmnguyen2805. Unit and integration tests live in `backend/tests/` (owner: @meomoc207).

See issues #2, #3 and #9.

## Layout

| Path | Purpose |
|---|---|
| `src/app.js` | Builds and exports the Express app (no `listen()`, so Supertest can import it) |
| `src/server.js` | Starts the server and handles graceful shutdown |
| `src/config.js` | Reads settings from environment variables |
| `src/db.js` | PostgreSQL connection pool |

## Endpoints

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `200 { "status": "ok", "db": "ok", "version": "<GIT_SHA>" }`, or `503` with `"status": "error", "db": "down"` |

## Running without Docker

Needs a PostgreSQL server you can reach with `DATABASE_URL`.

```bash
cd backend
npm ci
DATABASE_URL=postgres://app:app@localhost:5432/urlshortener npm run dev
```

On Windows PowerShell set the variable first: `$env:DATABASE_URL="postgres://..."`.

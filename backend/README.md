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
| `src/schema.js` | Runs `db/init.sql` on start (safe to repeat, uses `IF NOT EXISTS`) |
| `src/routes/links.js` | `POST /api/links` |
| `src/routes/redirect.js` | `GET /:code` |
| `src/lib/validateUrl.js` | URL validation (no Express or database, easy to unit test) |
| `src/lib/shortCode.js` | 7-character base62 code generation with nanoid |
| `src/lib/hashIp.js` | Salted SHA-256 of the visitor IP |
| `db/init.sql` | `links` and `clicks` tables and the `(link_id, clicked_at)` index |

## Endpoints

| Method | Path | Response |
|---|---|---|
| POST | `/api/links` | Body `{ "url": "https://..." }`. `201 { "code", "shortUrl", "originalUrl" }`, `400` invalid URL, `429` rate limited |
| GET | `/:code` | `302` redirect to the original URL and one row in `clicks`, `404` unknown code |
| GET | `/health` | `200 { "status": "ok", "db": "ok", "version": "<GIT_SHA>" }`, or `503` with `"status": "error", "db": "down"` |

Errors always use `{ "error": "<message>" }`.

### URL rules (400 if broken)

- Must be a string, not empty, at most 2048 characters
- `http://` or `https://` only (rejects `javascript:`, `data:`, `ftp:` and so on)
- Must have a host name and must not contain `user:password@`

### Rate limit

`POST /api/links` allows `RATE_LIMIT_PER_MINUTE` requests per IP per minute (default 20), counting
rejected requests too. Extra requests get `429` and a `RateLimit` header. The count is kept in memory,
so it resets when the API restarts.

## Running without Docker

Needs a PostgreSQL server you can reach with `DATABASE_URL`.

```bash
cd backend
npm ci
DATABASE_URL=postgres://app:app@localhost:5432/urlshortener npm run dev
```

On Windows PowerShell set the variable first: `$env:DATABASE_URL="postgres://..."`.

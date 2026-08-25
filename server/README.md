# naxxar-campaign-server

Express + MongoDB API backing the Naxxar campaign codex. One collection, `entries`, one document per
codex entry, shaped like `ICodexEntry` (see `../src/app/core/models/i-codex-entry.ts`).

## Setup

```bash
cp .env.example .env   # then set MONGODB_URI (and MONGODB_DB if you don't want the default)
pnpm install            # from the repo root; server/ is part of the pnpm workspace
pnpm run server:seed    # from the repo root - loads the sample entries into Mongo
pnpm run server         # from the repo root, or `npm start` from here
```

`MONGODB_URI` can point at a local `mongod` (`mongodb://127.0.0.1:27017`) or an Atlas connection string
(`mongodb+srv://...`). The database name comes from `MONGODB_DB`, not the URI's path.

Run the API's own tests (no MongoDB required - routes are exercised against an in-memory fake collection
in `test-utils/fake-collection.mjs`):

```bash
pnpm run server:test    # from the repo root, or `npm test` from here
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8000` | Port the API listens on. |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | Connection string. |
| `MONGODB_DB` | `naxxar_campaign` | Database name. |
| `STATIC_DIR` | unset | If set, also serves this directory as the Angular app (SPA fallback to `index.html` for any non-`/api` route). Point it at `../dist/naxxar-campaign/browser` after `pn run build` to run the whole app from one process. |

## Endpoints

All responses are JSON. Entries are addressed by `section` + `slug` (matching the app's `section:slug`
entry id), not a Mongo ObjectId.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/entries` | List entries (summaries - no `body`), optionally filtered. |
| `GET` | `/api/entries/:section/:slug` | Fetch one entry, including its `body`. `404` if it doesn't exist. |
| `POST` | `/api/entries` | Create an entry. Slug is derived from `title` server-side. `409` on a duplicate slug in the section. |
| `PUT` | `/api/entries/:section/:slug` | Replace an existing entry (used for edits, favourite toggles, etc). `404` if it doesn't exist. |
| `DELETE` | `/api/entries/:section/:slug` | Delete an entry. Idempotent - `200` even if nothing matched. |

### Filtering `GET /api/entries`

Query params, all optional and combinable:

| Param | Example | Behaviour |
| --- | --- | --- |
| `section` | `npcs` | Exact match. |
| `status` | `Alive` | Exact match. |
| `visibility` | `dm` or `revealed` | Exact match. |
| `tags` | `ally,silver-ledger` | Comma-separated; an entry must have every listed tag. |
| `query` | `broker` | Case-insensitive substring match against `title` or `excerpt`. |

```bash
curl "http://localhost:8000/api/entries?section=npcs&status=Alive&tags=ally&query=broker"
```

### Creating an entry

```bash
curl -X POST http://localhost:8000/api/entries \
  -H 'Content-Type: application/json' \
  -d '{
    "section": "places",
    "title": "Emberfall Road",
    "status": "Visited",
    "tags": ["ally"],
    "visibility": "dm",
    "fields": { "type": "Road" }
  }'
```

`section` must be one of `npcs`, `players`, `places`, `organizations`, `story`, and `title` must be at
least two characters after trimming; anything else fails with `400`.

## Layout

```
server/
├── src/
│   ├── app.js          Express app factory - takes a Mongo collection as a dependency
│   ├── config.js        reads PORT / MONGODB_URI / MONGODB_DB / STATIC_DIR from the environment
│   ├── db.js             connects to MongoDB, ensures indexes
│   ├── entries.js        the /api/entries router
│   ├── http-error.js     HttpError(status, message) used for 4xx responses
│   ├── index.js           entry point: connect, then listen
│   ├── query.js           builds the MongoDB filter for GET /api/entries
│   └── sections.js        the five valid section ids
├── seed-data/codex/      sample entries as markdown, one folder per section
├── scripts/seed.mjs      parses seed-data/codex/**/*.md and upserts them into Mongo
├── test/                 route + query-builder specs (node:test)
└── test-utils/           the in-memory fake collection used by the tests above
```

`createApp(collection, options)` takes the Mongo collection as a parameter rather than importing a
singleton, so tests can pass in a fake collection instead of connecting to a real database.

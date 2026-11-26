# naxxar-campaign-server

Express + MongoDB API for the Naxxar campaign dashboard. Accounts, campaigns and campaign content all
live in MongoDB:

| Collection        | Contents                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `users`           | One document per account: email, display name, Argon2id hash, Google sub, optional super-admin flag |
| `sessions`        | Opaque session tokens, stored as SHA-256 hashes with an expiry                                      |
| `campaigns`       | Campaign name and URL slug                                                                          |
| `memberships`     | `{ campaignId, userId, role }`, `_id` is `${campaignId}:${userId}`                                  |
| `invites`         | Single-use invite tokens, stored hashed, with a seven-day expiry                                    |
| `password_resets` | Single-use reset tokens, stored hashed, with a one-hour expiry                                      |
| `entries`         | Codex entries, shaped like `ICodexEntry`, `_id` is `${campaignId}:${section}:${slug}`               |
| `inventory`       | Items, shaped like `IInventoryItem`, `_id` stays a UUID                                             |
| `purses`          | Gold by owner, shaped like `IPurse`, `_id` is `${campaignId}:${owner}`                              |
| `combat`          | One encounter per campaign, `_id` is `${campaignId}:current`                                        |

The interfaces are in `../src/app/core/models/`.

## Setup

```bash
pnpm install            # from the repo root; server/ is part of the pnpm workspace
pnpm run dev            # from the repo root - local API + Angular app, no MongoDB required
pnpm run server         # from the repo root, or `npm start` from here - needs a real MongoDB
```

`pnpm run dev` defaults `PORT` to `3000` and falls back to the seeded in-memory database when
`MONGODB_URI` is unset, so a fresh clone works without a `.env`. The in-memory database seeds one DM
account and one campaign:

| Field    | Value             |
| -------- | ----------------- |
| Email    | `dm@naxxar.local` |
| Password | `app`             |
| Campaign | `naxxar`          |

Set `MONGODB_URI` in `server/.env` to use a real database in dev instead. The in-memory database is
dev-only; `pnpm run server` always connects to MongoDB and never seeds a dev user.

Create the first real account, campaign and sample lore once:

```bash
pnpm --dir server run bootstrap -- user \
  --email dm@example.com --name "Dungeon Master" --password "change-me-now"
pnpm --dir server run bootstrap -- campaign \
  --slug naxxar --name Naxxar --dm-email dm@example.com
pnpm --dir server run seed -- --campaign naxxar
```

Passwords can also come from `BOOTSTRAP_PASSWORD` instead of `--password`. `bootstrap user` without a
password creates an account that can only sign in with Google. `bootstrap campaign` promotes an existing
user to DM; there is deliberately no public way to become the first DM.

For a personal account that can inspect and manage every campaign, create or promote a deployment-wide
super admin:

```bash
# Create a new super admin account (or pass an existing email to promote it).
pnpm --dir server run bootstrap -- superadmin \
  --email you@example.com --name "Your Name" --password "change-me-now"

# Promote an existing account without changing its name or password (unless one is supplied).
pnpm --dir server run bootstrap -- superadmin --email you@example.com
```

A super admin resolves to an effective `dm` role in every campaign, including campaigns they have not
joined. That is full read/write access: DM-only entries, members and email addresses, invites, inventory,
purses, combat, and the live combat socket. Treat the account as production infrastructure, not a
normal DM account.

After that, everyone else joins through invites created by a DM in the app's **Members** page - never
through a public registration form.

Run the API's own tests (no MongoDB required - routes are exercised against the same in-memory collection
implementation the dev fallback uses):

```bash
pnpm run server:test    # from the repo root, or `npm test` from here
```

## Environment variables

| Variable            | Default                       | Purpose                                                                                                                                                                                                                    |
| ------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`              | `8000`                        | Port the API listens on. The dev script defaults it to `3000` to match the Angular proxy.                                                                                                                                  |
| `NODE_ENV`          | `development`                 | `production` enables the fail-fast config check and disables the dev reset-link log.                                                                                                                                       |
| `MONGODB_URI`       | `mongodb://127.0.0.1:27017`   | Connection string. When unset in dev, the API uses the seeded in-memory database instead.                                                                                                                                  |
| `MONGODB_DB`        | `naxxar_campaign`             | Database name.                                                                                                                                                                                                             |
| `APP_ORIGIN`        | `http://localhost:57571`      | Public origin of the app. Session cookies are `Secure` on an `https://` origin, and state-changing requests are rejected when their `Origin` is different. Required in production.                                         |
| `GOOGLE_CLIENT_ID`  | unset                         | Google Identity Services client id. When unset, `/api/config` reports no client id and Google sign-in endpoints return `503`.                                                                                              |
| `SMTP_URL`          | unset                         | SMTP connection URL for password-reset email, e.g. `smtp://user:pass@smtp.example.com:587`. Required in production; in development the reset link is logged instead.                                                       |
| `MAIL_FROM`         | `Naxxar <no-reply@localhost>` | From address on reset email.                                                                                                                                                                                               |
| `STATIC_DIR`        | unset                         | If set, also serves this directory as the Angular app (SPA fallback to `index.html` for any non-`/api` route). Point it at `../dist/naxxar-campaign/browser` after `pnpm run build` to run the whole app from one process. |
| `TRUST_PROXY`       | unset                         | `1` or `true` behind a trusted reverse proxy, so rate limits and cookies see the client IP and protocol correctly.                                                                                                         |
| `DEV_IN_MEMORY_DB`  | unset                         | `1` uses the seeded in-memory database. The dev script sets it when `MONGODB_URI` is missing; the normal `start` script never sets it.                                                                                     |
| `DEV_DM_EMAIL`      | `dm@naxxar.local`             | Dev-only seed account email. Never used with MongoDB.                                                                                                                                                                      |
| `DEV_DM_PASSWORD`   | `app`                         | Dev-only seed account password. Never used with MongoDB.                                                                                                                                                                   |
| `DEV_CAMPAIGN_NAME` | `Naxxar`                      | Dev-only seed campaign name. Never used with MongoDB.                                                                                                                                                                      |

`APP_PASSWORD` and `SESSION_SECRET` have been removed. Sessions are database records, so there is no
shared password and no cookie-signing secret to configure.

## Authentication

Accounts are invite-only. `POST /api/auth/login` verifies an Argon2id password; `POST /api/auth/google`
verifies a Google Identity Services credential. Both create an opaque 32-byte token, store only its
SHA-256 hash in `sessions`, and set it in the `naxxar_session` cookie (`httpOnly`, `SameSite=Lax`,
`Path=/`, 30 days, `Secure` on an https origin). The cookie is not signed - the database record is the
source of truth.

`/api/auth/me` is anonymous-safe: it returns `{ "user": null, "campaigns": [] }` with `200` when there
is no session. The Angular session check relies on that so a signed-out visitor never sees a failed
request. Any other protected route returns `401` without a valid session.

Password reset is enumeration-safe: `POST /api/auth/forgot-password` always returns `202`, whether or
not the email exists. A valid request stores a hashed, single-use, one-hour token and emails a link to
`${APP_ORIGIN}/reset-password/<token>`. Completing the reset revokes every session for that user.

| Method | Path                        | Description                                                                                         |
| ------ | --------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/config`               | Public runtime config: `{ "googleClientId": string or null }`, `Cache-Control: no-store`.           |
| `POST` | `/api/auth/login`           | Body `{ email, password }`. Sets the session cookie. `401` with a generic error on bad credentials. |
| `POST` | `/api/auth/google`          | Body `{ credential }`. Signs in an existing account. `403` if no account exists; never registers.   |
| `POST` | `/api/auth/logout`          | Revokes the current session and clears the cookie. Always `200`.                                    |
| `GET`  | `/api/auth/me`              | Current `{ user, campaigns }`, or `{ user: null, campaigns: [] }` when anonymous.                   |
| `POST` | `/api/auth/forgot-password` | Body `{ email }`. Always `202`; emails a reset link if the account exists.                          |
| `POST` | `/api/auth/reset-password`  | Body `{ token, password }`. Password must be 8-128 characters. Revokes the user's sessions.         |

Auth payloads use `{ user: { id, email, displayName, isSuperAdmin? }, campaigns: [{ id, slug, name, role }] }`.
`isSuperAdmin` is present only for super-admin accounts. Invite registration adds the joined campaign as
`campaign`.

## Invites and campaigns

| Method | Path                                   | Description                                                                                                                     |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/invites/:token`                  | Public preview: `{ campaignName, campaignSlug, expiresAt }`. `404` unknown, `410` used/expired.                                 |
| `POST` | `/api/invites/:token/register`         | Public. Body `{ displayName, email, password }`. Creates the account and a `player` membership, then signs in.                  |
| `POST` | `/api/invites/:token/google`           | Public. Body `{ credential, displayName? }`. Creates or links a Google account and a `player` membership.                       |
| `POST` | `/api/invites/:token/accept`           | Session required. Adds the signed-in user to the campaign as `player`.                                                          |
| `GET`  | `/api/campaigns`                       | Campaigns the current user belongs to, sorted by name. Super admins get every campaign as `dm`.                                 |
| `POST` | `/api/campaigns`                       | Body `{ name }`. Creates a campaign and makes the caller its `dm`. Name is 2-80 characters; slug is generated.                  |
| `GET`  | `/api/campaigns/:campaignSlug`         | `{ campaign }` for a member. `404` for a non-member, so campaign existence is not disclosed.                                    |
| `GET`  | `/api/campaigns/:campaignSlug/members` | Roster. Email addresses are included only for the campaign DM.                                                                  |
| `GET`  | `/api/campaigns/:campaignSlug/invites` | DM only. `{ invites: [{ createdAt, expiresAt, usedAt, status }] }`, newest first.                                               |
| `POST` | `/api/campaigns/:campaignSlug/invites` | DM only. Creates a seven-day, single-use invite. Returns `{ invite: { url, expiresAt } }` once - the URL is never listed again. |

Every campaign route runs an access check first. A missing campaign and a campaign the user has not
joined both return `404 Campaign not found.`; a member whose role is too low gets
`403 Only the DM can change campaign content.` An account with `isSuperAdmin: true` bypasses the
membership lookup and resolves to an effective `dm` role in every campaign.

Invites and password-reset tokens are stored hashed. Losing the database does not leak usable tokens,
and a used or expired token cannot be replayed.

## Campaign content endpoints

All routes below require a session and a campaign membership. They are mounted under
`/api/campaigns/:campaignSlug`; `entries`, `inventory`, `purses` and `combat` are scoped to that campaign
server-side, so a client cannot address another campaign's data by changing an id.

| Method   | Path                                          | Description                                                                                                 |
| -------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/campaigns/:slug/entries`                | List entry summaries (no `body`), optionally filtered. Players never see `visibility: dm` entries.          |
| `GET`    | `/api/campaigns/:slug/entries/:section/:slug` | Fetch one entry including `body`. `404` if missing or DM-only for a player.                                 |
| `POST`   | `/api/campaigns/:slug/entries`                | DM only. Create an entry; slug is derived from `title`. `409` on a duplicate in the section.                |
| `PUT`    | `/api/campaigns/:slug/entries/:section/:slug` | DM only. Replace an entry.                                                                                  |
| `DELETE` | `/api/campaigns/:slug/entries/:section/:slug` | DM only. Delete an entry. Idempotent.                                                                       |
| `GET`    | `/api/campaigns/:slug/inventory`              | List every item, sorted by name.                                                                            |
| `POST`   | `/api/campaigns/:slug/inventory`              | DM only. Create an item.                                                                                    |
| `PATCH`  | `/api/campaigns/:slug/inventory/:id`          | DM only. Update item fields. `404` if missing.                                                              |
| `DELETE` | `/api/campaigns/:slug/inventory/:id`          | DM only. Delete an item. Idempotent.                                                                        |
| `GET`    | `/api/campaigns/:slug/purses`                 | List every purse that has been set.                                                                         |
| `PUT`    | `/api/campaigns/:slug/purses/:owner`          | DM only. Create or replace the purse for `owner` with `{ gold }`.                                           |
| `GET`    | `/api/campaigns/:slug/combat`                 | The current encounter. Before anything is saved: `{ revision: 0, round: 0, turnId: null, combatants: [] }`. |
| `PUT`    | `/api/campaigns/:slug/combat`                 | DM only. Replace the encounter. Returns it with a new server-set `revision`.                                |
| `GET`    | `/api/campaigns/:slug/combat/live`            | WebSocket upgrade for live encounter sync (see below).                                                      |

### Role matrix

| Capability                                | `dm` | `player` | super admin |
| ----------------------------------------- | ---- | -------- | ----------- |
| List/open joined campaigns                | yes  | yes      | all         |
| Read entries, inventory, purses, combat   | yes  | yes      | yes         |
| Read `visibility: dm` entries / DM blocks | yes  | no       | yes         |
| Create/edit/delete entries                | yes  | no       | yes         |
| Create/update/delete inventory and purses | yes  | no       | yes         |
| Start/update/end combat                   | yes  | no       | yes         |
| Open the live combat socket               | yes  | yes      | yes         |
| See member email addresses                | yes  | no       | yes         |
| Create/list campaign invites              | yes  | no       | yes         |
| Create a new campaign                     | yes  | yes      | yes         |
| Use the DM preview of the player view     | yes  | n/a      | yes         |

Players are read-only by role, not by hiding buttons: every write above is rejected by the API with
`403`.

`isSuperAdmin` is a flag on the user document, set only by `bootstrap superadmin` - no public route can
grant it. Super admins do not appear in a campaign roster unless they also join it, but every campaign
resolves to an effective `dm` role for them. To revoke access, unset the flag in MongoDB; the next
request from that account sees normal membership rules again.

### Filtering `GET /api/campaigns/:slug/entries`

Query params, all optional and combinable:

| Param        | Example              | Behaviour                                                      |
| ------------ | -------------------- | -------------------------------------------------------------- |
| `section`    | `npcs`               | Exact match.                                                   |
| `status`     | `Alive`              | Exact match.                                                   |
| `visibility` | `dm` or `revealed`   | Exact match, except a player's `dm` filter is overridden.      |
| `tags`       | `ally,silver-ledger` | Comma-separated; an entry must have every listed tag.          |
| `query`      | `broker`             | Case-insensitive substring match against `title` or `excerpt`. |

```bash
curl "http://localhost:8000/api/campaigns/naxxar/entries?section=npcs&status=Alive&tags=ally&query=broker" \
  --cookie "naxxar_session=<token>"
```

The `visibility` query param is ignored for players: the server always adds `{ visibility: { $ne: 'dm' } }`
so a hand-written request cannot reveal a DM entry.

### Creating an entry

```bash
curl -X POST http://localhost:8000/api/campaigns/naxxar/entries \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:57571' \
  --cookie "naxxar_session=<token>" \
  -d '{
    "section": "places",
    "title": "Emberfall Road",
    "status": "Visited",
    "tags": ["ally"],
    "visibility": "dm",
    "fields": { "type": "Road" }
  }'
```

`section` must be one of `npcs`, `players`, `places`, `organizations`, `story`, `rules`, and `title` must
be at least two characters after trimming; anything else fails with `400`.

### Inventory and purses

`owner` is either the literal `"party"` or a codex entry id of a `players` entry (for example
`"players:tessaly-oakhand"`). The API stores the string as given; resolving it to a display name is the
app's job. Inventory `rarity` is one of `none`, `common`, `uncommon`, `rare`, `very-rare`, `legendary`,
`artifact`, and `status` is one of `mundane`, `non-attuned`, `attuned`, `magic`; invalid values fall back
to the default on create or the previous value on update. Purse `gold` must be a non-negative number
(fractional values are floored).

### Combat and live sync

The combat tracker is one encounter document per campaign that the app reads and writes whole.
`combatants` must be a list of at most 100, each with a unique non-blank `id` and `name`. Each combatant
carries `kind` (`player` or `enemy`, default `enemy`), `entryId`, an integer `initiative`, an integer
`initiativeNudge` (higher first), a `color` (`#rrggbb` or `null`), a `name` capped at 100 characters,
nullable non-negative integers `hp`, `maxHp` and `ac` (players only; always `null` for an enemy), and
`conditions` - a list of `{ name, rounds }` where `rounds` is at least 1 or `null`. `round` is clamped to
zero or more, and a `turnId` that does not match a combatant is stored as `null`.

`GET /api/campaigns/:campaignSlug/combat/live` upgrades to a WebSocket that keeps every open tracker for
that campaign in sync. The upgrade needs the session cookie and campaign access (a membership, or the
super-admin flag); without them it returns `401` or `404`. On connect the server sends the current
encounter, then the encounter saved by every `PUT`, in revision order:

```json
{ "type": "encounter", "encounter": { "revision": 8, "round": 1, "turnId": "goblin-1", "combatants": [] } }
```

The socket is push-only: writes still go through `PUT .../combat`, and anything a client sends is
ignored. The server pings every 30 seconds and drops connections that stop answering. Clients compare
`revision`s to discard a snapshot older than the one they already show, since a save's HTTP response and
its broadcast can arrive in either order. Behind a reverse proxy, forward WebSocket upgrades on
`/api/campaigns/*/combat/live`; the Angular dev proxy in `proxy.conf.json` already does, via `"ws": true`.

## Security notes

- **CSRF.** State-changing requests must carry an `Origin` equal to `APP_ORIGIN`, or no cross-site
  `Sec-Fetch-Site`. A mismatch fails with `403 Cross-origin request rejected.` The session cookie is
  `SameSite=Lax` as a second layer. Keep the app same-origin and set `APP_ORIGIN` exactly.
- **Cookies.** `Secure` is derived from the `APP_ORIGIN` scheme. Serving production over plain HTTP
  therefore drops that flag; always deploy behind HTTPS.
- **Rate limits.** Login and Google login allow 10 attempts per 15 minutes per IP; password reset
  allows 5; invites allow 20. They use `express-rate-limit`'s in-memory store, so they are per-process.
  Running several API instances needs a shared store (Redis) or a proxy-level limit.
- **Sessions.** 30-day opaque tokens; only hashes are stored. Password reset and
  `bootstrap reset-password` revoke existing sessions. There is no refresh token and no sliding expiry.
- **Invites.** Seven-day, single-use, hashed tokens; the full URL is returned only once at creation.
  Possession of the link is the authorization, so share it privately.
- **Authorization.** Every campaign route loads the membership from the database before touching
  content. Ids embed the campaign id, but handlers still filter by `campaignId`, so guessing another
  campaign's id is not enough. A user with `isSuperAdmin: true` deliberately bypasses that membership
  check and gets DM access to every campaign.
- **Super admin.** The flag is set only by `bootstrap superadmin` and cannot be granted through the API.
  It is full write access across the deployment, including member email addresses and invite creation.
  Keep the credentials separate from normal campaign accounts and unset the flag if the account is no
  longer needed.
- **Secrets.** MongoDB credentials live only in `MONGODB_URI`; SMTP credentials only in `SMTP_URL`.
  Google verifies the ID token against `GOOGLE_CLIENT_ID`. The server never stores Google access tokens.
- **Production fail-fast.** `NODE_ENV=production` refuses to start without `APP_ORIGIN` and `SMTP_URL`,
  so password reset cannot silently degrade and CSRF checks cannot fall back to a dev origin.

## Migration and maintenance

The `migrate` script moves legacy, campaign-less documents into one campaign. It is a one-shot operation
for databases created before multi-campaign support; run it after bootstrap creates the campaign:

```bash
# Preview first; nothing is written.
pnpm --dir server run migrate -- --campaign naxxar --dry-run

# Then apply. Entries/purses/combat get new campaign-scoped _ids; inventory keeps its UUID and
# gains campaignId.
pnpm --dir server run migrate -- --campaign naxxar
```

Because Mongo `_id` values are immutable, entries, purses and combat are re-inserted under their new id
and the old document is deleted. Run it with the API stopped, and take a backup first.

Other maintenance commands:

```bash
# Update a display name, and optionally the password (revokes that user's sessions).
pnpm --dir server run bootstrap -- user \
  --email dm@example.com --name "New Name" --password "new-password"

# Reset a forgotten password and revoke sessions, without email.
pnpm --dir server run bootstrap -- reset-password \
  --email dm@example.com --password "new-password"

# Re-seed the sample entries into a campaign; existing entries are replaced by _id.
pnpm --dir server run seed -- --campaign naxxar
pnpm --dir server run seed -- --dm-email dm@example.com   # or pick that user's DM campaign
```

## Production checklist

1. Set `NODE_ENV=production`, `APP_ORIGIN=https://your-domain`, `SMTP_URL`, `MONGODB_URI`, `MONGODB_DB`
   and `STATIC_DIR=../dist/naxxar-campaign/browser`. Set `TRUST_PROXY=true` if a proxy terminates TLS.
2. Run `pnpm install && pnpm run build`, then start the API with `pnpm run server` (or `npm start` in
   `server/`). One process serves both the API and the SPA.
3. Create the first account and campaign with `bootstrap user` and `bootstrap campaign`. Confirm the API
   starts without the dev in-memory user. If you need a personal deployment-wide account, create it with
   `bootstrap superadmin` (see above) and keep its credentials separate from campaign DMs.
4. Forward `/api/*` and WebSocket upgrades for `/api/campaigns/*/combat/live` to the Node process.
5. Back up MongoDB. The reset-token and session collections expire through TTL indexes, but campaigns,
   memberships and content do not.
6. If you run more than one API instance, move rate limiting to a shared store and ensure the combat
   WebSocket broadcasts reach every instance (the current bus is per-process).

## Layout

```
server/
├── src/
│   ├── app.js              Express app factory - takes the collections and { config, passwords, google, mailer, combatLive, rateLimiters }
│   ├── auth.js             /api/auth: login, Google, logout, me, forgot/reset password
│   ├── campaign-access.js  membership loading, DM assertion, 404-vs-403 policy
│   ├── campaigns.js        /api/campaigns, campaign summary, members, nested content routers
│   ├── combat.js           campaign combat router
│   ├── combat-live.js      per-campaign combat WebSocket
│   ├── config.js           reads the environment and validates production requirements
│   ├── db.js               connects to MongoDB and creates indexes
│   ├── entries.js          campaign entries router and visibility filtering
│   ├── google.js           Google ID-token verifier
│   ├── index.js            entry point: config, services, database, server, WebSocket
│   ├── in-memory-collection.js  collection API shared by the dev fallback and tests
│   ├── in-memory-db.js     seeded dev database and dev DM account
│   ├── inventory.js        campaign inventory router
│   ├── invites.js          public invite routes and DM invite management
│   ├── mailer.js           SMTP transport, or console reset links in development
│   ├── passwords.js        Argon2id hash/verify and password rules
│   ├── purses.js           campaign purses router
│   ├── query.js            builds the entries filter
│   ├── rate-limit.js       login/reset/invite limiters; pass-throughs for tests
│   ├── sections.js         the six valid section ids
│   ├── seed.js             parses seed-data/codex for the fallback and the seed script
│   ├── sessions.js         opaque tokens, cookies, origin check, loadSession/requireAuth
│   ├── slugify.js          campaign slug generation
│   └── users.js            user lookup/creation and public user shape
├── seed-data/codex/        sample entries as markdown, one folder per section
├── scripts/
│   ├── bootstrap.mjs       users, super admins, campaigns, password resets
│   ├── dev-env.mjs         dev defaults for PORT and the in-memory database
│   ├── migrate-campaign-scope.mjs  legacy data migration
│   └── seed.mjs            upserts seed-data/codex into one campaign
├── test/                   route, auth, config and query-builder specs (node:test)
└── test-utils/             fakes used by the tests
```

`createApp(collections, options)` takes the Mongo collections as a parameter rather than importing a
singleton, so tests can pass fake collections instead of connecting to a real database. `config` and
`passwords` are required; `google`, `mailer` and `combatLive` are optional in tests.

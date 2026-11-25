# Public Authentication & Multi-Campaign Tenancy — Implementation Plan

**Status:** Ready for implementation
**Created:** 2026-11-19
**Complexity:** XL (full-stack, security-sensitive, data migration)
**Estimated effort:** 6–9 implementation sessions
**Plan file:** `.claude/PRPs/plans/public-authentication-multi-campaign.plan.md`
**Implementation state:** Not started. No application code has been changed for this plan.

---

## 1. Summary

Naxxar campaign currently has one shared password (`APP_PASSWORD`), one hard-coded campaign, and one
global set of codex, inventory, purse, and combat documents. This plan replaces that with:

- individual user accounts (email + password, plus Google sign-in);
- invite-only account creation;
- multiple campaigns, each with its own members and content;
- campaign roles (`dm` and `player`) enforced by the API, not only by the Angular UI;
- database-backed sessions with an opaque `naxxar_session` cookie;
- campaign-scoped URLs, API routes, and combat WebSocket rooms;
- password reset by email;
- a campaign picker, invite registration/acceptance page, and members/invite management page;
- migration of existing global documents into a first campaign, plus a bootstrap/reset CLI.

The target deployment is still a single Express process serving the Angular bundle and the API from the
same origin. The design protects the data model and API contracts so a future reverse proxy or multiple
API instances remain possible, while explicitly leaving distributed WebSocket broadcasting and shared
rate-limit storage out of scope.

### 1.1 Why this shape

- **Campaign is the tenant boundary.** Every content document carries `campaignId`; every scoped API
  request resolves `:campaignSlug` to a campaign and checks membership before touching content.
- **Authorization is server-side.** Hiding DM-only entries or write controls in Angular is a UX
  convenience; the API independently returns `403`/`404` and filters content for players.
- **Invite-only avoids open registration.** A valid invite is a bearer credential with a hashed,
  expiring, single-use token. Any signed-in user can create a new campaign and becomes its DM.
- **Opaque sessions beat signed shared-password cookies for a public app.** The raw token lives only in
  the browser cookie; the database stores only its SHA-256 hash, and revocation is a delete.
- **Campaign-local public references stay stable.** The browser still uses `section:slug` for codex
  entry references. The server widens only the storage key to
  `${campaignId}:${section}:${slug}`, so existing markdown links and model shapes remain usable.

---

## 2. User Story

> As a tabletop group using Naxxar, I want each person to have their own account and to be able to run
> more than one campaign, so that a DM can publish the app to a wider audience without giving everyone
> the same password or mixing one campaign's lore with another's.

A second story drives the authorization work:

> As a DM, I want to send a player an invite link and have that player see only what the party is allowed
> to see, so that DM notes and write actions cannot be reached by editing a URL or calling the API.

A third story covers account recovery and onboarding:

> As an invited player, I want to create my account with a password or Google, and later reset a forgotten
> password by email, so that I can get back to the campaign without asking the DM to reset the server.

---

## 3. User-Facing Outcomes

### Before

- `GET /login` asks for one shared campaign password.
- A valid password sets `naxxar_session=authenticated.<hmac>`.
- All data is global: `/api/entries`, `/api/inventory`, `/api/purses`, `/api/combat`.
- `/campaign/...` is the only route tree; the campaign name is a hard-coded `"Naxxar campaign"` signal.
- Any signed-in user can toggle a client-only "player view"; the API never knows who they are or what
  role they have.
- There is no account identity, campaign list, invite flow, password reset, or membership management.
- There is no way to keep two campaigns isolated; creating a second campaign would collide on entry
  `_id` (`section:slug`), purse `_id` (owner), and the single combat `_id` (`current`).

### After

- `/login` has email + password, "Forgot password?", and a Google sign-in button when configured.
  There is no public "Create account" link; `/register` redirects to `/login` with an invite-only note.
- `/forgot-password` accepts an email and always returns a generic confirmation.
- `/reset-password/:token` lets the user choose a new password and returns them to `/login`.
- `/invite/:token` previews the campaign. A signed-in user joins with one click. An anonymous visitor
  holding the link can create an account with display name, email, and password, or with Google, then
  joins. Account creation is possible only through a valid invite; `/register` still redirects to
  `/login` with an invite-only note.
- `/campaigns` lists the campaigns the user belongs to and lets any signed-in user create a campaign. The
  creator becomes that campaign's DM.
- `/campaigns/:campaignSlug/:section` and `/campaigns/:campaignSlug/:section/:slug` show campaign-scoped
  content. Inventory, combat, and members live under the same `/campaigns/:campaignSlug/...` prefix.
- The shell header shows the real campaign name and the signed-in user's initials. The account menu links
  to "Your campaigns", offers "Preview player view" only for DMs, and signs out.
- A DM sees a Members page with the member list and copy-link invites. Players see the member list but no
  invite controls.
- A player's UI is read-only for codex, inventory, and combat; DM-only entries and DM-only markdown blocks
  are absent from player API responses. A DM can still preview the player view, but the server keeps the
  DM's write access during that preview (preview changes rendering, not authorization).
- Switching campaigns recreates the shell subtree, reloads campaign-scoped data, and opens a new combat
  WebSocket room. Data from the previous campaign is cleared immediately.
- Sessions last 30 days, are checked server-side on every request, and are revoked on logout, password
  reset, or admin password reset. Existing shared-password cookies stop working after deployment; users
  receive new accounts/invites from the DM.

### UX principles

- Reuse the existing dark card language and `--cdx-*` tokens; no new visual system.
- Auth and invite screens are single-card pages, like the current login component.
- Keep all loading feedback on the existing `pane-is-loading` pattern, not spinners.
- Every destructive or access-changing action uses `ModalService.confirm`.
- Error text is short, specific, and accessible (`role="alert"`); account-enumeration cases stay generic.

---

## 4. Scope Decisions

| Area                    | Decision                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenancy                 | `campaign` is the tenant. Every content document gets `campaignId`. Content routes and WebSockets are campaign-scoped.                                                                                          |
| Accounts                | One user record per person. Users can belong to many campaigns with different roles.                                                                                                                            |
| Registration            | Invite-only. A valid invite token is the only way to create an account. There is no standalone registration page or open endpoint; `/register` redirects to `/login`.                                           |
| Invite registration     | `POST /api/invites/:token/register` (email + password) and `POST /api/invites/:token/google` create an account only with a valid, unused invite. `/api/auth/google` is login-only and never creates an account. |
| Campaign creation       | Any authenticated user can create a campaign and becomes its single DM.                                                                                                                                         |
| Roles                   | `dm` and `player`, stored on membership. No co-DMs, role changes, or ownership transfer in this phase.                                                                                                          |
| Password auth           | Email + password. Argon2id at OWASP-recommended parameters.                                                                                                                                                     |
| Google auth             | Google Identity Services ID token, verified server-side. Auto-link to an existing account only by verified email when `googleSub` is empty.                                                                     |
| Sessions                | Opaque 32-byte token in an httpOnly `naxxar_session` cookie. Only the SHA-256 token hash is stored in `sessions`; 30-day expiry checked in code and by TTL index.                                               |
| Invites                 | DM-generated copy-link only. 7-day expiry, single use, token hash stored. No invite emails.                                                                                                                     |
| Password reset          | Email link through SMTP. Dev logs the link. Production requires SMTP configuration at startup.                                                                                                                  |
| Authorization           | Server middleware for auth, campaign membership, and DM-only writes. Players are read-only for all campaign content.                                                                                            |
| DM-only content         | Players cannot list or fetch `visibility: dm` entries, and `:::dm` blocks are stripped from entry bodies returned to players.                                                                                   |
| Public IDs              | Codex entry APIs continue to expose `section:slug`; storage uses `${campaignId}:${section}:${slug}`. Inventory keeps UUID ids. Purses and combat use campaign-composited internal `_id`s.                       |
| Deterministic dev login | In-memory dev database seeds `dm@naxxar.local` / `app` and the `Naxxar` campaign. Production never enables this fallback.                                                                                       |
| Client role modeling    | `codex.dmPreview` is a DM-only rendering toggle. The existing `selectPlayerMode` selector becomes role-derived (`role === player                                                                                |     | dmPreview`) to minimize template churn. |
| Route reuse             | A custom `RouteReuseStrategy` returns `false` when `campaignSlug` changes, recreating the shell and its WebSocket/lifecycle.                                                                                    |
| CSRF                    | Same-origin deployment, no wildcard CORS, SameSite=Lax session cookie, and rejection of unsafe cross-origin requests using `Origin` / `Sec-Fetch-Site`.                                                         |
| Deployment target       | One Express instance. In-memory rate limits and in-process WebSocket rooms are acceptable for this phase and documented as scaling limits.                                                                      |

### Explicitly NOT building

- Public self-serve registration or "sign up" marketing flow.
- Email verification for password accounts.
- Account settings screens, display-name editing, avatar uploads, or self-service password change (reset
  only).
- Google manual link/unlink UI; only automatic verified-email linking.
- Co-DMs, role changes, ownership transfer, member removal, campaign rename/archive/delete.
- Invite emails, resend flows, or email-bound invitations.
- Two-factor authentication, passkeys, SSO, or social providers other than Google.
- Billing, subscriptions, quotas, usage limits per campaign, or admin console.
- Cross-campaign links or moving entries between campaigns.
- Offline auth, offline writes, or a service worker.
- Session-management UI (viewing/revoking other devices), although password reset revokes all sessions.
- Distributed rate limiting or Redis pub/sub for WebSocket broadcasts across multiple API instances.
- Full application security headers/CSP, reverse-proxy hardening, and load-balancer setup. These are
  deployment responsibilities, with the Google script's CSP requirements documented.
- API versioning, OpenAPI generation, or public API keys.

---

## 5. Target Architecture

### 5.1 Runtime shape

```text
Browser
  |
  |  same origin: https://app.example.com
  |  cookie: naxxar_session=<opaque 32-byte token>; HttpOnly; SameSite=Lax
  v
Express (one process)
  |
  +-- /api/config                       public runtime config
  +-- /api/auth/*                       login, Google, logout, me, reset
  +-- /api/invites/:token               public preview
  +-- /api/invites/:token/register      invite-only account creation (password)
  +-- /api/invites/:token/google        invite-only account creation (Google)
  +-- /api/invites/:token/accept        authenticated existing-user accept
  +-- /api/campaigns                    list + create for the signed-in user
  +-- /api/campaigns/:campaignSlug/*    membership-scoped campaign routers
  |     +-- /entries
  |     +-- /inventory
  |     +-- /purses
  |     +-- /combat
  |     +-- /combat/live              (websocket upgrade)
  |     +-- /members
  |     +-- /invites
  |
  +-- MongoDB
        users, sessions, campaigns, memberships, invites,
        password_resets, entries, inventory, purses, combat
```

The deployment remains a single Express instance serving the API and, with `STATIC_DIR`, the built
Angular app. WebSocket rooms and rate-limit counters are in-process; this is documented as a scaling
limit, not solved in this phase.

### 5.2 Server module layout

| File                                        | Status  | Responsibility                                                                                                                                  |
| ------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/config.js`                      | rewrite | Parse `APP_ORIGIN`, `GOOGLE_CLIENT_ID`, `SMTP_URL`, `MAIL_FROM`, `TRUST_PROXY`, dev seed credentials. Remove `APP_PASSWORD` / `SESSION_SECRET`. |
| `server/src/index.js`                       | rewrite | Fail-fast production checks, build Argon2/SMTP/Google services, wire collections, start HTTP + WebSocket.                                       |
| `server/src/db.js`                          | extend  | Return `users`, `sessions`, `campaigns`, `memberships`, `invites`, `passwordResets`; create all indexes from 6.2.                               |
| `server/src/in-memory-db.js`                | extend  | Seed the dev DM user, dev campaign, DM membership, plus campaign-scoped content.                                                                |
| `server/src/passwords.js`                   | new     | Argon2id hash/verify, dummy verify for unknown emails, password length policy.                                                                  |
| `server/src/sessions.js`                    | new     | Token generation/hash, cookie set/clear, session lookup, revocation, `loadSession`, `requireAuth`, CSRF origin check.                           |
| `server/src/users.js`                       | new     | Email normalization, user lookup, public user shape, Google link helpers.                                                                       |
| `server/src/google.js`                      | new     | Thin wrapper around `google-auth-library` `verifyIdToken`; injectable for tests.                                                                |
| `server/src/mailer.js`                      | new     | Nodemailer transport; dev logs reset links instead of sending.                                                                                  |
| `server/src/auth.js`                        | rewrite | `/api/auth` router: login, google, logout, me, forgot-password, reset-password.                                                                 |
| `server/src/invites.js`                     | new     | Public preview, invite-only registration/Google, existing-user accept, and DM create/list.                                                      |
| `server/src/campaigns.js`                   | new     | Campaign list/create and the campaign-scoped router composition.                                                                                |
| `server/src/campaign-access.js`             | new     | Resolve `campaignSlug`, load membership, `requireCampaignMember`, `requireCampaignDm`.                                                          |
| `server/src/entries.js`                     | rewrite | Campaign-scoped entry CRUD, DM-entry filtering, `:::dm` stripping for players.                                                                  |
| `server/src/inventory.js`                   | rewrite | Campaign-scoped inventory CRUD.                                                                                                                 |
| `server/src/purses.js`                      | rewrite | Campaign-scoped purses.                                                                                                                         |
| `server/src/combat.js`                      | rewrite | Campaign-scoped encounter read/write and per-campaign `onSaved`.                                                                                |
| `server/src/combat-live.js`                 | rewrite | Campaign rooms, session + membership check on upgrade, per-campaign broadcast.                                                                  |
| `server/src/app.js`                         | rewrite | Remove `cors()`, mount config/auth/invites/campaigns, add CSRF and error handling.                                                              |
| `server/src/in-memory-collection.js`        | extend  | Add `deleteMany`, `$in`, `$ne`, and `$exists` support needed by auth/campaign queries.                                                          |
| `server/src/seed.js`                        | extend  | Build entries for a supplied campaign id.                                                                                                       |
| `server/scripts/bootstrap.mjs`              | new     | Create users, campaigns, DM memberships; reset passwords for lockout recovery.                                                                  |
| `server/scripts/migrate-campaign-scope.mjs` | new     | One-shot legacy-data migration (Section 11).                                                                                                    |
| `server/scripts/seed.mjs`                   | extend  | Seed into a named campaign.                                                                                                                     |

### 5.3 Request lifecycle

1. `app.use(express.json())`.
2. `app.use(originCheck)` for unsafe methods. Rejects a present `Origin` that is not `APP_ORIGIN`, or a
   `Sec-Fetch-Site` of `cross-site`.
3. `app.use(loadSession)` reads `naxxar_session`, hashes it, loads `sessions` by `_id`, rejects a missing
   or expired session, then loads the user and attaches `req.auth = { user, session }`. It never throws
   for an absent cookie.
4. Public routers (`/api/config`, `/api/auth`, `/api/invites/:token`) run.
5. `/api/campaigns` uses `requireAuth`.
6. `/api/campaigns/:campaignSlug` uses `requireAuth`, then `loadCampaignAccess`, which loads the campaign
   by slug and the membership `_id = `${campaign._id}:${user._id}``. A missing campaign or membership
   yields `404 Campaign not found.` (no existence oracle). It attaches `req.campaign = { doc, role }`.
7. Content routers read `req.campaign.doc._id`; they never accept a campaign id from a body or query.
8. DM-only writes add `requireCampaignDm` after membership resolution, returning `403`.
9. The existing 4-argument error middleware maps `HttpError` to JSON.

Express 4 does not catch rejected promises. Every async middleware and handler uses the existing
explicit `try { ... } catch (error) { next(error); }` pattern (see `server/src/entries.js:41-56`), or a
small `asyncHandler` wrapper introduced once and used consistently.

### 5.4 Client module layout

| Area                                                     | Status  | Responsibility                                                                         |
| -------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `src/app/core/models/i-user.ts`                          | new     | `IUser { id, email, displayName }`.                                                    |
| `src/app/core/models/i-campaign.ts`                      | new     | `ICampaignSummary { id, slug, name, role }`, `CampaignRole` union.                     |
| `src/app/core/models/i-campaign-member.ts`               | new     | Member row for the members page.                                                       |
| `src/app/core/models/i-invite.ts`                        | new     | Invite metadata and create response.                                                   |
| `src/app/core/models/i-public-config.ts`                 | new     | `{ googleClientId: string \| null }`.                                                  |
| `src/app/core/services/auth-api.service.ts`              | rewrite | Typed auth calls plus Google credential exchange.                                      |
| `src/app/core/services/campaign-api.service.ts`          | new     | `GET/POST /api/campaigns`.                                                             |
| `src/app/core/services/campaign-members-api.service.ts`  | new     | Members and invites for a campaign slug.                                               |
| `src/app/core/services/campaign-context.service.ts`      | new     | Holds the active campaign slug/id and builds campaign API URLs.                        |
| `src/app/core/services/campaign-route-reuse.strategy.ts` | new     | Returns `false` when `campaignSlug` changes.                                           |
| `src/app/core/guards/auth.guard.ts`                      | rewrite | Session-aware auth/guest guards with `returnUrl`; add `campaignMemberGuard`.           |
| `src/app/app.routes.ts`                                  | rewrite | Campaign picker, campaign-scoped shell, invite/reset routes.                           |
| `src/app/app.config.ts`                                  | extend  | Provide the route reuse strategy.                                                      |
| `src/app/store/auth/*`                                   | rewrite | Session/user/campaigns/config state, auth actions, effects, selectors, reducer, specs. |
| `src/app/store/campaign-members/*`                       | new     | Members/invites slice, actions, effects, reducer, selectors, specs.                    |
| `src/app/features/auth/login.component.*`                | rewrite | Email/password + Google button.                                                        |
| `src/app/features/auth/forgot-password.component.*`      | new     | Request a reset link.                                                                  |
| `src/app/features/auth/reset-password.component.*`       | new     | Set a new password from a token.                                                       |
| `src/app/features/invite/invite-accept.component.*`      | new     | Preview, register, and accept an invite.                                               |
| `src/app/features/campaigns/campaign-list.component.*`   | new     | Campaign cards + create dialog.                                                        |
| `src/app/features/members/members.component.*`           | new     | Member list; DM invite creation and invite history.                                    |
| `src/app/features/shell/*`                               | extend  | Campaign switcher, member link, campaign-scoped links.                                 |
| `src/app/features/entry-detail/*`                        | extend  | Role-derived player view and campaign-scoped navigation.                               |
| `src/app/features/section-list/*`                        | extend  | Campaign-scoped navigation.                                                            |
| `src/app/core/services/markdown-renderer.service.ts`     | extend  | Campaign-aware entity links.                                                           |
| `src/app/core/utils/help-page.util.ts`                   | extend  | Resolve help pages under `/campaigns/:slug/...`.                                       |
| `src/app/core/services/combat-live.service.ts`           | extend  | Campaign-scoped WebSocket URL.                                                         |

### 5.5 Invariants

- Every content document has a non-empty `campaignId`, and every content query filters on it.
- The campaign id is derived only from the URL slug plus the membership check, never from client input.
- Public entry ids remain `section:slug`; internal ids are prefixed with the campaign id.
- A player can never receive a `visibility: dm` entry, a `:::dm` block, or a DM-only invite/member field.
- Session cookies contain only an opaque random token; the database stores only its SHA-256 hash.
- `req.auth.user` is the raw user document used for authorization; every API response passes it through `toPublicUser`, so `passwordHash`, `emailNormalized`, and `googleSub` never leave the server.
- A campaign switch destroys and recreates the shell, its stores, and its WebSocket connection.
- Authorization is enforced server-side; the client role is presentation only.

---

## 6. Data Model

All new documents use string `_id`s generated with `randomUUID()` unless noted. Timestamps are ISO
strings, matching the existing content collections.

### 6.1 `users`

```js
{
  _id: '<uuid>',
  email: 'DM@Example.com',          // original casing, display only
  emailNormalized: 'dm@example.com', // lowercase + trim
  displayName: 'Dungeon Master',
  passwordHash: '$argon2id$...',     // null for users created through Google on an invite
  googleSub: null,                   // Google's stable subject claim
  createdAt: '<iso>',
  updatedAt: '<iso>'
}
```

Indexes: unique `{ emailNormalized: 1 }`; unique partial `{ googleSub: 1 }` where `googleSub` is a
string. A user created through Google on an invite has `passwordHash: null` and can set a password
later with the reset flow. A user created with a password has `googleSub: null` until they first sign in
with Google.

### 6.2 `sessions`

```js
{
  _id: '<sha256(token) hex>',
  userId: '<uuid>',
  createdAt: '<iso>',
  expiresAt: '<iso>'  // now + 30 days
}
```

Indexes: TTL `{ expiresAt: 1 }` with `expireAfterSeconds: 0`; `{ userId: 1 }` for revocation. The TTL
monitor is not a security boundary; every lookup also checks `expiresAt > now`.

### 6.3 `campaigns`

```js
{
  _id: '<uuid>',
  slug: 'naxxar',
  name: 'Naxxar',
  createdBy: '<user uuid>',
  createdAt: '<iso>',
  updatedAt: '<iso>'
}
```

Index: unique `{ slug: 1 }`.

### 6.4 `memberships`

```js
{
  _id: '<campaignId>:<userId>',
  campaignId: '<uuid>',
  userId: '<uuid>',
  role: 'dm' | 'player',
  createdAt: '<iso>'
}
```

Indexes: `{ campaignId: 1 }`, `{ userId: 1 }`. The deterministic `_id` makes invite acceptance
idempotent and enforces one membership per user per campaign.

### 6.5 `invites`

```js
{
  _id: '<sha256(token) hex>',
  campaignId: '<uuid>',
  createdBy: '<user uuid>',
  createdAt: '<iso>',
  expiresAt: '<iso>',   // now + 7 days
  usedAt: null,
  usedBy: null
}
```

Index: `{ campaignId: 1, createdAt: -1 }`. The plaintext token is returned once at creation and never
stored. Losing the link means creating a new invite.

### 6.6 `password_resets`

```js
{
  _id: '<sha256(token) hex>',
  userId: '<uuid>',
  createdAt: '<iso>',
  expiresAt: '<iso>',   // now + 60 minutes
  usedAt: null
}
```

Indexes: TTL `{ expiresAt: 1 }`; `{ userId: 1 }`.

### 6.7 Content collections

| Collection  | `_id`                              | Campaign fields       | Other changes                                                                                                                                |
| ----------- | ---------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `entries`   | `${campaignId}:${section}:${slug}` | `campaignId`          | Public id is `_id` with the `${campaignId}:` prefix removed. Index `{ campaignId: 1, section: 1, status: 1 }`, `{ campaignId: 1, tags: 1 }`. |
| `inventory` | `randomUUID()` (unchanged)         | `campaignId`          | Index `{ campaignId: 1, name: 1 }`. Public `id` stays the UUID.                                                                              |
| `purses`    | `${campaignId}:${owner}`           | `campaignId`, `owner` | `toPublicPurse` returns `owner` and `gold`, not `_id`.                                                                                       |
| `combat`    | `${campaignId}:current`            | `campaignId`          | One encounter per campaign. `revision` remains per campaign.                                                                                 |

### 6.8 Public vs internal identifiers

| Entity         | Client-visible id              | Stored `_id`                 | Where the mapping happens                |
| -------------- | ------------------------------ | ---------------------------- | ---------------------------------------- |
| Codex entry    | `npcs:vaelith-corrun`          | `<uuid>:npcs:vaelith-corrun` | `entries.js` `toPublicEntry` / `buildId` |
| Inventory item | UUID                           | same UUID                    | unchanged                                |
| Purse          | owner (`party`, `players:...`) | `${campaignId}:${owner}`     | `purses.js`                              |
| Combat         | none                           | `${campaignId}:current`      | `combat.js`                              |
| Campaign       | slug                           | UUID                         | `campaigns.js`                           |
| User           | UUID                           | UUID                         | `users.js`                               |

Keeping entry public ids campaign-relative means the Angular codex store, markdown links, inventory
owners, and URL structure need no id migration inside a campaign.

---

## 7. API Contract

All responses are JSON. Errors are `{ "error": "<message>" }`, matching the current error middleware
(`server/src/app.js:45-53`).

### 7.1 Public endpoints

| Method | Path                           | Behaviour                                                                                                                                                                                                                                    |
| ------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/config`                  | `{ "googleClientId": "..." \| null }`. Cacheable for a short period. No secrets.                                                                                                                                                             |
| `GET`  | `/api/invites/:token`          | Preview. `200 { campaignName, campaignSlug, expiresAt }`, `404` unknown, `410` used/expired.                                                                                                                                                 |
| `POST` | `/api/invites/:token/register` | Body `{ displayName, email, password }`. Creates the user, consumes the invite, adds a `player` membership, sets the session cookie, returns `{ user, campaigns, campaign }`. `409` if the email already exists.                             |
| `POST` | `/api/invites/:token/google`   | Body `{ credential, displayName? }`. Verifies the Google token; logs in an existing matching user or creates a passwordless user, consumes the invite, adds a `player` membership, sets the cookie, returns `{ user, campaigns, campaign }`. |

### 7.2 Auth endpoints

| Method | Path                        | Body                  | Success                                      | Notes                                                                                                                                                                                                  |
| ------ | --------------------------- | --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST` | `/api/auth/login`           | `{ email, password }` | `200 { user, campaigns }` + cookie           | Generic `401 "Incorrect email or password."`. Rate-limited. Dummy Argon2 verify for unknown emails.                                                                                                    |
| `POST` | `/api/auth/google`          | `{ credential }`      | `200 { user, campaigns }` + cookie           | Verify ID token, require `email_verified`, then link/login. Login only; it never creates an account. Invite registration is `/api/invites/:token/google`. Returns `503` when Google is not configured. |
| `POST` | `/api/auth/logout`          | none                  | `200 { ok: true }`                           | Deletes the session document and clears the cookie. Always succeeds.                                                                                                                                   |
| `GET`  | `/api/auth/me`              | none                  | `200 { user: IUser \| null, campaigns: [] }` | Never `401`. The client treats `user === null` as signed out.                                                                                                                                          |
| `POST` | `/api/auth/forgot-password` | `{ email }`           | `202 { ok: true }`                           | Always generic, even for unknown emails. Rate-limited.                                                                                                                                                 |
| `POST` | `/api/auth/reset-password`  | `{ token, password }` | `200 { ok: true }`                           | `400` invalid/expired token or weak password. Revokes every session for that user.                                                                                                                     |

`IUser` is `{ id, email, displayName }`. `campaigns` is the same array as `GET /api/campaigns` so the
client needs only one round trip after login.

### 7.3 Campaign endpoints

| Method | Path                                   | Access                      | Behaviour                                                                                                                                                                |
| ------ | -------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/campaigns`                       | authenticated               | List the caller's memberships: `[{ id, slug, name, role }]`, sorted by name.                                                                                             |
| `POST` | `/api/campaigns`                       | authenticated               | Body `{ name }`. Creates the campaign and a `dm` membership for the caller. Slug is `slugify(name)`; on collision append `-2`, `-3`, ... Returns `201 { campaign }`.     |
| `GET`  | `/api/campaigns/:campaignSlug`         | member                      | `{ campaign: { id, slug, name, role } }`. Used by deep links; membership failure is `404`.                                                                               |
| `GET`  | `/api/campaigns/:campaignSlug/members` | member                      | `{ members: [{ userId, displayName, role, joinedAt }] }`. `email` is included only when the caller is the DM.                                                            |
| `POST` | `/api/campaigns/:campaignSlug/invites` | DM                          | Creates a 7-day single-use invite. Returns `201 { invite: { url, expiresAt } }` once.                                                                                    |
| `GET`  | `/api/campaigns/:campaignSlug/invites` | DM                          | `{ invites: [{ createdAt, expiresAt, usedAt, status }] }`. No token or URL.                                                                                              |
| `POST` | `/api/invites/:token/accept`           | authenticated existing user | Adds a `player` membership. Returns `{ campaign }`. Already a member: `200` and leaves the invite unused. New users register through the public invite endpoints in 7.1. |

### 7.4 Campaign content endpoints

These replace the current top-level content routes. Every route is under
`/api/campaigns/:campaignSlug` and requires membership. Reads are available to players and the DM;
writes are DM-only.

| Method   | Path                      | Notes                                                                             |
| -------- | ------------------------- | --------------------------------------------------------------------------------- |
| `GET`    | `/entries`                | Same filters as today. Players never see `visibility: dm` entries.                |
| `GET`    | `/entries/:section/:slug` | Players get `404` for DM entries. DM blocks are stripped from `body` for players. |
| `POST`   | `/entries`                | DM only. Slug uniqueness is per campaign + section.                               |
| `PUT`    | `/entries/:section/:slug` | DM only.                                                                          |
| `DELETE` | `/entries/:section/:slug` | DM only, idempotent.                                                              |
| `GET`    | `/inventory`              | Member read.                                                                      |
| `POST`   | `/inventory`              | DM only.                                                                          |
| `PATCH`  | `/inventory/:id`          | DM only. Items from another campaign are `404`.                                   |
| `DELETE` | `/inventory/:id`          | DM only, idempotent.                                                              |
| `GET`    | `/purses`                 | Member read.                                                                      |
| `PUT`    | `/purses/:owner`          | DM only.                                                                          |
| `GET`    | `/combat`                 | Member read.                                                                      |
| `PUT`    | `/combat`                 | DM only.                                                                          |
| `GET`    | `/combat/live`            | WebSocket upgrade, member only.                                                   |

### 7.5 Error semantics

| Status | Meaning                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `400`  | Validation failure, malformed body, weak password.                                                                                                                       |
| `401`  | No/expired session, bad credentials, invalid Google token.                                                                                                               |
| `403`  | Signed in and a member, but not the DM for a write.                                                                                                                      |
| `404`  | Missing resource, **or** campaign not found, **or** campaign not joined. This deliberately hides campaign existence.                                                     |
| `409`  | Duplicate campaign slug after retries, an email that already has an account during invite registration, or a Google email collision with a different linked `googleSub`. |
| `410`  | Invite or reset token used/expired.                                                                                                                                      |
| `429`  | Rate limit exceeded.                                                                                                                                                     |
| `500`  | Unexpected error; the existing middleware logs it and returns `"Something went wrong."`                                                                                  |
| `503`  | Google sign-in requested but not configured.                                                                                                                             |

### 7.6 Cookies, CSRF, and rate limits

- Cookie name `naxxar_session`; value is `base64url(randomBytes(32))`.
- Flags: `httpOnly: true`, `sameSite: 'lax'`, `secure: config.appOrigin.startsWith('https://')`,
  `path: '/'`, `maxAge: 30 days`.
- No wildcard CORS. The Angular dev server proxies `/api` (`proxy.conf.json:1-7`), so requests are
  same-origin in dev and production.
- `originCheck` runs before auth on `POST`, `PUT`, `PATCH`, `DELETE`:
  - If `Origin` is present, it must equal `APP_ORIGIN`.
  - Else if `Sec-Fetch-Site` is present, it must be `same-origin` or `none`.
  - Absence of both is allowed so curl and supertest still work.
- WebSocket upgrades apply the same `Origin` check when the header is present.
- `express-rate-limit`: login and Google login `10 / 15 min / IP`; forgot/reset `5 / 15 min / IP`;
  invite preview/register/Google/accept `20 / 15 min / IP`. Registration endpoints share the invite
  limiter. Set `app.set('trust proxy', config.trustProxy)` only when configured.
- Login responses use a constant generic message and a dummy Argon2 verify when the email is unknown.
- Auth and invite responses set `Cache-Control: no-store` so a shared browser or proxy cannot replay user data.

### 7.7 Validation rules

- Email: trim, lowercase for `emailNormalized`, require a simple `^[^@\s]+@[^@\s]+\.[^@\s]+$`.
- Display name: trim, 1-80 characters.
- Password: 8-128 characters when registering with a password or setting a new one. Login accepts any
  non-empty string so old accounts are not locked out by a policy change. Google invite registration
  creates a user with `passwordHash: null`; the reset flow can set one later.
- Campaign name: trim, 2-80 characters. Slug must be non-empty after `slugify`.
- Invite/reset tokens: base64url, 43 characters; reject anything else before hashing.
- Existing entry/inventory/combat validators are retained; only their id construction and query
  filters change.

---

## 8. Authorization Matrix

| Action                            | Anonymous             | Player                | DM                    | Notes                                                                                                      |
| --------------------------------- | --------------------- | --------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| View login/forgot/reset pages     | yes                   | yes                   | yes                   | Guest-only guards redirect signed-in users.                                                                |
| Preview invite                    | yes                   | yes                   | yes                   | Public, shows campaign name/slug and expiry only.                                                          |
| Register via invite               | yes, with valid token | yes, with valid token | yes, with valid token | Public by design; the UI offers it only when signed out, and the new session replaces any existing cookie. |
| Register with Google via invite   | yes, with valid token | yes, with valid token | yes, with valid token | Creates or links a passwordless user; the new session replaces any existing cookie.                        |
| Accept invite as an existing user | no                    | yes                   | yes                   | Must sign in first; already-member is a no-op.                                                             |
| List/create own campaigns         | no                    | yes                   | yes                   | Any user can create a campaign and becomes its DM.                                                         |
| Read campaign content             | no                    | yes                   | yes                   | Entries, inventory, purses, combat, members.                                                               |
| Read `visibility: dm` entry       | no                    | **no**                | yes                   | List filters it; detail returns `404`.                                                                     |
| Read `:::dm` markdown blocks      | no                    | **no**                | yes                   | Server strips them from `body`.                                                                            |
| Create/update/delete entries      | no                    | no                    | yes                   | `403` for players.                                                                                         |
| Create/update/delete inventory    | no                    | no                    | yes                   | `403` for players.                                                                                         |
| Update purses                     | no                    | no                    | yes                   | `403` for players.                                                                                         |
| Read combat                       | no                    | yes                   | yes                   | Live WebSocket is member-only.                                                                             |
| Write combat                      | no                    | no                    | yes                   | `403` for players.                                                                                         |
| List members                      | no                    | yes                   | yes                   | Email hidden from players.                                                                                 |
| Create/list invites               | no                    | no                    | yes                   | `403` for players.                                                                                         |
| Create campaign                   | no                    | yes                   | yes                   | Creator receives the `dm` membership.                                                                      |
| Change roles / remove members     | no                    | no                    | no                    | Explicitly out of scope.                                                                                   |

Client mirrors this matrix for presentation only. Every rule above is independently enforced by the
server.

---

## 9. WebSocket Design

### 9.1 Path and upgrade

- Path: `/api/campaigns/:campaignSlug/combat/live`.
- `combatLive.attach(server, { resolveAccess })` handles `upgrade`.
- Parse the pathname, extract `campaignSlug`, reject unknown paths with `404`.
- Apply the `Origin` check when present.
- Read and hash the session cookie, load the session + user, load the campaign + membership. Reject
  with `401` when unauthenticated and `404` when not a member.
- Attach `{ campaignId }` to the socket before `wss.emit('connection', client, req)`.

### 9.2 Rooms and broadcast

```js
const rooms = new Map(); // campaignId -> Set<socket>
```

- `publish(campaignId, encounter)` sends only to that campaign's room.
- On connect, `readEncounter(collection, campaignId)` sends the current encounter to that socket.
- `combat.js` calls `onSaved(campaignId, encounter)` after each successful `PUT`.
- Heartbeat logic is unchanged (`combat-live.js:52-64`), but runs over `wss.clients` as today.
- Disconnect removes the socket from its room and deletes empty rooms.
- `MAX_INBOUND_PAYLOAD` stays at 1024 bytes; the socket remains push-only.

### 9.3 Client

- `CombatLiveService.connect(campaignSlug)` builds
  `${ws|wss}://${host}/api/campaigns/${encodeURIComponent(campaignSlug)}/combat/live`.
- The shell recreates the service subscription when `campaignSlug` changes because the route reuse
  strategy destroys the shell component.
- No campaign id or role is trusted from the socket payload; the server already scoped the room.

### 9.4 Failure behaviour

| Situation             | Client sees                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Session expired       | Socket closes; existing backoff reconnects, then `401` upgrades fail. After three failures the combat page prompts a refresh/login. |
| Campaign switch       | Old shell destroyed, old socket closed, new socket opened.                                                                          |
| DM edits encounter    | Only that campaign's clients receive the new revision.                                                                              |
| Player tries to write | REST `PUT /combat` returns `403`; the socket never accepts writes.                                                                  |

---

## 10. Client State, Routing, and UX Flows

### 10.1 Auth store shape

`src/app/store/auth/auth.state.ts` becomes:

```ts
export interface IAuthState {
  user: IUser | null;
  campaigns: ICampaignSummary[];
  config: IPublicConfig;
  activeCampaignSlug: string | null;
  checked: boolean;
  status: ApiCallStatus;
  error: string | null;
  errorStatus: number | null;
}
```

`selectAuthenticated` becomes `user !== null`, so the guard and header keep their existing selector
names. New selectors: `selectUser`, `selectCampaigns`, `selectConfig`, `selectActiveCampaign`,
`selectActiveRole`, `selectHasCampaigns`. Every failure action sets `error` and `errorStatus` from the
caught HTTP error, and every request start clears both.

Actions (all through `createApiAction` where they call the API):

| Action                    | Request                                   | Success                         |
| ------------------------- | ----------------------------------------- | ------------------------------- |
| `checkSession`            | `{}`                                      | `{ user, campaigns }`           |
| `login`                   | `{ email, password }`                     | `{ user, campaigns }`           |
| `googleLogin`             | `{ credential }`                          | `{ user, campaigns }`           |
| `registerViaInvite`       | `{ token, displayName, email, password }` | `{ user, campaigns, campaign }` |
| `googleRegisterViaInvite` | `{ token, credential, displayName? }`     | `{ user, campaigns, campaign }` |
| `logout`                  | `{}`                                      | `{}`                            |
| `loadConfig`              | `{}`                                      | `{ config }`                    |
| `loadCampaigns`           | `{}`                                      | `{ campaigns }`                 |
| `createCampaign`          | `{ name }`                                | `{ campaign }`                  |
| `forgotPassword`          | `{ email }`                               | `{}`                            |
| `resetPassword`           | `{ token, password }`                     | `{}`                            |
| `campaignActivated`       | `{ slug }`                                | plain action, no API            |
| `sessionExpired`          | `{}`                                      | plain action, no API            |

Effects:

- `checkSession$` calls `GET /api/auth/me`, stores `user` (nullable) and `campaigns`, sets `checked`.
- `login$` and `googleLogin$` store the response and navigate to `returnUrl` (validated to a
  single-leading-slash internal path), else to the only campaign if exactly one exists, else
  `/campaigns`.
- `registerViaInvite$` and `googleRegisterViaInvite$` store the response, mark `checked`, and navigate
  to `campaign.slug` from the response (`/campaigns/:slug/npcs`) because registration implies accepting
  that invite. They share the response/navigation helper with `login$` but always ignore `returnUrl`.
- `createCampaign$` appends the campaign, activates it, and navigates to `/campaigns/:slug/npcs`.
- `logout$` calls the API, clears auth + campaign-scoped stores, and navigates to `/login`.
- `loadConfig$` calls `GET /api/config`.
- `forgotPassword$` and `resetPassword$` expose pending/error state; reset success clears auth and
  campaign-scoped state (the server revoked every session), then navigates to `/login?reset=1`.
- A functional `auth.interceptor.ts` dispatches `sessionExpired` when a non-auth API returns `401`.
  `sessionExpired` clears the user, keeps `checked: true`, clears campaign-scoped stores and the active
  campaign, and the auth guard redirects on the next navigation.

### 10.2 Campaign members store

`src/app/store/campaign-members/` owns:

```ts
export interface ICampaignMembersState {
  members: ICampaignMember[];
  invites: ICampaignInvite[];
  invitePreview: IInvitePreview | null;
  createdInviteUrl: string | null;
  status: ApiCallStatus;
  error: string | null;
  errorStatus: number | null;
}
```

`IInvitePreview` is `{ campaignName, campaignSlug, expiresAt }`. The slug lets the invite page compare the invite with the signed-in user's campaign list and choose "Join" versus "Open campaign".

Actions: `loadMembers`, `loadInvites`, `createInvite`, `loadInvitePreview`, `acceptInvite`,
`membersCleared`. Campaign-scoped effects take `campaignSlug` from the action payload (not from a
service singleton) so tests stay deterministic; preview and accept take the invite token.
`acceptInvite$` dispatches `loadCampaigns` on success so the new membership is in the auth store
before navigation. `campaignActivated`, `logoutSuccess`, and `sessionExpired` reset the slice.
`errorStatus` lets the invite page distinguish `404` (invalid) from `410` (used/expired).

### 10.3 Route tree

```ts
export const APP_ROUTES: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: LoginComponent },
  { path: 'forgot-password', canActivate: [guestGuard], loadComponent: ForgotPasswordComponent },
  { path: 'reset-password/:token', loadComponent: ResetPasswordComponent },
  { path: 'invite/:token', loadComponent: InviteAcceptComponent },
  { path: 'register', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'campaigns',
    canActivate: [authGuard],
    loadComponent: CampaignListComponent
  },
  {
    path: 'campaigns/:campaignSlug',
    canActivate: [authGuard, campaignMemberGuard],
    loadComponent: CampaignShellComponent,
    children: [
      { path: '', redirectTo: 'npcs', pathMatch: 'full' },
      { path: 'inventory', loadComponent: InventoryComponent },
      { path: 'combat', loadComponent: CombatComponent },
      { path: 'members', loadComponent: MembersComponent },
      { path: ':section', loadComponent: SectionListComponent },
      { path: ':section/:slug', loadComponent: EntryDetailComponent }
    ]
  },
  { path: '', redirectTo: 'campaigns', pathMatch: 'full' },
  { path: '**', redirectTo: 'campaigns' }
];
```

Static child paths (`inventory`, `combat`, `members`) are declared before `:section`, matching the
current precedence documented in `src/app/core/utils/help-page.util.ts:5-24`.

### 10.4 Guards

- `authGuard` waits for `checked`, then returns true or `router.parseUrl('/login?returnUrl=' + encodeURIComponent(state.url))`.
- `guestGuard` waits for `checked`, then returns true or `/campaigns`. It must not redirect while
  `user` is still null and `checked` is false.
- `campaignMemberGuard` waits for `checked`, finds `campaignSlug` in `selectCampaigns`; missing means
  `/campaigns`. It does not call the API on every navigation; `checkSession` already returns the
  campaign list, and invite acceptance or registration reloads it.
- On a hard refresh of `/campaigns/naxxar/npcs`, the auth guard triggers `checkSession`, the campaign
  guard waits for the list, and the shell then dispatches loads for the active campaign.

### 10.5 Route reuse

`CampaignRouteReuseStrategy`:

```ts
shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (future.routeConfig !== curr.routeConfig) {
        return false;
    }

    const futureSlug = future.params['campaignSlug'];
    const currSlug = curr.params['campaignSlug'];
    return futureSlug === undefined || currSlug === undefined || futureSlug === currSlug;
}
```

Provide it in `app.config.ts` with `{ provide: RouteReuseStrategy, useClass: CampaignRouteReuseStrategy }`.
Returning `false` for the shell route destroys the shell, its `ngOnInit` loads, and its combat socket
subscription, then recreates them for the new campaign.

### 10.6 Campaign context and API URLs

`CampaignContextService` exposes:

```ts
readonly slug = signal<string | null>(null);
readonly campaign = computed(() => /* find in auth campaigns */);
readonly role = computed(() => this.campaign()?.role ?? null);
baseUrl(): string // `/api/campaigns/${encodeURIComponent(this.slug()!)}`
```

The shell sets `slug` from `ActivatedRoute.snapshot.paramMap` in `ngOnInit` and clears it in
`ngOnDestroy`. `CodexApiService`, `InventoryApiService`, `PurseApiService`, `CombatApiService`, and
`CampaignMembersApiService` take the slug or the base URL from this service. No API service keeps a
module-level campaign constant.

### 10.7 UX flows

| Flow            | Behaviour                                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First visit     | `/login` with email/password, "Continue with Google" (only when `googleClientId` is set), and "Forgot password?".                                                                                                                                                                                                                                                              |
| Login success   | `returnUrl` if present; else the only campaign; else `/campaigns`.                                                                                                                                                                                                                                                                                                             |
| Campaign list   | Cards with name and role badge; "New campaign" inline form; "Join with invite" explains that invites are links.                                                                                                                                                                                                                                                                |
| Create campaign | Name -> server slug -> navigate into the new campaign as DM.                                                                                                                                                                                                                                                                                                                   |
| Campaign switch | Header `mat-select` listing campaigns; switching goes to `/campaigns/:slug/npcs`; "All campaigns" goes to `/campaigns`.                                                                                                                                                                                                                                                        |
| Invite link     | Public preview shows campaign name and expiry. Signed out: tabs for "Create account" (display name, email, password) and "Continue with Google", plus a "Already have an account? Sign in" link. Signed in: "Join campaign". Already a member with a still-valid invite: "Open campaign". A used/expired invite shows the error, no form, and a campaigns link when signed in. |
| DM invite panel | Create invite -> show the full URL once with a copy button and expiry; list prior invites with active/used/expired status.                                                                                                                                                                                                                                                     |
| Forgot password | Email -> generic "If that email has an account, a reset link is on its way."                                                                                                                                                                                                                                                                                                   |
| Reset password  | Token -> new password + confirm -> success -> `/login?reset=1`.                                                                                                                                                                                                                                                                                                                |
| Player session  | Header shows a "Player view" badge; no create/edit/delete controls; combat read-only; members page hides invites.                                                                                                                                                                                                                                                              |
| DM preview      | DM can toggle player preview; the badge reads "Previewing as player" and a single click returns to DM controls.                                                                                                                                                                                                                                                                |
| Session expiry  | Any `401` clears the user and sends the next navigation to `/login` with the original URL.                                                                                                                                                                                                                                                                                     |

### 10.8 Template and navigation updates

- `selectPlayerMode` stays the name used by templates, but its implementation becomes
  `role === 'player' || codex.dmPreview`. Rename the codex state field to `dmPreview` and the action to
  `dmPreviewToggled`; update `codex-header.component.ts:84-86`.
- Header campaign name comes from `selectActiveCampaign` instead of the hardcoded
  `signal('Naxxar campaign')` at `codex-header.component.ts:45`.
- Header search navigates with the active slug: `['/campaigns', slug, entry.section, entry.slug]`
  replacing `codex-header.component.ts:94`.
- Sidebar links gain the slug segment at `codex-sidebar.component.html:32,55,67,87`; the active-path
  checks at `codex-sidebar.component.ts:76-80` compare against `router.url` parsed by route params
  rather than a hardcoded `/campaign/...` prefix.
- Entry detail navigation uses the active slug at `entry-detail.component.ts:173,288`.
- Section list navigation uses the active slug at `section-list.component.ts:133`.
- `markdown-renderer.service.ts:193` builds `/campaigns/:slug/${section}/${slug}`. The renderer already
  receives campaign context through `IRenderOptions`; add `campaignSlug` there rather than reading a
  service.
- `help-page.util.ts` accepts `/campaigns/:slug/...`; the campaign segment moves from index 0 to index
  0 with section at index 2. Keep the existing `inventory`/`combat` precedence and add `members`.
- `combat-live.service.ts` `COMBAT_LIVE_PATH` becomes a function of the slug; `connect(slug)` is called
  by the combat store/effect with `CampaignContextService.slug()`.

---

## 11. Migration and Bootstrap

### 11.1 Pre-migration checklist

1. Stop the API and all writers.
2. Back up MongoDB (`mongodump`) and record the database name.
3. Deploy the new schema code and indexes first; old code cannot read campaign-scoped documents.
4. Create the owner user and campaign with `bootstrap.mjs`.
5. Run the migration with `--dry-run`, inspect counts, then run it for real.
6. Optionally seed the campaign's sample content.
7. Start the API, verify login, campaign list, entries, inventory, purses, combat, and live sync.

### 11.2 `bootstrap.mjs`

```
node server/scripts/bootstrap.mjs user --email dm@example.com --name "Dungeon Master" --password <secret>
node server/scripts/bootstrap.mjs campaign --slug naxxar --name "Naxxar" --dm-email dm@example.com
node server/scripts/bootstrap.mjs reset-password --email dm@example.com --password <new-secret>
```

- `user` creates or updates a user. If the email exists, it updates the display name and, when a
  password is supplied, replaces the hash and deletes all sessions.
- `campaign` creates the campaign if missing and upserts the DM membership. It fails if the user does
  not exist or already has a non-DM membership in that campaign.
- `reset-password` is the lockout recovery path and also deletes every session for the user.
- Passwords may be supplied with `--password` for local/dev use or with the `BOOTSTRAP_PASSWORD`
  environment variable to keep them out of shell history. Production operators should prefer the env
  var.
- All commands are idempotent and print what changed.

### 11.3 `migrate-campaign-scope.mjs`

Inputs: `--campaign <slug>` and optional `--dry-run`.

| Collection  | Legacy shape                | Migration                                                                                                                                                       |
| ----------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entries`   | `_id: "section:slug"`       | Insert `{ ...doc, _id: "${campaignId}:${oldId}", campaignId }`, then delete the old `_id` (`_id` is immutable in MongoDB, so replace-in-place is not possible). |
| `inventory` | UUID `_id`, no `campaignId` | `replaceOne({ _id }, { ...doc, campaignId })`; the id is unchanged.                                                                                             |
| `purses`    | `_id: owner`                | Insert `{ ...doc, _id: "${campaignId}:${owner}", campaignId, owner }`, then delete the old `_id`.                                                               |
| `combat`    | `_id: "current"`            | Insert `{ ...doc, _id: "${campaignId}:current", campaignId }`, then delete the old `_id`.                                                                       |

Rules:

- Skip any document that already has `campaignId`.
- Preserve `updatedAt`; do not rewrite content.
- For entries, verify the slug suffix matches `section:slug` after stripping the new prefix.
- Run per collection and print `{ scanned, migrated, skipped }`.
- `--dry-run` performs the reads and prints the same counts without writes.
- The script is safe to re-run; the second run reports everything as skipped.
- It does not create users, campaigns, or memberships. Those come from `bootstrap.mjs`.

### 11.4 Dev in-memory seed

`createInMemoryDb` becomes:

1. Load dev config (`DEV_DM_EMAIL` default `dm@naxxar.local`, `DEV_DM_PASSWORD` default `app`,
   `DEV_CAMPAIGN_NAME` default `Naxxar`, slug derived).
2. Hash the dev password with Argon2id.
3. Create the user, campaign, and DM membership.
4. Build seed entries with the campaign id.
5. Return `users`, `sessions`, `campaigns`, `memberships`, `invites`, `passwordResets`, and the four
   content collections.

`server/scripts/seed.mjs` resolves a campaign by slug (or by `--dm-email`'s DM campaign), then calls
`buildSeedEntries(campaignId)` and upserts by the new ids. It fails with a clear message when the
campaign is missing.

### 11.5 `createApp` signature

```js
createApp(
    {
        users,
        sessions,
        campaigns,
        memberships,
        invites,
        passwordResets,
        entries,
        inventory,
        purses,
        combat
    },
    {
        config,
        passwords,
        google,
        mailer,
        combatLive = null,
        rateLimiters = defaultRateLimiters
    }
)
```

`config` carries `appOrigin`, `googleClientId`, `staticDir`, `cookieSecure`, and `trustProxy`. Tests
inject fakes for `passwords`, `google`, `mailer`, and rate limiters, which keeps Argon2 and SMTP out of
the fast test path while a small number of integration tests exercise the real password module.

---

## 12. Mandatory Reading and External References

### 12.1 Read before starting

| File                                                                    | Why                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| `.claude/PRPs/plans/public-authentication-multi-campaign.plan.md`       | This plan; keep it open.                                        |
| `server/src/app.js`                                                     | Current dependency injection, mounts, 404 and error middleware. |
| `server/src/auth.js`                                                    | The shared-password implementation being replaced.              |
| `server/src/index.js`                                                   | Startup, config validation, WebSocket attach.                   |
| `server/src/config.js`                                                  | Current env parsing.                                            |
| `server/src/db.js`                                                      | Collection construction and index creation.                     |
| `server/src/entries.js`                                                 | Id mapping, filtering, CRUD validation.                         |
| `server/src/inventory.js`, `purses.js`, `combat.js`                     | Document shapes and normalization rules.                        |
| `server/src/combat-live.js`                                             | Upgrade handling, heartbeat, broadcast.                         |
| `server/src/in-memory-collection.js`, `in-memory-db.js`                 | Fake collection capabilities and dev seed.                      |
| `server/src/seed.js`, `server/scripts/seed.mjs`                         | Seed document construction.                                     |
| `server/test/auth.test.mjs`, `entries.test.mjs`, `combat-live.test.mjs` | Test harness patterns.                                          |
| `server/README.md`                                                      | Endpoint, env, and deployment docs to update.                   |
| `server/.env.example`                                                   | Environment template to replace.                                |
| `src/app/store/auth/*`                                                  | Current auth slice to rewrite.                                  |
| `src/app/core/guards/auth.guard.ts`                                     | Session-wait pattern and redirects.                             |
| `src/app/app.routes.ts`                                                 | Current route tree.                                             |
| `src/app/features/auth/login.component.ts`                              | Current single-password form.                                   |
| `src/app/features/shell/*`                                              | Header, sidebar, shell lifecycle, hardcoded links.              |
| `src/app/features/entry-detail/entry-detail.component.ts`               | Player-mode gating and navigation.                              |
| `src/app/core/services/markdown-renderer.service.ts`                    | Entity links and DM block rendering.                            |
| `src/app/core/utils/help-page.util.ts`                                  | URL-to-help-page mapping.                                       |
| `src/app/core/services/combat-live.service.ts`                          | WebSocket URL and reconnect behaviour.                          |
| `README.md`                                                             | Conventions, commands, and layout.                              |

### 12.2 External documentation

| Topic                                 | Reference                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Google ID token verification          | https://developers.google.com/identity/gsi/web/guides/verify-google-id-token                          |
| `google-auth-library` `verifyIdToken` | https://github.com/googleapis/google-auth-library-nodejs#verify-id-tokens                             |
| Google Identity Services button       | https://developers.google.com/identity/gsi/web/guides/display-button                                  |
| OWASP password storage                | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html                      |
| OWASP session management              | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html                    |
| OWASP CSRF prevention                 | https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html |
| `argon2` Node package                 | https://github.com/ranisalt/node-argon2                                                               |
| `express-rate-limit`                  | https://express-rate-limit.mintlify.app/                                                              |
| Nodemailer SMTP transport             | https://nodemailer.com/smtp/                                                                          |
| MongoDB TTL indexes                   | https://www.mongodb.com/docs/manual/core/index-ttl/                                                   |
| Express `Router({ mergeParams })`     | https://expressjs.com/en/4x/api.html#router                                                           |
| Angular `RouteReuseStrategy`          | https://angular.dev/api/router/RouteReuseStrategy                                                     |
| NgRx selectors composing features     | https://ngrx.io/guide/store/selectors                                                                 |
| MDN `Set-Cookie` / `SameSite`         | https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie                                  |

### 12.3 Decisions to re-confirm during implementation

- Google sign-in from `/login` never creates an account. If a verified Google email has no user, return
  a friendly "ask your DM for an invite" error. Google **registration** is allowed only at
  `/api/invites/:token/google`, where the invite token is the authorization to create the account.
- Invite registration is the only account-creation path. It must check the invite before creating a
  user, consume the invite atomically, and then create the membership. A duplicate email returns `409`
  and leaves the invite unused so the person can sign in and accept instead.
- Auto-linking by verified email is allowed only when the existing user has `googleSub === null`.
- Invite URLs are shown once. The database stores only the hash, so a lost link means creating a new
  invite. Do not add a "copy again" affordance that cannot be backed by data.
- Player read-only applies to all campaign content, including inventory and purses. If playtesting
  shows players need to edit their own sheet, that is a follow-up permission feature, not a silent
  relaxation now.
- One DM per campaign, no ownership transfer. Lockout recovery is an operator CLI, not a UI feature.

---

## 13. Patterns To Follow

### 13.1 Dependency-injected app factory

Current: `createApp` takes collections and options, validates required config, mounts routers, and owns
the error middleware (`server/src/app.js:12-31`, `45-53`). Tests build the app directly with fake
collections (`server/test/auth.test.mjs:10-14`).

Apply: keep the factory. Replace `appPassword`/`sessionSecret` with a `config` object plus injectable
`passwords`, `google`, and `mailer` services. Mount the public config router before auth, then campaigns.
Every route test keeps constructing the app with fakes.

### 13.2 Campaign-scoped router composition

Current: top-level routers are mounted with a shared `requireAuth` (`server/src/app.js:27-31`), and each
router owns its own paths (`server/src/entries.js:38-170`).

Apply:

```js
const campaignRouter = Router({ mergeParams: true });
campaignRouter.use(loadCampaignAccess);
campaignRouter.use('/entries', createEntriesRouter(entries));
campaignRouter.use('/inventory', createInventoryRouter(inventory));
// ...
app.use('/api/campaigns/:campaignSlug', requireAuth, campaignRouter);
```

`mergeParams: true` is mandatory: without it, the child router cannot see `:campaignSlug`, and
`req.campaign` would be the only reliable source. Child routers read `req.campaign.doc._id`; they never
parse the slug themselves.

### 13.3 Public id mapping

Current: entries build `_id` as `${section}:${slug}` (`server/src/entries.js:8`) and strip it for the
client (`server/src/entries.js:10-13`). Inventory does the same with UUIDs (`server/src/inventory.js:13-16`),
while purses expose `owner` (`server/src/purses.js:10`).

Apply: keep one `toPublicEntry(doc, campaignId)` that slices the prefix instead of splitting on `:`.
Do not split on `:` because campaign UUIDs and slugs can contain hyphens but not colons; slicing by the
known prefix is safer and preserves slugs containing colons (not currently allowed, but cheap to
guarantee).

### 13.4 Validate at the edge, normalize before store

Current: entry creation validates section/title then normalizes tags, fields, and visibility
(`server/src/entries.js:72-111`); inventory normalizes every optional field with a fallback
(`server/src/inventory.js:46-69`); combat clamps and defaults every combatant field
(`server/src/combat.js:75-130`).

Apply: reuse these exact helpers. Add only campaign-specific concerns:

- entry id = `${campaignId}:${section}:${slug}`;
- duplicate check scoped to `{ _id: newId }`;
- list filter always includes `campaignId`, plus `visibility: { $ne: 'dm' }` for players;
- inventory/purse/combat lookups always include `campaignId`.

### 13.5 Serial queue for combat revisions

Current: `createSerialQueue` serializes reads and writes so each save sees the previous revision
(`server/src/combat.js:137-146`), and `onSaved` publishes after the write (`server/src/combat.js:165-183`).

Apply: create one queue per campaign inside the campaign-scoped combat router, or key a shared queue map
by campaign id. `onSaved(campaignId, encounter)` must fire after the write and inside the queue order.
Do not publish a stale revision.

### 13.6 Session lookup and auth middleware

Current: `createAuthRouter` sets a signed cookie (`server/src/auth.js:52-83`), `isAuthenticatedRequest`
re-parses cookies for WebSockets (`server/src/auth.js:85-87`), and `requireAuth` wraps routes
(`server/src/auth.js:89-96`).

Apply: replace the signature check with `loadSession`:

1. read cookie,
2. hash token,
3. `sessions.findOne({ _id: hash })`,
4. reject `expiresAt <= now`,
5. `users.findOne({ _id: session.userId })`,
6. attach `req.auth`.

The WebSocket upgrade must reuse the same `resolveSession` function so REST and sockets cannot drift.
Cookie parsing can stay as-is (`server/src/auth.js:31-47`).

### 13.7 In-memory collection parity

Current: the fake supports `find` + `sort` + `toArray`, `findOne`, `insertOne`, `replaceOne` with upsert,
and `deleteOne` (`server/src/in-memory-collection.js:20-63`). Matching supports `$or`, `RegExp`, and
`$all` only (`server/src/in-memory-collection.js:3-18`).

Apply before writing queries:

- add `$in`, `$ne`, and `$exists` to `matches`;
- add `deleteMany(filter)` for session and reset-token revocation;
- keep `replaceOne(filter, doc, { upsert })` semantics exact, because invite single-use relies on
  `replaceOne({ _id, usedAt: null }, ...)` returning `matchedCount: 0` when another request consumed it;
- add a test for each new operator. Any query that works in tests must work in MongoDB and vice versa.

### 13.8 NgRx API action groups

Current: every API call uses `createApiAction` (`src/app/store/create-api-action.ts:20-28`), and effects
map request/success/failure (`src/app/store/auth/auth.effects.ts:15-37`). Reducers track
`ApiCallStatus` and `error` (`src/app/store/auth/auth.reducer.ts:7-48`).

Apply: keep the pattern for all new calls. Do not call `HttpClient` from components. For auth, add one
effect per action and a single `authFailure$` stream if the error handling repeats. Keep success
payloads typed; do not type them as `unknown`.

### 13.9 Cross-feature selector composition

Current: `selectPlayerMode` lives in the codex slice and is consumed by header and entry detail
(`src/app/features/shell/codex-header.component.ts:47`, `src/app/features/entry-detail/entry-detail.component.ts:90`).

Apply: keep the selector name but compose it with the auth role:

```ts
export const selectPlayerMode = createSelector(
  selectCodexState,
  selectActiveRole,
  (codex, role) => role === 'player' || codex.dmPreview
);
```

This avoids touching every template while making player mode server-role-derived. `dmPreview` is
ignored for a real player.

### 13.10 Route-derived context and reactive URL state

Current: the sidebar tracks `NavigationEnd` into a signal so OnPush highlighting stays fresh
(`src/app/features/shell/codex-sidebar.component.ts:57-63`), and the shell dispatches its loads in
`ngOnInit` (`src/app/features/shell/campaign-shell.component.ts:42-51`).

Apply: the shell reads `campaignSlug` from the route snapshot once, sets `CampaignContextService`, and
dispatches campaign-scoped loads. The custom reuse strategy guarantees `ngOnInit` runs again on a
switch. Keep the sidebar's `NavigationEnd` signal; adjust its path checks to route params.

### 13.11 Markdown rendering stays pure

Current: the renderer receives `IRenderOptions` and strips DM blocks when `showDmBlocks` is false
(`src/app/core/services/markdown-renderer.service.ts:7-10`, `50-59`); entity links are hardcoded to
`/campaign/...` (`markdown-renderer.service.ts:193`).

Apply: add `campaignSlug` to `IRenderOptions` and build `/campaigns/${campaignSlug}/...`. The server
must also strip DM blocks for players before sending `body`; the client option remains defence in depth
and is still needed for DM preview.

### 13.12 WebSocket reconnect and campaign lifecycle

Current: `CombatLiveService.connect()` defers a socket, retries with backoff, and resets failures on
open (`src/app/core/services/combat-live.service.ts:59-77`); `liveUrl()` builds from
`document.location` (`107-110`).

Apply: change `connect(campaignSlug: string)` and `liveUrl(campaignSlug)`. The combat effects pass the
active slug. When the shell is destroyed, the subscription closes the old socket; the new shell opens a
new one. Do not share the service's socket across campaigns.

### 13.13 Server tests with supertest and fake collections

Current: route tests build `createApp` with `createFakeCollection` (`server/test/auth.test.mjs:10-14`), use
an agent to persist cookies (`44-54`), and start a real HTTP server for WebSocket tests
(`server/test/combat-live.test.mjs:32-59`).

Apply:

- helper `buildApp({ users, campaigns, memberships, ... })` returns the app plus the fake collections;
- helper `createUser` inserts an Argon2 hash once per suite (or uses a fake password service);
- login helper returns an agent with a valid cookie;
- WebSocket tests connect with the cookie and a campaign-scoped path, and assert isolation by connecting
  two campaigns and publishing to one;
- rate-limit tests inject a tiny limiter instead of sleeping.

### 13.14 Client tests

Current conventions: arrange-act-assert, Jest, `overrideComponent` for children, no `fakeAsync`/`tick`
(README lines 203-205). Store tests use `provideMockStore` and effect tests use `provideMockActions`.

Apply:

- reducer tests cover `campaignActivated` resets in every campaign-scoped slice;
- selector tests cover `selectPlayerMode` for `dm`, `player`, and `dmPreview`;
- guard tests cover return URLs, missing campaign membership, and the checked/not-checked wait;
- component tests mock `CampaignContextService` and the store, never `HttpClient`;
- reuse-strategy tests call `shouldReuseRoute` with fake snapshots for same/different slugs.

---

## 14. Files To Change

### 14.1 Server

| File                                        | Change                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `server/package.json`                       | Add `argon2`, `google-auth-library`, `express-rate-limit`, `nodemailer`; remove `cors`. Add `bootstrap` and `migrate` scripts.             |
| `server/.env.example`                       | Replace `APP_PASSWORD` / `SESSION_SECRET` with `APP_ORIGIN`, `GOOGLE_CLIENT_ID`, `SMTP_URL`, `MAIL_FROM`, `TRUST_PROXY`, dev DM variables. |
| `server/src/config.js`                      | Parse the new environment; derive `cookieSecure`; expose `nodeEnv`.                                                                        |
| `server/src/index.js`                       | Fail fast in production without `APP_ORIGIN`, SMTP config, or (if enabled) Google config; wire all services and collections.               |
| `server/src/db.js`                          | Create and return the six identity collections; add all indexes from 6.1-6.7.                                                              |
| `server/src/passwords.js`                   | New. Argon2id options, `hashPassword`, `verifyPassword`, `verifyDummy`, password policy.                                                   |
| `server/src/sessions.js`                    | New. Token generation, hash, cookie helpers, `resolveSession`, `loadSession`, `requireAuth`, `revokeUserSessions`, `originCheck`.          |
| `server/src/users.js`                       | New. `normalizeEmail`, `findUserByEmail`, `toPublicUser`, `createUser`, `setGoogleSub`.                                                    |
| `server/src/google.js`                      | New. `createGoogleVerifier({ clientId })` returning `{ verify(credential) }`.                                                              |
| `server/src/mailer.js`                      | New. `createMailer({ smtpUrl, mailFrom, appOrigin, nodeEnv })` with `sendPasswordReset`.                                                   |
| `server/src/auth.js`                        | Rewrite. Login, Google, logout, me, forgot-password, reset-password.                                                                       |
| `server/src/invites.js`                     | New. Public preview, invite-only registration plus Google registration, existing-user accept, DM create/list.                              |
| `server/src/campaigns.js`                   | New. List/create plus `createCampaignRouter`.                                                                                              |
| `server/src/campaign-access.js`             | New. `loadCampaignAccess`, `requireCampaignMember`, `requireCampaignDm`.                                                                   |
| `server/src/entries.js`                     | Rewrite for campaign ids, scoped queries, player filtering, DM-block stripping.                                                            |
| `server/src/inventory.js`                   | Rewrite for campaign-scoped ids and queries.                                                                                               |
| `server/src/purses.js`                      | Rewrite for composite ids and scoped queries.                                                                                              |
| `server/src/combat.js`                      | Rewrite for `${campaignId}:current` and per-campaign publish.                                                                              |
| `server/src/combat-live.js`                 | Rewrite for campaign rooms and async session/membership upgrade checks.                                                                    |
| `server/src/app.js`                         | Rewrite mounts, remove `cors()`, add origin check, pass services, keep error middleware.                                                   |
| `server/src/in-memory-collection.js`        | Add `$in`, `$ne`, `$exists`, `deleteMany`; keep replace/upsert semantics exact.                                                            |
| `server/src/in-memory-db.js`                | Seed dev user, campaign, membership, and campaign-scoped content.                                                                          |
| `server/src/seed.js`                        | `buildSeedEntries(campaignId)` and composite ids.                                                                                          |
| `server/scripts/seed.mjs`                   | Resolve a campaign, then seed into it.                                                                                                     |
| `server/scripts/bootstrap.mjs`              | New. User, campaign, and password-reset operator commands.                                                                                 |
| `server/scripts/migrate-campaign-scope.mjs` | New. Dry-run-capable legacy data migration.                                                                                                |
| `server/README.md`                          | Rewrite auth, endpoints, environment, migration, and WebSocket sections.                                                                   |
| `server/test/auth.test.mjs`                 | Rewrite for email/password, sessions, me, logout, rate limits.                                                                             |
| `server/test/google-auth.test.mjs`          | New. Verified, unverified, unknown, collision cases.                                                                                       |
| `server/test/password-reset.test.mjs`       | New. Generic response, token use, expiry, session revocation.                                                                              |
| `server/test/campaigns.test.mjs`            | New. List/create/membership enforcement.                                                                                                   |
| `server/test/invites.test.mjs`              | New. Preview, password/Google registration, accept, single use, expiry, role assignment, collisions, races.                                |
| `server/test/members.test.mjs`              | New. DM sees emails, players do not.                                                                                                       |
| `server/test/entries.test.mjs`              | Rewrite for campaign scope and player filtering.                                                                                           |
| `server/test/inventory.test.mjs`            | Rewrite for campaign scope.                                                                                                                |
| `server/test/purses.test.mjs`               | Rewrite for composite ids.                                                                                                                 |
| `server/test/combat.test.mjs`               | Rewrite for per-campaign encounters.                                                                                                       |
| `server/test/combat-live.test.mjs`          | Rewrite for campaign-scoped upgrade and room isolation.                                                                                    |
| `server/test/helpers.mjs`                   | New. Shared app/user/campaign/login builders.                                                                                              |

### 14.2 Client

| File                                                           | Change                                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/app/core/models/i-user.ts`                                | New. `IUser`.                                                                                            |
| `src/app/core/models/i-campaign.ts`                            | New. `CampaignRole`, `ICampaignSummary`, `ICampaignDetail`.                                              |
| `src/app/core/models/i-campaign-member.ts`                     | New. `ICampaignMember`.                                                                                  |
| `src/app/core/models/i-invite.ts`                              | New. `IInvitePreview`, `ICampaignInvite`, `ICreateInviteResult`.                                         |
| `src/app/core/models/i-public-config.ts`                       | New. `IPublicConfig`.                                                                                    |
| `src/app/core/models/index.ts`                                 | Export the new models.                                                                                   |
| `src/app/core/services/auth-api.service.ts`                    | Rewrite for login, Google login, invite registration/Google registration, logout, me, forgot/reset.      |
| `src/app/core/services/campaign-api.service.ts`                | New. List/create/detail.                                                                                 |
| `src/app/core/services/campaign-members-api.service.ts`        | New. Members and invites.                                                                                |
| `src/app/core/services/campaign-context.service.ts`            | New. Active slug/campaign/role and base URL.                                                             |
| `src/app/core/services/auth.interceptor.ts`                    | New. Dispatch `sessionExpired` on non-auth `401`.                                                        |
| `src/app/core/services/campaign-route-reuse.strategy.ts`       | New. Recreate the shell on slug change.                                                                  |
| `src/app/core/services/codex-api.service.ts`                   | Build URLs from `CampaignContextService`; keep the public path names.                                    |
| `src/app/core/services/inventory-api.service.ts`               | Same campaign prefix.                                                                                    |
| `src/app/core/services/purse-api.service.ts`                   | Same campaign prefix.                                                                                    |
| `src/app/core/services/combat-api.service.ts`                  | Same campaign prefix.                                                                                    |
| `src/app/core/services/combat-live.service.ts`                 | `connect(slug)` and campaign-scoped URL.                                                                 |
| `src/app/core/services/markdown-renderer.service.ts`           | Campaign-aware entity links.                                                                             |
| `src/app/core/guards/auth.guard.ts`                            | Auth/guest/campaign-member guards with return URLs.                                                      |
| `src/app/core/utils/help-page.util.ts`                         | New URL shape and members page.                                                                          |
| `src/app/app.routes.ts`                                        | New route tree from 10.3.                                                                                |
| `src/app/app.config.ts`                                        | Provide the reuse strategy and auth interceptor.                                                         |
| `src/app/store/auth/auth.state.ts`                             | New state shape.                                                                                         |
| `src/app/store/auth/auth.actions.ts`                           | New actions from 10.1.                                                                                   |
| `src/app/store/auth/auth.reducer.ts`                           | Handle all auth actions and reset on logout/expiry.                                                      |
| `src/app/store/auth/auth.effects.ts`                           | Login/Google/config/campaigns/reset/navigation.                                                          |
| `src/app/store/auth/auth.selectors.ts`                         | User/campaigns/config/role selectors; `authenticated` derived.                                           |
| `src/app/store/auth/*.spec.ts`                                 | Rewrite for the new shape.                                                                               |
| `src/app/store/campaign-members/*`                             | New state/actions/reducer/effects/selectors and specs.                                                   |
| `src/app/store/codex/codex.state.ts`                           | `dmPreview` replaces `playerMode`; add campaign reset handling.                                          |
| `src/app/store/codex/codex.actions.ts`                         | `dmPreviewToggled`, campaign reset, slug-free payloads.                                                  |
| `src/app/store/codex/codex.reducer.ts`                         | Reset content on `campaignActivated`; keep UI preferences.                                               |
| `src/app/store/codex/codex.selectors.ts`                       | `selectPlayerMode` composes auth role + preview.                                                         |
| `src/app/store/inventory/*`                                    | Reset on campaign change; API calls use context.                                                         |
| `src/app/store/combat/*`                                       | Reset on campaign change; pass slug to live service.                                                     |
| `src/app/store/purses/*`                                       | Reset on campaign change.                                                                                |
| `src/app/store/editor/*`                                       | Reset on campaign change.                                                                                |
| `src/app/features/auth/login.component.ts/html/scss/spec.ts`   | Email/password + Google + forgot link + return URL.                                                      |
| `src/app/features/auth/forgot-password.component.*`            | New.                                                                                                     |
| `src/app/features/auth/reset-password.component.*`             | New.                                                                                                     |
| `src/app/features/invite/invite-accept.component.*`            | New. Preview, signed-out registration (password or Google), signed-in accept, and already-member states. |
| `src/app/features/campaigns/campaign-list.component.*`         | New.                                                                                                     |
| `src/app/features/members/members.component.*`                 | New.                                                                                                     |
| `src/app/features/shell/campaign-shell.component.ts`           | Activate the campaign, clear context on destroy.                                                         |
| `src/app/features/shell/codex-header.component.ts/html`        | Campaign name, switcher, scoped search navigation, role badge.                                           |
| `src/app/features/shell/codex-sidebar.component.ts/html`       | Campaign-scoped links, members entry, active checks.                                                     |
| `src/app/features/entry-detail/entry-detail.component.ts/html` | Role-derived player view, scoped navigation, DM-only controls.                                           |
| `src/app/features/section-list/section-list.component.ts`      | Scoped navigation.                                                                                       |
| `src/app/features/combat/combat.component.ts/html`             | Read-only for players; DM controls hidden.                                                               |
| `src/app/features/inventory/inventory.component.ts/html`       | DM-only edit controls.                                                                                   |
| `README.md`                                                    | New routes, auth flow, dev credentials, migration notes.                                                 |

---

## 15. Ordered Implementation Tasks

Each task is independently reviewable. Do not start a later task before its predecessor's validation
passes. The server is completed and tested before the client is switched over, so the app is briefly
non-functional only inside a branch, never in a deploy.

### Task 1: Dependencies, environment, and config

- **ACTION**: Add the four server dependencies and replace the shared-password configuration.
- **IMPLEMENT**:
  - `pnpm --filter naxxar-campaign-server add argon2 google-auth-library express-rate-limit nodemailer`
  - `pnpm --filter naxxar-campaign-server remove cors`
  - Rewrite `server/src/config.js` to return `{ port, mongoUri, mongoDb, staticDir, appOrigin, googleClientId, smtpUrl, mailFrom, trustProxy, cookieSecure, nodeEnv, inMemoryDb, devDmEmail, devDmPassword, devCampaignName }`.
  - Defaults: `APP_ORIGIN=http://localhost:57571` in dev (the Angular dev server), `TRUST_PROXY=false`, `DEV_DM_EMAIL=dm@naxxar.local`, `DEV_DM_PASSWORD=app`, `DEV_CAMPAIGN_NAME=Naxxar`.
  - `cookieSecure = appOrigin.startsWith('https://')`.
  - Rewrite `server/.env.example` with commented production examples.
- **MIRROR**: `server/src/config.js:1-9` keeps the same "pure function of env" shape so it stays trivially testable.
- **IMPORTS**: `node:process` only; no new packages in this task.
- **GOTCHA**: Do not keep `APP_PASSWORD`/`SESSION_SECRET` fallbacks "for safety". A stale env var silently preserving the old shared password would defeat the whole change. Delete them and let startup fail if old deployments have not been updated.
- **VALIDATE**: `node -e "import('./server/src/config.js').then(m => console.log(m.loadConfig({ APP_ORIGIN: 'https://x.test' })))"` prints `cookieSecure: true`; `pnpm --filter naxxar-campaign-server test` still passes (old auth tests will fail later, not here).

### Task 2: Password module

- **ACTION**: Implement Argon2id hashing and verification behind a small injectable module.
- **IMPLEMENT**:
  - `server/src/passwords.js` exports `ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }`.
  - `hashPassword(password)` -> `argon2.hash(password, ARGON2_OPTIONS)`.
  - `verifyPassword(hash, password)` -> `argon2.verify(hash, password)`, returning `false` on a malformed hash instead of throwing.
  - `verifyDummy()` verifies against a precomputed hash of a random startup value, so unknown-email logins cost the same as real ones.
  - `isValidPassword(value)` -> string, 8-128 characters.
  - Export `createPasswordService()` so tests can inject a fast fake.
- **MIRROR**: Normalization helpers return safe fallbacks rather than throwing (`server/src/combat.js:39-62`); the auth route decides the HTTP error.
- **IMPORTS**: `argon2`.
- **GOTCHA**: Argon2's default `memoryCost` is lower than OWASP's recommendation; passing options explicitly is required. Never log the password or hash. `verifyDummy` must run even when the email is unknown, otherwise timing reveals account existence.
- **VALIDATE**: New `server/test/passwords.test.mjs`: hash/verify round trip, wrong password fails, malformed hash returns false, `isValidPassword` boundaries, two hashes of the same password differ (salt).

### Task 3: In-memory collection parity

- **ACTION**: Extend the fake collection so the new queries are testable.
- **IMPLEMENT**:
  - Add `$in` (value is in the array), `$ne` (not equal), and `$exists` (boolean presence) to `matches` in `server/src/in-memory-collection.js`.
  - Add `deleteMany(filter)` returning `{ deletedCount }`.
  - Keep `replaceOne` exactly as-is, including `upsert`.
  - Add unit tests for each operator and for `deleteMany`.
- **MIRROR**: `server/src/in-memory-collection.js:3-18` is the single matching function; extend it rather than adding special cases in routes.
- **IMPORTS**: none.
- **GOTCHA**: Mongo's `$ne` matches documents where the field is missing; implement it that way. `$exists: false` must also match missing fields. Do not change `replaceOne` to merge documents; invite single-use depends on full replacement with a filter.
- **VALIDATE**: `pnpm --filter naxxar-campaign-server test` and a quick Node REPL check that `find({ role: { $in: ['dm'] } })` returns the DM membership.

### Task 4: Users and sessions

- **ACTION**: Build identity storage and the session lifecycle.
- **IMPLEMENT**:
  - `server/src/users.js`: `normalizeEmail`, `isValidEmail`, `toPublicUser`, `findUserByEmail`, `findUserById`, `createUser`, `setGoogleSub`.
  - `server/src/sessions.js`:
    - `createSessionToken()` -> `{ token, tokenHash }` using `randomBytes(32).toString('base64url')` and SHA-256 hex.
    - `hashToken(token)` -> SHA-256 hex; reject non-43-character base64url input.
    - `createSession(sessions, userId)` -> `{ token, session }`, inserting `{ _id: tokenHash, userId, createdAt, expiresAt }` so auth and invite registration share one implementation.
    - `setSessionCookie(res, token, { secure })`, `clearSessionCookie(res)`.
    - `resolveSession(req, { sessions, users })` -> `{ user, session } | null`, checking expiry in code.
    - `loadSession(deps)` Express middleware attaching `req.auth`.
    - `requireAuth` middleware returning `401 { error: 'Sign in required.' }`.
    - `revokeUserSessions(sessions, userId)` -> `deleteMany({ userId })`.
    - `originCheck(appOrigin)` middleware from 7.6.
  - Session duration constant `30 * 24 * 60 * 60 * 1000`.
- **MIRROR**: Cookie parsing from `server/src/auth.js:31-47`; middleware signature from `server/src/auth.js:89-96`.
- **IMPORTS**: `node:crypto`, `./http-error.js`.
- **GOTCHA**: The session `_id` is the hash, so `findOne({ _id: hash })` is a primary-key lookup. Do not store the token in `userId` or a secondary field. Cookie `secure` must be false in local HTTP dev or the browser silently drops it. Expiry must be checked in code even with a TTL index, because TTL cleanup is asynchronous.
- **VALIDATE**: `server/test/sessions.test.mjs`: token/hash round trip, expired session rejected, tampered cookie rejected, `revokeUserSessions` clears all, origin check accepts same-origin, rejects cross-origin, allows absent headers.

### Task 5: Database collections, indexes, and dev seed

- **ACTION**: Wire the identity collections into MongoDB and the in-memory development database.
- **IMPLEMENT**:
  - `server/src/db.js` returns `{ client, users, sessions, campaigns, memberships, invites, passwordResets, entries, inventory, purses, combat }`. Map the existing Mongo collection handles to these final names (`entries: collection`, `inventory: inventoryCollection`, `purses: pursesCollection`, `combat: combatCollection`) and update every caller in the same task so two names never coexist.
  - Create indexes: users `emailNormalized` unique, `googleSub` unique partial; sessions `expiresAt` TTL and `userId`; campaigns `slug` unique; memberships `campaignId`, `userId`; invites `campaignId + createdAt`; password resets `expiresAt` TTL and `userId`; entries `campaignId + section + status`, `campaignId + tags`; inventory `campaignId + name`.
  - `server/src/in-memory-db.js` seeds a user, campaign, DM membership, and content for the dev campaign. Hash the dev password with the real password service.
  - `server/src/seed.js` accepts `campaignId` and builds `${campaignId}:${section}:${slug}` ids.
- **MIRROR**: `server/src/db.js:9-18` creates indexes at connect time; `server/src/in-memory-db.js:6-11` is the dev factory.
- **IMPORTS**: `./passwords.js`, `./seed.js`, `./in-memory-collection.js`.
- **GOTCHA**: A Mongo unique index on `googleSub` with multiple `null`s fails; use `partialFilterExpression: { googleSub: { $type: 'string' } }`. Do not create a unique index on `memberships.userId` alone; users belong to many campaigns.
- **VALIDATE**: Start the dev server with no `MONGODB_URI`; it logs the dev DM email and boots without `APP_PASSWORD`. `server/test` still passes.

### Task 6: Auth router (email/password)

- **ACTION**: Replace shared-password login with user login, logout, and session introspection.
- **IMPLEMENT**:
  - `createAuthRouter({ users, sessions, passwords, config })`.
  - `POST /login` validates `{ email, password }`, looks up by normalized email, verifies (or dummy-verifies), creates a session, sets the cookie, returns `{ user, campaigns }` via a shared `loadCampaignSummaries(user._id, { memberships, campaigns })` helper.
  - `POST /logout` hashes the cookie token, deletes that session, clears the cookie, returns `{ ok: true }`.
  - `GET /me` returns `{ user: null, campaigns: [] }` when unauthenticated, else the current user + campaigns.
  - Apply login rate limiting.
- **MIRROR**: `server/src/auth.js:52-83` router factory and response style; `server/src/app.js:45-53` error handling.
- **IMPORTS**: `express`, `./http-error.js`, `./users.js`, `./sessions.js`, `./campaigns.js` (summary helper).
- **GOTCHA**: Login must not reveal whether the email exists. Use the same 401 message and the dummy verify. `GET /me` must be `200` for anonymous callers so the client's initial session check is not an error path. Cookie clearing must use the same `path` and flags as setting it.
- **VALIDATE**: `server/test/auth.test.mjs`: correct login sets a cookie; wrong password and unknown email are both 401 with the same body; `/me` reflects login/logout; tampered cookie is anonymous; logout deletes the row (check the fake collection).

### Task 7: Google sign-in

- **ACTION**: Verify Google ID tokens and link them to existing users.
- **IMPLEMENT**:
  - `server/src/google.js` wraps `OAuth2Client.verifyIdToken({ idToken, audience })` and returns `{ sub, email, emailVerified, name }`.
  - `POST /api/auth/google`:
    1. Verify the credential; map failures to `401 "Google sign-in failed."`.
    2. Reject `email_verified !== true`.
    3. Find by `googleSub`; if found, log in.
    4. Else find by normalized email:
       - existing with `googleSub === null` -> set `googleSub`, log in;
       - existing with a different `googleSub` -> `409 "This email is linked to another sign-in method."`;
       - missing -> `403 "No account exists for this email. Ask your DM for an invite."`.
    5. Create a session and return the same shape as password login.
- **MIRROR**: Same session creation and response helper as Task 6.
- **IMPORTS**: `google-auth-library`.
- **GOTCHA**: `verifyIdToken` checks signature, audience, issuer, and expiry; do not parse the JWT manually. Use `sub`, never email, as the stable Google identifier. `/api/auth/google` is login-only and must **not** create an account. Invite-authorized Google account creation is a separate endpoint in Task 9, so the invite token, not Google, controls registration. Auto-linking is safe only for a verified email and an unset `googleSub`. If `googleClientId` is null, return `503 "Google sign-in is not configured."` before touching the verifier.
- **VALIDATE**: `server/test/google-auth.test.mjs` with a fake verifier: new Google user is rejected; existing password user is linked; second login uses `sub`; unverified email rejected; mismatch `sub` rejected; verification exception is 401.

### Task 8: Mailer and password reset

- **ACTION**: Add forgot/reset password with SMTP and a safe dev fallback.
- **IMPLEMENT**:
  - `server/src/mailer.js`: if `smtpUrl` is set, create a Nodemailer transport and send `{ from, to, subject, text }`; otherwise, in non-production, `console.info` the reset URL; in production, `index.js` refuses to start before this point.
  - `POST /forgot-password` validates the email shape, always returns `202 { ok: true }`, and when the user exists creates a 60-minute token, stores its hash, and sends/logs `${appOrigin}/reset-password/${token}`.
  - `POST /reset-password` validates token shape and password policy, loads the reset doc, rejects used/expired, hashes the new password, updates the user, marks the reset used, deletes all other resets for that user, and revokes all sessions.
  - Rate-limit both endpoints.
- **MIRROR**: `HttpError` for failures; ISO timestamps like the content docs.
- **IMPORTS**: `nodemailer`, `node:crypto`, `./passwords.js`, `./sessions.js`.
- **GOTCHA**: Always return the generic message, including for unknown emails. Do not put the email in the URL. Never log the token in production. Marking the reset used and updating the password should happen in that order; if the password update fails, the token is burned and the user requests another link, which is safer than a reusable token. If the SMTP send fails, log the error and still return `202`; a delivery failure must not reveal whether the account exists.
- **VALIDATE**: `server/test/password-reset.test.mjs`: unknown email still 202; known email creates one reset doc; valid token changes the password and revokes sessions; reused token 400; expired token 400; weak password 400; production config without SMTP fails at startup (unit test the guard).

### Task 9: Invites, invite-only registration, and acceptance

- **ACTION**: Implement copy-link invites, invite-only account creation, and existing-user acceptance.
- **IMPLEMENT**:
  - `server/src/invites.js`:
    - `createInviteRouter({ invites, users, campaigns, memberships, sessions, passwords, google, config })` for `/api/invites/:token`:
      - `GET /` preview (public): returns `{ campaignName, campaignSlug, expiresAt }`; used/expired is `410`, unknown is `404`.
      - `POST /register` (public): validate invite first; validate `displayName`, `email`, and password policy; if `findUserByEmail` returns a user, `409 "An account already exists for this email. Sign in to join."` and leave the invite unused; otherwise consume the invite atomically, create the user with an Argon2id hash, upsert the `player` membership, create a session, set the cookie, and return `{ user, campaigns, campaign }`.
      - `POST /google` (public): load and validate the invite first; if Google is not configured, `503`; verify the credential and `email_verified`; find by `googleSub`; else find by normalized email:
        - existing with `googleSub === null` -> link and use that user;
        - existing with a different `googleSub` -> `409`;
        - missing -> create a user with `passwordHash: null`, `googleSub`, the verified email, and `displayName` from the body, Google's `name`, or the email local part.
          For a new user, consume the invite before the insert. For an existing user who is not yet a member, consume the invite before the membership upsert. If the user is already a member, return `200` without consuming. Then create a session, set the cookie, and return `{ user, campaigns, campaign }`.
      - `POST /accept` (authenticated existing user): already a member -> `200` without consuming; otherwise consume the invite, upsert the membership, and return `{ campaign }`.
    - `createCampaignInvitesRouter({ invites, memberships, config })` for DM `GET`/`POST` inside the campaign router.
  - Token: 32 random bytes base64url; store the SHA-256 hash as `_id`; 7-day expiry.
  - Create returns `{ invite: { url: `${appOrigin}/invite/${token}`, expiresAt } }` once.
  - List returns metadata with a derived `status` and no token/url.
  - Shared `consumeInvite(invites, tokenHash, userId)` first loads `_id: tokenHash` so it can distinguish unknown (404) from used/expired (410), then replaces with `replaceOne({ _id: tokenHash, usedAt: null }, { ...loadedDoc, usedAt, usedBy }, { upsert: false })`. `matchedCount === 0` means another request won the race, so return `410` even though the loaded copy looked valid.
- **MIRROR**: `server/src/purses.js:24-38` for replacement semantics; `server/src/entries.js:90-93` for the duplicate check; `server/src/users.js` for creation; Task 7's Google verifier.
- **IMPORTS**: `node:crypto`, `express`, `./http-error.js`, `./sessions.js`, `./slugify.js`, `./users.js`, `./passwords.js`, `./google.js`, `./campaigns.js`.
- **GOTCHA**:
  - The invite is not email-bound. The registration form asks the invitee for their own email; anyone with the link can join, which is the chosen copy-link model. Do not add an invite email field that implies binding.
  - Registration endpoints are public by design and do not require a signed-out caller. If a session cookie is present, the newly created session replaces it; the client only offers registration when signed out.
  - Check email/Google collisions **before** consuming the invite, so a typo or an existing account does not burn the link.
  - Consume the invite **before** creating the user and membership, so two concurrent registrations cannot both succeed. If the user insert then fails on the unique email index (a race), return `409` and accept that the invite is burned; log it.
  - Google registration is the only place a `passwordHash: null` user is created. The password reset flow can set a password later. Never create a user without a valid invite.
  - Already-a-member `accept` must return `200` without consuming an unused invite.
- **VALIDATE**: `server/test/invites.test.mjs`: preview valid/used/expired/unknown; DM creates; player gets 403; email/password registration creates a user, hashes the password, adds a `player` membership, and sets a session; duplicate email returns 409 and leaves the invite unused; Google registration creates a passwordless user and links `googleSub`; Google registration for an existing password user links and accepts; Google registration for an existing member links without consuming; two parallel registrations produce one user and one membership; used token 410; expired token 410; accept as an existing user is idempotent; cross-campaign invite adds the right campaign.

### Task 10: Campaign access and campaign router

- **ACTION**: Add campaign listing/creation and the membership gate.
- **IMPLEMENT**:
  - `server/src/campaigns.js`:
    - `createCampaignsRouter({ campaigns, memberships, users })`: `GET /` loads memberships by `userId`, loads campaigns with `{ _id: { $in: [...ids] } }`, and returns `{ id, slug, name, role }` sorted by name; `POST /` validates name, slugifies, checks `findOne({ slug })` and appends `-2`/`-3` until free, inserts campaign + DM membership, returns `201`. The unique `slug` index remains the race safety net.
    - Export `loadCampaignSummaries(userId, { memberships, campaigns })` from this module so login, Google login, registration, and `GET /api/campaigns` share one query path.
    - `createCampaignRouter(...)`: mounts the child routers from Task 11-14 plus members/invites.
  - `server/src/campaign-access.js`:
    - `loadCampaignAccess({ campaigns, memberships })` async middleware; loads campaign by slug, then membership `${campaign._id}:${req.auth.user._id}`; attaches `req.campaign = { doc, role }`; otherwise `404`.
    - `requireCampaignMember` and `requireCampaignDm`.
  - `GET /:campaignSlug` returns campaign + role.
- **MIRROR**: `server/src/app.js:27-31` mounting; `server/src/slugify.js`; `HttpError` statuses.
- **IMPORTS**: `express`, `./slugify.js`, `./http-error.js`, `./campaign-access.js`.
- **GOTCHA**: Use `Router({ mergeParams: true })` for child routers, otherwise `campaignSlug` disappears. A signed-in non-member must get `404`, not `403`, to avoid confirming a campaign exists. A player writing gets `403` because they are a member but not the DM.
- **VALIDATE**: `server/test/campaigns.test.mjs`: create returns DM role; slug collision appends; list excludes other users' campaigns; non-member gets 404; player write gets 403; creator can read content.

### Task 11: Campaign-scope entries

- **ACTION**: Scope entry CRUD and hide DM content from players.
- **IMPLEMENT**:
  - `createEntriesRouter(entries, { campaignId })` or read `req.campaign.doc._id` in every handler.
  - `buildId(campaignId, section, slug)`; `toPublicEntry(doc, campaignId)` slices the prefix.
  - List: always `{ campaignId }`; for players add `visibility: { $ne: 'dm' }`.
  - Detail: load by composite id; if player and `visibility === 'dm'`, `404`.
  - Create/update/delete: DM only, composite ids, duplicate check scoped to the campaign.
  - Player body: strip `:::dm ... :::` blocks server-side before returning. Reuse a small `stripDmBlocks(body)` in a shared module or export it from the router.
- **MIRROR**: Existing validation/normalization at `server/src/entries.js:72-111`; list query at `41-56`; id mapping at `8-13`.
- **IMPORTS**: `express`, `./http-error.js`, `./query.js`, `./sections.js`, `./slugify.js`.
- **GOTCHA**: Filtering only in the client is not authorization. The DM block regex must handle `:::dm` at line start and a closing `:::` line; do not let an unterminated block leak the rest of the entry. Keep `toSummary` stripping `body` so list responses stay small.
- **VALIDATE**: `server/test/entries.test.mjs`: same section+slug in two campaigns yields two entries; player list omits DM entries; player detail 404; player body has no `:::dm` content; DM still sees it; cross-campaign id 404; duplicate create 409.

### Task 12: Campaign-scope inventory

- **ACTION**: Scope inventory to the active campaign.
- **IMPLEMENT**:
  - All queries add `campaignId`; create adds `campaignId`; update/delete look up by `{ _id: id, campaignId }`.
  - Public shape stays `{ id, ...rest }` with no `campaignId` leak.
  - DM-only writes.
- **MIRROR**: `server/src/inventory.js:34-126`.
- **IMPORTS**: `node:crypto`, `express`, `./http-error.js`.
- **GOTCHA**: An item UUID from another campaign must behave as `404`, not update it. Inventory owners reference campaign-local `players:slug` ids, so no change to owner strings is needed.
- **VALIDATE**: `server/test/inventory.test.mjs`: two campaigns cannot see or patch each other's items; player read works; player write 403; create returns no `campaignId`.

### Task 13: Campaign-scope purses

- **ACTION**: Scope purses with composite ids.
- **IMPLEMENT**:
  - `_id = `${campaignId}:${owner}``, store `campaignId` and `owner`.
  - List filters by `campaignId`; `toPublicPurse` returns `{ owner, gold }`.
  - `PUT` is DM-only and upserts by composite id.
- **MIRROR**: `server/src/purses.js:5-38`.
- **IMPORTS**: `express`, `./http-error.js`.
- **GOTCHA**: Do not expose the composite `_id`; clients address purses by owner. Owner strings can contain `:` (`players:tessaly-oakhand`), so split only the first `:` if you ever need to parse; better, never parse.
- **VALIDATE**: `server/test/purses.test.mjs`: same owner in two campaigns has independent gold; player read sees only own campaign; player write 403.

### Task 14: Campaign-scope combat

- **ACTION**: Give each campaign its own encounter and publish with a campaign id.
- **IMPLEMENT**:
  - `ENCOUNTER_ID` becomes a function `encounterId(campaignId)`.
  - `readEncounter(collection, campaignId)`; `createCombatRouter(collection, { campaignId, onSaved })`.
  - One serial queue per campaign, created in the campaign router.
  - `onSaved(campaignId, encounter)` called after each save.
  - Public shape unchanged.
- **MIRROR**: `server/src/combat.js:132-190`.
- **IMPORTS**: `express`, `./http-error.js`.
- **GOTCHA**: The revision must be per campaign. A shared global revision would make one campaign's client discard another campaign's newer snapshot if the ids ever leaked; keep both storage and queue campaign-local.
- **VALIDATE**: `server/test/combat.test.mjs`: two campaigns have independent revision sequences; player read works; player write 403; cross-campaign ids cannot collide.

### Task 15: Campaign WebSocket rooms

- **ACTION**: Replace the global combat socket with campaign-scoped rooms.
- **IMPLEMENT**:
  - `COMBAT_LIVE_PATH` becomes `combatLivePath(campaignSlug)` or a regex `^/api/campaigns/([^/]+)/combat/live$`.
  - `createCombatLive(combat, { resolveAccess })` where `resolveAccess(req, slug)` returns `{ campaignId } | null`.
  - `publish(campaignId, encounter)` selects the room.
  - On connect, read that campaign's encounter.
  - `attach(server)` no longer needs `sessionSecret`; it uses the injected resolver.
  - Remove the socket from its room on close.
- **MIRROR**: `server/src/combat-live.js:23-90`; preserve heartbeat and payload cap.
- **IMPORTS**: `ws`, `./combat.js`, `./sessions.js`, `./campaign-access.js`.
- **GOTCHA**: The upgrade handler is async now. Reject with `401`/`404` before `handleUpgrade`; never call `handleUpgrade` after writing a rejection. Use the same `resolveSession` as REST. The room key must be the campaign id, not the slug, to survive a rename.
- **VALIDATE**: `server/test/combat-live.test.mjs`: member connects and receives the initial encounter; two campaigns do not receive each other's saves; anonymous gets 401; non-member gets 404; unknown path 404; heartbeat still closes dead sockets.

### Task 16: App wiring, startup, CSRF, and rate limits

- **ACTION**: Compose the new app and enforce startup preconditions.
- **IMPLEMENT**:
  - `server/src/app.js` signature from 11.5.
  - Confirm `db.js`, `in-memory-db.js`, `index.js`, and the scripts expose only `entries`, `inventory`, `purses`, and `combat`; delete every legacy `collection` alias.
  - Remove `cors()`.
  - `app.set('trust proxy', config.trustProxy)` when set.
  - Mount `/api/config`, `/api/auth`, `/api/invites`, `/api/campaigns`.
  - Keep static serving and SPA fallback; ensure the fallback does not swallow `/api`.
  - Keep the 404 and error middleware.
  - `server/src/index.js`: in production require `APP_ORIGIN` and SMTP; build the real services; wire collections; `combatLive.attach(server)`.
  - `/api/config` returns `{ googleClientId }`.
- **MIRROR**: `server/src/app.js:12-56`, `server/src/index.js:9-48`.
- **IMPORTS**: `express`, `./auth.js`, `./campaigns.js`, `./invites.js`, `./sessions.js`, `./config.js`.
- **GOTCHA**: `express.json()` must run before handlers that read bodies. Origin checks must run before session mutation but after body parsing is fine. Do not add `cors()` back for the dev server: the proxy makes it unnecessary.
- **VALIDATE**: `server/test/app.test.mjs`: boot with missing production config fails; `/api/config` is public; anonymous campaign request 401; cross-origin POST 403; same-origin POST passes; JSON 404 for unknown API paths; static fallback still serves `index.html`.

### Task 17: Seed, bootstrap, and migration scripts

- **ACTION**: Provide operator tooling for initial setup, recovery, and legacy data.
- **IMPLEMENT**:
  - `bootstrap.mjs` with the three subcommands from 11.2; reuse `loadConfig`, `connectToMongo`, `hashPassword`, `slugify`.
  - `migrate-campaign-scope.mjs` from 11.3 with `--dry-run`.
  - `seed.mjs` resolves `--campaign` and seeds composite ids.
  - Add `server/package.json` scripts `bootstrap`, `migrate`.
- **MIRROR**: `server/scripts/seed.mjs:7-21` connection and cleanup pattern.
- **IMPORTS**: `dotenv/config`, `../src/config.js`, `../src/db.js`, `../src/passwords.js`, `../src/slugify.js`.
- **GOTCHA**: Mongo `_id` is immutable, so entries/purses/combat require insert-then-delete, not `replaceOne` with a new `_id`. Back up first. The migration must be idempotent because operators will run it twice.
- **VALIDATE**: Run the migration twice against a seeded in-memory-like fixture; second run reports 0 migrated. Bootstrap a user and campaign, log in, and verify DM access. Reset a password and confirm sessions are gone.

### Task 18: Client models, campaign context, and API services

- **ACTION**: Introduce the client-side campaign contract before touching UI.
- **IMPLEMENT**:
  - New models and `index.ts` exports.
  - `CampaignContextService` from 10.6.
  - Rewrite `AuthApiService` with typed methods, including `registerWithInvite` and
    `registerWithGoogleInvite`; those two post to `/api/invites/:token/...` but return the same auth
    envelope, so keep them on this service rather than on the campaign-members service.
  - Preserve the HTTP status in a small typed error (for example `ApiError { status, message }`) instead
    of collapsing every failure to `Error(message)`, so the invite component can branch on `409`/`410`
    without matching message text.
  - New `CampaignApiService` and `CampaignMembersApiService`.
  - Prefix `CodexApiService`, `InventoryApiService`, `PurseApiService`, `CombatApiService` with `campaignContext.baseUrl()`.
  - `CombatLiveService.connect(slug)`.
- **MIRROR**: `src/app/core/services/auth-api.service.ts:28-34` friendly error mapping; `src/app/core/services/codex-api.service.ts:15-37` parameter handling.
- **IMPORTS**: `@angular/common/http`, `@angular/core`, `rxjs`, new models.
- **GOTCHA**: Resolve `baseUrl()` at call time, not at construction, because the shell sets the slug after the service is injected. Encode the slug in URLs. Do not put the campaign id in the URL; the server expects the slug.
- **VALIDATE**: Service specs assert exact URLs for two different slugs and that a slug change changes the next request URL.

### Task 19: Auth store rewrite

- **ACTION**: Replace the boolean auth slice with user/campaigns/config state.
- **IMPLEMENT**:
  - State, actions, reducer, effects, selectors from 10.1.
  - Dispatch `loadConfig` once at app startup (app initializer or the root shell bootstrap) and store the result, so login and invite screens know whether Google is enabled before rendering.
  - `selectAuthenticated` derived from `user !== null`; keep `selectAuthChecked` and `selectAuthPending`.
  - Keep `selectAuthError`.
  - Login/Google success navigation rules.
  - Invite registration success rules; registration always lands in the joined campaign.
  - `sessionExpired` handling and logout cleanup, including campaign-scoped stores.
- **MIRROR**: `src/app/store/auth/auth.effects.ts:15-67`; `auth.reducer.ts:7-48`; `create-api-action.ts:20-28`.
- **IMPORTS**: `@ngrx/store`, `@ngrx/effects`, `rxjs`, `AuthApiService`, `CampaignApiService`.
- **GOTCHA**: Do not navigate from a reducer. Do not treat a `401` from `/api/auth/me` as an error; `/me` is always 200 now. Validate `returnUrl` before navigating (must start with `/`, not `//`). Clear campaign-scoped stores on logout and session expiry so a different account never sees stale data.
- **VALIDATE**: Reducer/selector/effect specs: checkSession sets user and campaigns; login failure keeps `user: null`; logout resets; `selectAuthenticated` is false when user is null; returnUrl navigation; one-campaign shortcut; config loads once; invite registration navigates to `campaign.slug` from the response.

### Task 20: Campaign members store and session interceptor

- **ACTION**: Add the members/invites slice and global 401 handling.
- **IMPLEMENT**:
  - `src/app/store/campaign-members/*` from 10.2.
  - Store `errorStatus` on every failure so the invite page can distinguish `404` from `410`; clear it at each request start.
  - `auth.interceptor.ts` functional interceptor: on `401` from any URL not starting with `/api/auth`, dispatch `sessionExpired`; rethrow the error so the caller still fails.
  - Register the interceptor with `provideHttpClient(withInterceptors([authInterceptor]))` in `app.config.ts`.
- **MIRROR**: `createApiAction`; effects error mapping.
- **IMPORTS**: `@angular/common/http`, `@ngrx/store`, `rxjs`.
- **GOTCHA**: The interceptor must not redirect directly; the guard does that on the next navigation, which preserves a single redirect path. Ignore `/api/auth/login`, `/api/auth/google`, `/api/auth/reset-password`, `/api/auth/me`, and the two public `/api/invites/:token/register|google` URLs so a wrong password or Google credential does not look like an expired session.
- **VALIDATE**: Interceptor spec: 401 on `/api/campaigns/x/entries` dispatches `sessionExpired`; 401 on `/api/auth/login` does not; 500 does not. Members reducer stores `errorStatus` for preview 404/410 and resets on `campaignActivated`.

### Task 21: Guards, routes, and route reuse

- **ACTION**: Switch the app to the campaign-scoped route tree.
- **IMPLEMENT**:
  - Rewrite `auth.guard.ts` with `authGuard`, `guestGuard`, `campaignMemberGuard`.
  - Rewrite `app.routes.ts` exactly as 10.3.
  - Add `CampaignRouteReuseStrategy` and provide it in `app.config.ts`.
  - Add placeholder lazy imports for the new feature components (created in Tasks 22-25).
- **MIRROR**: `src/app/core/guards/auth.guard.ts:9-33` wait-for-checked pattern; `src/app/app.routes.ts:5-46` lazy loading.
- **IMPORTS**: `@angular/router`, `@ngrx/store`, `rxjs`, auth selectors/actions.
- **GOTCHA**: Route order matters: `members`, `inventory`, and `combat` must precede `:section`. `campaignMemberGuard` must not redirect before `checked` is true. The reuse strategy must compare `future.params`, not `future.queryParams`, because the slug is a path param. Without the strategy, `ngOnInit` will not re-run and the WebSocket will stay on the old campaign.
- **VALIDATE**: Guard specs and route specs: anonymous -> `/login?returnUrl=...`; authenticated guest -> `/campaigns`; missing campaign -> `/campaigns`; `/register` redirects to `/login`; switching slugs recreates the shell; same slug reuses it.

### Task 22: Login, forgot-password, and reset-password UI

- **ACTION**: Build the public auth screens.
- **IMPLEMENT**:
  - Login: email + password controls, submit, Google button rendered only when `config.googleClientId` is set, "Forgot password?" link, `returnUrl` handling, `reset=1` success notice.
  - Load Google Identity Services with the client id from `/api/config`; on callback dispatch `googleLogin({ credential })`. Encapsulate in `GoogleSignInService` or a small component-level loader; do not pollute the login component with script-tag code.
  - Forgot: email form, generic success state.
  - Reset: token from route, password + confirm, client-side match and length validation, success -> login.
  - All HTTP through effects.
- **MIRROR**: `src/app/features/auth/login.component.ts:20-37` form control + store dispatch; Material modules already used.
- **IMPORTS**: `@angular/forms`, `@angular/material/*`, `@ngrx/store`, auth actions/selectors.
- **GOTCHA**: Do not show whether an email exists. Do not store the Google credential anywhere. The Google script requires the origin to be authorized in the Google console; document `http://localhost:57571` and the production origin. If `googleClientId` is null, hide the button rather than rendering a broken one. After a successful password reset, clear the stale client auth state before navigating to `/login`, or `guestGuard` will bounce the user back to `/campaigns` with a revoked session.
- **VALIDATE**: Component specs: invalid form does not dispatch; valid login dispatches; Google button hidden without config; forgot shows generic message; reset mismatch blocks submit; token passed to action; reset success clears auth state before navigating.

### Task 23: Invite preview, registration, and acceptance UI

- **ACTION**: Let a signed-out visitor create an account through an invite, and let a signed-in visitor accept it.
- **IMPLEMENT**:
  - `/invite/:token` component dispatches `loadInvitePreview` on init.
  - States: loading, invalid (404), expired/used (410), valid. For 410, show the error and, when signed in, a "Go to your campaigns" link; there is no campaign name or slug to open directly.
  - Signed out and valid: show campaign name and expiry, then two paths.
    - "Create account" tab: display name, email, password, confirm password; submit dispatches
      `registerViaInvite` with the route token. This is the only registration form in the app.
    - "Continue with Google": render only when `/api/config` exposes a client ID; dispatch
      `googleRegisterViaInvite` with the route token and the Google credential.
    - "Already have an account? Sign in" links to `/login?returnUrl=/invite/<token>`.
  - Signed in and not a member: "Join campaign" dispatches `acceptInvite`; success refreshes campaigns
    and navigates to the campaign.
  - Signed in and already a member with a still-valid invite: "Open campaign", determined by comparing
    `invitePreview.campaignSlug` with `selectCampaigns`.
- **MIRROR**: Signal + store pattern; error message mapping from `auth-api.service.ts:28-34`; the
  login form's control/validation structure for the registration form.
- **IMPORTS**: `@angular/router`, `@angular/forms`, `@angular/material/*`, `@ngrx/store`, `rxjs`,
  auth actions/selectors, campaign-members actions/selectors.
- **GOTCHA**: The preview endpoint is public; registration and acceptance are authorized by the invite
  token, not by a session. Wait for `checked` before choosing the signed-out or signed-in branch, so a
  signed-in user never flashes the registration form during session bootstrap. Do not clear the token
  from the URL before the call succeeds, and do not swap to the signed-in "Join" state until
  `loadCampaigns` has run. Registration success must refresh campaigns before navigation so
  `campaignMemberGuard` sees the new membership. A `409` means the email already has an account: show
  "Sign in to join" and keep the token, because the invite is still unused. Branch on the typed error
  status, not on message text. Do not post the Google credential anywhere except the invite Google
  endpoint.
- **VALIDATE**: Specs for all preview states; password mismatch blocks submit; registration dispatch
  payload includes the route token; Google button hidden without config; 409 shows the sign-in path;
  signed-in acceptance dispatch order; returnUrl round trip.

### Task 24: Campaign list and creation UI

- **ACTION**: Build the post-login campaign picker.
- **IMPLEMENT**:
  - Cards for each campaign: name, role badge, "Open".
  - Empty state explaining invite links and offering "Create a campaign".
  - Inline create form: name input, validation, create button, pending state.
  - "Join with invite" helper text.
  - Header/account area with display name and sign out.
- **MIRROR**: Existing Material button/form patterns; `pane-is-loading` for loading.
- **IMPORTS**: `@angular/forms`, `@angular/material/*`, `@ngrx/store`, auth actions/selectors.
- **GOTCHA**: Do not auto-redirect away from the list when the user has one campaign; they may want to create another. The login shortcut handles the common case; the list stays reachable. Slug generation is server-side; never derive it in the client.
- **VALIDATE**: Specs: empty state, card navigation, create dispatches trimmed name, invalid name blocked, role badge text.

### Task 25: Members and invite management UI

- **ACTION**: Add the campaign roster and DM invite panel.
- **IMPLEMENT**:
  - `MembersComponent` loads members and, for DM, invites.
  - Member table: display name, role, joined date; email column only for DM.
  - Invite panel (DM): "Create invite" -> show URL once with copy button and expiry; list statuses; explain single-use and 7-day expiry.
  - Player view: roster only, no invite controls.
- **MIRROR**: `src/app/shared/datatable` for read-only tables; Material buttons.
- **IMPORTS**: `@angular/common`, `@angular/material/*`, `@ngrx/store`, campaign-members actions/selectors, auth selectors.
- **GOTCHA**: The URL is returned only once; do not render a stale list URL after reload. Copy must use `navigator.clipboard` with a visible fallback (selectable input) when the API is unavailable. Do not show email addresses to players.
- **VALIDATE**: Specs: DM sees invite panel and email column; player does not; create shows URL once; role badge.

### Task 26: Shell, header, sidebar, and campaign switching

- **ACTION**: Make the shell campaign-aware.
- **IMPLEMENT**:
  - Shell reads `campaignSlug`, dispatches `campaignActivated`, sets `CampaignContextService`, loads codex/inventory/combat/purses for that campaign, clears context on destroy.
  - Header reads campaign name from the store; adds campaign switcher; adds members link (visible to all); keeps help/search/player-preview/sign-out.
  - Header search navigates with the active slug.
  - Sidebar links and active checks use the slug; add a "Members" nav item.
  - Campaign switch navigates to `/campaigns/:slug/npcs`; "All campaigns" -> `/campaigns`.
- **MIRROR**: `campaign-shell.component.ts:42-51`; `codex-sidebar.component.ts:57-63`; `codex-sidebar.component.html:32,55,67,87`.
- **IMPORTS**: `@angular/router`, `@ngrx/store`, `rxjs`, campaign context, auth/codex/combat/inventory/purses actions.
- **GOTCHA**: The shell must not keep the previous campaign's data while the new loads are pending; reducers reset on `campaignActivated`. The header search must not navigate to another campaign's entry. `data-help` anchors must be updated if the members nav adds a new target.
- **VALIDATE**: Shell spec: slug change dispatches loads and resets; header shows campaign name; switch navigates; sidebar highlights the right section under two slugs.

### Task 27: Player mode, entry detail, markdown, help, and live combat

- **ACTION**: Make role-derived player mode consistent across the reading experience.
- **IMPLEMENT**:
  - Codex state `dmPreview`; `selectPlayerMode = role === 'player' || dmPreview`.
  - Header toggle dispatches `dmPreviewToggled`; hidden for real players (or replaced with a static badge).
  - Entry detail hides edit/delete/favourite/DM visibility controls for players; DM preview keeps the DM banner.
  - Entry detail and section list navigate with the active slug.
  - `IRenderOptions.campaignSlug`; markdown entity links use it; `showDmBlocks` stays.
  - Help URL resolver handles `/campaigns/:slug/...` and `members`.
  - Combat and inventory components hide write controls for players.
  - `CombatLiveService.connect(slug)` wired from combat effects.
- **MIRROR**: `entry-detail.component.ts:90,131,173,288`; `markdown-renderer.service.ts:7-10,50-59,193`; `help-page.util.ts:8-25`; `combat-live.service.ts:59-110`.
- **IMPORTS**: `@ngrx/store`, `@angular/router`, `rxjs`, codex/auth selectors.
- **GOTCHA**: Do not rely on `dmPreview` alone for security. A real player must never see DM entries even if `dmPreview` is somehow false/true; the server already excludes them, and the client selector must not turn preview into an elevation. `:::dm` stripping still happens server-side; the client renderer is defence in depth. A player toggling player mode off must not re-enable edits.
- **VALIDATE**: Specs: player hides all write controls; DM preview hides writes but keeps DM-only content; real player cannot toggle preview; markdown link uses the slug; help resolves members; live service receives the slug.

### Task 28: Server test suite completion

- **ACTION**: Finish and harden the API tests.
- **IMPLEMENT**:
  - `server/test/helpers.mjs` with app/user/campaign/login builders.
  - Cover the full matrix in 16.1.
  - Add migration and bootstrap script tests where practical (pure functions; spawn the CLI only if fast).
  - Add a rate-limit test with injected limiters.
  - Add a "no DM leak" test that inspects list and detail bodies for players.
- **MIRROR**: `server/test/auth.test.mjs:10-14,44-54`; `server/test/combat-live.test.mjs:32-59`.
- **IMPORTS**: `node:test`, `node:assert/strict`, `supertest`, `ws`.
- **GOTCHA**: Fake collections are shared per app; reset between tests or build a new app each time. Cookie agents must be used for session persistence. WebSocket tests must close servers in `t.after` to avoid hanging the runner.
- **VALIDATE**: `pnpm --filter naxxar-campaign-server test` green; no test depends on a live MongoDB; suite under ~30 seconds.

### Task 29: Client test suite completion

- **ACTION**: Cover the new store, guards, services, and components.
- **IMPLEMENT**:
  - Auth reducer/effects/selectors; campaign-members; guard; reuse strategy; interceptor.
  - API service URL tests for two slugs.
  - Login/forgot/reset/invite/campaign-list/members component specs.
  - Player-mode selector tests for all three combinations.
  - Reset-on-campaign-change and reset-on-logout/session-expiry tests for codex/inventory/combat/purses/editor.
- **MIRROR**: README lines 203-205 and existing specs.
- **IMPORTS**: Jest, `@ngrx/store/testing`, `provideMockActions`, Angular TestBed.
- **GOTCHA**: Do not use `fakeAsync`/`tick`; use Jest fake timers. Child components are mocked with `overrideComponent`. Google script loading must be injectable/faked; never hit the network in tests.
- **VALIDATE**: `pnpm test` green; `pnpm run test:coverage` at or above the existing 95% line target and never below the 80% floor.

### Task 30: Documentation and cleanup

- **ACTION**: Update operator and developer docs, then remove dead shared-password code.
- **IMPLEMENT**:
  - `README.md`: new routes, auth flow, dev credentials, campaign model, commands.
  - `server/README.md`: environment table, auth endpoints, campaign endpoints, role matrix, WebSocket path, migration/bootstrap, production checklist, scaling limits.
  - Confirm `APP_PASSWORD` / `SESSION_SECRET` appear nowhere except a migration note.
  - Confirm `cors` is gone from `server/package.json` and `app.js`.
  - Confirm no hardcoded `/campaign` links remain (`grep`).
  - Add a short "Security notes" section: same-origin deployment, TLS termination, SMTP, Google authorized origins, rate limits, single-instance limits.
- **MIRROR**: Existing README structure and tables.
- **IMPORTS**: none.
- **GOTCHA**: Do not document features that were not built (email verification, member removal, role changes). Document the invite-once behaviour clearly so operators do not expect a reusable link.
- **VALIDATE**: `pnpm run lint`; `grep -R "APP_PASSWORD\|SESSION_SECRET" server README.md` returns only intentional migration notes; `grep -R "'/campaign\|\"/campaign" src` returns nothing.

---

## 16. Testing Strategy

### 16.1 Server test matrix

All API tests use `node:test`, `node:assert/strict`, `supertest`, and `createFakeCollection`. No live
MongoDB is required. A small number of tests exercise the real Argon2 module; the rest inject a fast
fake so the suite stays quick.

| Area           | File                                  | Required cases                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Passwords      | `server/test/passwords.test.mjs`      | Round trip, wrong password, malformed hash, policy boundaries, unique salts.                                                                                                                                                                                                                                                                                                                     |
| Sessions       | `server/test/sessions.test.mjs`       | Token/hash, cookie flags, expired session, tampered cookie, revocation, origin check.                                                                                                                                                                                                                                                                                                            |
| Auth           | `server/test/auth.test.mjs`           | Login success/failure, unknown email parity, `/me` anonymous and signed in, logout deletes the row, cookie cleared.                                                                                                                                                                                                                                                                              |
| Google         | `server/test/google-auth.test.mjs`    | Fake verifier success, unverified email, unknown email rejected (no account creation), auto-link, link collision, verifier exception.                                                                                                                                                                                                                                                            |
| Password reset | `server/test/password-reset.test.mjs` | Generic 202, token creation, successful reset, reuse, expiry, weak password, all sessions revoked.                                                                                                                                                                                                                                                                                               |
| Campaigns      | `server/test/campaigns.test.mjs`      | List own only, create assigns DM, slug collision, non-member 404, player write 403, detail response.                                                                                                                                                                                                                                                                                             |
| Invites        | `server/test/invites.test.mjs`        | Preview states, DM-only create/list, player 403, password registration creates a session and player membership, Google registration creates a passwordless user, duplicate email 409 leaves the invite unused, Google existing-user link, existing-member Google link leaves the invite unused, existing-user accept, idempotent already-member, single use, expiry, parallel-registration race. |
| Members        | `server/test/members.test.mjs`        | Roster, DM sees email, player does not, cross-campaign isolation.                                                                                                                                                                                                                                                                                                                                |
| Entries        | `server/test/entries.test.mjs`        | Same slug in two campaigns, DM entry hidden from player list, player detail 404, DM blocks stripped, DM still sees, duplicate 409, cross-campaign 404.                                                                                                                                                                                                                                           |
| Inventory      | `server/test/inventory.test.mjs`      | Read/write isolation, player 403, no `campaignId` leak, cross-campaign patch 404.                                                                                                                                                                                                                                                                                                                |
| Purses         | `server/test/purses.test.mjs`         | Independent gold per campaign, player 403, public shape.                                                                                                                                                                                                                                                                                                                                         |
| Combat         | `server/test/combat.test.mjs`         | Independent revisions, player 403, empty default per campaign.                                                                                                                                                                                                                                                                                                                                   |
| Combat live    | `server/test/combat-live.test.mjs`    | Initial snapshot, per-campaign room isolation, 401/404 upgrades, unknown path, reconnect snapshot.                                                                                                                                                                                                                                                                                               |
| App/config     | `server/test/app.test.mjs`            | Production fail-fast, public config, CSRF, 404/error shapes, static fallback.                                                                                                                                                                                                                                                                                                                    |
| Scripts        | `server/test/scripts.test.mjs`        | Migration idempotence and dry run; bootstrap user/campaign/reset; seed resolution.                                                                                                                                                                                                                                                                                                               |

Specific security regressions that must exist as named tests:

- `player never receives a visibility:dm entry`
- `player never receives :::dm content`
- `player cannot write any campaign content`
- `non-member cannot distinguish a missing campaign from an unjoined one`
- `expired session is rejected even before the TTL monitor runs`
- `password reset revokes every session`
- `an invite token can be consumed exactly once`
- `a used invite cannot register an account`
- `duplicate-email registration leaves the invite unused`
- `a websocket in campaign A never receives campaign B's encounter`
- `cross-origin unsafe request is rejected`
- `login response time does not reveal whether the email exists` (structural check: dummy verify called)

### 16.2 Client test matrix

| Area             | Spec                                                                    | Required cases                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth reducer     | `auth.reducer.spec.ts`                                                  | Initial, checkSession, login, google, invite registration, logout, sessionExpired, campaignActivated.                                         |
| Auth selectors   | `auth.selectors.spec.ts`                                                | `authenticated`, user, campaigns, active campaign, active role.                                                                               |
| Auth effects     | `auth.effects.spec.ts`                                                  | API mapping, returnUrl navigation, registration navigation, one-campaign shortcut, create campaign navigation, config load, reset navigation. |
| Campaign members | `campaign-members.*.spec.ts`                                            | Load, create invite URL, preview states, accept, reset on campaign change.                                                                    |
| Guards           | `auth.guard.spec.ts`                                                    | Checked wait, anonymous redirect with returnUrl, guest redirect, missing campaign, member pass.                                               |
| Reuse strategy   | `campaign-route-reuse.strategy.spec.ts`                                 | Same slug true, different slug false, different route config false.                                                                           |
| Interceptor      | `auth.interceptor.spec.ts`                                              | 401 on content dispatches expiry, auth/invite-registration endpoints ignored, other errors pass.                                              |
| API services     | `*-api.service.spec.ts`                                                 | Exact campaign-scoped URLs for two slugs, error mapping, no module-level constant.                                                            |
| Player mode      | `codex.selectors.spec.ts`                                               | DM, player, DM preview combinations.                                                                                                          |
| Login            | `login.component.spec.ts`                                               | Invalid form, dispatch, Google visibility, reset notice, returnUrl.                                                                           |
| Forgot/reset     | `forgot-password.component.spec.ts`, `reset-password.component.spec.ts` | Validation, generic success, token pass-through, mismatch.                                                                                    |
| Invite           | `invite-accept.component.spec.ts`                                       | Preview states, signed-out registration form, Google registration visibility, 409 sign-in path, signed-in accept then refresh then navigate.  |
| Campaign list    | `campaign-list.component.spec.ts`                                       | Empty, cards, create, pending, role badge.                                                                                                    |
| Members          | `members.component.spec.ts`                                             | DM panel/email column, player restrictions, copy-once URL.                                                                                    |
| Shell            | `campaign-shell.component.spec.ts`                                      | Slug activation, loads, context clear, switch.                                                                                                |
| Navigation       | `codex-header/sidebar/section-list/entry-detail` specs                  | All built routes include the campaign slug.                                                                                                   |
| Markdown/help    | `markdown-renderer.service.spec.ts`, `help-page.util.spec.ts`           | Slug-aware entity link, DM blocks, members page, new URL shape.                                                                               |
| Live combat      | `combat-live.service.spec.ts`                                           | URL contains the slug, reconnect, close on unsubscribe.                                                                                       |

### 16.3 Manual end-to-end script

Run this on a clean database before calling the work done:

1. `pn run dev`; confirm the dev DM email is logged and login works with `dm@naxxar.local` / `app`.
2. Create a second campaign; verify the slug appears and the DM lands in it.
3. Create a DM-only entry and a `:::dm` block; copy the invite link from Members.
4. Open the invite in a private window; confirm the public preview and create the second account with email/password, then land in the campaign. Repeat with a fresh invite in another private window using Google.
5. As the player: verify no DM entry, no DM block, no edit/delete controls, read-only inventory/combat, and no invite panel.
6. Sign out, reopen the same (now used) invite link, sign in as the player, and confirm it shows the used state with a campaigns link; then open the campaign from `/campaigns`.
7. As the DM: verify live combat updates reach the player's window and do not reach a tab open in the other campaign.
8. Switch campaigns in the header; verify the sidebar, entries, inventory, gold, and combat all change and no old data flashes.
9. Sign out; verify `/campaigns` redirects to login and the back button does not restore content.
10. Request a password reset; use the logged dev link; verify the old session is signed out and the new password works.
11. Expire an invite by editing `expiresAt`; verify the preview shows expired and acceptance is blocked.
12. Attempt a cross-campaign API call with the player's cookie; verify `404`.
13. Resize to tablet/phone; verify the campaign switcher, sidebar, and new forms remain usable.

### 16.4 Coverage expectations

- Server: every new module has direct tests; route tests cover success, validation, auth, role, and
  cross-campaign cases. No coverage percentage is enforced on the server today; do not reduce the
  existing breadth.
- Client: keep the existing 95% line target and never fall below the 80% floor in `jest.config.js`.
- New code should not be excluded from coverage to make the number pass.

### 16.5 Rollout slices

1. **Server identity + scoping** (Tasks 1-17): deploy behind a feature branch; the old client will not
   work against it, so do not ship halfway.
2. **Client auth + campaign shell** (Tasks 18-26): switch the route tree and UI in one deploy.
3. **Role polish + docs** (Tasks 27-30): player-mode gating, tests, documentation.
4. **Data migration** (Section 11): run during a maintenance window after the new code is deployed and
   before users are invited.
5. **Invite rollout**: create the owner account, migrate, seed, verify, then issue the first invite.

---

## 17. Validation Commands

Run from the repository root.

```bash
# Install the new server dependencies
pnpm install

# Type-check and build the Angular app
pn run build

# Client unit tests
pn test

# Client coverage gates
pn run test:coverage

# Server tests (in-memory, no MongoDB)
pn run server:test

# Formatting gate
pn run lint

# Full local stack (server + Angular dev server)
pn run dev

# Seed a real database into a campaign
pn run server:seed -- --campaign naxxar

# Operator setup
node server/scripts/bootstrap.mjs user --email dm@example.com --name "Dungeon Master"
node server/scripts/bootstrap.mjs campaign --slug naxxar --name "Naxxar" --dm-email dm@example.com

# Legacy migration, dry run first
node server/scripts/migrate-campaign-scope.mjs --campaign naxxar --dry-run
node server/scripts/migrate-campaign-scope.mjs --campaign naxxar
```

Targeted test runs during development:

```bash
pnpm --filter naxxar-campaign-server exec node --test test/auth.test.mjs
pnpm --filter naxxar-campaign-server exec node --test test/entries.test.mjs
pnpm exec jest src/app/store/auth
pnpm exec jest src/app/core/guards
```

Production smoke checks after deploy:

```bash
curl -i https://app.example.com/api/config
curl -i https://app.example.com/api/campaigns
curl -i -X POST https://app.example.com/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"dm@example.com","password":"..."}'
```

Expected: `/api/config` is `200`; `/api/campaigns` without a cookie is `401`; login is `200` with
`Set-Cookie: naxxar_session=...; HttpOnly; SameSite=Lax; Secure`; a wrong password is `401` with the
generic message.

---

## 18. Acceptance Criteria

### Authentication

- [ ] A user can sign in with email + password and receives an httpOnly `naxxar_session` cookie.
- [ ] A user can sign in with Google when `GOOGLE_CLIENT_ID` is configured; the button is hidden otherwise.
- [ ] Google login never creates an account; an unknown verified email at `/api/auth/google` gets a friendly invite-only error.
- [ ] Google registration creates an account only at `/api/invites/:token/google` with a valid invite; a passwordless user can later set a password by reset.
- [ ] A verified Google email auto-links only to an existing account with no `googleSub`.
- [ ] Passwords are stored with Argon2id at m=19456 KiB, t=2, p=1.
- [ ] `GET /api/auth/me` returns `200` with `user: null` when anonymous.
- [ ] Logout deletes the session document and clears the cookie.
- [ ] Sessions expire after 30 days; expired sessions are rejected before TTL cleanup runs.
- [ ] Login, Google login, invite registration, forgot, reset, and invite accept are rate-limited.
- [ ] Unsafe cross-origin requests are rejected; same-origin requests work without CORS.

### Multi-campaign tenancy

- [ ] Every content document has a `campaignId`, and every content query filters on it.
- [ ] A user can belong to multiple campaigns with a different role in each.
- [ ] Campaign content, inventory, purses, combat, members, and invites are isolated per campaign.
- [ ] A non-member receives `404` for a campaign they have not joined.
- [ ] Creating a campaign makes the creator its DM.
- [ ] The campaign picker lists only the caller's campaigns.

### Roles

- [ ] Players can read entries, inventory, purses, combat, and members.
- [ ] Players cannot create, update, or delete any campaign content; the server returns `403`.
- [ ] Players never receive `visibility: dm` entries or `:::dm` blocks.
- [ ] Players do not receive member email addresses.
- [ ] Players cannot create or list invites.
- [ ] The DM can preview the player view and return to DM controls.
- [ ] There is exactly one DM per campaign; no role-change or transfer UI exists.

### Invites

- [ ] Only the DM can create an invite.
- [ ] An invite is a copy-link URL, shown once, valid for 7 days, and single-use.
- [ ] A valid invite lets an anonymous visitor create an account with email/password or Google; no other HTTP endpoint creates accounts (operator scripts are not public).
- [ ] A used, expired, or unknown invite cannot create an account or add a membership.
- [ ] Registration with an email that already exists returns `409` and leaves the invite unused.
- [ ] The database stores only the token hash.
- [ ] Accepting an invite creates a `player` membership and is idempotent for existing members.
- [ ] Used, expired, and unknown invites are distinguishable to the invitee but do not leak campaign data.

### Password reset

- [ ] Forgot-password always returns the same generic response.
- [ ] The reset link works once and expires after 60 minutes.
- [ ] A successful reset revokes every session for that user.
- [ ] Development logs the reset link; production refuses to start without SMTP configuration.
- [ ] The bootstrap CLI can recover a locked-out owner.

### Client UX

- [ ] `/login`, `/register` (redirects to login), `/forgot-password`, `/reset-password/:token`,
      `/invite/:token`, `/campaigns`, and the campaign-scoped shell routes all render and are bookmarkable.
- [ ] `returnUrl` survives the login round trip and rejects external URLs.
- [ ] Switching campaigns destroys and recreates the shell, its data, and its WebSocket.
- [ ] No stale campaign data flashes after a switch.
- [ ] Header search, sidebar links, entry links, markdown entity links, and help topics all use the
      active campaign slug.
- [ ] The app still works at tablet and phone widths.

### Quality gates

- [ ] `pn run build` passes.
- [ ] `pn test` passes; coverage stays at or above the existing target and never below 80%.
- [ ] `pn run server:test` passes without MongoDB.
- [ ] `pn run lint` passes.
- [ ] No `APP_PASSWORD`, `SESSION_SECRET`, `cors()`, or hardcoded `/campaign` navigation remains.
- [ ] `README.md` and `server/README.md` document the new flow, env vars, migration, and limitations.

---

## 19. Risks and Mitigations

| #   | Risk                                                                             | Impact   | Likelihood | Mitigation                                                                                                                                                                        | Detection                                                                  |
| --- | -------------------------------------------------------------------------------- | -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | A missed `campaignId` filter leaks another campaign's content.                   | Critical | Medium     | Centralize scoping in the campaign router and helpers; never query content collections without a campaign filter; add cross-campaign tests for every collection.                  | Named isolation tests; code review grep for `find(` in content routers.    |
| 2   | A player receives DM-only content through a summary, detail, or markdown body.   | Critical | Medium     | Filter `visibility` at the query level; 404 on detail; strip `:::dm` server-side; test list and detail bodies byte-for-byte.                                                      | `player never receives...` tests; manual private-window check.             |
| 3   | Session cookie is dropped or sent insecurely after deploy.                       | High     | Medium     | Derive `secure` from `APP_ORIGIN`; same-origin deployment; `SameSite=Lax`; test over HTTPS; document proxy TLS termination.                                                       | Production smoke check of `Set-Cookie`; login test on the deployed origin. |
| 4   | Google sign-in fails due to an unauthorized origin or wrong client id.           | Medium   | Medium     | Expose `googleClientId` through `/api/config`; document authorized origins; hide the button when unset; return a clear but non-sensitive error.                                   | Manual Google login on the deployed origin.                                |
| 5   | SMTP is misconfigured, so password reset is unusable and users are locked out.   | High     | Medium     | Fail fast in production without SMTP; dev logs the link; bootstrap CLI can reset a password and revoke sessions.                                                                  | Startup check; operator runbook; manual reset test.                        |
| 6   | An invite link is lost because only the hash is stored.                          | Medium   | Medium     | Show the URL once with a copy button and a selectable fallback; explain that a new invite is required.                                                                            | UX copy review; manual test.                                               |
| 7   | The shell is reused across campaigns, leaving the old WebSocket and data active. | High     | Medium     | `CampaignRouteReuseStrategy`; reset reducers on `campaignActivated`; close the socket in shell teardown.                                                                          | Guard/reuse tests; manual two-tab check.                                   |
| 8   | Migration is run without a backup or is not idempotent.                          | Critical | Low        | `--dry-run`; insert-then-delete because `_id` is immutable; skip documents with `campaignId`; back up first.                                                                      | Script tests; dry-run count review.                                        |
| 9   | In-memory fake and MongoDB diverge on a new operator.                            | Medium   | Medium     | Extend `matches` with tests; keep `replaceOne` semantics exact; run a real-Mongo smoke test before migration.                                                                     | Fake unit tests; one staging Mongo run.                                    |
| 10  | Argon2 memory cost exhausts the single process under a login burst.              | Medium   | Low        | Rate-limit login/Google; 19 MiB per concurrent hash; document the single-instance limit; monitor memory.                                                                          | Load test with the rate limiter enabled.                                   |
| 11  | `TRUST_PROXY` is wrong, so rate limits key on the proxy IP.                      | Medium   | Medium     | Default to false; document the exact hop count; set it only behind a known proxy.                                                                                                 | Rate-limit test with forwarded headers.                                    |
| 12  | Client role gating is mistaken for authorization.                                | Critical | Low        | Server enforces every rule; client only hides controls; tests assert 403/404 directly against the API.                                                                            | API tests; security review.                                                |
| 13  | User data remains in client stores after logout or account switch.               | High     | Medium     | Reset auth, codex, inventory, combat, purses, editor, and campaign-members on logout/expiry/campaign change.                                                                      | Reducer tests; manual account-switch check.                                |
| 14  | Scope creep adds co-DMs, member removal, or email invites mid-implementation.    | Medium   | Medium     | Keep Section 4's NOT-building list visible in every PR; defer to a follow-up plan.                                                                                                | PR review against the plan.                                                |
| 15  | No rollback path to the shared-password build.                                   | High     | Low        | Keep the change on a branch until the migration is verified; back up the database; the old code cannot read new documents, so rollback is restore-from-backup, not a code revert. | Deployment checklist.                                                      |

### Rollback policy

The schema change is not backward compatible: the old code expects `section:slug` ids and no campaign
filter. A code revert alone would show an empty or partially broken app. The safe rollback is:

1. Stop the API.
2. Restore the pre-migration MongoDB dump.
3. Redeploy the previous code.
4. Re-issue the old shared password.

Document this explicitly so nobody attempts a partial rollback.

---

## 20. Confidence and Open Questions

### Confidence: 8.5 / 10

Why it is high:

- Every current auth, routing, store, WebSocket, and content path was read and is referenced by
  `file:line` in this plan.
- The tenant boundary is simple and testable: one `campaignId` filter plus one membership check.
- Public entry ids stay campaign-relative, avoiding a large id migration in the client and markdown.
- The role model is small (`dm` / `player`) and matches the existing client-only player mode.
- The migration and lockout risks have explicit operator tooling.

Residual uncertainty:

- Google Identity Services and SMTP cannot be fully exercised locally; both depend on external console
  and delivery configuration.
- The in-memory fake must stay in sync with MongoDB for `$in`, `$ne`, `$exists`, and replacement
  semantics. The plan adds tests, but divergence remains a maintenance risk.
- The exact Angular route-reuse behaviour should be verified with an integration test or a manual
  two-campaign switch, because `RouteReuseStrategy` interacts with lazy loading and child routes.
- Rate limiting and WebSocket rooms are single-instance by design; a future multi-instance deployment
  needs a shared store and pub/sub, which this plan deliberately does not build.

### Open questions for the implementer

1. **Google client id**: who owns the Google Cloud project and authorized origins? The code can ship
   with the button hidden, but public Google sign-in needs the production origin registered.
2. **SMTP provider**: which provider and From address? The plan only needs a URL and a from address,
   but deliverability and SPF/DKIM are deployment concerns.
3. **Display names**: should a user be able to change their display name? This plan does not build an
   account settings screen; the bootstrap CLI and invite registration can set it. If users need to edit
   it, add a minimal `PATCH /api/auth/me` later.
4. **Campaign creation limits**: should any user be able to create unlimited campaigns? The plan says
   yes. If abuse becomes a concern, add a per-user cap or an invite-to-create policy later.
5. **Player editing**: confirm that players should be read-only for inventory and purses. If players
   need to manage their own sheet, that is a follow-up permission model, not a change to this plan.
6. **Deployment topology**: confirm one Express instance and same-origin static serving. Multiple
   instances require shared sessions (already in Mongo, so fine) plus shared rate limits and WebSocket
   pub/sub (not built).

### Definition of done

- All acceptance criteria in Section 18 are checked.
- All validation commands in Section 17 pass.
- The manual end-to-end script in 16.3 passes in a private window with two users.
- The migration has been dry-run and then executed against a backed-up database.
- The old shared-password code and `cors` dependency are gone.
- The docs describe the invite-once behaviour, the single-instance limits, and the rollback policy.

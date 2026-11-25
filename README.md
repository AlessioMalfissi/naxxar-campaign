# Naxxar campaign

Dungeons & Dragons campaign dashboard: lore split across six sections, each entry stored as a markdown
file and edited in place with a formatting toolbar. Dark theme, green primary, light-gray secondary.

Multiple campaigns share one deployment. Each account sees only the campaigns it belongs to, with a
`dm` or `player` role deciding what it can change. Built to the specification in
`naxxar-campaign-dashboard-spec.pdf`, extended for public, invite-only sign-in.

## Stack

| Package                              | Version     |
| ------------------------------------ | ----------- |
| Angular                              | 19.2.25     |
| Angular Material / CDK               | 19.2.19     |
| NgRx store / effects                 | 19.2.1      |
| TypeScript                           | 5.7         |
| Jest + jest-preset-angular           | 29 / 14.5   |
| Express + MongoDB driver (`server/`) | 4.21 / 6.10 |

## Running it

The app is a static Angular front end talking to a small Node/Express API in `server/`, backed by
MongoDB. Both live in this repo as a pnpm workspace.

```bash
pnpm install                 # installs both the app and server/
pnpm run dev                 # runs the API (:3000) and `ng serve` (:57571) together
```

`pnpm run dev` falls back to an in-memory database seeded from `server/seed-data` when `MONGODB_URI`
is unset; changes reset when the server restarts. It seeds one DM account and one campaign:

| Field    | Value             |
| -------- | ----------------- |
| Email    | `dm@naxxar.local` |
| Password | `app`             |
| Campaign | `naxxar`          |

To use a real MongoDB in dev, copy `server/.env.example` to `server/.env`, uncomment `MONGODB_URI`,
and create the first DM and campaign once (see `server/README.md` for the full flags). The normal
`pnpm run server` and the deployed app always connect to MongoDB, not the in-memory store.

```bash
pnpm --dir server run bootstrap -- user \
  --email dm@example.com --name "Dungeon Master" --password "change-me-now"
pnpm --dir server run bootstrap -- campaign \
  --slug naxxar --name Naxxar --dm-email dm@example.com
pnpm run server:seed -- --campaign naxxar
```

`ng serve` proxies `/api/*` (including the combat websocket) to `http://localhost:3000`; see
`proxy.conf.json`. To run the two processes separately: `pnpm run server` (or `pnpm run server:dev` to
restart on file changes) in one terminal, `pnpm start` in another.

```bash
pnpm run build       # production Angular bundle in dist/naxxar-campaign/browser
pnpm test            # Angular specs
pnpm run test:coverage
pnpm run server:test # API specs (no live MongoDB needed - routes use an in-memory fake)
pnpm run lint        # Prettier check (fails on unformatted files)
pnpm run format      # Prettier rewrite of every file
```

See `server/README.md` for endpoints, environment variables, the role matrix, the migration and
bootstrap commands, and how to serve the built Angular app from the same process.

## Accounts and campaigns

There is no public sign-up. A DM creates an invite from the campaign's **Members** page, and the invite
link is the only way a new account is created or an existing account joins a campaign. Invites expire
after seven days and are single-use.

- Email and password sign-in uses Argon2id hashes.
- **Continue with Google** appears only when the server exposes a `GOOGLE_CLIENT_ID`; Google
  sign-in never creates an account outside an invite.
- Sessions are opaque, database-backed tokens in an httpOnly, SameSite=Lax cookie. Signing out, a
  password reset, or a `401` from the API ends the session locally and returns to the login page.
- **Forgot password** emails a one-hour reset link. In development, without `SMTP_URL`, the link is
  printed to the server console instead.
- The campaign picker at `/campaigns` lists the signed-in user's campaigns. A user with exactly one
  campaign lands directly in it after login.
- `dm` accounts can create, edit and delete campaign content, manage members and invites, and use the
  DM preview of the player view. `player` accounts can read everything except `dm`-only entries and
  blocks, and cannot change campaign content. The API enforces this on every write.
- **Members** is at `/campaigns/:campaignSlug/members`. Only a DM can open invite management there;
  players see the roster without email addresses.

## Guest demo mode

The sign-in screen offers **Explore the demo campaign**, and `/demo` enters the same mode directly.
It is a client-side-only sample: one campaign named **Naxxar (demo)**, with static codex entries,
inventory, purses, members and a combat encounter. No API request leaves the browser for `/api/*`,
no combat WebSocket opens, and every write is rejected as read-only. The demo session lives in
`sessionStorage`, so a refresh stays in the demo while closing the tab or signing out leaves it.

The demo is part of the production bundle and does not touch MongoDB or require an account. All of
its data lives in `src/app/core/guest/guest-data.ts`; remove the `demo` route and the
`guestApiInterceptor` registration if a deployment should not expose it.

## Where the lore lives

Entries live in MongoDB, one document per entry, shaped like `ICodexEntry` in
`src/app/core/models/i-codex-entry.ts`, scoped to a campaign. The sample entries used to seed a fresh
database are kept as markdown files under `server/seed-data/codex/<section>/<slug>.md`, one folder per
section - `pnpm run server:seed` reads them and upserts them into the `entries` collection for the
campaign you name. They're backend seed data, not an Angular asset, so they live under `server/` and
are never shipped in the Angular build:

```
server/seed-data/codex/
├── npcs/vaelith-corrun.md
├── players/tessaly-oakhand.md
├── places/ashfall-city.md
├── organizations/silver-ledger.md
└── story/session-14.md
```

Each file carries YAML front matter followed by the body:

```markdown
---
title: Vaelith Corrun
status: Alive
tags: [ally, silver-ledger]
favourite: true
visibility: dm
author: DM
updatedAt: 2026-08-25T09:00:00.000Z
fields:
  race: Half-elf
  role: Broker of debts
  affiliation: organizations:silver-ledger
---

# Who he is

Broker of debts in the **Silver ledger**, and the only man in Ashfall who will lend
against a memory.
```

`visibility: dm` hides the entry from players. `fields` are section-specific; the keys accepted by each
section are declared in `src/app/core/models/i-section-definition.ts`. Values shaped `section:slug`
render as links to the target entry.

### Markdown supported

Headings 1–3, bold, italic, strikethrough, lists, blockquotes, inline code and fenced blocks, pipe
tables, images, external links, plus two additions:

- `[[npcs:vaelith-corrun]]` — an entity link, resolved to the target's title and clickable in the preview.
- `:::dm … :::` — a DM-only block, stripped entirely in player mode.

Raw HTML in the source is escaped, never rendered.

### Saving

Saves go through the campaign-scoped `CodexApiService` to the Express API in `server/`, which persists
to MongoDB - nothing else in the app reaches for storage. The overflow menu on any entry additionally
exports its current state to a markdown file, front matter included, for archiving or diffing outside
the app.

### Combat

The Combat tab, under Inventory in the sidebar, is a turn tracker for one fight at a time. Players are
added from the codex's `players` entries; enemies are typed in with a name, an optional count (copies are
numbered, "Goblin 1", "Goblin 2") and an initiative - a blank initiative rolls a d20 per copy. Enemies
carry no HP or AC; only players do. The turn order sorts by initiative, highest first; among equal
initiatives the higher **nudge** (the small field beside initiative) acts first, so tied monsters can be
ordered. Names, initiative and nudge are editable in place. Each row has a colour - players and enemies
default to two different colours, and the swatch beside the name picks another. Players get a read-only
tracker.

**Start combat** begins round 1 on the highest initiative; **Next turn** walks down the order and starts a
new round after the last combatant, and **Previous** steps back. Each combatant carries conditions - the
fifteen 2024 PHB conditions are suggested, any custom name works - with an optional duration in rounds,
counted down at the end of that combatant's turn. Clicking a condition reopens it for editing, and a
combatant's conditions stay sorted alphabetically. **End combat** clears the enemies and resets the
round; the party stays with its hit points and conditions.

The encounter is saved to the API after every change, so it survives a reload and the sidebar shows the
current round.

The tracker syncs live: while it is open it holds a websocket to
`/api/campaigns/:campaignSlug/combat/live`, and every change saved from any device shows up on every
other open tracker straight away - the DM runs the fight on a laptop and the players follow on their
phones without refreshing. A **Live** / **Offline** marker next to the refresh button shows the
connection; a dropped connection reconnects on its own (backing off up to 15 seconds) and picks up the
current encounter as soon as it is back. Edits still save over HTTP, and each saved encounter carries a
server-side revision, so a stale snapshot never overwrites a newer one whichever channel delivers it
first. When two devices edit at once, the last save wins.

## Layout

```
src/app/
├── core/
│   ├── guards/            auth, guest and campaign-membership guards
│   ├── guest/             static demo campaign data and the session lifecycle
│   ├── interceptors/      guest demo mocking and protected-401 session handling
│   ├── models/            enums, I-prefixed interfaces, section definitions
│   ├── routing/           route reuse that recreates the shell when the slug changes
│   ├── services/          auth, campaign, members/invite and campaign-scoped content APIs,
│   │                       combat live socket, Google sign-in, markdown render / command / export
│   └── utils/             front matter parsing, entry ids, slugs, combat turn rules
├── shared/
│   ├── datatable/         DataTableComponent - read-only tables
│   └── modal/             ModalService over the CDK Dialog, confirm/prompt/create-entry/condition modals
├── store/
│   ├── create-api-action.ts
│   ├── auth/              user, campaigns, active campaign, public config
│   ├── campaign-members/  roster, invites, invite preview and acceptance
│   ├── codex/             entries, index, filters, active section, DM preview, help overlay
│   ├── combat/            encounter, turn order, round, saves after every change, live sync
│   └── editor/            draft body, dirty flag, save status, view mode, autosave
└── features/
    ├── auth/              login, forgot password, reset password
    ├── guest/             demo entry point behind /demo
    ├── invite/            invite preview, registration and join flow
    ├── campaigns/         campaign picker and create form
    ├── members/           roster and DM invite management
    ├── shell/             campaign shell, header, tab bar, sidebar
    ├── section-list/      table and card views with status and tag filters
    ├── entry-detail/      entry header, markdown toolbar, markdown editor
    ├── inventory/         party and per-player items and gold
    ├── combat/            initiative tracker: turn order, rounds, enemies, hit points, conditions
    └── help/              "?" overlay: coloured tutorial dots for the current page

server/
├── src/                   Express app, auth/sessions, MongoDB access, routes (see server/README.md)
├── seed-data/codex/       sample entries as markdown, seeded into MongoDB
├── scripts/               seed, bootstrap (users/campaigns/passwords) and legacy migration
└── test/                  route specs, run against an in-memory fake collection
```

Public routes are `/login`, `/forgot-password`, `/reset-password/:token`, `/invite/:token` and
`/campaigns`. Everything under `/campaigns/:campaignSlug` requires a session and a membership:
`npcs`, `players`, `places`, `organizations`, `story`, `rules`, `inventory`, `combat` and `members`.
`/campaigns/:campaignSlug/:section` lists a section and `/:section/:slug` opens an entry. All are
bookmarkable and restore the correct tab, sidebar selection and campaign.

## Help overlay

The `?` button left of the search bar opens an overlay that drops a numbered, colour-coded dot on each
feature of the current page (blue navigation, green editing, amber filtering, purple actions). Clicking a
dot, or **Start tour**, opens a short tutorial card; Next/Back (or the arrow keys) step through, Escape or
the backdrop closes it.

Topics live in `features/help/help-topics.ts`, grouped per page (section list, entry, inventory, combat)
plus shell topics shown everywhere. Each topic's `id` matches a `data-help="..."` attribute on the element
it points at; topics whose element isn't rendered (e.g. DM-only controls in player view) are skipped. A
spec fails if a topic has no matching `data-help` anchor in any template.

## Conventions

Standalone components throughout; signal `input()` / `output()` / `viewChild()`; `inject()` with `readonly`
members; new control flow (`@if`, `@for`, `@switch`); `takeUntilDestroyed()` or the async pipe for
subscriptions; interfaces prefixed `I`; observables suffixed `$`; explicit return types; 4-space indent in
`.ts`, `.html` and `.scss`.

Formatting is owned by Prettier (`.prettierrc.json`): 120-column lines, 4-space indent (2 for JSON, Markdown
and YAML), single quotes, no trailing commas, Angular parser for templates. `pnpm run lint` checks it,
`pnpm run format` applies it. Seed lore in `server/seed-data` and the generated `src/_theme-colors.scss` are
excluded via `.prettierignore`.

All HTTP goes through NgRx effects — no `HttpClient` in a component. API actions are built with
`createApiAction()` so request/success/failure and status tracking come for free. Material Select, Dialog
and Tree are reached only through the shared wrappers; buttons are limited to `mat-button`,
`mat-flat-button` and `mat-icon-button`; loading uses the `pane-is-loading` class rather than a spinner
component.

Tests follow arrange–act–assert, use `fixture.componentRef.setInput()`, `fixture.detectChanges()` and
Jest fake timers — no `fakeAsync`, no `tick`. Child components are mocked with `overrideComponent`.
Coverage is 95% of lines against an 80% floor enforced in `jest.config.js`.

## Theme

Tokens are declared once as `--cdx-*` custom properties on `:root` in `src/styles.scss`; no component
stylesheet hardcodes a hex value. Primary `#97C459`, primary hover `#639922`, on-primary `#173404`,
secondary `#B4B2A9`, surfaces `#1B1D1A` / `#1F211D` / `#232520` / `#2A2D27`. Material sits underneath via
`mat.theme()` with `mat.$green-palette` and `color-scheme: dark`.

## Not built yet

Revision history and conflict resolution, real-time collaboration, offline queueing, the split
editor/preview at ≥1280px, and the sidebar's 64px collapsed mode below 1024px are specified but not
implemented. Sections 12–14 of the spec list the states and breakpoints still to cover.

# Naxxar campaign

Dungeons & Dragons campaign dashboard: lore split across five sections, each entry stored as a markdown
file and edited in place with a formatting toolbar. Dark theme, green primary, light-gray secondary.

Built to the specification in `naxxar-campaign-dashboard-spec.pdf`.

## Stack

| Package | Version |
| --- | --- |
| Angular | 19.2.25 |
| Angular Material / CDK | 19.2.19 |
| NgRx store / effects | 19.2.1 |
| TypeScript | 5.7 |
| Jest + jest-preset-angular | 29 / 14.5 |
| Express + MongoDB driver (`server/`) | 4.21 / 6.10 |

## Running it

The app is a static Angular front end talking to a small Node/Express API in `server/`, backed by
MongoDB. Both live in this repo as a pnpm workspace.

```bash
pn install                         # installs both the app and server/
cp server/.env.example server/.env # then fill in MONGODB_URI
pn run server:seed                 # loads the sample codex entries into Mongo
pn run dev                         # runs the API (:3000) and `ng serve` (:57571) together
```

`ng serve` proxies `/api/*` to `http://localhost:3000` (see `proxy.conf.json`), so the app at
`http://localhost:57571` talks to the local API transparently. To run them separately instead of
`pn run dev`: `pn run server` (or `pn run server:dev` to restart on file changes) in one terminal, `pn start`
in another.

```bash
pn run build       # production Angular bundle in dist/naxxar-campaign/browser
pn test            # Angular specs
pn run test:coverage
pn run server:test # API specs (no live MongoDB needed - routes are tested against an in-memory fake)
```

See `server/README.md` for the API's endpoints, environment variables, and how to point it at a real
MongoDB (local or Atlas) in production, including serving the built Angular app from the same process.

## Where the lore lives

Entries live in MongoDB, one document per entry, shaped like `ICodexEntry` in
`src/app/core/models/i-codex-entry.ts`. The eleven sample entries used to seed a fresh database are kept
as markdown files under `server/seed-data/codex/<section>/<slug>.md`, one folder per section - `pn run
server:seed` reads them and upserts them into the `entries` collection. They're backend seed data, not an
Angular asset, so they live under `server/` and are never shipped in the Angular build:

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

`visibility: dm` hides the entry in player mode. `fields` are section-specific; the keys accepted by each
section are declared in `src/app/core/models/i-section-definition.ts`. Values shaped `section:slug` render
as links to the target entry.

### Markdown supported

Headings 1–3, bold, italic, strikethrough, lists, blockquotes, inline code and fenced blocks, pipe
tables, images, external links, plus two additions:

- `[[npcs:vaelith-corrun]]` — an entity link, resolved to the target's title and clickable in the preview.
- `:::dm … :::` — a DM-only block, stripped entirely in player mode.

Raw HTML in the source is escaped, never rendered.

### Saving

Saves go through `CodexApiService` to the Express API in `server/`, which persists to MongoDB - nothing
else in the app reaches for storage. The overflow menu on any entry additionally exports its current state
to a markdown file, front matter included, for archiving or diffing outside the app.

## Layout

```
src/app/
├── core/
│   ├── models/            enums, I-prefixed interfaces, section definitions
│   ├── services/          codex api, markdown render / command / export
│   └── utils/             front matter parsing, entry ids, slugs
├── shared/
│   ├── datatable/         DataTableComponent - read-only tables
│   └── modal/             ModalService over the CDK Dialog, confirm/prompt/create-entry modals
├── store/
│   ├── create-api-action.ts
│   ├── codex/             entries, index, filters, active section, player mode
│   └── editor/            draft body, dirty flag, save status, view mode, autosave
└── features/
    ├── shell/             campaign shell, header, tab bar, sidebar
    ├── section-list/      table and card views with status and tag filters
    └── entry-detail/      entry header, markdown toolbar, markdown editor

server/
├── src/                   Express app, MongoDB access, routes (see server/README.md)
├── seed-data/codex/       sample entries as markdown, seeded into MongoDB
├── scripts/seed.mjs       loads seed-data/codex/**/*.md into MongoDB
└── test/                  route specs, run against an in-memory fake collection
```

Routes are lazy: `/campaign/:section` for a list, `/campaign/:section/:slug` for an entry. Both are
bookmarkable and restore the correct tab and sidebar selection.

## Conventions

Standalone components throughout; signal `input()` / `output()` / `viewChild()`; `inject()` with `readonly`
members; new control flow (`@if`, `@for`, `@switch`); `takeUntilDestroyed()` or the async pipe for
subscriptions; interfaces prefixed `I`; observables suffixed `$`; explicit return types; 4-space indent in
`.ts`, `.html` and `.scss`.

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

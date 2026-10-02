# Personality Studio

> Branch: `dev/personality-studio`
>
> Local-only contributor tooling. Keep it outside production feature PRs.

## Goal

Inspect, validate and manually prepare personality catalog information before data is merged.

The Studio uses the same Paper / Forest / Carmine visual language as the production site and reads both runtime and active staging pipelines.

## Run

```bash
git switch dev/personality-studio
cd frontend
npm ci
npm run dev:studio
```

Open `http://localhost:5173/dev/personality-studio`.

`dev:studio` starts two local processes:

- Vite on port 5173;
- a write API bound only to `127.0.0.1:5174`.

The API is available to the browser only through the Vite proxy.

## Workbench controls

The Studio is intentionally compact and tool-like rather than a landing page.

It provides:

- light/dark theme toggle;
- PT/EN interface toggle;
- A→Z / Z→A ordering;
- runtime/staging and validation filters;
- explicit All / Men / Women filtering;
- local composition targets for men and women.

Composition targets are planning controls stored in browser `localStorage`. They do not add or delete personalities by themselves; the panel shows the current/planned count and how many entries remain to reach each target.

## Filters

The UI can filter:

- all / men / women;
- runtime / staging;
- clean / warning / error;
- search by name, id, role or category.

## Manual editing

The editor supports:

- PT name, role, category, lifespan and description;
- EN name, role and description;
- local portrait path and source metadata;
- staging-only license and attribution fields;
- optional book title/year.

The 12-axis vector remains read-only. Profile values still come from the separate 240-question human-review audit process.

### Portrait preview and download

A staged portrait may define a Wikimedia Commons `sourceFile` before the local JPEG exists.

In that case the Studio:

1. uses the Commons file as a remote preview for visual review;
2. keeps `portraitStatus` pending until a local asset exists;
3. exposes **Download portrait** in the editor.

The local API only materializes portraits from `https://commons.wikimedia.org` and only writes under `frontend/public/personalities/portraits/`. The result is normalized to JPEG.

### Save local draft

`Salvar rascunho` writes to:

`.personality-studio/drafts.json`

That folder is ignored by Git. It is useful for experimenting without changing repository data.

### Apply to repository files

`Aplicar no runtime` updates:

- `backend/src/main/resources/data/personalities.json`;
- `backend/src/main/resources/data/i18n/en/personalities.json`;
- `backend/src/main/resources/data/books.json`.

`Aplicar no staging` updates:

- `scripts/data/female-expansion.json` for candidate name/category;
- `scripts/data/female-metadata-drafts.json` for PT/EN metadata, portrait information and book.

Applying information does **not** automatically change pipeline review/ready states and does not modify political vectors.

After every save/apply/discard, the Studio regenerates its local snapshot automatically.

## Data sources

### Runtime

- `personalities.json`
- English personality catalog
- `personality-profiles.json`
- `books.json`
- local portrait assets
- permanent and pending audit files

### Staging

When present, the Studio also reads:

- `scripts/data/female-expansion.json`
- `scripts/data/female-metadata-drafts.json`
- `scripts/data/female-profile-evidence.json`
- staged local portrait assets
- permanent and pending audit files

Runtime and staging are displayed as separate sources and can be filtered independently.

## Validation semantics

Runtime integrity failures are errors: missing metadata/translation/portrait/profile, invalid axis values or broken assets.

Staging is workflow-aware. An unfinished `pending` or `researching` field is a warning, not an error. If a field claims `review` or `ready`, the Studio verifies that the corresponding draft, evidence, image, attribution or book actually exists.

A staged profile marked `ready` must also have permanent 240-question audit answers.

## Branch workflow

- production work: `feat/women-leaders`
- contributor tooling: `dev/personality-studio`

To validate the current feature, update the Studio branch on the feature HEAD. Fix discovered data problems on the feature branch, then sync the Studio again.

The final production PR remains `feat/women-leaders -> main`; Studio UI/code does not enter that merge.

# Personality Studio

> Branch: `dev/personality-studio`
>
> Local-only contributor tooling. Keep it outside production feature PRs.

## Goal

Inspect and validate both the live personality catalog and active staging pipelines before data is merged.

The Studio is read-only: it never writes runtime or staging JSON.

## Run

```bash
git switch dev/personality-studio
cd frontend
npm ci
npm run dev:studio
```

Open `http://localhost:5173/dev/personality-studio`.

`predev:studio` generates `frontend/public/__dev/personality-studio/catalog.json`; the directory is ignored by Git.

Use `npm run studio:refresh` after changing repository data while Vite is already running.

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

To validate the current feature, rebase/update the Studio branch on the feature HEAD. Fix discovered data problems on the feature branch, then sync the Studio again.

The final production PR remains `feat/women-leaders -> main`; Studio UI/code does not enter that merge.

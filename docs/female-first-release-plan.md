# First women release — closeout plan

> Production branch: `feat/women-leaders`
>
> Developer tooling branch: `dev/personality-studio`
>
> The Studio must not be merged into this release.

## Release scope

This release ships the women-representation product work already integrated in runtime, plus the editorial pipeline that supports the next batches.

Current verified baseline:

- `main` is an ancestor of `feat/women-leaders`;
- the feature is ahead of `main` and not behind it;
- no Personality Studio UI/server files exist in the feature branch;
- 28 women are currently integrated in runtime;
- 172 additional women remain in the editorial pipeline and are not promoted automatically.

The 172 staged candidates may remain staged after this release. A staged candidate only becomes visible in runtime after the existing metadata, portrait, translation and profile gates are reviewed and promoted.

## Photo closeout for the first editorial wave

Nine women are currently reported without a usable local portrait in the Studio:

1. Carmen da Silva
2. Fatema Mernissi
3. Fatima Sheikh
4. Gisela Bock
5. Hatoon al-Fassi
6. Iris Murdoch
7. Philippa Foot
8. Rosa Mayreder
9. Sheila Rowbotham

### Source status

- **Fatema Mernissi** — reusable Commons source is already registered (CC BY-SA 4.0). Remaining work: materialize/normalize the JPEG and commit it.
- **Rosa Mayreder** — preferred replacement source is the Wien Museum circa-1895 photograph released as CC0. Crop is allowed; attribution to Wien Museum should still be retained.
- **Philippa Foot** — a 1939 Somerville College group photograph is available on Commons as public domain and explicitly depicts Foot. Use only after a visual crop identifies her unambiguously.
- **Fatima Sheikh** — the known historical group photograph is marked free of known restrictions/Public Domain Mark on Commons, but the authorship/copyright history and identification have caveats. Maintainer approval is required before using a crop.
- **Carmen da Silva** — the FURG-backed Carmen da Silva archive has multiple personal photographs, but no reusable open license has been confirmed. Do not copy an archive/press photo until reuse permission is explicit.
- **Gisela Bock** — photographs exist in biographical/academic sources, but an open reusable license has not yet been confirmed.
- **Hatoon al-Fassi** — the University of Manchester profile has a headshot, but its page does not establish an open image license. Do not ingest it without permission/license.
- **Iris Murdoch** — Commons currently provides plaques rather than a freely reusable portrait. Do not substitute a plaque for a portrait.
- **Sheila Rowbotham** — Commons currently exposes book/ephemera images rather than a clean licensed portrait. Continue searching institutional/Flickr/open archives.

### Portrait acceptance policy

Preferred order:

1. CC0 / public domain portrait;
2. CC BY / CC BY-SA portrait;
3. crop from a clearly identified group photograph under the same reusable license;
4. institutional archive image only when explicit reuse permission/license is documented.

Reject:

- fair-use/non-free images;
- press photographs without a reuse license;
- book covers as personality portraits;
- plaques/buildings used as substitutes for a face;
- historically ambiguous identification without maintainer approval.

Every accepted portrait must end as a local JPEG under:

`frontend/public/personalities/portraits/<id>.jpg`

and keep source URL, license and attribution in `scripts/data/female-metadata-drafts.json`.

## Local Studio assets must be exported before merge

The Studio downloads/normalizes portraits into the local working tree. Those files are not automatically pushed to GitHub.

Before release, on the machine where the Studio was used:

```bash
git status --short frontend/public/personalities/portraits
```

Any new reviewed portrait intended to be preserved must be committed to `feat/women-leaders` (or copied/cherry-picked there) without bringing `src/dev`, `run-personality-studio.mjs`, Studio CSS, or other developer-tool files.

## Profile/audit scope

Photo completion does not imply political-profile completion.

Candidates still in `pending`, `researching`, `review` or `proposed` remain staging-only. They are not promoted to runtime merely to close this release.

If a staged woman is intentionally added to runtime before merge, she must also complete:

1. factual evidence review;
2. PT/EN metadata review;
3. local portrait + source/license review;
4. 240-question + archetype audit;
5. `profile-audit/validate.py personality <id>`;
6. maintainer review of the resulting vector;
7. promotion of required pipeline gates to `ready`.

## Branch hygiene before PR

Keep:

- permanent audit history in `profile-audit/answers/personality/`;
- portrait validator and the production build hook;
- product/runtime changes for representation filters and matching;
- women pipeline JSON and roadmap documents.

Remove:

- duplicated temporary audit outputs under `profile-audit/subagent-out/personality/` when the corresponding permanent answer already exists;
- any Personality Studio implementation files from the production feature;
- unreviewed local/editor artifacts.

## Release validation

Run from a clean checkout of `feat/women-leaders`:

```bash
node scripts/validate-female-expansion.mjs

cd backend
mvn test

cd ../frontend
npm ci
npm test
npm run build
```

The frontend build includes `validate:portraits`.

Also verify:

- mixed matching behavior is unchanged except for the intended representation feature;
- male/female filters work;
- all runtime female `imagePath` values are local;
- no staged candidate is accidentally duplicated in runtime;
- no Studio route or dev API is present in the production diff.

## Merge procedure

1. Finish/commit accepted portrait assets.
2. Run the release validation above.
3. Review the PR diff against `main`.
4. Merge `feat/women-leaders -> main`.
5. Do **not** merge `dev/personality-studio`.
6. After the production merge, update the Studio from the new `main` while keeping Studio-only commits on its own branch.
7. Continue the next editorial batch from the Studio against the updated production baseline.

## Release decision

The feature can merge with staged candidates still unfinished because the pipeline is not runtime. What blocks the merge is a broken runtime, failing tests/validators, missing runtime portrait assets, or accidental Studio contamination.

If the maintainership decision is instead to make any of the nine women visible in this release, those specific women must finish the full profile/audit/runtime promotion workflow above before merge.

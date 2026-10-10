# Book schema: making Amazon one provider among several

Proposal for phase 6 of the female book availability audit. Nothing here is
implemented yet — the audit runs entirely in staging, and this document records
the target shape so the migration can be reviewed on its own merits.

## What the runtime does today

`books.json` entries carry a per-language affiliate link:

```json
{
  "personalityId": "rosa-luxemburg",
  "title": { "pt": "Reforma ou Revolução", "en": "Reform or Revolution" },
  "year": 1899,
  "url": { "pt": "", "en": "" }
}
```

`url.pt` and `url.en` are empty for every one of the 227 entries. When the link
is blank, `BookRecommendationService.affiliateUrl` falls back to an Amazon
**search** URL built from the title and author:

```
https://www.amazon.com.br/s?k=<title>+<author>&i=stripbooks&tag=12axes-20
```

Two consequences follow, and both are what this audit set out to measure:

1. **Amazon is structurally the only provider.** There is no field in which a
   publisher page, Google Books or Open Library reference could be recorded, so
   a work that is not sold on Amazon has no presentable link at all.
2. **Every live link is an unverified guess.** The fallback query is never
   checked against Amazon, so a reader can be sent to a search page that
   surfaces a study guide, a boxed set, a foreign-language edition or nothing
   at all. The audit probes exactly this query, which is why its results also
   read as a quality report on the links currently in production.

## Target shape

```json
{
  "personalityId": "angela-davis",
  "title": {
    "pt": "Mulheres, Raça e Classe",
    "en": "Women, Race & Class"
  },
  "author": "Angela Davis",
  "year": 1981,
  "associationType": "author",
  "identifiers": {
    "isbn10": null,
    "isbn13": null
  },
  "availability": {
    "amazonBr": {
      "url": null,
      "price": null,
      "currency": null,
      "merchant": null,
      "checkedAt": null
    },
    "amazonUs": null,
    "publisher": null,
    "googleBooks": null,
    "openLibrary": null
  }
}
```

`availability` replaces `url`. Each provider holds a verified entry or `null`.
`identifiers` holds the ISBNs the audit collected, which is what makes a link
re-verifiable later.

A provider entry is an object rather than a bare URL because the audit showed a
URL alone is not enough to judge a recommendation. Ten of the matched listings
were priced between R$ 667 and R$ 1.397 — importers reselling out-of-print
foreign editions. They are purchasable, so a boolean "available" calls them
available, which is useless editorially. `price` and `merchant` let the
catalogue tell a R$ 89 Brazilian edition from a R$ 1.235 import.

`checkedAt` exists because availability decays. A URL verified once and never
re-checked becomes the same unverified guess the current `url` field would have
been.

## Migration

The migration is mechanical and lossless, because the field it replaces is
empty everywhere:

| From | To |
| --- | --- |
| `url.pt` | `availability.amazonBr.url` |
| `url.en` | `availability.amazonUs.url` |

`Book` is annotated `@JsonIgnoreProperties(ignoreUnknown = true)`, so adding
`identifiers` and `availability` to the JSON is non-breaking on its own: old
builds ignore the new fields. Removing `url` is the breaking half, so the two
steps should land separately — add and populate `availability` first, switch
the service to read it, then drop `url`.

## Resolution order in the service

`affiliateUrl` becomes a provider lookup that keeps the affiliate revenue where
it exists but no longer depends on it:

1. `availability.amazonBr.url` for `pt`, `availability.amazonUs.url` for `en` —
   a verified product URL, with the affiliate tag appended. The PA-API returns
   `DetailPageURL` already carrying the partner tag, so the audit can store the
   final link rather than rebuilding it.
2. The other Amazon marketplace, when only one of the two carries the work.
3. The Amazon affiliate **search** fallback that exists today, for entries not
   yet audited. This keeps the change additive rather than a regression for the
   195 male entries the audit does not cover.
4. `publisher`, then `googleBooks`, then `openLibrary` — for works with no
   Amazon listing at all. These carry no affiliate tag, so the UI should not
   present them as purchase links; they are bibliographic references.

Step 4 is the point of the change. It is what lets a book stay in the catalogue
on the strength of a publisher or library reference, instead of being dropped or
pointed at an Amazon search that returns nothing.

## What the frontend needs

`BookRecommendation.url` can stay a single resolved string, so
`BooksSection.tsx` needs no change for steps 1–3. Step 4 does need one addition:
a non-Amazon reference should not be labelled as a purchase. The minimal change
is a provider discriminator on the recommendation, e.g.

```ts
/** Which provider resolved `url`; non-Amazon providers are references, not purchase links. */
provider?: 'amazon' | 'publisher' | 'googleBooks' | 'openLibrary';
```

## Scope

This proposal is written from an audit of the 38 female personalities. The
schema change itself is catalogue-wide, and the 195 male entries with books
would keep working unchanged on the step-3 fallback until they are audited
separately. No male record is read or written by any part of this audit.

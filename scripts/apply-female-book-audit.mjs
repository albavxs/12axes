/**
 * Merges the audit research back into the staging inventory.
 *
 * Inputs (all staging, all female-scoped):
 *   scripts/data/female-book-probe-evidence.json  phase 2/3 Amazon probe evidence
 *   scripts/data/female-book-candidates.json      phase 3 proposed works
 *
 * Output:
 *   scripts/data/female-book-availability.json    inventory with resolutions
 *
 * books.json is never written here. Promotion to runtime is a separate,
 * reviewed step (phase 6).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const personalitiesPath = resolve(root, 'backend/src/main/resources/data/personalities.json');
const inventoryPath = resolve(root, 'scripts/data/female-book-availability.json');
const evidencePath = resolve(root, 'scripts/data/female-book-probe-evidence.json');
const candidatesPath = resolve(root, 'scripts/data/female-book-candidates.json');
const providersPath = resolve(root, 'scripts/data/female-book-providers.json');

const personalities = JSON.parse(readFileSync(personalitiesPath, 'utf8'));
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
const evidence = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, 'utf8')) : {};
const candidates = existsSync(candidatesPath)
  ? JSON.parse(readFileSync(candidatesPath, 'utf8')).candidates ?? {}
  : {};
const providers = existsSync(providersPath) ? JSON.parse(readFileSync(providersPath, 'utf8')) : {};

const femaleIds = new Set(
  personalities
    .filter((personality) => personality.representation === 'female')
    .map((personality) => personality.id)
);

/** Scope guard: refuse to merge anything that is not a known female record. */
for (const id of [...Object.keys(evidence), ...Object.keys(candidates), ...Object.keys(providers)]) {
  if (!femaleIds.has(id)) {
    throw new Error(`Male scope blocked: ${id}`);
  }
}

const LANGUAGE_MARKERS = [
  ['pt', /portugu/i],
  ['en', /ingl[eê]s|english/i],
  ['es', /espanhol|spanish|castellano/i],
  ['fr', /franc[eê]s|french/i],
  ['de', /alem[aã]o|german/i],
  ['it', /italian/i]
];

function normalise(value) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Language of the edition Amazon actually returned. Amazon labels it
 * explicitly ("Edição Português") or inside the title ("(Spanish Edition)");
 * failing both, the matched title tells us which of our own title variants it
 * is. Returns null when nothing is decidable.
 */
function editionLanguage(record, titles) {
  // PA-API states the edition's language outright.
  for (const declared of record.languages ?? []) {
    for (const [lang, pattern] of LANGUAGE_MARKERS) {
      if (pattern.test(declared)) return lang;
    }
  }
  for (const [lang, pattern] of LANGUAGE_MARKERS) {
    if (pattern.test(record.matchedTitle ?? '')) return lang;
  }
  if (!titles) return null;
  const pt = normalise(titles.pt);
  const en = normalise(titles.en);
  // Our pt and en fields are identical for untranslated works; that tells us nothing.
  if (!pt || !en || pt === en) return null;

  // Compare by token overlap, not substring: Amazon reorders titles
  // ("Long Loneliness The by Day Dorothy"), which defeats a substring test.
  const matched = new Set(normalise(record.matchedTitle).split(' ').filter(Boolean));
  const overlap = (title) => {
    const want = title.split(' ').filter((token) => token.length > 2);
    if (!want.length) return 0;
    return want.filter((token) => matched.has(token)).length / want.length;
  };
  const ptScore = overlap(pt);
  const enScore = overlap(en);
  if (ptScore === enScore) return null;
  return ptScore > enScore ? 'pt' : 'en';
}

/** Price ceilings above which an offer is an importer's, not a real edition. */
const ACCESSIBLE_CEILING = { br: 250, us: 60 };

function priceTier(marketplace, offer) {
  if (!offer) return null;
  return offer.amount <= ACCESSIBLE_CEILING[marketplace] ? 'accessible' : 'import-priced';
}

function marketplaceRecord(probe, marketplace) {
  if (!probe) return null;
  const best = probe.best ?? {};
  const offer = best.offer ?? null;
  return {
    status: best.status ?? 'pending',
    confidence: best.confidence ?? null,
    via: best.via ?? null,
    url: best.url ?? null,
    asin: best.asin ?? null,
    isbn: best.isbn ?? null,
    matchedTitle: best.matchedTitle ?? null,
    matchedAuthor: best.matchedAuthor ?? null,
    languages: best.languages ?? [],
    binding: best.binding ?? null,
    // Price of the offer actually charged; null when there is no offer.
    price: offer?.displayAmount ?? null,
    priceAmount: offer?.amount ?? null,
    currency: offer?.currency ?? null,
    merchant: offer?.merchant ?? null,
    availability: offer?.availability ?? null,
    priceTier: priceTier(marketplace, offer),
    usedOffer: best.usedOffer ?? null,
    query: best.query ?? null,
    note: null
  };
}

/**
 * Record-level resolution, in the audit's own vocabulary. Availability on
 * Amazon BR wins; a US-only hit is split by the edition's language so a
 * Spanish-only edition is not reported as an English one.
 */
function resolve_(entry) {
  const br = entry.amazon.br;
  const us = entry.amazon.us;
  const titles = entry.book?.title ?? entry.candidate?.title ?? null;

  if (!entry.hasBook && !entry.candidate) return 'no-book-yet';
  if (entry.candidate?.decision === 'no-book') return 'no-book';

  // A hit only counts as the local edition when it is actually in that language.
  if (br.status === 'available') {
    const lang = editionLanguage(br, titles);
    return lang === null || lang === 'pt' ? 'available-br' : 'available-other-language';
  }
  if (us.status === 'available') {
    const lang = editionLanguage(us, titles);
    return lang === null || lang === 'en' ? 'available-en' : 'available-other-language';
  }
  if (br.status === 'used-only' || us.status === 'used-only') return 'used-only';
  // The edition exists in the catalogue but carries no offer in either store.
  if (br.status === 'no-offer' || us.status === 'no-offer') return 'no-offer';
  if (br.status === 'needs-review' || us.status === 'needs-review') return 'needs-review';
  if (br.status === 'error' || us.status === 'error') return 'needs-review';
  if (br.status === 'pending' || us.status === 'pending') return 'pending';
  return 'not-found';
}

const checkedAt = new Date().toISOString();

for (const entry of inventory.personalities) {
  const probe = evidence[entry.personalityId];
  const candidate = candidates[entry.personalityId];

  if (candidate) {
    entry.candidate = candidate;
  }
  const provider = providers[entry.personalityId];
  if (provider?.openLibrary) {
    entry.alternativeProviders = { openLibrary: provider.openLibrary };
  }
  if (probe) {
    const titles = entry.book?.title ?? candidate?.title ?? null;
    for (const marketplace of ['br', 'us']) {
      const record = marketplaceRecord(probe[marketplace], marketplace);
      if (!record) continue;
      record.editionLanguage = editionLanguage(record, titles);
      entry.amazon[marketplace] = record;
    }
    entry.source = probe.source ?? 'paapi';
    entry.checkedAt = checkedAt;
  }
  entry.resolution = resolve_(entry);
}

inventory.generatedAt = checkedAt;
writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');

const byResolution = {};
for (const entry of inventory.personalities) {
  byResolution[entry.resolution] = (byResolution[entry.resolution] ?? 0) + 1;
}
console.log(JSON.stringify({ women: inventory.personalities.length, byResolution }, null, 2));

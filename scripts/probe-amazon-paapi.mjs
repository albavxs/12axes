/**
 * Phases 2 and 3 of the female book audit: availability via the Amazon
 * Product Advertising API.
 *
 * Replaces an earlier HTML-scraping probe that produced four distinct
 * classification defects (variant parents counted as offers, R$ 0,00 read as a
 * price, a buy-button check that matched every page, and import resellers left
 * unflagged) plus eight outright wrong matches. PA-API returns the price that
 * is actually charged and gives title, author and ISBN as separate fields, so
 * none of those failure modes exist here.
 *
 * Scope: female personalities only, enforced before any write.
 * Writes scripts/data/female-book-probe-evidence.json. Never writes books.json.
 *
 *   node scripts/probe-amazon-paapi.mjs --check-credentials
 *   node scripts/probe-amazon-paapi.mjs [personalityId ...]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MARKETPLACES, PaapiError, credentials, getItems, searchItems } from './lib/paapi.mjs';

const root = resolve(import.meta.dirname, '..');
const personalitiesPath = resolve(root, 'backend/src/main/resources/data/personalities.json');
const inventoryPath = resolve(root, 'scripts/data/female-book-availability.json');
const candidatesPath = resolve(root, 'scripts/data/female-book-candidates.json');
const evidencePath = resolve(root, 'scripts/data/female-book-probe-evidence.json');

const MARKETS = ['br', 'us'];

// ---------- matching ----------

function normalise(value) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOP = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no',
  'um', 'uma', 'the', 'of', 'and', 'in', 'on', 'for', 'to', 'la', 'el', 'los',
  'las', 'y', 'del', 'al', 'ou', 'or', 'por'
]);

const tokens = (value) =>
  normalise(value).split(' ').filter((token) => token.length > 2 && !STOP.has(token));

/** One insertion, deletion or substitution apart. */
function withinOneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  const [short, long] = a.length > b.length ? [b, a] : [a, b];
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (short.length === long.length) i += 1;
    j += 1;
  }
  return true;
}

/**
 * Name tokens tolerate translation and transliteration: Luxemburg/Luxemburgo
 * by prefix, Kollontai/Kolontai by a single edit.
 */
function nameTokenPresent(token, haystack) {
  for (const other of haystack) {
    if (token === other) return true;
    if (token.length >= 4 && other.length >= 4 &&
        (token.startsWith(other) || other.startsWith(token))) return true;
    if (token.length >= 6 && other.length >= 6 && withinOneEdit(token, other)) return true;
  }
  return false;
}

/** Contributors credited as authors, falling back to every contributor. */
function itemAuthors(item) {
  const contributors = item?.ItemInfo?.ByLineInfo?.Contributors ?? [];
  const authors = contributors.filter((c) => /author|autor/i.test(c.Role ?? ''));
  const names = (authors.length ? authors : contributors).map((c) => c.Name).filter(Boolean);
  const brand = item?.ItemInfo?.ByLineInfo?.Brand?.DisplayValue;
  if (!names.length && brand) names.push(brand);
  return names;
}

function authorMatches(expectedAuthor, item) {
  if (!expectedAuthor) return false;
  const haystack = new Set(normalise(itemAuthors(item).join(' ')).split(' ').filter(Boolean));
  for (const person of expectedAuthor.split(/,| e | and |&/)) {
    const parts = normalise(person).split(' ').filter((token) => token.length > 2);
    if (parts.length && parts.every((part) => nameTokenPresent(part, haystack))) return true;
  }
  return false;
}

/** Fraction of the expected title's significant tokens present in the item. */
function titleRecall(expected, found) {
  const want = tokens(expected);
  if (!want.length) return 0;
  const got = new Set(tokens(found));
  return want.filter((token) => got.has(token)).length / want.length;
}

const BUNDLE = /^\s*(kit|box|combo|cole[cç][aã]o|collection|pacote)\b/i;
const COMPANION =
  /\b(study guide|summary|summaries|analysis|sparknotes|cliffsnotes|workbook|journal|notebook|colou?ring|for kids|guide to|a macat|resumo|resenha|guia de estudo)\b/i;

/**
 * Best item for the expected work, with a confidence label. Only high and
 * medium may be reported as availability; low becomes needs-review, because
 * a title-adjacent guess is what produced the earlier false positives.
 */
function matchItem(items, expectedTitles, expectedAuthor) {
  const titles = expectedTitles.filter(Boolean);
  if (!titles.length) return { item: null, confidence: 'low' };
  const expectedLength = Math.max(...titles.map((title) => tokens(title).length));
  const normalisedExpected = new Set(titles.map(normalise));

  let best = null;
  let bestScore = 0;
  let bestConfidence = 'low';

  for (const item of items) {
    const found = item?.ItemInfo?.Title?.DisplayValue ?? '';
    if (COMPANION.test(found)) continue;

    const recall = Math.max(...titles.map((title) => titleRecall(title, found)));
    if (recall < 0.8) continue;

    const foundTokens = tokens(found);
    const precision = foundTokens.length
      ? expectedLength / Math.max(foundTokens.length, expectedLength)
      : 0;
    const foundNorm = normalise(found);
    const exact = normalisedExpected.has(foundNorm);
    const subtitled = [...normalisedExpected].some((title) => title && foundNorm.startsWith(`${title} `));
    const authorHit = authorMatches(expectedAuthor, item);

    let confidence;
    if (authorHit && (exact || subtitled || (recall >= 0.999 && precision >= 0.7))) {
      confidence = 'high';
    } else if (exact && expectedLength >= 4) {
      confidence = 'high';
    } else if (authorHit && recall >= 0.999) {
      confidence = 'medium';
    } else if (subtitled) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    const score =
      recall +
      0.6 * precision +
      (authorHit ? 1 : 0) +
      (exact ? 0.4 : subtitled ? 0.3 : 0) +
      (offerOf(item) ? 0.2 : 0) -
      (BUNDLE.test(found) ? 0.8 : 0);

    const rank = { high: 2, medium: 1, low: 0 };
    if (rank[confidence] > rank[bestConfidence] ||
        (rank[confidence] === rank[bestConfidence] && score > bestScore)) {
      best = item;
      bestScore = score;
      bestConfidence = confidence;
    }
  }
  return { item: best, confidence: bestConfidence };
}

// ---------- offers ----------

/** The featured offer, or null. PA-API only reports a price someone pays. */
function offerOf(item) {
  const listing = item?.Offers?.Listings?.[0];
  const amount = listing?.Price?.Amount;
  if (typeof amount !== 'number' || amount <= 0) return null;
  return {
    amount,
    currency: listing.Price.Currency ?? null,
    displayAmount: listing.Price.DisplayAmount ?? null,
    availability: listing.Availability?.Message ?? null,
    availabilityType: listing.Availability?.Type ?? null,
    merchant: listing.MerchantInfo?.Name ?? null,
    condition: 'New'
  };
}

/** Cheapest used offer, used to tell "used only" from "no offer at all". */
function usedSummary(item) {
  const summaries = item?.Offers?.Summaries ?? [];
  const used = summaries.find((s) => /used/i.test(s.Condition?.Value ?? ''));
  const amount = used?.LowestPrice?.Amount;
  if (typeof amount !== 'number' || amount <= 0) return null;
  return {
    amount,
    currency: used.LowestPrice.Currency ?? null,
    displayAmount: used.LowestPrice.DisplayAmount ?? null,
    condition: 'Used'
  };
}

function statusOf(item, confidence) {
  if (!item) return 'not-found';
  if (confidence === 'low') return 'needs-review';
  if (offerOf(item)) return 'available';
  if (usedSummary(item)) return 'used-only';
  return 'no-offer';
}

function isbnOf(item) {
  const ids = item?.ItemInfo?.ExternalIds ?? {};
  const isbns = ids.ISBNs?.DisplayValues ?? [];
  const eans = ids.EANs?.DisplayValues ?? [];
  return { isbn: isbns[0] ?? null, allIsbns: isbns, ean: eans[0] ?? null };
}

function recordFor(item, confidence, attempt) {
  const offer = item ? offerOf(item) : null;
  const used = item ? usedSummary(item) : null;
  const { isbn, allIsbns, ean } = item ? isbnOf(item) : { isbn: null, allIsbns: [], ean: null };
  return {
    status: statusOf(item, confidence),
    confidence,
    via: attempt,
    asin: item?.ASIN ?? null,
    url: item?.DetailPageURL ?? null,
    matchedTitle: item?.ItemInfo?.Title?.DisplayValue ?? null,
    matchedAuthor: item ? itemAuthors(item).join(', ') || null : null,
    isbn,
    allIsbns,
    ean,
    binding: item?.ItemInfo?.Classifications?.Binding?.DisplayValue ?? null,
    languages: item?.ItemInfo?.ContentInfo?.Languages?.DisplayValues?.map((l) => l.DisplayValue) ?? [],
    publicationDate: item?.ItemInfo?.ContentInfo?.PublicationDate?.DisplayValue ?? null,
    offer,
    usedOffer: used
  };
}

// ---------- probing ----------

async function probe(marketplace, { titles, author, isbn }) {
  const expected = [titles.pt, titles.en].filter(Boolean);
  const attempts = [];

  // An ISBN-10 is usually the book's ASIN, so try the exact lookup first.
  const isbn10 = (isbn ?? '').replace(/[^0-9X]/gi, '');
  if (isbn10.length === 10) {
    try {
      const response = await getItems(marketplace, [isbn10]);
      const items = response?.ItemsResult?.Items ?? [];
      if (items.length) {
        const { item, confidence } = matchItem(items, expected, author);
        // A direct ISBN hit is the right edition even if the title is restyled.
        const chosen = item ?? items[0];
        const record = recordFor(chosen, item ? confidence : 'high', 'GetItems:isbn');
        attempts.push(record);
        if (record.status === 'available') return { attempts, best: record };
      }
    } catch (error) {
      if (error.isAuthFailure) throw error;
      attempts.push({ status: 'error', via: 'GetItems:isbn', error: error.message });
    }
  }

  // Structured search: Title and Author as separate fields, not keyword soup.
  const primary = marketplace === 'br' ? (titles.pt ?? titles.en) : (titles.en ?? titles.pt);
  const queries = [{ title: primary, author }, { title: primary }];
  const secondary = marketplace === 'br' ? titles.en : titles.pt;
  if (secondary && normalise(secondary) !== normalise(primary)) {
    queries.push({ title: secondary, author });
  }

  for (const query of queries) {
    try {
      const response = await searchItems(marketplace, query);
      const items = response?.SearchResult?.Items ?? [];
      const { item, confidence } = matchItem(items, expected, author);
      const record = recordFor(item, item ? confidence : 'low', `SearchItems:${query.author ? 'title+author' : 'title'}`);
      record.query = query;
      record.resultCount = items.length;
      attempts.push(record);
      if (record.status === 'available' && confidence === 'high') return { attempts, best: record };
    } catch (error) {
      if (error.isAuthFailure) throw error;
      // "No results" is an ordinary outcome for a book absent from a locale.
      if (error.code === 'NoResults') {
        attempts.push({ status: 'not-found', via: 'SearchItems', confidence: 'high', query });
        continue;
      }
      attempts.push({ status: 'error', via: 'SearchItems', error: error.message, query });
    }
  }

  const rank = { available: 5, 'used-only': 4, 'needs-review': 3, 'no-offer': 2, 'not-found': 1, error: 0 };
  const confidenceRank = { high: 2, medium: 1, low: 0 };
  const scored = attempts.filter((a) => a.status);
  const best = scored.length
    ? scored.reduce((winner, candidate) => {
        const a = [rank[candidate.status] ?? 0, confidenceRank[candidate.confidence] ?? 0];
        const b = [rank[winner.status] ?? 0, confidenceRank[winner.confidence] ?? 0];
        return a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]) ? candidate : winner;
      })
    : { status: 'error', confidence: 'low' };
  return { attempts, best };
}

// ---------- entry point ----------

async function checkCredentials() {
  let ok = true;
  for (const marketplace of MARKETS) {
    try {
      credentials(marketplace);
    } catch (error) {
      console.error(`[${marketplace}] ${error.message}`);
      ok = false;
      continue;
    }
    try {
      // "O Segundo Sexo" PT edition / "The Second Sex" - any real ASIN works.
      await getItems(marketplace, [marketplace === 'br' ? '852092283X' : '0307277788'],
        ['ItemInfo.Title']);
      console.log(`[${marketplace}] credenciais OK`);
    } catch (error) {
      ok = false;
      const why = error.isAuthFailure ? 'credenciais recusadas' : error.message;
      console.error(`[${marketplace}] FALHOU: ${why}` +
        (error.code ? ` (${error.code})` : ''));
    }
  }
  return ok;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check-credentials')) {
    const ok = await checkCredentials();
    if (!ok) {
      console.error('\nSem acesso à PA-API. A auditoria para aqui: não há fallback para raspagem.');
      process.exit(1);
    }
    return;
  }

  const personalities = JSON.parse(readFileSync(personalitiesPath, 'utf8'));
  const femaleIds = new Set(
    personalities
      .filter((personality) => personality.representation === 'female')
      .map((personality) => personality.id)
  );
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const candidates = existsSync(candidatesPath)
    ? JSON.parse(readFileSync(candidatesPath, 'utf8')).candidates ?? {}
    : {};

  const only = args.filter((arg) => !arg.startsWith('--'));
  const jobs = [];
  for (const entry of inventory.personalities) {
    const id = entry.personalityId;
    if (!femaleIds.has(id)) throw new Error(`Male scope blocked: ${id}`);
    if (only.length && !only.includes(id)) continue;

    if (entry.hasBook) {
      jobs.push({
        id,
        phase: 'phase2',
        titles: entry.book.title,
        author: entry.book.author || entry.name,
        isbn: null
      });
    } else if (candidates[id]?.decision === 'propose') {
      const candidate = candidates[id];
      jobs.push({
        id,
        phase: 'phase3',
        titles: candidate.title,
        author: candidate.author,
        isbn: candidate.identifiers?.isbn10 ?? candidate.identifiers?.isbn13 ?? null
      });
    }
  }

  // Fail before the sweep rather than halfway through it.
  if (!(await checkCredentials())) {
    console.error('\nSem acesso à PA-API. A auditoria para aqui: não há fallback para raspagem.');
    process.exit(1);
  }

  const evidence = existsSync(evidencePath) && only.length
    ? JSON.parse(readFileSync(evidencePath, 'utf8'))
    : {};

  for (const [index, job] of jobs.entries()) {
    const record = { phase: job.phase, source: 'paapi', checkedAt: new Date().toISOString() };
    for (const marketplace of MARKETS) {
      const result = await probe(marketplace, job);
      record[marketplace] = result;
      const best = result.best;
      const price = best.offer?.displayAmount ?? '';
      console.log(`[${index + 1}/${jobs.length}] ${job.id} ${marketplace}: ` +
        `${best.status} (${best.confidence}) ${price}`);
    }
    evidence[job.id] = record;
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  }

  console.log(`\nEvidência escrita em scripts/data/female-book-probe-evidence.json ` +
    `(${Object.keys(evidence).length} personalidades, fonte: PA-API)`);
}

main().catch((error) => {
  if (error instanceof PaapiError && error.isAuthFailure) {
    console.error(`\nPA-API recusou as credenciais: ${error.message}`);
    console.error('A auditoria para aqui: não há fallback para raspagem.');
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});

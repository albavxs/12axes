/**
 * Phase 1 of the female book/Amazon availability audit.
 *
 * Builds (and idempotently refreshes) the staging inventory at
 * scripts/data/female-book-availability.json from the runtime data files.
 *
 * Scope rule: this script reads and writes female personalities only. Any
 * record that is not `representation: "female"` aborts the run. Nothing here
 * ever writes to books.json — the audit stays in staging until the results are
 * reviewed and promoted.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const personalitiesPath = resolve(root, 'backend/src/main/resources/data/personalities.json');
const booksPath = resolve(root, 'backend/src/main/resources/data/books.json');
const inventoryPath = resolve(root, 'scripts/data/female-book-availability.json');

const MARKETPLACES = ['br', 'us'];

const personalities = JSON.parse(readFileSync(personalitiesPath, 'utf8'));
const books = JSON.parse(readFileSync(booksPath, 'utf8'));

const women = personalities.filter((personality) => personality.representation === 'female');

/** Hard stop: the audit must never be able to reach a male record. */
function assertFemaleScope(personality) {
  if (personality.representation !== 'female') {
    throw new Error(`Male scope blocked: ${personality.id}`);
  }
}

const booksByPersonality = new Map();
for (const book of books) {
  if (!booksByPersonality.has(book.personalityId)) {
    booksByPersonality.set(book.personalityId, []);
  }
  booksByPersonality.get(book.personalityId).push(book);
}

const previous = existsSync(inventoryPath)
  ? JSON.parse(readFileSync(inventoryPath, 'utf8'))
  : { personalities: [] };
const previousById = new Map((previous.personalities ?? []).map((entry) => [entry.personalityId, entry]));

function emptyMarketplace() {
  return { status: 'pending', url: null, isbn: null, matchedTitle: null, format: null, note: null };
}

/**
 * Research findings already recorded for this personality survive a refresh;
 * only the data mirrored from personalities.json/books.json is rewritten.
 */
function carryOverAmazon(personalityId) {
  const prior = previousById.get(personalityId)?.amazon ?? {};
  return Object.fromEntries(
    MARKETPLACES.map((marketplace) => [marketplace, { ...emptyMarketplace(), ...(prior[marketplace] ?? {}) }])
  );
}

const entries = women.map((personality) => {
  assertFemaleScope(personality);

  const associated = booksByPersonality.get(personality.id) ?? [];
  if (associated.length > 1) {
    throw new Error(`Multiple books for ${personality.id}; inventory shape assumes at most one`);
  }
  const [book] = associated;
  const prior = previousById.get(personality.id);

  return {
    personalityId: personality.id,
    name: personality.name,
    hasBook: Boolean(book),
    book: book
      ? {
          title: book.title,
          author: book.author ?? null,
          year: book.year ?? null,
          associationType: book.associationType ?? null
        }
      : null,
    // Only populated for women with no book yet (phase 3).
    candidate: prior?.candidate ?? null,
    amazon: carryOverAmazon(personality.id),
    alternativeProviders: prior?.alternativeProviders ?? null,
    resolution: prior?.resolution ?? (book ? 'pending' : 'no-book-yet'),
    checkedAt: prior?.checkedAt ?? null
  };
});

const inventory = {
  generatedAt: new Date().toISOString(),
  scope: 'representation === "female"',
  note: 'Staging only. books.json is not modified by this audit.',
  totals: {
    women: entries.length,
    withBook: entries.filter((entry) => entry.hasBook).length,
    withoutBook: entries.filter((entry) => !entry.hasBook).length
  },
  personalities: entries
};

writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');

console.log(JSON.stringify(inventory.totals, null, 2));
console.log(`\nInventory written to scripts/data/female-book-availability.json`);

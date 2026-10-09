/**
 * Phase 4 of the female book/Amazon availability audit.
 *
 * Splits the audited inventory into the follow-up queues and prints the
 * summary. Read-only with respect to the inventory; writes only the queue
 * file. books.json is never touched.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const inventoryPath = resolve(root, 'scripts/data/female-book-availability.json');
const queuePath = resolve(root, 'scripts/data/female-book-followup-queue.json');

const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
const entries = inventory.personalities;

const AVAILABLE = new Set(['available-br', 'available-en', 'available-other-language']);
/** Resolutions that still need a non-Amazon provider before the book is usable. */
const NEEDS_PROVIDER = new Set(['used-only', 'no-offer', 'not-found', 'needs-review']);

/** The offer backing a resolution, preferring BR as the audit's home store. */
function winningOffer(entry) {
  for (const marketplace of ['br', 'us']) {
    const record = entry.amazon[marketplace];
    if (record.status === 'available') return { marketplace, record };
  }
  return null;
}

function summarise(entry) {
  return {
    personalityId: entry.personalityId,
    name: entry.name,
    resolution: entry.resolution,
    title: entry.book?.title?.pt ?? entry.candidate?.title?.pt ?? null,
    author: entry.book?.author ?? entry.candidate?.author ?? null,
    associationType: entry.book?.associationType ?? entry.candidate?.associationType ?? null,
    proposed: !entry.hasBook && Boolean(entry.candidate),
    priceTier: winningOffer(entry)?.record.priceTier ?? null,
    price: winningOffer(entry)?.record.price ?? null,
    merchant: winningOffer(entry)?.record.merchant ?? null,
    amazon: {
      br: {
        status: entry.amazon.br.status,
        url: entry.amazon.br.url,
        price: entry.amazon.br.price,
        priceTier: entry.amazon.br.priceTier,
        editionLanguage: entry.amazon.br.editionLanguage
      },
      us: {
        status: entry.amazon.us.status,
        url: entry.amazon.us.url,
        price: entry.amazon.us.price,
        priceTier: entry.amazon.us.priceTier,
        editionLanguage: entry.amazon.us.editionLanguage
      }
    },
    alternativeProviders: entry.alternativeProviders
  };
}

const queue = {
  generatedAt: new Date().toISOString(),
  source: 'scripts/data/female-book-availability.json',
  scope: inventory.scope,
  amazonAvailable: entries.filter((entry) => AVAILABLE.has(entry.resolution)).map(summarise),
  amazonUnavailable: entries
    .filter((entry) => NEEDS_PROVIDER.has(entry.resolution))
    .map(summarise),
  needsAlternativeProvider: entries
    .filter((entry) => NEEDS_PROVIDER.has(entry.resolution) && !entry.alternativeProviders)
    .map(summarise),
  noRecommendation: entries
    .filter((entry) => entry.resolution === 'no-book' || entry.resolution === 'no-book-yet')
    .map(summarise),
  // Available, but only through an importer: counted as available by decision,
  // surfaced here because the price makes it a poor recommendation.
  importPriced: entries
    .filter((entry) => winningOffer(entry)?.record.priceTier === 'import-priced')
    .map(summarise)
};

writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');

const count = (resolution) => entries.filter((entry) => entry.resolution === resolution).length;

const lines = [
  `${entries.length} mulheres analisadas`,
  '',
  `${count('available-br')} livro encontrado na Amazon BR`,
  `${count('available-en')} somente Amazon internacional`,
  `${count('available-other-language')} somente edição em outro idioma`,
  `${count('used-only')} disponível apenas usado`,
  `${count('no-offer')} edição sem oferta ativa`,
  `${count('not-found')} sem resultado na Amazon`,
  `${count('needs-review')} precisa de revisão manual`,
  `${count('no-book')} sem recomendação adequada`,
  `${count('no-book-yet')} ainda sem obra pesquisada`,
  `${count('pending')} pendente`
];
const tier = (name) =>
  entries.filter((entry) => winningOffer(entry)?.record.priceTier === name).length;

lines.push(
  '',
  'Por faixa de preço (entre as disponíveis):',
  `${tier('accessible')} com preço acessível`,
  `${tier('import-priced')} só via importador (preço proibitivo)`
);

console.log(lines.join('\n'));
if (queue.importPriced.length) {
  console.log('\nImportado caro:');
  for (const item of queue.importPriced) {
    console.log(`  ${item.personalityId.padEnd(22)} ${String(item.price).padEnd(12)} ${item.merchant ?? ''}`);
  }
}
console.log(`\nFila escrita em scripts/data/female-book-followup-queue.json`);
console.log(
  `amazonAvailable=${queue.amazonAvailable.length} ` +
  `amazonUnavailable=${queue.amazonUnavailable.length} ` +
  `needsAlternativeProvider=${queue.needsAlternativeProvider.length} ` +
  `noRecommendation=${queue.noRecommendation.length}`
);

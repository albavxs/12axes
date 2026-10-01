import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = resolve(root, 'scripts/data/female-expansion.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const requiredStatuses = ['metadataStatus', 'portraitStatus', 'translationStatus', 'profileStatus'];
const candidates = manifest.candidates;
const ids = candidates.map((candidate) => candidate.id);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
const ready = candidates.filter((candidate) =>
  requiredStatuses.every((field) => candidate[field] === 'ready')
);
const blocked = candidates.filter((candidate) => !ready.includes(candidate));
const planned = manifest.target.initialFemaleCount + candidates.length;
const remainingUnplanned = Math.max(0, manifest.target.targetFemaleCount - planned);

const errors = [];
if (duplicateIds.length) errors.push(`IDs duplicados: ${[...new Set(duplicateIds)].join(', ')}`);
if (planned < manifest.target.targetFemaleCount) {
  errors.push(`Planejamento incompleto: ${planned}/${manifest.target.targetFemaleCount}`);
}
for (const candidate of candidates) {
  for (const field of requiredStatuses) {
    if (!manifest.statuses.includes(candidate[field])) {
      errors.push(`${candidate.id}: status inválido em ${field}: ${candidate[field]}`);
    }
  }
}

const summary = {
  target: manifest.target.targetFemaleCount,
  integrated: manifest.target.initialFemaleCount,
  pipeline: candidates.length,
  planned,
  ready: ready.length,
  blocked: blocked.length,
  remainingUnplanned,
  byProfileStatus: Object.fromEntries(
    manifest.statuses.map((status) => [
      status,
      candidates.filter((candidate) => candidate.profileStatus === status).length
    ])
  )
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) {
  console.error('\nManifest validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

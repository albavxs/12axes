import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const manifestPath = resolve(root, 'scripts/data/female-expansion.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const personalitiesPath = resolve(root, 'backend/src/main/resources/data/personalities.json');
const personalities = JSON.parse(readFileSync(personalitiesPath, 'utf8'));

const requiredStatuses = ['metadataStatus', 'portraitStatus', 'translationStatus', 'profileStatus'];
const candidates = manifest.candidates;
const ids = candidates.map((candidate) => candidate.id);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
const runtimeFemaleIds = new Set(
  personalities
    .filter((personality) => personality.representation === 'female')
    .map((personality) => personality.id)
);
const integratedFromPipeline = candidates.filter((candidate) => runtimeFemaleIds.has(candidate.id));
const activeCandidates = candidates.filter((candidate) => !runtimeFemaleIds.has(candidate.id));
const ready = activeCandidates.filter((candidate) =>
  requiredStatuses.every((field) => candidate[field] === 'ready')
);
const blocked = activeCandidates.filter((candidate) => !ready.includes(candidate));
const planned = runtimeFemaleIds.size + activeCandidates.length;
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
for (const candidate of integratedFromPipeline) {
  const missingReady = requiredStatuses.filter((field) => candidate[field] !== 'ready');
  if (missingReady.length) {
    errors.push(
      `${candidate.id}: presente no runtime antes de concluir os gates: ${missingReady.join(', ')}`
    );
  }
}

const expectedProgress = {
  integratedFemaleCount: runtimeFemaleIds.size,
  pipelineCandidateCount: activeCandidates.length,
  plannedFemaleCount: planned,
  targetFemaleCount: manifest.target.targetFemaleCount,
  remainingUnplanned,
  readyCandidateCount: ready.length,
  profileReviewCount: activeCandidates.filter((candidate) => candidate.profileStatus === 'review').length,
  profileResearchingCount: activeCandidates.filter((candidate) => candidate.profileStatus === 'researching').length,
  profilePendingCount: activeCandidates.filter((candidate) => candidate.profileStatus === 'pending').length,
  blockedFromRuntimeCount: blocked.length
};
for (const [field, expected] of Object.entries(expectedProgress)) {
  if (manifest.progress?.[field] !== expected) {
    errors.push(
      `progress.${field} desatualizado: manifest=${manifest.progress?.[field]} runtime/pipeline=${expected}`
    );
  }
}

const summary = {
  target: manifest.target.targetFemaleCount,
  integrated: runtimeFemaleIds.size,
  pipeline: activeCandidates.length,
  manifestCandidates: candidates.length,
  integratedFromPipeline: integratedFromPipeline.length,
  planned,
  ready: ready.length,
  blocked: blocked.length,
  remainingUnplanned,
  byProfileStatus: Object.fromEntries(
    manifest.statuses.map((status) => [
      status,
      activeCandidates.filter((candidate) => candidate.profileStatus === status).length
    ])
  )
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) {
  console.error('\nManifest validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

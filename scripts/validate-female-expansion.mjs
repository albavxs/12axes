import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'scripts/data/female-expansion.json');
const personalitiesPath = resolve(root, 'backend/src/main/resources/data/personalities.json');
const evidencePath = resolve(root, 'scripts/data/female-profile-evidence.json');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const personalities = JSON.parse(readFileSync(personalitiesPath, 'utf8'));
const evidence = existsSync(evidencePath)
  ? JSON.parse(readFileSync(evidencePath, 'utf8'))
  : { personalities: [] };

const requiredStatuses = ['metadataStatus', 'portraitStatus', 'translationStatus', 'profileStatus'];
const candidates = manifest.candidates;
const evidenceById = new Map((evidence.personalities ?? []).map((entry) => [entry.id, entry]));
const runtimeFemaleIds = new Set(
  personalities
    .filter((personality) => personality.representation === 'female')
    .map((personality) => personality.id)
);

const ids = candidates.map((candidate) => candidate.id);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
const ready = candidates.filter((candidate) =>
  requiredStatuses.every((field) => candidate[field] === 'ready')
);
const blocked = candidates.filter((candidate) => !ready.includes(candidate));
const planned = runtimeFemaleIds.size + candidates.length;
const remainingUnplanned = Math.max(0, manifest.target.targetFemaleCount - planned);

const errors = [];

if (duplicateIds.length) {
  errors.push(`IDs duplicados: ${[...new Set(duplicateIds)].join(', ')}`);
}
if (planned < manifest.target.targetFemaleCount) {
  errors.push(`Planejamento incompleto: ${planned}/${manifest.target.targetFemaleCount}`);
}

for (const candidate of candidates) {
  if (runtimeFemaleIds.has(candidate.id)) {
    errors.push(`${candidate.id}: já está no runtime e deve ser removida do pipeline ativo`);
  }

  for (const field of requiredStatuses) {
    if (!manifest.statuses.includes(candidate[field])) {
      errors.push(`${candidate.id}: status inválido em ${field}: ${candidate[field]}`);
    }
  }

  if (['review', 'proposed', 'ready'].includes(candidate.profileStatus)) {
    if (candidate.evidenceFile !== 'scripts/data/female-profile-evidence.json') {
      errors.push(
        `${candidate.id}: profileStatus=${candidate.profileStatus} exige evidenceFile em scripts/data/female-profile-evidence.json`
      );
    }

    const dossier = evidenceById.get(candidate.id);
    if (!dossier) {
      errors.push(`${candidate.id}: profileStatus=${candidate.profileStatus} sem dossiê de evidência`);
    } else {
      if (!Array.isArray(dossier.sources) || dossier.sources.length < 2) {
        errors.push(`${candidate.id}: dossiê precisa de pelo menos 2 fontes`);
      }
      if (!dossier.evidence || Object.keys(dossier.evidence).length < 3) {
        errors.push(`${candidate.id}: dossiê precisa de evidência em pelo menos 3 eixos`);
      }

      const dossierUrls = new Set((dossier.sources ?? []).map((source) => source.url));
      for (const sourceUrl of candidate.sources ?? []) {
        if (!dossierUrls.has(sourceUrl)) {
          errors.push(`${candidate.id}: fonte do manifesto não consta no dossiê: ${sourceUrl}`);
        }
      }
    }
  }
}

for (const entry of manifest.integrated ?? []) {
  if (!runtimeFemaleIds.has(entry.id)) {
    errors.push(`${entry.id}: registrado como integrado, mas ausente do runtime`);
  }
}

const expectedProgress = {
  integratedFemaleCount: runtimeFemaleIds.size,
  pipelineCandidateCount: candidates.length,
  plannedFemaleCount: planned,
  targetFemaleCount: manifest.target.targetFemaleCount,
  remainingUnplanned,
  readyCandidateCount: ready.length,
  profileReviewCount: candidates.filter((candidate) => candidate.profileStatus === 'review').length,
  profileResearchingCount: candidates.filter((candidate) => candidate.profileStatus === 'researching').length,
  profilePendingCount: candidates.filter((candidate) => candidate.profileStatus === 'pending').length,
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
  pipeline: candidates.length,
  planned,
  ready: ready.length,
  blocked: blocked.length,
  remainingUnplanned,
  dossiers: evidence.personalities?.length ?? 0,
  integratedRecorded: manifest.integrated?.length ?? 0,
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

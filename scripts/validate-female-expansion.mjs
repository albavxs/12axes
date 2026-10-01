import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'scripts/data/female-expansion.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const requiredStatuses = ['metadataStatus', 'portraitStatus', 'translationStatus', 'profileStatus'];
const candidates = manifest.candidates;
const evidencePath = resolve(root, 'scripts/data/female-profile-evidence.json');
const evidence = existsSync(evidencePath)
  ? JSON.parse(readFileSync(evidencePath, 'utf8'))
  : { personalities: [] };
const evidenceById = new Map((evidence.personalities ?? []).map((entry) => [entry.id, entry]));
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

  if (['review', 'proposed', 'ready'].includes(candidate.profileStatus)) {
    if (candidate.evidenceFile !== 'scripts/data/female-profile-evidence.json') {
      errors.push(`${candidate.id}: profileStatus=${candidate.profileStatus} exige evidenceFile em scripts/data/female-profile-evidence.json`);
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
      if (candidate.sources && candidate.sources.length) {
        const dossierUrls = new Set(dossier.sources.map((source) => source.url));
        for (const sourceUrl of candidate.sources) {
          if (!dossierUrls.has(sourceUrl)) {
            errors.push(`${candidate.id}: fonte do manifesto não consta no dossiê: ${sourceUrl}`);
          }
        }
      }
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
  dossiers: evidence.personalities?.length ?? 0,
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

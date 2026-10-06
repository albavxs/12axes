import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'scripts/data/female-expansion.json');
const personalitiesPath = resolve(root, 'backend/src/main/resources/data/personalities.json');
const evidencePath = resolve(root, 'scripts/data/female-profile-evidence.json');
const metadataPath = resolve(root, 'scripts/data/female-metadata-drafts.json');
const auditAnswersRoot = resolve(root, 'profile-audit/answers/personality');
const AXES = [
  'estrutura', 'representacao', 'poder', 'imigracao', 'diplomacia', 'intervencao',
  'economia', 'controle', 'comercio', 'religiao', 'moral', 'tecnologia'
];

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const personalities = JSON.parse(readFileSync(personalitiesPath, 'utf8'));
const evidence = existsSync(evidencePath)
  ? JSON.parse(readFileSync(evidencePath, 'utf8'))
  : { personalities: [] };
const metadata = existsSync(metadataPath)
  ? JSON.parse(readFileSync(metadataPath, 'utf8'))
  : { personalities: [] };

const requiredStatuses = ['metadataStatus', 'portraitStatus', 'translationStatus', 'profileStatus'];
const candidates = manifest.candidates;
const evidenceById = new Map((evidence.personalities ?? []).map((entry) => [entry.id, entry]));
const metadataById = new Map((metadata.personalities ?? []).map((entry) => [entry.id, entry]));
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

if (manifest.target.requiredAdditions !== manifest.target.targetFemaleCount - manifest.target.initialFemaleCount) {
  errors.push(`target.requiredAdditions inconsistente: ${manifest.target.requiredAdditions}; esperado ${manifest.target.targetFemaleCount - manifest.target.initialFemaleCount}`);
}

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

  if (['review', 'ready'].includes(candidate.metadataStatus) || ['review', 'ready'].includes(candidate.translationStatus)) {
    if (candidate.metadataFile !== 'scripts/data/female-metadata-drafts.json') {
      errors.push(`${candidate.id}: metadata/translation em review/ready exige metadataFile em scripts/data/female-metadata-drafts.json`);
    }
    const draft = metadataById.get(candidate.id);
    if (!draft) {
      errors.push(`${candidate.id}: metadata/translation em review/ready sem draft factual`);
    } else {
      if (!draft.lifespan || !draft.pt?.role || !draft.pt?.description) {
        errors.push(`${candidate.id}: draft PT incompleto`);
      }
      if (!draft.en?.role || !draft.en?.description) {
        errors.push(`${candidate.id}: draft EN incompleto`);
      }
      if (candidate.bookStatus === 'review' || candidate.bookStatus === 'ready') {
        if (!draft.book?.title?.pt || !draft.book?.title?.en || !draft.book?.year) {
          errors.push(`${candidate.id}: bookStatus=${candidate.bookStatus} sem livro completo no staging`);
        }
      }
    }
  }

  if (['review', 'ready'].includes(candidate.portraitStatus)) {
    if (candidate.metadataFile !== 'scripts/data/female-metadata-drafts.json') {
      errors.push(`${candidate.id}: portraitStatus=${candidate.portraitStatus} exige metadataFile em scripts/data/female-metadata-drafts.json`);
    }
    const draft = metadataById.get(candidate.id);
    const portrait = draft?.portrait;
    if (!portrait?.path || !portrait?.sourceUrl || !portrait?.license || !portrait?.attribution) {
      errors.push(`${candidate.id}: portrait metadata incompleta`);
    } else {
      const relativePortraitPath = portrait.path.replace(/^\//, '');
      const portraitPath = resolve(root, 'frontend/public', relativePortraitPath);
      if (!existsSync(portraitPath)) {
        errors.push(`${candidate.id}: retrato local ausente: ${portrait.path}`);
      } else {
        const bytes = readFileSync(portraitPath);
        const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        if (!isJpeg) {
          errors.push(`${candidate.id}: retrato local não é JPEG válido: ${portrait.path}`);
        }
      }
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
      const evidenceKeys = Object.keys(dossier.evidence ?? {});
      const unknownAxes = evidenceKeys.filter((axisId) => !AXES.includes(axisId));
      if (evidenceKeys.length < 3) {
        errors.push(`${candidate.id}: dossiê precisa de evidência em pelo menos 3 eixos para entrar em review`);
      }
      if (unknownAxes.length) {
        errors.push(`${candidate.id}: dossiê contém eixos desconhecidos: ${unknownAxes.join(', ')}`);
      }
      if (['proposed', 'ready'].includes(candidate.profileStatus)) {
        const missingAxes = AXES.filter((axisId) => !evidenceKeys.includes(axisId));
        if (missingAxes.length) {
          errors.push(
            `${candidate.id}: profileStatus=${candidate.profileStatus} exige evidência 12/12; faltam: ${missingAxes.join(', ')}`
          );
        }
      }
      if (candidate.profileStatus === 'ready') {
        const auditPath = resolve(auditAnswersRoot, `${candidate.id}.json`);
        if (!existsSync(auditPath)) {
          errors.push(`${candidate.id}: profileStatus=ready exige auditoria permanente em profile-audit/answers/personality/`);
        }
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

const evidenceAxisSlots = candidates.reduce((total, candidate) => {
  const dossier = evidenceById.get(candidate.id);
  return total + AXES.filter((axisId) => Object.prototype.hasOwnProperty.call(dossier?.evidence ?? {}, axisId)).length;
}, 0);
const fullEvidenceDossiers = candidates.filter((candidate) => {
  const dossier = evidenceById.get(candidate.id);
  return AXES.every((axisId) => Object.prototype.hasOwnProperty.call(dossier?.evidence ?? {}, axisId));
}).length;

const summary = {
  target: manifest.target.targetFemaleCount,
  integrated: runtimeFemaleIds.size,
  pipeline: candidates.length,
  planned,
  ready: ready.length,
  blocked: blocked.length,
  remainingUnplanned,
  dossiers: evidence.personalities?.length ?? 0,
  fullEvidenceDossiers,
  evidenceAxisSlots,
  evidenceAxisSlotsTotal: candidates.length * AXES.length,
  missingEvidenceAxisSlots: candidates.length * AXES.length - evidenceAxisSlots,
  metadataDrafts: metadata.personalities?.length ?? 0,
  portraitsInReview: candidates.filter((candidate) => candidate.portraitStatus === 'review').length,
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

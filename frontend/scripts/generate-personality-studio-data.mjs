import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const frontendRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(frontendRoot, '..');
const dataRoot = resolve(repoRoot, 'backend/src/main/resources/data');
const publicRoot = resolve(frontendRoot, 'public');
const auditRoot = resolve(repoRoot, 'profile-audit');
const scriptsDataRoot = resolve(repoRoot, 'scripts/data');
const outDir = resolve(publicRoot, '__dev/personality-studio');
const outPath = resolve(outDir, 'catalog.json');

function readJson(path, fallback = null) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
}

const personalities = readJson(resolve(dataRoot, 'personalities.json'), []);
const english = readJson(resolve(dataRoot, 'i18n/en/personalities.json'), []);
const profiles = readJson(resolve(dataRoot, 'personality-profiles.json'), []);
const books = readJson(resolve(dataRoot, 'books.json'), []);
const axes = readJson(resolve(dataRoot, 'axes.json'), []);
const evidence = readJson(resolve(scriptsDataRoot, 'female-profile-evidence.json'), { personalities: [] });
const manifest = readJson(resolve(scriptsDataRoot, 'female-expansion.json'), { candidates: [] });
const metadataDrafts = readJson(resolve(scriptsDataRoot, 'female-metadata-drafts.json'), { personalities: [] });

const englishById = new Map(english.map((entry) => [entry.id, entry]));
const profileById = new Map(profiles.map((entry) => [entry.personalityId, entry]));
const bookById = new Map(books.map((entry) => [entry.personalityId, entry]));
const evidenceById = new Map((evidence.personalities ?? []).map((entry) => [entry.id, entry]));
const draftById = new Map((metadataDrafts.personalities ?? []).map((entry) => [entry.id, entry]));
const runtimeIds = new Set(personalities.map((entry) => entry.id));
const axisIds = axes.map((axis) => axis.id);

async function inspectImage(imagePath) {
  const trimmed = typeof imagePath === 'string' ? imagePath.trim() : '';
  const isRemote = /^https?:\/\//i.test(trimmed);
  const normalizedPath = trimmed.replace(/^\/+/, '').replace(/^public\//, '');
  const assetPath = trimmed && !isRemote ? resolve(publicRoot, normalizedPath) : '';
  const exists = Boolean(assetPath && existsSync(assetPath));
  const bytes = exists ? statSync(assetPath).size : null;
  let metadata = null;
  let error = null;

  if (exists) {
    try {
      const decoded = await sharp(assetPath).metadata();
      metadata = {
        format: decoded.format ?? null,
        width: decoded.width ?? null,
        height: decoded.height ?? null,
      };
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  return { path: trimmed, isRemote, normalizedPath: normalizedPath || null, exists, bytes, metadata, error };
}

function validateDecodedImage(image, errors, warnings, { required }) {
  if (!image.path) {
    if (required) errors.push('imagePath ausente');
    return;
  }
  if (image.isRemote) {
    errors.push('Retrato remoto; esperado asset local');
    return;
  }
  if (!image.exists) {
    errors.push(`Asset ausente: frontend/public/${image.normalizedPath}`);
    return;
  }
  if (image.bytes === 0) errors.push('Asset de retrato vazio');
  if (image.error) errors.push(`Imagem ilegível: ${image.error}`);
  if (image.metadata) {
    if (!['jpeg', 'png', 'webp'].includes(image.metadata.format ?? '')) {
      warnings.push(`Formato de imagem incomum: ${image.metadata.format ?? 'unknown'}`);
    }
    if ((image.metadata.width ?? 0) < 200 || (image.metadata.height ?? 0) < 200) {
      warnings.push(`Retrato pequeno: ${image.metadata.width}×${image.metadata.height}`);
    }
  }
}

const runtimeEntries = await Promise.all(personalities.map(async (personality) => {
  const id = String(personality.id ?? '');
  const translated = englishById.get(id) ?? null;
  const profile = profileById.get(id) ?? null;
  const book = bookById.get(id) ?? null;
  const dossier = evidenceById.get(id) ?? null;
  const auditAnswerExists = existsSync(resolve(auditRoot, 'answers/personality', `${id}.json`));
  const auditPendingExists = existsSync(resolve(auditRoot, 'subagent-out/personality', `${id}.json`));
  const image = await inspectImage(personality.imagePath);

  const errors = [];
  const warnings = [];

  for (const field of ['id', 'name', 'role', 'category', 'representation', 'lifespan', 'description']) {
    if (!personality[field]) errors.push(`Campo obrigatório ausente: ${field}`);
  }

  if (!translated) {
    errors.push('Tradução EN ausente');
  } else {
    if (!translated.name) warnings.push('Nome EN ausente');
    if (!translated.role) errors.push('Role EN ausente');
    if (!translated.description) errors.push('Descrição EN ausente');
  }

  validateDecodedImage(image, errors, warnings, { required: true });

  if (!profile?.vector) {
    errors.push('Perfil de 12 eixos ausente');
  } else {
    for (const axisId of axisIds) {
      const value = profile.vector[axisId];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`Eixo ausente/inválido: ${axisId}`);
      } else if (value < 0 || value > 100) {
        errors.push(`Eixo fora de 0–100: ${axisId}`);
      }
    }
    const extraAxes = Object.keys(profile.vector).filter((axisId) => !axisIds.includes(axisId));
    if (extraAxes.length) warnings.push(`Eixos extras: ${extraAxes.join(', ')}`);
  }

  if (!book) warnings.push('Sem livro cadastrado');
  if (!auditAnswerExists) warnings.push('Sem auditoria permanente em profile-audit/answers');
  if (auditPendingExists) warnings.push('Há saída de auditoria pendente em subagent-out');

  return {
    source: 'runtime',
    pipeline: null,
    ...personality,
    translated,
    profile,
    book,
    evidence: dossier,
    audit: { answerExists: auditAnswerExists, pendingExists: auditPendingExists },
    image,
    validation: {
      errors,
      warnings,
      status: errors.length ? 'error' : warnings.length ? 'warning' : 'ok',
    },
  };
}));

const stagingEntries = await Promise.all(
  (manifest.candidates ?? [])
    .filter((candidate) => !runtimeIds.has(candidate.id))
    .map(async (candidate) => {
      const id = candidate.id;
      const draft = draftById.get(id) ?? null;
      const dossier = evidenceById.get(id) ?? null;
      const auditAnswerExists = existsSync(resolve(auditRoot, 'answers/personality', `${id}.json`));
      const auditPendingExists = existsSync(resolve(auditRoot, 'subagent-out/personality', `${id}.json`));
      const imagePath = draft?.portrait?.path ?? '';
      const image = await inspectImage(imagePath);
      const translated = draft?.en
        ? { id, name: candidate.name, role: draft.en.role, description: draft.en.description }
        : null;
      const book = draft?.book
        ? { personalityId: id, ...draft.book }
        : null;

      const errors = [];
      const warnings = [];

      if (['review', 'ready'].includes(candidate.metadataStatus)) {
        if (!draft?.lifespan || !draft?.pt?.role || !draft?.pt?.description) {
          errors.push(`metadataStatus=${candidate.metadataStatus}, mas draft PT está incompleto`);
        }
      } else {
        warnings.push(`Metadata ainda em ${candidate.metadataStatus}`);
      }

      if (['review', 'ready'].includes(candidate.translationStatus)) {
        if (!draft?.en?.role || !draft?.en?.description) {
          errors.push(`translationStatus=${candidate.translationStatus}, mas draft EN está incompleto`);
        }
      } else {
        warnings.push(`Tradução ainda em ${candidate.translationStatus}`);
      }

      if (['review', 'ready'].includes(candidate.portraitStatus)) {
        if (!draft?.portrait?.sourceUrl || !draft?.portrait?.license || !draft?.portrait?.attribution) {
          errors.push(`portraitStatus=${candidate.portraitStatus}, mas origem/licença está incompleta`);
        }
        validateDecodedImage(image, errors, warnings, { required: true });
      } else {
        warnings.push(`Retrato ainda em ${candidate.portraitStatus}`);
      }

      if (['review', 'proposed', 'ready'].includes(candidate.profileStatus)) {
        const sourceCount = dossier?.sources?.length ?? 0;
        const evidenceCount = Object.keys(dossier?.evidence ?? {}).length;
        if (sourceCount < 2) errors.push(`Dossiê tem apenas ${sourceCount} fonte(s); mínimo 2`);
        if (evidenceCount < 3) errors.push(`Dossiê tem apenas ${evidenceCount} campo(s) de evidência; mínimo 3`);
      } else {
        warnings.push(`Perfil ainda em ${candidate.profileStatus}`);
      }

      if (candidate.profileStatus === 'ready' && !auditAnswerExists) {
        errors.push('profileStatus=ready sem auditoria permanente de 240 respostas');
      } else if (!auditAnswerExists) {
        warnings.push('Sem auditoria permanente de 240 respostas');
      }
      if (auditPendingExists) warnings.push('Há saída de auditoria pendente em subagent-out');

      if (['review', 'ready'].includes(candidate.bookStatus)) {
        if (!book?.title?.pt || !book?.title?.en || !book?.year) {
          errors.push(`bookStatus=${candidate.bookStatus}, mas livro no staging está incompleto`);
        }
      } else if (!book) {
        warnings.push(`Livro: ${candidate.bookStatus}`);
      }

      return {
        source: 'staging',
        pipeline: {
          metadataStatus: candidate.metadataStatus,
          portraitStatus: candidate.portraitStatus,
          translationStatus: candidate.translationStatus,
          profileStatus: candidate.profileStatus,
          bookStatus: candidate.bookStatus,
          region: candidate.region,
          period: candidate.period,
        },
        id,
        name: candidate.name,
        role: draft?.pt?.role ?? '',
        category: candidate.category,
        representation: 'female',
        lifespan: draft?.lifespan ?? '',
        description: draft?.pt?.description ?? '',
        imagePath,
        imageSourceName: draft?.portrait?.sourceName ?? '',
        imageSourceUrl: draft?.portrait?.sourceUrl ?? '',
        imageNote: draft?.portrait?.note ?? '',
        translated,
        profile: null,
        book,
        evidence: dossier,
        audit: { answerExists: auditAnswerExists, pendingExists: auditPendingExists },
        image,
        validation: {
          errors,
          warnings,
          status: errors.length ? 'error' : warnings.length ? 'warning' : 'ok',
        },
      };
    })
);

const entries = [...runtimeEntries, ...stagingEntries];
const stats = {
  totalEntries: entries.length,
  runtime: runtimeEntries.length,
  staging: stagingEntries.length,
  runtimeMale: runtimeEntries.filter((entry) => entry.representation === 'male').length,
  runtimeFemale: runtimeEntries.filter((entry) => entry.representation === 'female').length,
  plannedFemale: runtimeEntries.filter((entry) => entry.representation === 'female').length + stagingEntries.length,
  errors: entries.filter((entry) => entry.validation.errors.length > 0).length,
  warnings: entries.filter(
    (entry) => entry.validation.errors.length === 0 && entry.validation.warnings.length > 0
  ).length,
  ok: entries.filter(
    (entry) => entry.validation.errors.length === 0 && entry.validation.warnings.length === 0
  ).length,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(
  outPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), axes, stats, personalities: entries }, null, 2) + '\n',
  'utf8'
);

console.log(`Personality Studio snapshot: ${outPath}`);
console.log(JSON.stringify(stats, null, 2));

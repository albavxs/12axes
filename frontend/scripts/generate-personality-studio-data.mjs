import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const frontendRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(frontendRoot, '..');
const dataRoot = resolve(repoRoot, 'backend/src/main/resources/data');
const publicRoot = resolve(frontendRoot, 'public');
const auditRoot = resolve(repoRoot, 'profile-audit');
const scriptsDataRoot = resolve(repoRoot, 'scripts/data');
const localDraftsPath = resolve(repoRoot, '.personality-studio/drafts.json');
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
const questions = readJson(resolve(dataRoot, 'questions-pool.json'), []);
const archetypeQuestions = readJson(resolve(dataRoot, 'archetype-questions.json'), []);
const evidence = readJson(resolve(scriptsDataRoot, 'female-profile-evidence.json'), { personalities: [] });
const manifest = readJson(resolve(scriptsDataRoot, 'female-expansion.json'), { candidates: [] });
const metadataDrafts = readJson(resolve(scriptsDataRoot, 'female-metadata-drafts.json'), { personalities: [] });
const localDrafts = readJson(localDraftsPath, {});

const englishById = new Map(english.map((entry) => [entry.id, entry]));
const profileById = new Map(profiles.map((entry) => [entry.personalityId, entry]));
const bookById = new Map(books.map((entry) => [entry.personalityId, entry]));
const evidenceById = new Map((evidence.personalities ?? []).map((entry) => [entry.id, entry]));
const provisionalEvidenceDir = resolve(auditRoot, 'subagent-evidence/personality');
if (existsSync(provisionalEvidenceDir)) {
  for (const name of readdirSync(provisionalEvidenceDir)) {
    if (!name.endsWith('.json')) continue;
    const dossier = readJson(resolve(provisionalEvidenceDir, name), null);
    if (dossier?.id) evidenceById.set(dossier.id, dossier);
  }
}
const draftById = new Map((metadataDrafts.personalities ?? []).map((entry) => [entry.id, entry]));
const runtimeIds = new Set(personalities.map((entry) => entry.id));
const axisIds = axes.map((axis) => axis.id);
const questionById = new Map(questions.map((question) => [question.id, question]));
const answerScore = { DT: 0, D: 0.25, N: 0.5, C: 0.75, CT: 1 };

function computeAuditVector(auditData) {
  if (!auditData || typeof auditData !== 'object') return null;

  const totals = Object.fromEntries(axisIds.map((axisId) => [axisId, [0, 0]]));
  for (const axisId of axisIds) {
    const answers = auditData?.[axisId]?.answers;
    if (!answers || typeof answers !== 'object') return null;

    for (const [questionId, answer] of Object.entries(answers)) {
      const question = questionById.get(questionId);
      const score = answerScore[answer];
      if (!question || typeof score !== 'number') return null;
      const weight = Number(question.weight ?? 1);
      const contribution = question.agreePole === 'LEFT' ? score : 1 - score;
      totals[axisId][0] += contribution * weight;
      totals[axisId][1] += weight;
    }
  }

  const archetype = auditData.archetype ?? {};
  for (const question of archetypeQuestions) {
    const selected = question.options?.find((option) => option.id === archetype[question.id]);
    if (!selected) continue;
    for (const [axisId, leftPercent] of Object.entries(selected.effects ?? {})) {
      if (!totals[axisId]) continue;
      totals[axisId][0] += Number(leftPercent) / 100;
      totals[axisId][1] += 1;
    }
  }

  if (axisIds.some((axisId) => totals[axisId][1] <= 0)) return null;
  return Object.fromEntries(axisIds.map((axisId) => [
    axisId,
    Math.round((totals[axisId][0] / totals[axisId][1]) * 1000) / 10,
  ]));
}

function auditProfileFor(id) {
  const answerPath = resolve(auditRoot, 'answers/personality', `${id}.json`);
  const pendingPath = resolve(auditRoot, 'subagent-out/personality', `${id}.json`);
  const sourcePath = existsSync(answerPath) ? answerPath : existsSync(pendingPath) ? pendingPath : null;
  if (!sourcePath) return { profile: null, source: null };
  const vector = computeAuditVector(readJson(sourcePath, null));
  return vector
    ? { profile: { personalityId: id, vector }, source: sourcePath === answerPath ? 'archived' : 'draft' }
    : { profile: null, source: null };
}

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
      metadata = { format: decoded.format ?? null, width: decoded.width ?? null, height: decoded.height ?? null };
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
  const auditPacketExists = existsSync(resolve(repoRoot, '.personality-studio/audit-packets', `${id}.txt`));
  const auditComputed = auditProfileFor(id);
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
      if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`Eixo ausente/inválido: ${axisId}`);
      else if (value < 0 || value > 100) errors.push(`Eixo fora de 0–100: ${axisId}`);
    }
    const extraAxes = Object.keys(profile.vector).filter((axisId) => !axisIds.includes(axisId));
    if (extraAxes.length) warnings.push(`Eixos extras: ${extraAxes.join(', ')}`);
  }

  // Livro e auditoria são gates independentes. A ausência deles não torna o
  // catálogo inválido e já é exibida nos badges/painel de auditoria do Studio.

  const runtimeMetadataValid = ['id', 'name', 'role', 'category', 'representation', 'lifespan', 'description']
    .every((field) => Boolean(personality[field]));
  const runtimeTranslationValid = Boolean(translated?.role && translated?.description);
  const runtimePortraitValid = Boolean(
    image.path && !image.isRemote && image.exists && !image.error && image.bytes && image.metadata?.width && image.metadata?.height
  );
  const runtimeEditorial = {
    metadataValid: runtimeMetadataValid,
    translationValid: runtimeTranslationValid,
    portraitValid: runtimePortraitValid,
    bookValid: true,
    canMarkValid: false,
    isMarkedValid: runtimeMetadataValid && runtimeTranslationValid && runtimePortraitValid,
    status: runtimeMetadataValid && runtimeTranslationValid && runtimePortraitValid ? 'ok' : 'error',
  };

  return {
    source: 'runtime',
    pipeline: null,
    ...personality,
    translated,
    profile,
    auditProfile: auditComputed.profile,
    auditProfileSource: auditComputed.source,
    book,
    evidence: dossier,
    evidenceReady: Boolean((dossier?.sources?.length ?? 0) >= 2 && axisIds.every((axisId) => String(dossier?.evidence?.[axisId] ?? '').trim())),
    audit: { answerExists: auditAnswerExists, pendingExists: auditPendingExists, packetExists: auditPacketExists },
    editorial: runtimeEditorial,
    image,
    previewImagePath: personality.imagePath ?? '',
    imageSourceFile: null,
    localDraft: localDrafts[`runtime:${id}`] ?? null,
    validation: { errors, warnings, status: errors.length ? 'error' : warnings.length ? 'warning' : 'ok' },
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
      const auditPacketExists = existsSync(resolve(repoRoot, '.personality-studio/audit-packets', `${id}.txt`));
      const auditComputed = auditProfileFor(id);
      const imagePath = draft?.portrait?.path ?? '';
      const image = await inspectImage(imagePath);
      const translated = draft?.en ? { id, name: candidate.name, role: draft.en.role, description: draft.en.description } : null;
      const book = draft?.book ? { personalityId: id, ...draft.book } : null;
      const errors = [];
      const warnings = [];

      const metadataMissing = !draft?.lifespan || !draft?.pt?.role || !draft?.pt?.description;
      if (metadataMissing) {
        const message = 'Metadata PT incompleta';
        if (['review', 'ready'].includes(candidate.metadataStatus)) errors.push(message);
        else warnings.push(message);
      }

      const translationMissing = !draft?.en?.role || !draft?.en?.description;
      if (translationMissing) {
        const message = 'Tradução EN incompleta';
        if (['review', 'ready'].includes(candidate.translationStatus)) errors.push(message);
        else warnings.push(message);
      }

      const portraitMetadataMissing =
        !draft?.portrait?.path ||
        !draft?.portrait?.sourceUrl ||
        !draft?.portrait?.license ||
        !draft?.portrait?.attribution;
      const portraitClaimed = ['review', 'ready'].includes(candidate.portraitStatus);
      if (portraitMetadataMissing) {
        const localImageHealthy = Boolean(
          image.exists &&
          !image.error &&
          image.bytes &&
          image.metadata?.width &&
          image.metadata?.height
        );
        const message = localImageHealthy
          ? 'Retrato local válido, mas fonte/licença/atribuição ainda está incompleta'
          : 'Retrato sem path, fonte, licença ou atribuição completa';
        if (portraitClaimed && !localImageHealthy) errors.push(message);
        else warnings.push(message);
      } else {
        const portraitErrors = [];
        const portraitWarnings = [];
        validateDecodedImage(image, portraitErrors, portraitWarnings, { required: true });
        if (portraitClaimed) errors.push(...portraitErrors);
        else warnings.push(...portraitErrors);
        warnings.push(...portraitWarnings);
      }

      // Estados pending/researching/proposed pertencem ao workflow e aparecem nos
      // badges. Só viram problema de QA quando o gate declara revisão/ready e os
      // dados que sustentam esse estado estão inconsistentes.
      if (['review', 'proposed', 'ready'].includes(candidate.profileStatus)) {
        const sourceCount = dossier?.sources?.length ?? 0;
        const evidenceCount = Object.keys(dossier?.evidence ?? {}).length;
        if (sourceCount < 2) errors.push(`Dossiê tem apenas ${sourceCount} fonte(s); mínimo 2`);
        if (evidenceCount < 3) errors.push(`Dossiê tem apenas ${evidenceCount} campo(s) de evidência; mínimo 3`);
      }

      if (candidate.profileStatus === 'ready' && !auditAnswerExists) {
        errors.push('profileStatus=ready sem auditoria permanente de 240 respostas');
      }

      const bookIncomplete = Boolean(book) && (!book?.title?.pt || !book?.title?.en || !book?.year);
      if (bookIncomplete) {
        const message = 'Livro cadastrado, mas incompleto';
        if (['review', 'ready'].includes(candidate.bookStatus)) errors.push(message);
        else warnings.push(message);
      } else if (['review', 'ready'].includes(candidate.bookStatus) && !book) {
        errors.push(`bookStatus=${candidate.bookStatus}, mas não há livro no staging`);
      }

      const metadataComplete = Boolean(
        candidate.name && candidate.category && draft?.lifespan && draft?.pt?.role && draft?.pt?.description
      );
      const translationComplete = Boolean(draft?.en?.role && draft?.en?.description);
      const portraitComplete = Boolean(
        draft?.portrait?.path &&
        draft?.portrait?.sourceUrl &&
        draft?.portrait?.license &&
        draft?.portrait?.attribution &&
        image.exists &&
        !image.error &&
        image.bytes &&
        image.metadata?.width &&
        image.metadata?.height
      );
      const bookComplete = !draft?.book || Boolean(draft.book.title?.pt && draft.book.title?.en && draft.book.year);
      const editorialMarkedReady =
        candidate.metadataStatus === 'ready' &&
        candidate.translationStatus === 'ready' &&
        candidate.portraitStatus === 'ready' &&
        (!draft?.book || candidate.bookStatus === 'ready');
      const stagingEditorial = {
        metadataValid: metadataComplete,
        translationValid: translationComplete,
        portraitValid: portraitComplete,
        bookValid: bookComplete,
        canMarkValid: metadataComplete && translationComplete && portraitComplete && bookComplete,
        isMarkedValid: editorialMarkedReady,
        status: errors.length ? 'error' : warnings.length ? 'warning' : 'ok',
      };

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
        previewImagePath: image.exists
          ? imagePath
          : (draft?.portrait?.sourceImageUrl
              ? draft.portrait.sourceImageUrl
              : (draft?.portrait?.sourceFile
                  ? 'https://commons.wikimedia.org/wiki/Special:Redirect/file/' + encodeURIComponent(draft.portrait.sourceFile) + '?width=800'
                  : '')),
        imageSourceFile: draft?.portrait?.sourceFile ?? '',
        imageSourceName: draft?.portrait?.sourceName ?? '',
        imageSourceUrl: draft?.portrait?.sourceUrl ?? '',
        imageSourceImageUrl: draft?.portrait?.sourceImageUrl ?? '',
        imageNote: draft?.portrait?.note ?? '',
        translated,
        profile: null,
        auditProfile: auditComputed.profile,
        auditProfileSource: auditComputed.source,
        book,
        evidence: dossier,
        evidenceReady: Boolean((dossier?.sources?.length ?? 0) >= 2 && axisIds.every((axisId) => String(dossier?.evidence?.[axisId] ?? '').trim())),
        audit: { answerExists: auditAnswerExists, pendingExists: auditPendingExists, packetExists: auditPacketExists },
        editorial: stagingEditorial,
        image,
        localDraft: localDrafts[`staging:${id}`] ?? null,
        validation: { errors, warnings, status: errors.length ? 'error' : warnings.length ? 'warning' : 'ok' },
      };
    })
);

const entries = [...runtimeEntries, ...stagingEntries];

const queueRank = { review: 0, proposed: 1, researching: 2, pending: 3, ready: 4 };
const womenAuditQueue = entries
  .filter((entry) => entry.representation === 'female' && !entry.audit.answerExists)
  .sort((a, b) => {
    if (a.source !== b.source) return a.source === 'runtime' ? -1 : 1;
    const ar = queueRank[a.pipeline?.profileStatus] ?? 9;
    const br = queueRank[b.pipeline?.profileStatus] ?? 9;
    if (ar !== br) return ar - br;
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
  });

womenAuditQueue.forEach((entry, index) => {
  entry.auditPlan = {
    batch: Math.floor(index / 15) + 1,
    position: index + 1,
    totalPending: womenAuditQueue.length,
  };
});

const stats = {
  totalEntries: entries.length,
  runtime: runtimeEntries.length,
  staging: stagingEntries.length,
  runtimeMale: runtimeEntries.filter((entry) => entry.representation === 'male').length,
  runtimeFemale: runtimeEntries.filter((entry) => entry.representation === 'female').length,
  plannedFemale: runtimeEntries.filter((entry) => entry.representation === 'female').length + stagingEntries.length,
  errors: entries.filter((entry) => entry.validation.errors.length > 0).length,
  warnings: entries.filter((entry) => entry.validation.errors.length === 0 && entry.validation.warnings.length > 0).length,
  ok: entries.filter((entry) => entry.validation.errors.length === 0 && entry.validation.warnings.length === 0).length,
  localDrafts: entries.filter((entry) => entry.localDraft).length,
  womenAuditDone: entries.filter((entry) => entry.representation === 'female' && entry.audit.answerExists).length,
  womenVectorReady: entries.filter((entry) => entry.representation === 'female' && (entry.profile?.vector || entry.auditProfile?.vector)).length,
  womenAuditPending: womenAuditQueue.length,
  womenAuditReview: entries.filter((entry) => entry.representation === 'female' && !entry.audit.answerExists && entry.audit.pendingExists).length,
  womenAuditBatches: Math.ceil(womenAuditQueue.length / 15),
};

mkdirSync(outDir, { recursive: true });
writeFileSync(
  outPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), axes, stats, personalities: entries }, null, 2) + '\n',
  'utf8'
);

console.log(`Personality Studio snapshot: ${outPath}`);
console.log(JSON.stringify(stats, null, 2));

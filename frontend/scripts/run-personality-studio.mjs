import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const frontendRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(frontendRoot, '..');
const dataRoot = resolve(repoRoot, 'backend/src/main/resources/data');
const scriptsDataRoot = resolve(repoRoot, 'scripts/data');
const publicRoot = resolve(frontendRoot, 'public');
const localRoot = resolve(repoRoot, '.personality-studio');
const localDraftsPath = resolve(localRoot, 'drafts.json');
const generatorPath = resolve(frontendRoot, 'scripts/generate-personality-studio-data.mjs');
const apiPort = 5174;

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function refreshSnapshot() {
  const result = spawnSync(process.execPath, [generatorPath], {
    cwd: frontendRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('Could not regenerate Personality Studio snapshot.');
  }
}

function readRequestBody(req) {
  return new Promise((resolveBody, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 512_000) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function cleanText(value, max = 5000) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

function normalizeDraft(input = {}) {
  const book = input.book ?? {};
  const portrait = input.portrait ?? {};
  return {
    pt: {
      name: cleanText(input.pt?.name, 180),
      role: cleanText(input.pt?.role, 180),
      category: cleanText(input.pt?.category, 120),
      lifespan: cleanText(input.pt?.lifespan, 80),
      description: cleanText(input.pt?.description, 1400),
    },
    en: {
      name: cleanText(input.en?.name, 180),
      role: cleanText(input.en?.role, 180),
      description: cleanText(input.en?.description, 1400),
    },
    portrait: {
      path: cleanText(portrait.path, 500),
      sourceFile: cleanText(portrait.sourceFile, 500),
      sourceName: cleanText(portrait.sourceName, 240),
      sourceUrl: cleanText(portrait.sourceUrl, 1000),
      note: cleanText(portrait.note, 1200),
      license: cleanText(portrait.license, 240),
      attribution: cleanText(portrait.attribution, 500),
    },
    book: {
      enabled: Boolean(book.enabled),
      titlePt: cleanText(book.titlePt, 400),
      titleEn: cleanText(book.titleEn, 400),
      year: cleanText(book.year, 12),
    },
  };
}

function draftKey(source, id) {
  return `${source}:${id}`;
}

function saveLocalDraft(source, id, draft) {
  mkdirSync(localRoot, { recursive: true });
  const localDrafts = readJson(localDraftsPath, {});
  localDrafts[draftKey(source, id)] = {
    ...draft,
    savedAt: new Date().toISOString(),
  };
  writeJson(localDraftsPath, localDrafts);
}

function discardLocalDraft(source, id) {
  const localDrafts = readJson(localDraftsPath, {});
  delete localDrafts[draftKey(source, id)];
  mkdirSync(localRoot, { recursive: true });
  writeJson(localDraftsPath, localDrafts);
}

function parseYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year > 0 && year < 3000 ? year : null;
}

function applyRuntime(id, draft) {
  const personalitiesPath = resolve(dataRoot, 'personalities.json');
  const englishPath = resolve(dataRoot, 'i18n/en/personalities.json');
  const booksPath = resolve(dataRoot, 'books.json');

  const personalities = readJson(personalitiesPath, []);
  const english = readJson(englishPath, []);
  const books = readJson(booksPath, []);
  const personality = personalities.find((entry) => entry.id === id);
  if (!personality) throw new Error(`Runtime personality not found: ${id}`);

  if (draft.pt.name) personality.name = draft.pt.name;
  if (draft.pt.role) personality.role = draft.pt.role;
  if (draft.pt.category) personality.category = draft.pt.category;
  if (draft.pt.lifespan) personality.lifespan = draft.pt.lifespan;
  if (draft.pt.description) personality.description = draft.pt.description;
  if (draft.portrait.path) personality.imagePath = draft.portrait.path;
  if (draft.portrait.sourceName) personality.imageSourceName = draft.portrait.sourceName;
  if (draft.portrait.sourceUrl) personality.imageSourceUrl = draft.portrait.sourceUrl;
  if (draft.portrait.note) personality.imageNote = draft.portrait.note;

  let translated = english.find((entry) => entry.id === id);
  if (!translated) {
    translated = { id, name: draft.en.name || draft.pt.name || personality.name, role: '', description: '' };
    english.push(translated);
  }
  if (draft.en.name) translated.name = draft.en.name;
  if (draft.en.role) translated.role = draft.en.role;
  if (draft.en.description) translated.description = draft.en.description;

  const bookIndex = books.findIndex((entry) => entry.personalityId === id);
  if (draft.book.enabled) {
    const year = parseYear(draft.book.year);
    const nextBook = {
      personalityId: id,
      title: { pt: draft.book.titlePt, en: draft.book.titleEn },
      ...(year ? { year } : {}),
      url: { pt: '', en: '' },
    };
    if (bookIndex >= 0) books[bookIndex] = nextBook;
    else books.push(nextBook);
  } else if (bookIndex >= 0) {
    books.splice(bookIndex, 1);
  }

  writeJson(personalitiesPath, personalities);
  writeJson(englishPath, english);
  writeJson(booksPath, books);
}

function applyStaging(id, draft) {
  const manifestPath = resolve(scriptsDataRoot, 'female-expansion.json');
  const metadataPath = resolve(scriptsDataRoot, 'female-metadata-drafts.json');
  const manifest = readJson(manifestPath, { candidates: [] });
  const metadata = readJson(metadataPath, { version: 1, personalities: [] });

  const candidate = manifest.candidates?.find((entry) => entry.id === id);
  if (!candidate) throw new Error(`Staging candidate not found: ${id}`);
  if (draft.pt.name) candidate.name = draft.pt.name;
  if (draft.pt.category) candidate.category = draft.pt.category;

  metadata.personalities ??= [];
  let entry = metadata.personalities.find((item) => item.id === id);
  if (!entry) {
    entry = { id, lifespan: '', pt: { role: '', description: '' }, en: { role: '', description: '' }, book: null };
    metadata.personalities.push(entry);
  }

  entry.lifespan = draft.pt.lifespan;
  entry.pt = {
    role: draft.pt.role,
    description: draft.pt.description,
  };
  entry.en = {
    role: draft.en.role,
    description: draft.en.description,
  };

  const portraitHasContent = Object.values(draft.portrait).some(Boolean);
  if (portraitHasContent) {
    entry.portrait = {
      path: draft.portrait.path,
      sourceFile: draft.portrait.sourceFile,
      sourceName: draft.portrait.sourceName,
      sourceUrl: draft.portrait.sourceUrl,
      note: draft.portrait.note,
      license: draft.portrait.license,
      attribution: draft.portrait.attribution,
    };
  }

  if (draft.book.enabled) {
    const year = parseYear(draft.book.year);
    entry.book = {
      title: { pt: draft.book.titlePt, en: draft.book.titleEn },
      ...(year ? { year } : {}),
      url: { pt: '', en: '' },
    };
  } else {
    entry.book = null;
  }

  writeJson(manifestPath, manifest);
  writeJson(metadataPath, metadata);
}

async function materializeCommonsPortrait(draft) {
  const sourceUrl = new URL(draft.portrait.sourceUrl);
  if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== 'commons.wikimedia.org') {
    throw new Error('Portrait download is restricted to commons.wikimedia.org.');
  }

  let sourceFile = draft.portrait.sourceFile;
  if (!sourceFile) {
    const decodedPath = decodeURIComponent(sourceUrl.pathname);
    const marker = '/wiki/File:';
    const index = decodedPath.indexOf(marker);
    if (index >= 0) sourceFile = decodedPath.slice(index + marker.length);
  }
  if (!sourceFile) throw new Error('Could not determine the Wikimedia Commons file name.');

  const portraitPath = draft.portrait.path;
  if (!portraitPath.startsWith('/personalities/portraits/') || !portraitPath.toLowerCase().endsWith('.jpg')) {
    throw new Error('Portrait path must be /personalities/portraits/<id>.jpg.');
  }

  const relative = portraitPath.replace(/^\/+/, '');
  const target = resolve(publicRoot, relative);
  const portraitsRoot = resolve(publicRoot, 'personalities/portraits');
  if (!target.startsWith(portraitsRoot + '/')) {
    throw new Error('Invalid portrait target path.');
  }

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '1200',
    titles: 'File:' + sourceFile,
  });
  const apiResponse = await fetch('https://commons.wikimedia.org/w/api.php?' + params, {
    headers: { 'User-Agent': '12axes-personality-studio/1.0' },
  });
  if (!apiResponse.ok) throw new Error('Commons API request failed.');
  const payload = await apiResponse.json();
  const page = payload?.query?.pages?.[0];
  const imageUrl = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
  if (!imageUrl) throw new Error('Commons did not return an image URL.');

  const imageResponse = await fetch(imageUrl, {
    headers: { 'User-Agent': '12axes-personality-studio/1.0' },
  });
  if (!imageResponse.ok) throw new Error('Could not download the Commons image.');
  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  mkdirSync(dirname(target), { recursive: true });
  await sharp(buffer)
    .rotate()
    .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, progressive: true })
    .toFile(target);

  return target;
}

async function markStagingEditorialReady(id) {
  const manifestPath = resolve(scriptsDataRoot, 'female-expansion.json');
  const metadataPath = resolve(scriptsDataRoot, 'female-metadata-drafts.json');
  const manifest = readJson(manifestPath, { candidates: [] });
  const metadata = readJson(metadataPath, { personalities: [] });

  const candidate = manifest.candidates?.find((entry) => entry.id === id);
  if (!candidate) throw new Error(`Staging candidate not found: ${id}`);
  const draft = metadata.personalities?.find((entry) => entry.id === id);
  if (!draft) throw new Error('Não é possível validar: metadata draft ausente.');

  const missing = [];
  if (!candidate.name) missing.push('nome');
  if (!candidate.category) missing.push('categoria');
  if (!draft.lifespan) missing.push('lifespan');
  if (!draft.pt?.role) missing.push('função PT');
  if (!draft.pt?.description) missing.push('descrição PT');
  if (!draft.en?.role) missing.push('função EN');
  if (!draft.en?.description) missing.push('descrição EN');

  const portrait = draft.portrait;
  if (!portrait?.path) missing.push('path do retrato');
  if (!portrait?.sourceUrl) missing.push('fonte do retrato');
  if (!portrait?.license) missing.push('licença do retrato');
  if (!portrait?.attribution) missing.push('atribuição do retrato');

  if (portrait?.path) {
    if (!portrait.path.startsWith('/personalities/portraits/') || !portrait.path.toLowerCase().endsWith('.jpg')) {
      missing.push('path de retrato JPEG válido');
    } else {
      const relative = portrait.path.replace(/^\/+/, '');
      const target = resolve(publicRoot, relative);
      const portraitsRoot = resolve(publicRoot, 'personalities/portraits');
      if (!target.startsWith(portraitsRoot + '/') || !existsSync(target)) {
        missing.push('arquivo local do retrato');
      } else {
        try {
          const image = await sharp(target).metadata();
          if (image.format !== 'jpeg' || !image.width || !image.height) missing.push('JPEG legível');
        } catch {
          missing.push('JPEG legível');
        }
      }
    }
  }

  if (draft.book) {
    if (!draft.book.title?.pt) missing.push('título PT do livro');
    if (!draft.book.title?.en) missing.push('título EN do livro');
    if (!draft.book.year) missing.push('ano do livro');
  }

  if (missing.length) {
    throw new Error('Não é possível marcar como válido. Falta: ' + [...new Set(missing)].join(', ') + '.');
  }

  candidate.metadataStatus = 'ready';
  candidate.translationStatus = 'ready';
  candidate.portraitStatus = 'ready';
  if (draft.book) candidate.bookStatus = 'ready';

  writeJson(manifestPath, manifest);
  return {
    metadataStatus: candidate.metadataStatus,
    translationStatus: candidate.translationStatus,
    portraitStatus: candidate.portraitStatus,
    bookStatus: candidate.bookStatus,
    profileStatus: candidate.profileStatus,
  };
}

function validateTarget(source, id) {
  if (!['runtime', 'staging'].includes(source)) throw new Error('Invalid source.');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error('Invalid personality id.');
}

function jsonResponse(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

const api = createServer(async (req, res) => {
  try {
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
      return jsonResponse(res, 403, { error: 'Local Studio API only accepts localhost origins.' });
    }
    if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed.' });

    const body = await readRequestBody(req);
    const source = cleanText(body.source, 20);
    const id = cleanText(body.id, 180);
    validateTarget(source, id);

    if (req.url === '/__dev/personality-studio-api/draft') {
      const draft = normalizeDraft(body.draft);
      saveLocalDraft(source, id, draft);
      refreshSnapshot();
      return jsonResponse(res, 200, { ok: true, message: 'Rascunho local salvo.' });
    }

    if (req.url === '/__dev/personality-studio-api/discard') {
      discardLocalDraft(source, id);
      refreshSnapshot();
      return jsonResponse(res, 200, { ok: true, message: 'Rascunho local descartado.' });
    }

    if (req.url === '/__dev/personality-studio-api/portrait') {
      const draft = normalizeDraft(body.draft);
      await materializeCommonsPortrait(draft);
      saveLocalDraft(source, id, draft);
      refreshSnapshot();
      return jsonResponse(res, 200, { ok: true, message: 'Retrato do Commons salvo localmente.' });
    }

    if (req.url === '/__dev/personality-studio-api/validate') {
      if (source !== 'staging') {
        throw new Error('A validação manual é usada somente para entradas em staging.');
      }
      const statuses = await markStagingEditorialReady(id);
      refreshSnapshot();
      return jsonResponse(res, 200, {
        ok: true,
        message: 'Dados editoriais marcados como válidos. Profile e audit não foram alterados.',
        statuses,
      });
    }

    if (req.url === '/__dev/personality-studio-api/apply') {
      const draft = normalizeDraft(body.draft);
      if (source === 'runtime') applyRuntime(id, draft);
      else applyStaging(id, draft);
      discardLocalDraft(source, id);
      refreshSnapshot();
      return jsonResponse(res, 200, {
        ok: true,
        message: source === 'runtime'
          ? 'Alterações aplicadas aos arquivos de runtime.'
          : 'Alterações aplicadas aos arquivos de staging.',
      });
    }

    return jsonResponse(res, 404, { error: 'Unknown Studio API route.' });
  } catch (error) {
    return jsonResponse(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

mkdirSync(localRoot, { recursive: true });
refreshSnapshot();

api.listen(apiPort, '127.0.0.1', () => {
  console.log(`Personality Studio write API: http://127.0.0.1:${apiPort}`);
});

const viteBin = resolve(frontendRoot, 'node_modules/vite/bin/vite.js');
const forwardedArgs = process.argv.slice(2);
const viteArgs = process.env.CI
  ? [viteBin, ...forwardedArgs]
  : [viteBin, '--open', '/dev/personality-studio', ...forwardedArgs];
const vite = spawn(process.execPath, viteArgs, {
  cwd: frontendRoot,
  stdio: 'inherit',
});

function shutdown(code = 0) {
  api.close();
  if (!vite.killed) vite.kill('SIGTERM');
  process.exit(code);
}

vite.on('exit', (code) => shutdown(code ?? 0));
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

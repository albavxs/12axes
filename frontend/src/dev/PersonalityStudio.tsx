import { useEffect, useMemo, useState, type ReactNode } from 'react';
import '../styles/personality-studio.css';
import BookValidationStudio from './BookValidationStudio';

type Axis = { id: string; label: string; leftPole: string; rightPole: string };
type Translation = { id: string; name?: string; role?: string; description?: string };
type Profile = { personalityId: string; vector: Record<string, number> };
type Book = { personalityId?: string; title: { pt: string; en: string }; year?: number; url?: { pt?: string; en?: string } };
type Pipeline = {
  metadataStatus: string; portraitStatus: string; translationStatus: string;
  profileStatus: string; bookStatus: string; region?: string; period?: string;
};
type EditableDraft = {
  pt: { name: string; role: string; category: string; lifespan: string; description: string };
  en: { name: string; role: string; description: string };
  portrait: { path: string; sourceFile: string; sourceName: string; sourceUrl: string; note: string; license: string; attribution: string };
  book: { enabled: boolean; titlePt: string; titleEn: string; year: string };
  savedAt?: string;
};
type Personality = {
  source: 'runtime' | 'staging';
  pipeline: Pipeline | null;
  id: string; name: string; role: string; category: string;
  representation: 'male' | 'female'; lifespan: string; description: string;
  imagePath?: string; previewImagePath?: string; imageSourceFile?: string; imageSourceName?: string; imageSourceUrl?: string; imageSourceImageUrl?: string; imageNote?: string;
  translated: Translation | null; profile: Profile | null; auditProfile: Profile | null; auditProfileSource: 'draft' | 'archived' | null;
  proposalProfile: Profile | null; proposalProfileStatus: string | null; proposalProfileConfidence: string | null; book: Book | null;
  evidence: { sources?: unknown[]; evidence?: Record<string, unknown> } | null;
  evidenceReady: boolean;
  audit: { answerExists: boolean; pendingExists: boolean; packetExists: boolean };
  auditPlan?: { batch: number; position: number; totalPending: number } | null;
  editorial: {
    metadataValid: boolean; translationValid: boolean; portraitValid: boolean; bookValid: boolean;
    canMarkValid: boolean; isMarkedValid: boolean; status: 'error' | 'warning' | 'ok';
  };
  image: {
    exists: boolean; bytes: number | null; normalizedPath: string | null; error: string | null;
    metadata: { format: string | null; width: number | null; height: number | null } | null;
  };
  localDraft: EditableDraft | null;
  validation: { errors: string[]; warnings: string[]; status: 'error' | 'warning' | 'ok' };
};
type Payload = {
  generatedAt: string;
  axes: Axis[];
  stats: {
    totalEntries: number; runtime: number; staging: number; runtimeMale: number;
    runtimeFemale: number; plannedFemale: number; excludedFemale: number; replacementSlots: number; errors: number; warnings: number; ok: number; localDrafts: number;
    womenAuditDone: number; womenVectorReady: number; womenAuditPending: number; womenAuditReview: number; womenAuditBatches: number;
  };
  personalities: Personality[];
};

type RepresentationFilter = 'all' | 'male' | 'female';
type StatusFilter = 'all' | 'error' | 'warning' | 'ok';
type SourceFilter = 'all' | 'runtime' | 'staging';
type AuditFilter = 'all' | 'review' | 'archived';
type StudioLanguage = 'pt' | 'en';
type StudioTheme = 'light' | 'dark';
type SortOrder = 'az' | 'za';

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent' }) {
  return <span className={`studio-badge studio-badge--${tone}`}>{children}</span>;
}

function emptyDraft(personality: Personality): EditableDraft {
  const book = personality.book;
  return {
    pt: {
      name: personality.name ?? '',
      role: personality.role ?? '',
      category: personality.category ?? '',
      lifespan: personality.lifespan ?? '',
      description: personality.description ?? '',
    },
    en: {
      name: personality.translated?.name ?? personality.name ?? '',
      role: personality.translated?.role ?? '',
      description: personality.translated?.description ?? '',
    },
    portrait: {
      path: personality.imagePath ?? '',
      sourceFile: personality.imageSourceFile ?? '',
      sourceName: personality.imageSourceName ?? '',
      sourceUrl: personality.imageSourceUrl ?? '',
      note: personality.imageNote ?? '',
      license: '',
      attribution: '',
    },
    book: {
      enabled: Boolean(book),
      titlePt: book?.title?.pt ?? '',
      titleEn: book?.title?.en ?? '',
      year: book?.year ? String(book.year) : '',
    },
  };
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function PersonalityStudio() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [representation, setRepresentation] = useState<RepresentationFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [auditFilter, setAuditFilter] = useState<AuditFilter>('all');
  const [language, setLanguage] = useState<StudioLanguage>(() => (localStorage.getItem('personality-studio:language') as StudioLanguage) || 'pt');
  const [theme, setTheme] = useState<StudioTheme>(() => (localStorage.getItem('personality-studio:theme') as StudioTheme) || 'light');
  const [sortOrder, setSortOrder] = useState<SortOrder>('az');
  const [targetMen, setTargetMen] = useState<number>(() => Number(localStorage.getItem('personality-studio:target-men')) || 386);
  const [targetWomen, setTargetWomen] = useState<number>(() => Number(localStorage.getItem('personality-studio:target-women')) || 200);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditableDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [auditingAll, setAuditingAll] = useState(false);
  const [portraitBusy, setPortraitBusy] = useState(false);
  const [auditResult, setAuditResult] = useState<{ ok: boolean; message: string; output: string } | null>(null);
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  async function loadCatalog(preferredKey?: string | null) {
    await fetch('/__dev/personality-studio-api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    });
    const response = await fetch(`/__dev/personality-studio/catalog.json?t=${Date.now()}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load catalog');
    const next = body as Payload;
    setPayload(next);
    const first = next.personalities[0];
    setSelectedKey((current) => preferredKey ?? current ?? (first ? `${first.source}:${first.id}` : null));
    return next;
  }

  useEffect(() => {
    loadCatalog().catch((error: Error) => setLoadError(error.message));
  }, []);

  useEffect(() => {
    localStorage.setItem('personality-studio:language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('personality-studio:theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('personality-studio:target-men', String(targetMen));
    localStorage.setItem('personality-studio:target-women', String(targetWomen));
  }, [targetMen, targetWomen]);

  const ui = language === 'pt' ? {
    catalog: 'Catálogo',
    runtime: 'Runtime',
    staging: 'Staging',
    men: 'Homens',
    women: 'Mulheres',
    all: 'Todos',
    plannedWomen: 'Mulheres planejadas',
    errors: 'Erros',
    drafts: 'Rascunhos',
    womenAudits: 'auditorias',
    womenVectors: '12 eixos',
    auditQueue: 'na fila',
    auditReview: 'aguardando revisão',
    auditStates: 'Todas auditorias',
    auditReviewOnly: 'Aguardando revisão',
    auditArchivedOnly: 'Arquivadas',
    search: 'Buscar nome, id, função ou categoria…',
    states: 'Todos os estados',
    withError: 'Com erro',
    withWarning: 'Com aviso',
    clean: 'Limpos',
    visible: 'visíveis',
    composition: 'Composição',
    targetMen: 'Meta homens',
    targetWomen: 'Meta mulheres',
    current: 'atual',
    planned: 'planejado',
    excluded: 'excluídas do fluxo',
    remaining: 'faltam',
    edit: 'Editar informações',
    discard: 'Descartar rascunho',
    noPortrait: 'Sem retrato',
    noSource: 'origem não informada',
    roleMissing: 'Função ainda não preparada',
    descriptionMissing: 'Descrição ainda não preparada.',
    workflow: 'Workflow',
    pipeline: 'Pipeline da personalidade',
    validation: 'Validação',
    audit: 'Auditoria',
    english: 'Inglês',
    book: 'Livro',
    axes: 'Perfil em 12 eixos',
    readonly: 'resultado salvo · somente leitura',
    draftReadonly: 'vetor calculado das 240 respostas · aguardando sua revisão',
    proposalReadonly: 'proposta editorial baseada em evidências · ainda não validada pelas 240 perguntas',
    proposalReady: 'Proposta de 12 eixos pronta',
    axesHelp: 'Cada eixo vai de 0 (polo à esquerda) a 100 (polo à direita). Em drafts, o valor é calculado das 240 respostas + arquétipo.',
    noAxisProfile: 'Ainda não existem respostas suficientes para calcular os 12 eixos desta personalidade.',
    dataCard: 'Dados',
    photoCard: 'Foto',
    profileCard: 'Perfil 12 eixos',
    complete: 'Completo',
    needsReview: 'Precisa revisar',
    localPhoto: 'Foto local pronta',
    sourceReady: 'Fonte pronta para baixar',
    noPhotoSource: 'Sem fonte de foto',
    downloadPhoto: 'Baixar foto',
    downloadingPhoto: 'Baixando…',
    addPhotoSource: 'Adicionar fonte',
    searchCommons: 'Buscar no Commons',
    auditNotStarted: 'Auditoria não iniciada',
    auditPrepared: 'Ficha preparada',
    auditAnswersReady: 'Respostas disponíveis',
    auditComplete: 'Auditoria arquivada',
    prepareAudit: 'Preparar auditoria',
    preparingAudit: 'Preparando…',
    validateAnswers: 'Validar respostas',
    technicalDetails: 'Detalhes técnicos',

    noIssues: 'Nenhum problema detectado.',
    permanentAnswers: 'Respostas permanentes',
    pendingOutput: 'Saída pendente',
    runAudit: 'Rodar auditoria',
    runningAudit: 'Auditando…',
    auditRunnerHint: 'Valida as 240 respostas existentes com o validador do projeto; não gera pontuação automaticamente.',
    validateAllAudits: 'Pré-validar 188 audits',
    validatingAllAudits: 'Pré-validando…',
    dossier: 'Dossiê',
    sources: 'Fontes',
    evidenceFields: 'Campos de evidência',
    yes: 'sim',
    no: 'não',
    noEnglish: 'Sem entrada em inglês.',
    noBook: 'Sem livro cadastrado/preparado.',
    select: 'Selecione uma personalidade.',
    sortAZ: 'A → Z',
    sortZA: 'Z → A',
    sourceAll: 'Runtime + staging',
    localTool: 'Studio local',
    snapshot: 'snapshot',
    downloadPendingPortraits: 'Baixar fotos pendentes',
    evidenceGate: 'EVIDENCE',
    markValid: 'Marcar como válido',
    markedValid: 'Validado ✓',
    completeBeforeValidation: 'Complete metadata, EN e retrato local',
    editorialData: 'Dados editoriais',
    metadataGate: 'META',
    translationGate: 'EN',
    portraitGate: 'IMG',
    profileGate: 'PROFILE',
    auditGate: 'AUDIT',
    readyGate: 'ready',
    pendingGate: 'pending',
    localEdit: 'Edição local',
    runtimeCatalog: 'Catálogo em runtime',
    stagingPipeline: 'Pipeline de staging',
    vectorsReadonly: 'vetores não são editáveis aqui',
    close: 'Fechar',
    portuguese: 'Português',
    name: 'Nome',
    role: 'Função',
    category: 'Categoria',
    lifespan: 'Período de vida',
    description: 'Descrição',
    portrait: 'Retrato',
    localPath: 'Path local',
    localPathHint: 'Ex.: /personalities/portraits/nome.jpg',
    commonsFile: 'Arquivo no Commons',
    commonsFileHint: 'Ex.: Nome da Pessoa.jpg',
    sourceName: 'Nome da fonte',
    sourceUrl: 'URL da fonte',
    license: 'Licença',
    attribution: 'Atribuição',
    note: 'Nota',
    registerBook: 'Cadastrar livro para esta personalidade',
    titlePt: 'Título PT',
    titleEn: 'Título EN',
    year: 'Ano',
    localDraft: 'Rascunho local',
    localDraftHint: 'não altera o repositório e fica em .personality-studio/',
    downloadPortrait: 'Baixar retrato',
    saveDraft: 'Salvar rascunho',
    saving: 'Salvando…',
    applyRuntime: 'Aplicar no runtime',
    applyStaging: 'Aplicar no staging',
  } : {
    catalog: 'Catalog',
    runtime: 'Runtime',
    staging: 'Staging',
    men: 'Men',
    women: 'Women',
    all: 'All',
    plannedWomen: 'Women planned',
    errors: 'Errors',
    drafts: 'Drafts',
    womenAudits: 'audits',
    womenVectors: '12 axes',
    auditQueue: 'queued',
    auditReview: 'awaiting review',
    auditStates: 'All audits',
    auditReviewOnly: 'Awaiting review',
    auditArchivedOnly: 'Archived',
    search: 'Search name, id, role or category…',
    states: 'All states',
    withError: 'Errors',
    withWarning: 'Warnings',
    clean: 'Clean',
    visible: 'visible',
    composition: 'Composition',
    targetMen: 'Men target',
    targetWomen: 'Women target',
    current: 'current',
    planned: 'planned',
    excluded: 'excluded from workflow',
    remaining: 'remaining',
    edit: 'Edit information',
    discard: 'Discard draft',
    noPortrait: 'No portrait',
    noSource: 'source not provided',
    roleMissing: 'Role not prepared yet',
    descriptionMissing: 'Description not prepared yet.',
    workflow: 'Workflow',
    pipeline: 'Personality pipeline',
    validation: 'Validation',
    audit: 'Audit',
    english: 'English',
    book: 'Book',
    axes: '12-axis profile',
    readonly: 'saved result · read-only',
    draftReadonly: 'vector computed from the 240 answers · awaiting your review',
    axesHelp: 'Each axis runs from 0 (left pole) to 100 (right pole). For drafts, the value is computed from the 240 answers + archetype.',
    noAxisProfile: 'There are not enough audit answers to compute this personality’s 12-axis vector yet.',
    dataCard: 'Data',
    photoCard: 'Photo',
    profileCard: '12-axis profile',
    complete: 'Complete',
    needsReview: 'Needs review',
    localPhoto: 'Local photo ready',
    sourceReady: 'Source ready to download',
    noPhotoSource: 'No photo source',
    downloadPhoto: 'Download photo',
    downloadingPhoto: 'Downloading…',
    addPhotoSource: 'Add source',
    searchCommons: 'Search Commons',
    auditNotStarted: 'Audit not started',
    auditPrepared: 'Audit sheet prepared',
    auditAnswersReady: 'Answers available',
    auditComplete: 'Audit archived',
    prepareAudit: 'Prepare audit',
    preparingAudit: 'Preparing…',
    validateAnswers: 'Validate answers',
    technicalDetails: 'Technical details',

    noIssues: 'No issues detected.',
    permanentAnswers: 'Permanent answers',
    pendingOutput: 'Pending output',
    runAudit: 'Run audit',
    runningAudit: 'Auditing…',
    auditRunnerHint: 'Validates existing 240 answers with the project validator; it does not generate scores automatically.',
    validateAllAudits: 'Pre-validate 188 audits',
    validatingAllAudits: 'Pre-validating…',
    dossier: 'Dossier',
    sources: 'Sources',
    evidenceFields: 'Evidence fields',
    yes: 'yes',
    no: 'no',
    noEnglish: 'No English entry.',
    noBook: 'No book registered/staged.',
    select: 'Select a personality.',
    sortAZ: 'A → Z',
    sortZA: 'Z → A',
    sourceAll: 'Runtime + staging',
    localTool: 'Local Studio',
    snapshot: 'snapshot',
    downloadPendingPortraits: 'Download pending photos',
    evidenceGate: 'EVIDENCE',
    markValid: 'Mark as valid',
    markedValid: 'Validated ✓',
    completeBeforeValidation: 'Complete metadata, EN and local portrait',
    editorialData: 'Editorial data',
    metadataGate: 'META',
    translationGate: 'EN',
    portraitGate: 'IMG',
    profileGate: 'PROFILE',
    auditGate: 'AUDIT',
    readyGate: 'ready',
    pendingGate: 'pending',
    localEdit: 'Local editing',
    runtimeCatalog: 'Runtime catalog',
    stagingPipeline: 'Staging pipeline',
    vectorsReadonly: 'vectors are not editable here',
    close: 'Close',
    portuguese: 'Portuguese',
    name: 'Name',
    role: 'Role',
    category: 'Category',
    lifespan: 'Lifespan',
    description: 'Description',
    portrait: 'Portrait',
    localPath: 'Local path',
    localPathHint: 'Example: /personalities/portraits/name.jpg',
    commonsFile: 'Commons file',
    commonsFileHint: 'Example: Person Name.jpg',
    sourceName: 'Source name',
    sourceUrl: 'Source URL',
    license: 'License',
    attribution: 'Attribution',
    note: 'Note',
    registerBook: 'Register a book for this personality',
    titlePt: 'PT title',
    titleEn: 'EN title',
    year: 'Year',
    localDraft: 'Local draft',
    localDraftHint: 'does not change repository files and stays in .personality-studio/',
    downloadPortrait: 'Download portrait',
    saveDraft: 'Save draft',
    saving: 'Saving…',
    applyRuntime: 'Apply to runtime',
    applyStaging: 'Apply to staging',
  };

  const filtered = useMemo(() => {
    if (!payload) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return payload.personalities
      .filter((personality) => {
        if (representation !== 'all' && personality.representation !== representation) return false;
        if (source !== 'all' && personality.source !== source) return false;
        if (status !== 'all' && personality.validation.status !== status) return false;
        if (auditFilter === 'review' && (personality.audit.answerExists || !personality.audit.pendingExists)) return false;
        if (auditFilter === 'archived' && !personality.audit.answerExists) return false;
        if (!normalizedQuery) return true;
        return [personality.id, personality.name, personality.translated?.name, personality.role, personality.category]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        const aName = language === 'en' ? (a.translated?.name || a.name) : a.name;
        const bName = language === 'en' ? (b.translated?.name || b.name) : b.name;
        const result = aName.localeCompare(bName, language === 'pt' ? 'pt-BR' : 'en', { sensitivity: 'base' });
        return sortOrder === 'az' ? result : -result;
      });
  }, [payload, query, representation, source, status, auditFilter, sortOrder, language]);

  useEffect(() => {
    if (!filtered.length) return;
    if (!selectedKey || !filtered.some((personality) => `${personality.source}:${personality.id}` === selectedKey)) {
      setSelectedKey(`${filtered[0].source}:${filtered[0].id}`);
    }
  }, [filtered, selectedKey]);

  const selected = payload?.personalities.find((personality) => `${personality.source}:${personality.id}` === selectedKey) ?? null;

  useEffect(() => {
    setAuditResult(null);
  }, [selectedKey]);

  function openEditor() {
    if (!selected) return;
    setForm(selected.localDraft ?? emptyDraft(selected));
    setNotice(null);
    setEditing(true);
  }

  function setDraft(path: string, value: string | boolean) {
    setForm((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      const [group, field] = path.split('.') as [keyof EditableDraft, string];
      if (group === 'pt' && field in next.pt) (next.pt as Record<string, string>)[field] = String(value);
      if (group === 'en' && field in next.en) (next.en as Record<string, string>)[field] = String(value);
      if (group === 'portrait' && field in next.portrait) (next.portrait as Record<string, string>)[field] = String(value);
      if (group === 'book' && field === 'enabled') next.book.enabled = Boolean(value);
      if (group === 'book' && field !== 'enabled' && field in next.book) (next.book as unknown as Record<string, string>)[field] = String(value);
      return next;
    });
  }

  async function validateAllAuditDrafts() {
    setAuditingAll(true);
    setNotice(null);
    try {
      const response = await fetch('/__dev/personality-studio-api/audit-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'staging', id: 'bulk-audit' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not pre-validate audit drafts');
      const failedIds = Array.isArray(body.failed) ? body.failed.map((item: { id: string }) => item.id) : [];
      const suffix = failedIds.length ? ` Falharam: ${failedIds.slice(0, 12).join(', ')}${failedIds.length > 12 ? '…' : ''}` : '';
      setNotice({ tone: body.ok ? 'good' : 'bad', text: `${body.message}${suffix}` });
    } catch (error) {
      setNotice({ tone: 'bad', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setAuditingAll(false);
    }
  }

  async function downloadPendingPortraits() {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch('/__dev/personality-studio-api/portraits-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'staging', id: 'bulk-portraits' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not download portraits');
      await loadCatalog(selectedKey);
      setNotice({ tone: body.report?.failed?.length ? 'bad' : 'good', text: body.message });
    } catch (error) {
      setNotice({ tone: 'bad', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  async function downloadSelectedPortrait() {
    if (!selected || selected.source !== 'staging') return;
    setPortraitBusy(true);
    setNotice(null);
    try {
      const response = await fetch('/__dev/personality-studio-api/portrait-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: selected.source, id: selected.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not download portrait');
      await loadCatalog(selectedKey);
      setNotice({ tone: 'good', text: body.message });
    } catch (error) {
      setNotice({ tone: 'bad', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setPortraitBusy(false);
    }
  }

  async function runAudit() {
    if (!selected) return;
    setAuditing(true);
    setAuditResult(null);
    setNotice(null);
    try {
      const needsPreparation = !selected.audit.answerExists && !selected.audit.pendingExists;
      const endpoint = needsPreparation
        ? '/__dev/personality-studio-api/audit-prepare'
        : '/__dev/personality-studio-api/audit';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: selected.source, id: selected.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not run audit action');
      setAuditResult({
        ok: Boolean(body.ok),
        message: String(body.message || ''),
        output: String(body.output || body.path || ''),
      });
      setNotice({ tone: body.ok ? 'good' : 'bad', text: body.message });
      await loadCatalog(selectedKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAuditResult({ ok: false, message, output: '' });
      setNotice({ tone: 'bad', text: message });
    } finally {
      setAuditing(false);
    }
  }

  async function mutate(action: 'draft' | 'apply' | 'discard' | 'portrait' | 'validate') {
    if (!selected) return;
    if (action !== 'discard' && action !== 'validate' && !form) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`/__dev/personality-studio-api/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: selected.source,
          id: selected.id,
          ...(action === 'discard' || action === 'validate' ? {} : { draft: form }),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not save changes');
      const key = `${selected.source}:${selected.id}`;
      await loadCatalog(key);
      setNotice({ tone: 'good', text: body.message });
      if (action === 'apply' || action === 'discard') {
        setEditing(false);
        setForm(null);
      }
    } catch (error) {
      setNotice({ tone: 'bad', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return <main className="studio-shell" data-theme={theme}><section className="studio-empty"><h1>Personality Studio</h1><p>{loadError}</p><p>Run <code>npm run dev:studio</code> first.</p></section></main>;
  }
  if (!payload) {
    return <main className="studio-shell" data-theme={theme}><section className="studio-empty"><h1>Personality Studio</h1><p>Reading repository data…</p></section></main>;
  }

  return (
    <main className="studio-shell" data-theme={theme}>
      <header className="site-header studio-site-header">
        <a className="brand-lockup" href="/" aria-label="12 Axes">
          <span className="brand-num">12</span><span className="brand-word">Axes</span>
        </a>
        <div className="studio-title-inline">
          <strong>Personality Studio</strong>
          <span>{ui.localTool}</span>
        </div>
        <div className="studio-header-tools">
          <button className="studio-icon-button" type="button" onClick={() => setSortOrder((value) => value === 'az' ? 'za' : 'az')} title="Sort">
            {sortOrder === 'az' ? ui.sortAZ : ui.sortZA}
          </button>
          <button className="studio-icon-button" type="button" onClick={() => setLanguage((value) => value === 'pt' ? 'en' : 'pt')} title="Language">
            {language === 'pt' ? 'EN' : 'PT'}
          </button>
          <button className="studio-icon-button" type="button" onClick={() => setTheme((value) => value === 'light' ? 'dark' : 'light')} title="Theme">
            {theme === 'light' ? '◐' : '☀'}
          </button>
          <span className="studio-generated">{ui.snapshot} {new Date(payload.generatedAt).toLocaleTimeString(language === 'pt' ? 'pt-BR' : 'en-US')}</span>
        </div>
      </header>

      <section className="studio-workbar">
        <div className="studio-metrics-compact">
          <span><strong>{payload.stats.runtime}</strong>{ui.runtime}</span>
          <span><strong>{payload.stats.staging}</strong>{ui.staging}</span>
          <span><strong>{payload.stats.runtimeMale}</strong>{ui.men}</span>
          <span><strong>{payload.stats.plannedFemale}</strong>{ui.women}</span>
          <span className={payload.stats.errors ? 'has-error' : ''}><strong>{payload.stats.errors}</strong>{ui.errors}</span>
          <span><strong>{payload.stats.localDrafts}</strong>{ui.drafts}</span>
          <span><strong>{payload.stats.womenAuditDone}/200</strong>{ui.womenAudits}</span>
          <span><strong>{payload.stats.womenVectorReady}/200</strong>{ui.womenVectors}</span>
          <span><strong>{payload.stats.womenAuditReview}</strong>{ui.auditReview}</span>
        </div>
        <div className="studio-workbar-actions">
          <button className="studio-icon-button studio-bulk-button" type="button" disabled={auditingAll} onClick={validateAllAuditDrafts}>
            {auditingAll ? ui.validatingAllAudits : ui.validateAllAudits}
          </button>
          <button className="studio-icon-button studio-bulk-button" type="button" disabled={saving} onClick={downloadPendingPortraits}>{ui.downloadPendingPortraits}</button>
          <a className="studio-icon-button studio-link-button studio-bulk-button" href="#book-validation">{language === 'pt' ? 'Validar livros' : 'Validate books'}</a>
        </div>
        <div className="studio-composition">
          <span className="studio-composition-title">{ui.composition}</span>
          <label>
            <span>{ui.targetMen}</span>
            <input type="number" min="0" value={targetMen} onChange={(event) => setTargetMen(Math.max(0, Number(event.target.value) || 0))} />
            <small>{ui.current}: {payload.stats.runtimeMale} · {ui.remaining}: {Math.max(0, targetMen - payload.stats.runtimeMale)}</small>
          </label>
          <label>
            <span>{ui.targetWomen}</span>
            <input type="number" min="0" value={targetWomen} onChange={(event) => setTargetWomen(Math.max(0, Number(event.target.value) || 0))} />
            <small>{ui.planned}: {payload.stats.plannedFemale} · {ui.remaining}: {Math.max(0, targetWomen - payload.stats.plannedFemale)} · {ui.excluded}: {payload.stats.excludedFemale}</small>
          </label>
        </div>
      </section>

      <section className="studio-filter-card" aria-label="Catalog filters">
        <div className="studio-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui.search} aria-label="Search personalities" />
        </div>
        <div className="studio-segmented" aria-label="Representation">
          {([
            ['all', ui.all],
            ['male', ui.men],
            ['female', ui.women],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className={representation === value ? 'is-active' : ''} onClick={() => setRepresentation(value)}>{label}</button>
          ))}
        </div>
        <select value={source} onChange={(event) => setSource(event.target.value as SourceFilter)} aria-label="Filter by source">
          <option value="all">{ui.sourceAll}</option>
          <option value="runtime">{ui.runtime}</option>
          <option value="staging">{ui.staging}</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filter by validation state">
          <option value="all">{ui.states}</option>
          <option value="error">{ui.withError}</option>
          <option value="warning">{ui.withWarning}</option>
          <option value="ok">{ui.clean}</option>
        </select>
        <select value={auditFilter} onChange={(event) => setAuditFilter(event.target.value as AuditFilter)} aria-label="Filter by audit state">
          <option value="all">{ui.auditStates}</option>
          <option value="review">{ui.auditReviewOnly}</option>
          <option value="archived">{ui.auditArchivedOnly}</option>
        </select>
        <span className="studio-result-count">{filtered.length} {ui.visible}</span>
      </section>

      {notice ? <div className={`studio-notice studio-notice--${notice.tone}`}>{notice.text}</div> : null}

      <section className="studio-layout">
        <aside className="studio-list" aria-label="Personalities">
          {filtered.map((personality) => {
            const key = `${personality.source}:${personality.id}`;
            return (
              <button key={key} className={`studio-list-item ${key === selectedKey ? 'is-selected' : ''}`} onClick={() => setSelectedKey(key)} type="button">
                {personality.previewImagePath ? <img src={personality.previewImagePath} alt="" loading="lazy" /> : <span className="studio-image-placeholder">—</span>}
                <span className="studio-list-copy">
                  <strong>{language === 'en' ? (personality.translated?.name || personality.name) : personality.name}</strong>
                  <small>{personality.id} · {personality.source}</small>
                </span>
                {personality.localDraft ? <span className="studio-draft-dot" title="Rascunho local" /> : null}
                <span className={`studio-status-dot studio-status-dot--${personality.validation.status}`} aria-label={`qa ${personality.validation.status}`} />
              </button>
            );
          })}
          {!filtered.length && <p className="studio-list-empty">Nenhuma personalidade encontrada.</p>}
        </aside>

        <article className="studio-detail">
          {selected ? (
            <>
              <section className="studio-profile-head">
                {selected.previewImagePath ? <img className="studio-portrait" src={selected.previewImagePath} alt={selected.name} /> : <div className="studio-portrait studio-portrait--missing">{ui.noPortrait}</div>}
                <div className="studio-profile-copy">
                  <div className="studio-badges">
                    <Badge tone={selected.source === 'runtime' ? 'good' : 'warn'}>{selected.source}</Badge>
                    <Badge>{selected.representation === 'male' ? ui.men : ui.women}</Badge>
                    <Badge>{selected.category}</Badge>
                    <Badge tone={selected.validation.status === 'ok' ? 'good' : selected.validation.status === 'warning' ? 'warn' : 'bad'}>{selected.validation.status}</Badge>
                    {selected.localDraft ? <Badge tone="accent">rascunho local</Badge> : null}
                  </div>
                  <h2>{language === 'en' ? (selected.translated?.name || selected.name) : selected.name}</h2>
                  <p className="studio-role">{language === 'en' ? (selected.translated?.role || selected.role || ui.roleMissing) : (selected.role || ui.roleMissing)}{selected.lifespan ? ` · ${selected.lifespan}` : ''}</p>
                  <p>{language === 'en' ? (selected.translated?.description || selected.description || ui.descriptionMissing) : (selected.description || ui.descriptionMissing)}</p>
                  <div className="studio-profile-actions">
                    <button className="primary-button" type="button" onClick={openEditor}>{ui.edit}</button>
                    {selected.source === 'staging' && !selected.image.exists && selected.imageSourceUrl && (selected.imageSourceFile || selected.imageSourceImageUrl) ? (
                      <button className="secondary-button" type="button" onClick={downloadSelectedPortrait} disabled={portraitBusy}>
                        {portraitBusy ? ui.downloadingPhoto : ui.downloadPhoto}
                      </button>
                    ) : null}
                    {selected.source === 'staging' ? (
                      <button
                        className="secondary-button studio-validate-button"
                        type="button"
                        onClick={() => mutate('validate')}
                        disabled={saving || selected.editorial.isMarkedValid || !selected.editorial.canMarkValid}
                        title={!selected.editorial.canMarkValid ? ui.completeBeforeValidation : undefined}
                      >
                        {selected.editorial.isMarkedValid ? ui.markedValid : ui.markValid}
                      </button>
                    ) : null}
                    {selected.localDraft ? <button className="secondary-button" type="button" onClick={() => mutate('discard')} disabled={saving}>{ui.discard}</button> : null}
                  </div>
                  <div className="studio-action-grid">
                    <section className="studio-action-card">
                      <div>
                        <p className="studio-eyebrow">{ui.dataCard}</p>
                        <strong>{selected.editorial.metadataValid && selected.editorial.translationValid ? ui.complete : ui.needsReview}</strong>
                        <span>PT + EN</span>
                      </div>
                      <button className="studio-icon-button" type="button" onClick={openEditor}>{ui.edit}</button>
                    </section>

                    <section className="studio-action-card">
                      <div>
                        <p className="studio-eyebrow">{ui.photoCard}</p>
                        <strong>
                          {selected.image.exists
                            ? ui.localPhoto
                            : selected.imageSourceUrl && (selected.imageSourceFile || selected.imageSourceImageUrl)
                              ? ui.sourceReady
                              : ui.noPhotoSource}
                        </strong>
                        <span>
                          {selected.image.metadata?.width && selected.image.metadata?.height
                            ? `${selected.image.metadata.width}×${selected.image.metadata.height}`
                            : (selected.imageSourceName || ui.noSource)}
                        </span>
                      </div>
                      <div className="studio-action-buttons">
                        {selected.source === 'staging' && !selected.image.exists && selected.imageSourceUrl && (selected.imageSourceFile || selected.imageSourceImageUrl) ? (
                          <button className="studio-icon-button" type="button" onClick={downloadSelectedPortrait} disabled={portraitBusy}>
                            {portraitBusy ? ui.downloadingPhoto : ui.downloadPhoto}
                          </button>
                        ) : null}
                        {!selected.image.exists && (!selected.imageSourceUrl || (!selected.imageSourceFile && !selected.imageSourceImageUrl)) ? (
                          <>
                            <button className="studio-icon-button" type="button" onClick={openEditor}>{ui.addPhotoSource}</button>
                            <a
                              className="studio-icon-button studio-link-button"
                              href={`https://commons.wikimedia.org/wiki/Special:MediaSearch?type=image&search=${encodeURIComponent(selected.name)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {ui.searchCommons}
                            </a>
                          </>
                        ) : null}
                      </div>
                    </section>

                    <section className="studio-action-card">
                      <div>
                        <p className="studio-eyebrow">{ui.profileCard}</p>
                        <strong>
                          {selected.profile
                            ? (selected.source === 'staging' && selected.pipeline?.profileStatus !== 'ready' ? ui.proposalReady : ui.complete)
                            : selected.auditProfile
                              ? ui.auditAnswersReady
                              : selected.proposalProfile
                                ? ui.proposalReady
                                : selected.audit.answerExists
                              ? ui.auditComplete
                              : selected.audit.pendingExists
                                ? ui.auditAnswersReady
                                : selected.audit.packetExists
                                  ? ui.auditPrepared
                                  : ui.auditNotStarted}
                        </strong>
                        <span>
                          {selected.profile
                            ? (selected.source === 'staging' && selected.pipeline?.profileStatus !== 'ready' ? ui.proposalReadonly : ui.readonly)
                            : selected.auditProfile
                              ? ui.draftReadonly
                              : selected.proposalProfile
                                ? ui.proposalReadonly
                                : ui.noAxisProfile}
                          {selected.auditPlan?.batch ? ` · lote ${selected.auditPlan.batch}/${payload.stats.womenAuditBatches}` : ''}
                        </span>
                      </div>
                      {(!selected.profile || (selected.source === 'staging' && selected.pipeline?.profileStatus !== 'ready')) ? (
                        <button className="studio-icon-button" type="button" onClick={runAudit} disabled={auditing}>
                          {auditing
                            ? (selected.audit.answerExists || selected.audit.pendingExists ? ui.runningAudit : ui.preparingAudit)
                            : (selected.audit.answerExists || selected.audit.pendingExists ? ui.validateAnswers : ui.prepareAudit)}
                        </button>
                      ) : selected.audit.answerExists || selected.audit.pendingExists ? (
                        <button className="studio-icon-button" type="button" onClick={runAudit} disabled={auditing}>
                          {auditing ? ui.runningAudit : ui.validateAnswers}
                        </button>
                      ) : null}
                    </section>
                  </div>

                  <details className="studio-technical-details">
                    <summary>{ui.technicalDetails}</summary>
                    <div className="studio-gate-strip" aria-label={ui.editorialData}>
                      <Badge tone={selected.editorial.metadataValid ? 'good' : 'bad'}>{ui.metadataGate} {selected.pipeline?.metadataStatus ?? ui.readyGate}</Badge>
                      <Badge tone={selected.editorial.translationValid ? 'good' : 'bad'}>{ui.translationGate} {selected.pipeline?.translationStatus ?? ui.readyGate}</Badge>
                      <Badge tone={selected.image.exists && !selected.image.error ? 'good' : selected.imageSourceUrl ? 'warn' : 'bad'}>
                        {ui.portraitGate} {selected.image.exists && !selected.image.error ? 'local' : (selected.pipeline?.portraitStatus ?? ui.pendingGate)}
                      </Badge>
                      <Badge tone={selected.source === 'runtime' ? (selected.profile ? 'good' : 'bad') : (selected.pipeline?.profileStatus === 'ready' ? 'good' : 'warn')}>
                        {ui.profileGate} {selected.pipeline?.profileStatus ?? (selected.profile ? ui.readyGate : ui.pendingGate)}
                      </Badge>
                      <Badge tone={selected.evidenceReady ? 'good' : 'warn'}>{ui.evidenceGate} {selected.evidenceReady ? ui.readyGate : ui.pendingGate}</Badge>
                      <Badge tone={selected.audit.answerExists ? 'good' : 'warn'}>{ui.auditGate} {selected.audit.answerExists ? ui.readyGate : ui.pendingGate}</Badge>
                    </div>
                    <div className="studio-source">
                      <strong>Retrato:</strong>{' '}
                      {selected.imageSourceUrl ? <a href={selected.imageSourceUrl} target="_blank" rel="noreferrer">{selected.imageSourceName || selected.imageSourceUrl}</a> : ui.noSource}
                      {selected.image.bytes ? <span> · {Math.round(selected.image.bytes / 1024)} KB</span> : null}
                      {selected.image.metadata?.width && selected.image.metadata?.height ? <span> · {selected.image.metadata.width}×{selected.image.metadata.height}</span> : null}
                    </div>
                  </details>
                </div>
              </section>

              {selected.pipeline ? (
                <details className="studio-panel studio-pipeline-panel studio-pipeline-details">
                  <summary>{ui.workflow} · {ui.pipeline}</summary>
                  <div className="studio-pipeline-grid">
                    <span>metadata <strong>{selected.pipeline.metadataStatus}</strong></span>
                    <span>translation <strong>{selected.pipeline.translationStatus}</strong></span>
                    <span>portrait <strong>{selected.pipeline.portraitStatus}</strong></span>
                    <span>profile <strong>{selected.pipeline.profileStatus}</strong></span>
                    <span>book <strong>{selected.pipeline.bookStatus}</strong></span>
                    <span>{selected.pipeline.region} · {selected.pipeline.period}</span>
                  </div>
                </details>
              ) : null}

              <section className="studio-grid">
                <div className="studio-panel">
                  <div className="studio-panel-title"><p className="studio-eyebrow">QA</p><h3>{ui.validation}</h3></div>
                  {selected.validation.errors.length === 0 && selected.validation.warnings.length === 0 ? <p className="studio-ok">{ui.noIssues}</p> : null}
                  {selected.validation.errors.map((message) => <p key={message} className="studio-issue studio-issue--error">{message}</p>)}
                  {selected.validation.warnings.map((message) => <p key={message} className="studio-issue studio-issue--warning">{message}</p>)}
                </div>

                <div className="studio-panel">
                  <div className="studio-panel-title studio-panel-title--row">
                    <div><p className="studio-eyebrow">QA</p><h3>{ui.audit}</h3></div>
                    <button
                      className="studio-icon-button"
                      type="button"
                      onClick={runAudit}
                      disabled={auditing}
                      title={ui.auditRunnerHint}
                    >
                      {auditing
                        ? (selected.audit.answerExists || selected.audit.pendingExists ? ui.runningAudit : ui.preparingAudit)
                        : (selected.audit.answerExists || selected.audit.pendingExists ? ui.validateAnswers : ui.prepareAudit)}
                    </button>
                  </div>
                  <p className="studio-role">{selected.audit.answerExists || selected.audit.pendingExists ? ui.auditRunnerHint : (selected.audit.packetExists ? ui.auditPrepared : ui.auditNotStarted)}</p>
                  <dl className="studio-definition-list">
                    <div><dt>{ui.permanentAnswers}</dt><dd>{selected.audit.answerExists ? ui.yes : ui.no}</dd></div>
                    <div><dt>{ui.pendingOutput}</dt><dd>{selected.audit.pendingExists ? ui.yes : ui.no}</dd></div>
                    <div><dt>{ui.dossier}</dt><dd>{selected.evidence ? ui.yes : ui.no}</dd></div>
                    <div><dt>{ui.sources}</dt><dd>{selected.evidence?.sources?.length ?? 0}</dd></div>
                    <div><dt>{ui.evidenceFields}</dt><dd>{Object.keys(selected.evidence?.evidence ?? {}).length}</dd></div>
                  </dl>
                  {auditResult ? (
                    <div className={`studio-audit-result ${auditResult.ok ? 'studio-audit-result--good' : 'studio-audit-result--bad'}`}>
                      <strong>{auditResult.message}</strong>
                      {auditResult.output ? <pre>{auditResult.output}</pre> : null}
                    </div>
                  ) : null}
                </div>

                <div className="studio-panel">
                  <div className="studio-panel-title"><p className="studio-eyebrow">i18n</p><h3>{ui.english}</h3></div>
                  {selected.translated ? <><strong>{selected.translated.name || selected.name}</strong><p className="studio-role">{selected.translated.role || 'Função ausente'}</p><p>{selected.translated.description || 'Descrição ausente'}</p></> : <p>{ui.noEnglish}</p>}
                </div>

                <div className="studio-panel">
                  <div className="studio-panel-title"><p className="studio-eyebrow">ref</p><h3>{ui.book}</h3></div>
                  {selected.book ? <><strong>{selected.book.title.pt}</strong><p>{selected.book.title.en}</p><p className="studio-role">{selected.book.year ?? 'Ano não definido'}</p></> : <p>{ui.noBook}</p>}
                </div>
              </section>

              <section className="studio-panel studio-axis-panel">
                <div className="studio-panel-title studio-panel-title--row">
                  <div><p className="studio-eyebrow">profile</p><h3>{ui.axes}</h3></div>
                  {selected.profile || selected.auditProfile || selected.proposalProfile ? (
                    <span className="studio-readonly-label">
                      {selected.profile
                        ? (selected.source === 'staging' && selected.pipeline?.profileStatus !== 'ready' ? ui.proposalReadonly : ui.readonly)
                        : selected.auditProfile
                          ? ui.draftReadonly
                          : ui.proposalReadonly}
                    </span>
                  ) : null}
                </div>
                <p className="studio-axis-help">{ui.axesHelp}</p>
                {selected.profile || selected.auditProfile || selected.proposalProfile ? (
                  <div className="studio-axes">
                    {payload.axes.map((axis) => {
                      const activeProfile = selected.profile ?? selected.auditProfile ?? selected.proposalProfile;
                      const value = activeProfile?.vector[axis.id];
                      const position = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 50;
                      return (
                        <div className="studio-axis-row" key={axis.id}>
                          <div className="studio-axis-label">
                            <strong>{axis.label}</strong>
                            <span className="studio-axis-value">{typeof value === 'number' ? value.toFixed(1) : '—'}</span>
                          </div>
                          <div className="studio-axis-track studio-axis-track--marker">
                            <span className="studio-axis-midpoint" aria-hidden="true" />
                            <span className="studio-axis-marker" style={{ left: `${position}%` }} aria-hidden="true" />
                          </div>
                          <div className="studio-axis-poles">
                            <span><b>0</b> · {axis.leftPole}</span>
                            <span><b>100</b> · {axis.rightPole}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="studio-axis-empty">
                    <strong>{ui.noAxisProfile}</strong>
                    <span>{selected.audit.answerExists || selected.audit.pendingExists ? ui.auditAnswersReady : selected.audit.packetExists ? ui.auditPrepared : ui.auditNotStarted}</span>
                    <button className="secondary-button" type="button" onClick={runAudit} disabled={auditing}>
                      {auditing
                        ? (selected.audit.answerExists || selected.audit.pendingExists ? ui.runningAudit : ui.preparingAudit)
                        : (selected.audit.answerExists || selected.audit.pendingExists ? ui.validateAnswers : ui.prepareAudit)}
                    </button>
                  </div>
                )}
              </section>
            </>
          ) : <div className="studio-empty">{ui.select}</div>}
        </article>
      </section>

      <BookValidationStudio personalities={payload.personalities} language={language} />

      {editing && selected && form ? (
        <div className="studio-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditing(false); }}>
          <section className="studio-editor" role="dialog" aria-modal="true" aria-label={`${ui.edit} ${selected.name}`}>
            <header className="studio-editor-header">
              <div><p className="studio-eyebrow">{ui.localEdit}</p><h2>{selected.name}</h2><p>{selected.source === 'runtime' ? ui.runtimeCatalog : ui.stagingPipeline} · {ui.vectorsReadonly}.</p></div>
              <button type="button" className="studio-close" onClick={() => setEditing(false)} aria-label={ui.close}>×</button>
            </header>

            <div className="studio-editor-body">
              <fieldset className="studio-editor-section">
                <legend>{ui.portuguese}</legend>
                <div className="studio-form-grid">
                  <Field label={ui.name}><input value={form.pt.name} onChange={(e) => setDraft('pt.name', e.target.value)} /></Field>
                  <Field label={ui.role}><input value={form.pt.role} onChange={(e) => setDraft('pt.role', e.target.value)} /></Field>
                  <Field label={ui.category}><input value={form.pt.category} onChange={(e) => setDraft('pt.category', e.target.value)} /></Field>
                  <Field label={ui.lifespan}><input value={form.pt.lifespan} onChange={(e) => setDraft('pt.lifespan', e.target.value)} /></Field>
                </div>
                <Field label={ui.description}><textarea rows={4} value={form.pt.description} onChange={(e) => setDraft('pt.description', e.target.value)} /></Field>
              </fieldset>

              <fieldset className="studio-editor-section">
                <legend>English</legend>
                <div className="studio-form-grid">
                  <Field label="Name"><input value={form.en.name} onChange={(e) => setDraft('en.name', e.target.value)} /></Field>
                  <Field label="Role"><input value={form.en.role} onChange={(e) => setDraft('en.role', e.target.value)} /></Field>
                </div>
                <Field label="Description"><textarea rows={4} value={form.en.description} onChange={(e) => setDraft('en.description', e.target.value)} /></Field>
              </fieldset>

              <fieldset className="studio-editor-section">
                <legend>{ui.portrait}</legend>
                <div className="studio-form-grid">
                  <Field label={ui.localPath} hint={ui.localPathHint}><input value={form.portrait.path} onChange={(e) => setDraft('portrait.path', e.target.value)} /></Field>
                  <Field label={ui.commonsFile} hint={ui.commonsFileHint}><input value={form.portrait.sourceFile} onChange={(e) => setDraft('portrait.sourceFile', e.target.value)} /></Field>
                  <Field label={ui.sourceName}><input value={form.portrait.sourceName} onChange={(e) => setDraft('portrait.sourceName', e.target.value)} /></Field>
                  <Field label={ui.sourceUrl}><input value={form.portrait.sourceUrl} onChange={(e) => setDraft('portrait.sourceUrl', e.target.value)} /></Field>
                  <Field label={ui.license} hint={selected.source === 'runtime' ? (language === 'pt' ? 'Guardada no rascunho; runtime atual usa imageNote/source.' : 'Stored in the draft; current runtime uses imageNote/source.') : undefined}><input value={form.portrait.license} onChange={(e) => setDraft('portrait.license', e.target.value)} /></Field>
                  <Field label={ui.attribution}><input value={form.portrait.attribution} onChange={(e) => setDraft('portrait.attribution', e.target.value)} /></Field>
                </div>
                <Field label={ui.note}><textarea rows={3} value={form.portrait.note} onChange={(e) => setDraft('portrait.note', e.target.value)} /></Field>
              </fieldset>

              <fieldset className="studio-editor-section">
                <legend>{ui.book}</legend>
                <label className="studio-checkbox"><input type="checkbox" checked={form.book.enabled} onChange={(e) => setDraft('book.enabled', e.target.checked)} /><span>{ui.registerBook}</span></label>
                {form.book.enabled ? (
                  <div className="studio-form-grid">
                    <Field label={ui.titlePt}><input value={form.book.titlePt} onChange={(e) => setDraft('book.titlePt', e.target.value)} /></Field>
                    <Field label={ui.titleEn}><input value={form.book.titleEn} onChange={(e) => setDraft('book.titleEn', e.target.value)} /></Field>
                    <Field label={ui.year}><input inputMode="numeric" value={form.book.year} onChange={(e) => setDraft('book.year', e.target.value)} /></Field>
                  </div>
                ) : null}
              </fieldset>
            </div>

            <footer className="studio-editor-footer">
              <div>
                <strong>{ui.localDraft}</strong>
                <span>{ui.localDraftHint}</span>
              </div>
              <div className="studio-editor-actions">
                <button className="secondary-button" type="button" disabled={saving || !form.portrait.sourceUrl || !form.portrait.path} onClick={() => mutate('portrait')}>{ui.downloadPortrait}</button>
                <button className="secondary-button" type="button" disabled={saving} onClick={() => mutate('draft')}>{ui.saveDraft}</button>
                <button className="primary-button" type="button" disabled={saving} onClick={() => mutate('apply')}>{saving ? ui.saving : selected.source === 'runtime' ? ui.applyRuntime : ui.applyStaging}</button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default PersonalityStudio;

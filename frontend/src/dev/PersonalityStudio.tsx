import { useEffect, useMemo, useState, type ReactNode } from 'react';
import '../styles/personality-studio.css';

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
  portrait: { path: string; sourceName: string; sourceUrl: string; note: string; license: string; attribution: string };
  book: { enabled: boolean; titlePt: string; titleEn: string; year: string };
  savedAt?: string;
};
type Personality = {
  source: 'runtime' | 'staging';
  pipeline: Pipeline | null;
  id: string; name: string; role: string; category: string;
  representation: 'male' | 'female'; lifespan: string; description: string;
  imagePath?: string; imageSourceName?: string; imageSourceUrl?: string; imageNote?: string;
  translated: Translation | null; profile: Profile | null; book: Book | null;
  evidence: { sources?: unknown[]; evidence?: Record<string, unknown> } | null;
  audit: { answerExists: boolean; pendingExists: boolean };
  image: {
    exists: boolean; bytes: number | null; normalizedPath: string | null;
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
    runtimeFemale: number; plannedFemale: number; errors: number; warnings: number; ok: number; localDrafts: number;
  };
  personalities: Personality[];
};

type RepresentationFilter = 'all' | 'male' | 'female';
type StatusFilter = 'all' | 'error' | 'warning' | 'ok';
type SourceFilter = 'all' | 'runtime' | 'staging';
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
  const [language, setLanguage] = useState<StudioLanguage>(() => (localStorage.getItem('personality-studio:language') as StudioLanguage) || 'pt');
  const [theme, setTheme] = useState<StudioTheme>(() => (localStorage.getItem('personality-studio:theme') as StudioTheme) || 'light');
  const [sortOrder, setSortOrder] = useState<SortOrder>('az');
  const [targetMen, setTargetMen] = useState<number>(() => Number(localStorage.getItem('personality-studio:target-men')) || 386);
  const [targetWomen, setTargetWomen] = useState<number>(() => Number(localStorage.getItem('personality-studio:target-women')) || 200);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditableDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  async function loadCatalog(preferredKey?: string | null) {
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
    axes: '12 eixos',
    readonly: 'somente leitura · vem da auditoria',
    noIssues: 'Nenhum problema detectado.',
    permanentAnswers: 'Respostas permanentes',
    pendingOutput: 'Saída pendente',
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
    axes: '12 axes',
    readonly: 'read-only · comes from audit',
    noIssues: 'No issues detected.',
    permanentAnswers: 'Permanent answers',
    pendingOutput: 'Pending output',
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
  };

  const filtered = useMemo(() => {
    if (!payload) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return payload.personalities
      .filter((personality) => {
        if (representation !== 'all' && personality.representation !== representation) return false;
        if (source !== 'all' && personality.source !== source) return false;
        if (status !== 'all' && personality.validation.status !== status) return false;
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
  }, [payload, query, representation, source, status, sortOrder, language]);

  useEffect(() => {
    if (!filtered.length) return;
    if (!selectedKey || !filtered.some((personality) => `${personality.source}:${personality.id}` === selectedKey)) {
      setSelectedKey(`${filtered[0].source}:${filtered[0].id}`);
    }
  }, [filtered, selectedKey]);

  const selected = payload?.personalities.find((personality) => `${personality.source}:${personality.id}` === selectedKey) ?? null;

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

  async function mutate(action: 'draft' | 'apply' | 'discard') {
    if (!selected) return;
    if (action !== 'discard' && !form) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`/__dev/personality-studio-api/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: selected.source,
          id: selected.id,
          ...(action === 'discard' ? {} : { draft: form }),
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
            <small>{ui.planned}: {payload.stats.plannedFemale} · {ui.remaining}: {Math.max(0, targetWomen - payload.stats.plannedFemale)}</small>
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
        <span className="studio-result-count">{filtered.length} {ui.visible}</span>
      </section>

      {notice ? <div className={`studio-notice studio-notice--${notice.tone}`}>{notice.text}</div> : null}

      <section className="studio-layout">
        <aside className="studio-list" aria-label="Personalities">
          {filtered.map((personality) => {
            const key = `${personality.source}:${personality.id}`;
            return (
              <button key={key} className={`studio-list-item ${key === selectedKey ? 'is-selected' : ''}`} onClick={() => setSelectedKey(key)} type="button">
                {personality.imagePath ? <img src={personality.imagePath} alt="" loading="lazy" /> : <span className="studio-image-placeholder">—</span>}
                <span className="studio-list-copy">
                  <strong>{language === 'en' ? (personality.translated?.name || personality.name) : personality.name}</strong>
                  <small>{personality.id} · {personality.source}</small>
                </span>
                {personality.localDraft ? <span className="studio-draft-dot" title="Rascunho local" /> : null}
                <span className={`studio-status-dot studio-status-dot--${personality.validation.status}`} aria-label={personality.validation.status} />
              </button>
            );
          })}
          {!filtered.length && <p className="studio-list-empty">Nenhuma personalidade encontrada.</p>}
        </aside>

        <article className="studio-detail">
          {selected ? (
            <>
              <section className="studio-profile-head">
                {selected.imagePath ? <img className="studio-portrait" src={selected.imagePath} alt={selected.name} /> : <div className="studio-portrait studio-portrait--missing">{ui.noPortrait}</div>}
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
                    {selected.localDraft ? <button className="secondary-button" type="button" onClick={() => mutate('discard')} disabled={saving}>{ui.discard}</button> : null}
                  </div>
                  <div className="studio-source">
                    <strong>Retrato:</strong>{' '}
                    {selected.imageSourceUrl ? <a href={selected.imageSourceUrl} target="_blank" rel="noreferrer">{selected.imageSourceName || selected.imageSourceUrl}</a> : ui.noSource}
                    {selected.image.bytes ? <span> · {Math.round(selected.image.bytes / 1024)} KB</span> : null}
                    {selected.image.metadata?.width && selected.image.metadata?.height ? <span> · {selected.image.metadata.width}×{selected.image.metadata.height}</span> : null}
                  </div>
                </div>
              </section>

              {selected.pipeline ? (
                <section className="studio-panel studio-pipeline-panel">
                  <div className="studio-panel-title"><p className="studio-eyebrow">{ui.workflow}</p><h3>{ui.pipeline}</h3></div>
                  <div className="studio-pipeline-grid">
                    <span>metadata <strong>{selected.pipeline.metadataStatus}</strong></span>
                    <span>translation <strong>{selected.pipeline.translationStatus}</strong></span>
                    <span>portrait <strong>{selected.pipeline.portraitStatus}</strong></span>
                    <span>profile <strong>{selected.pipeline.profileStatus}</strong></span>
                    <span>book <strong>{selected.pipeline.bookStatus}</strong></span>
                    <span>{selected.pipeline.region} · {selected.pipeline.period}</span>
                  </div>
                </section>
              ) : null}

              <section className="studio-grid">
                <div className="studio-panel">
                  <div className="studio-panel-title"><p className="studio-eyebrow">QA</p><h3>{ui.validation}</h3></div>
                  {selected.validation.errors.length === 0 && selected.validation.warnings.length === 0 ? <p className="studio-ok">{ui.noIssues}</p> : null}
                  {selected.validation.errors.map((message) => <p key={message} className="studio-issue studio-issue--error">{message}</p>)}
                  {selected.validation.warnings.map((message) => <p key={message} className="studio-issue studio-issue--warning">{message}</p>)}
                </div>

                <div className="studio-panel">
                  <div className="studio-panel-title"><p className="studio-eyebrow">QA</p><h3>{ui.audit}</h3></div>
                  <dl className="studio-definition-list">
                    <div><dt>{ui.permanentAnswers}</dt><dd>{selected.audit.answerExists ? ui.yes : ui.no}</dd></div>
                    <div><dt>{ui.pendingOutput}</dt><dd>{selected.audit.pendingExists ? ui.yes : ui.no}</dd></div>
                    <div><dt>{ui.dossier}</dt><dd>{selected.evidence ? ui.yes : ui.no}</dd></div>
                    <div><dt>{ui.sources}</dt><dd>{selected.evidence?.sources?.length ?? 0}</dd></div>
                    <div><dt>{ui.evidenceFields}</dt><dd>{Object.keys(selected.evidence?.evidence ?? {}).length}</dd></div>
                  </dl>
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
                  <span className="studio-readonly-label">{ui.readonly}</span>
                </div>
                {selected.profile ? (
                  <div className="studio-axes">
                    {payload.axes.map((axis) => {
                      const value = selected.profile?.vector[axis.id];
                      return (
                        <div className="studio-axis-row" key={axis.id}>
                          <div className="studio-axis-label"><strong>{axis.label}</strong><span>{typeof value === 'number' ? value.toFixed(1) : 'missing'}</span></div>
                          <div className="studio-axis-poles"><span>{axis.leftPole}</span><span>{axis.rightPole}</span></div>
                          <div className="studio-axis-track"><div className="studio-axis-fill" style={{ width: `${typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 0}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p>{selected.source === 'staging' ? `Ainda fora do runtime. profileStatus=${selected.pipeline?.profileStatus ?? 'unknown'}.` : 'Sem vetor de perfil.'}</p>}
              </section>
            </>
          ) : <div className="studio-empty">{ui.select}</div>}
        </article>
      </section>

      {editing && selected && form ? (
        <div className="studio-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditing(false); }}>
          <section className="studio-editor" role="dialog" aria-modal="true" aria-label={`Editar ${selected.name}`}>
            <header className="studio-editor-header">
              <div><p className="studio-eyebrow">Edição local</p><h2>{selected.name}</h2><p>{selected.source === 'runtime' ? 'Catálogo em runtime' : 'Pipeline de staging'} · vetores não são editáveis aqui.</p></div>
              <button type="button" className="studio-close" onClick={() => setEditing(false)} aria-label="Fechar">×</button>
            </header>

            <div className="studio-editor-body">
              <fieldset className="studio-editor-section">
                <legend>Português</legend>
                <div className="studio-form-grid">
                  <Field label="Nome"><input value={form.pt.name} onChange={(e) => setDraft('pt.name', e.target.value)} /></Field>
                  <Field label="Função"><input value={form.pt.role} onChange={(e) => setDraft('pt.role', e.target.value)} /></Field>
                  <Field label="Categoria"><input value={form.pt.category} onChange={(e) => setDraft('pt.category', e.target.value)} /></Field>
                  <Field label="Período de vida"><input value={form.pt.lifespan} onChange={(e) => setDraft('pt.lifespan', e.target.value)} /></Field>
                </div>
                <Field label="Descrição"><textarea rows={4} value={form.pt.description} onChange={(e) => setDraft('pt.description', e.target.value)} /></Field>
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
                <legend>Retrato</legend>
                <div className="studio-form-grid">
                  <Field label="Path local" hint="Ex.: /personalities/portraits/nome.jpg"><input value={form.portrait.path} onChange={(e) => setDraft('portrait.path', e.target.value)} /></Field>
                  <Field label="Nome da fonte"><input value={form.portrait.sourceName} onChange={(e) => setDraft('portrait.sourceName', e.target.value)} /></Field>
                  <Field label="URL da fonte"><input value={form.portrait.sourceUrl} onChange={(e) => setDraft('portrait.sourceUrl', e.target.value)} /></Field>
                  <Field label="Licença" hint={selected.source === 'runtime' ? 'Guardada no rascunho; runtime atual usa imageNote/source.' : undefined}><input value={form.portrait.license} onChange={(e) => setDraft('portrait.license', e.target.value)} /></Field>
                  <Field label="Atribuição"><input value={form.portrait.attribution} onChange={(e) => setDraft('portrait.attribution', e.target.value)} /></Field>
                </div>
                <Field label="Nota"><textarea rows={3} value={form.portrait.note} onChange={(e) => setDraft('portrait.note', e.target.value)} /></Field>
              </fieldset>

              <fieldset className="studio-editor-section">
                <legend>Livro</legend>
                <label className="studio-checkbox"><input type="checkbox" checked={form.book.enabled} onChange={(e) => setDraft('book.enabled', e.target.checked)} /><span>Cadastrar livro para esta personalidade</span></label>
                {form.book.enabled ? (
                  <div className="studio-form-grid">
                    <Field label="Título PT"><input value={form.book.titlePt} onChange={(e) => setDraft('book.titlePt', e.target.value)} /></Field>
                    <Field label="Título EN"><input value={form.book.titleEn} onChange={(e) => setDraft('book.titleEn', e.target.value)} /></Field>
                    <Field label="Ano"><input inputMode="numeric" value={form.book.year} onChange={(e) => setDraft('book.year', e.target.value)} /></Field>
                  </div>
                ) : null}
              </fieldset>
            </div>

            <footer className="studio-editor-footer">
              <div>
                <strong>Rascunho local</strong>
                <span>não altera o repositório e fica em .personality-studio/</span>
              </div>
              <div className="studio-editor-actions">
                <button className="secondary-button" type="button" disabled={saving} onClick={() => mutate('draft')}>Salvar rascunho</button>
                <button className="primary-button" type="button" disabled={saving} onClick={() => mutate('apply')}>{saving ? 'Salvando…' : selected.source === 'runtime' ? 'Aplicar no runtime' : 'Aplicar no staging'}</button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default PersonalityStudio;

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

  const filtered = useMemo(() => {
    if (!payload) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return payload.personalities.filter((personality) => {
      if (representation !== 'all' && personality.representation !== representation) return false;
      if (source !== 'all' && personality.source !== source) return false;
      if (status !== 'all' && personality.validation.status !== status) return false;
      if (!normalizedQuery) return true;
      return [personality.id, personality.name, personality.role, personality.category]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [payload, query, representation, source, status]);

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
    return <main className="studio-shell"><section className="studio-empty"><h1>Personality Studio</h1><p>{loadError}</p><p>Run <code>npm run dev:studio</code> first.</p></section></main>;
  }
  if (!payload) {
    return <main className="studio-shell"><section className="studio-empty"><h1>Personality Studio</h1><p>Reading repository data…</p></section></main>;
  }

  return (
    <main className="studio-shell">
      <header className="site-header studio-site-header">
        <a className="brand-lockup" href="/" aria-label="12 Axes">
          <span className="brand-num">12</span>
          <span className="brand-word">Axes</span>
        </a>
        <div className="studio-header-tools">
          <Badge tone="accent">local contributor tool</Badge>
          <span className="studio-generated">snapshot {new Date(payload.generatedAt).toLocaleTimeString()}</span>
        </div>
      </header>

      <section className="studio-hero">
        <div>
          <p className="intro-eyebrow"><strong>Personality Studio</strong><small>QA editorial</small></p>
          <h1>Revise o catálogo <em>antes do merge.</em></h1>
          <p className="intro-lead">Metadados, tradução, retratos, livros, auditorias e vetores em um painel local que segue a mesma linguagem visual do 12 Axes.</p>
        </div>
        <div className="studio-summary">
          <div className="studio-stat-card"><strong>{payload.stats.runtime}</strong><span>Runtime</span></div>
          <div className="studio-stat-card"><strong>{payload.stats.staging}</strong><span>Staging</span></div>
          <div className="studio-stat-card"><strong>{payload.stats.runtimeMale}</strong><span>Homens</span></div>
          <div className="studio-stat-card"><strong>{payload.stats.plannedFemale}</strong><span>Mulheres planejadas</span></div>
          <div className="studio-stat-card studio-stat-card--critical"><strong>{payload.stats.errors}</strong><span>Erros</span></div>
          <div className="studio-stat-card"><strong>{payload.stats.localDrafts}</strong><span>Rascunhos locais</span></div>
        </div>
      </section>

      <section className="studio-filter-card" aria-label="Catalog filters">
        <div className="studio-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, id, função ou categoria…" aria-label="Search personalities" />
        </div>
        <div className="studio-segmented" aria-label="Filtrar por representação">
          {([
            ['all', 'Todos'],
            ['male', 'Homens'],
            ['female', 'Mulheres'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className={representation === value ? 'is-active' : ''} onClick={() => setRepresentation(value)}>{label}</button>
          ))}
        </div>
        <select value={source} onChange={(event) => setSource(event.target.value as SourceFilter)} aria-label="Filter by source">
          <option value="all">Runtime + staging</option>
          <option value="runtime">Runtime</option>
          <option value="staging">Staging</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filter by validation state">
          <option value="all">Todos os estados</option>
          <option value="error">Com erro</option>
          <option value="warning">Com aviso</option>
          <option value="ok">Limpos</option>
        </select>
        <span className="studio-result-count">{filtered.length} visíveis</span>
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
                  <strong>{personality.name}</strong>
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
                {selected.imagePath ? <img className="studio-portrait" src={selected.imagePath} alt={selected.name} /> : <div className="studio-portrait studio-portrait--missing">Sem retrato</div>}
                <div className="studio-profile-copy">
                  <div className="studio-badges">
                    <Badge tone={selected.source === 'runtime' ? 'good' : 'warn'}>{selected.source}</Badge>
                    <Badge>{selected.representation === 'male' ? 'homem' : 'mulher'}</Badge>
                    <Badge>{selected.category}</Badge>
                    <Badge tone={selected.validation.status === 'ok' ? 'good' : selected.validation.status === 'warning' ? 'warn' : 'bad'}>{selected.validation.status}</Badge>
                    {selected.localDraft ? <Badge tone="accent">rascunho local</Badge> : null}
                  </div>
                  <h2>{selected.name}</h2>
                  <p className="studio-role">{selected.role || 'Função ainda não preparada'}{selected.lifespan ? ` · ${selected.lifespan}` : ''}</p>
                  <p>{selected.description || 'Descrição ainda não preparada.'}</p>
                  <div className="studio-profile-actions">
                    <button className="primary-button" type="button" onClick={openEditor}>Editar informações</button>
                    {selected.localDraft ? <button className="secondary-button" type="button" onClick={() => mutate('discard')} disabled={saving}>Descartar rascunho</button> : null}
                  </div>
                  <div className="studio-source">
                    <strong>Retrato:</strong>{' '}
                    {selected.imageSourceUrl ? <a href={selected.imageSourceUrl} target="_blank" rel="noreferrer">{selected.imageSourceName || selected.imageSourceUrl}</a> : 'origem não informada'}
                    {selected.image.bytes ? <span> · {Math.round(selected.image.bytes / 1024)} KB</span> : null}
                    {selected.image.metadata?.width && selected.image.metadata?.height ? <span> · {selected.image.metadata.width}×{selected.image.metadata.height}</span> : null}
                  </div>
                </div>
              </section>

              {selected.pipeline ? (
                <section className="studio-panel studio-pipeline-panel">
                  <div className="studio-panel-title"><p className="studio-eyebrow">Workflow</p><h3>Pipeline da personalidade</h3></div>
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
                  <div className="studio-panel-title"><p className="studio-eyebrow">QA</p><h3>Validação</h3></div>
                  {selected.validation.errors.length === 0 && selected.validation.warnings.length === 0 ? <p className="studio-ok">Nenhum problema detectado.</p> : null}
                  {selected.validation.errors.map((message) => <p key={message} className="studio-issue studio-issue--error">{message}</p>)}
                  {selected.validation.warnings.map((message) => <p key={message} className="studio-issue studio-issue--warning">{message}</p>)}
                </div>

                <div className="studio-panel">
                  <div className="studio-panel-title"><p className="studio-eyebrow">Evidência</p><h3>Auditoria</h3></div>
                  <dl className="studio-definition-list">
                    <div><dt>Respostas permanentes</dt><dd>{selected.audit.answerExists ? 'sim' : 'não'}</dd></div>
                    <div><dt>Saída pendente</dt><dd>{selected.audit.pendingExists ? 'sim' : 'não'}</dd></div>
                    <div><dt>Dossiê</dt><dd>{selected.evidence ? 'sim' : 'não'}</dd></div>
                    <div><dt>Fontes</dt><dd>{selected.evidence?.sources?.length ?? 0}</dd></div>
                    <div><dt>Campos de evidência</dt><dd>{Object.keys(selected.evidence?.evidence ?? {}).length}</dd></div>
                  </dl>
                </div>

                <div className="studio-panel">
                  <div className="studio-panel-title"><p className="studio-eyebrow">i18n</p><h3>Inglês</h3></div>
                  {selected.translated ? <><strong>{selected.translated.name || selected.name}</strong><p className="studio-role">{selected.translated.role || 'Função ausente'}</p><p>{selected.translated.description || 'Descrição ausente'}</p></> : <p>Sem entrada em inglês.</p>}
                </div>

                <div className="studio-panel">
                  <div className="studio-panel-title"><p className="studio-eyebrow">Referência</p><h3>Livro</h3></div>
                  {selected.book ? <><strong>{selected.book.title.pt}</strong><p>{selected.book.title.en}</p><p className="studio-role">{selected.book.year ?? 'Ano não definido'}</p></> : <p>Sem livro cadastrado/preparado.</p>}
                </div>
              </section>

              <section className="studio-panel studio-axis-panel">
                <div className="studio-panel-title studio-panel-title--row">
                  <div><p className="studio-eyebrow">Perfil</p><h3>12 eixos</h3></div>
                  <span className="studio-readonly-label">somente leitura · vem da auditoria</span>
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
          ) : <div className="studio-empty">Selecione uma personalidade.</div>}
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

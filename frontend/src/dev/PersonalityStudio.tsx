import { useEffect, useMemo, useState } from 'react';
import '../styles/personality-studio.css';

type Axis = { id: string; label: string; leftPole: string; rightPole: string };
type Translation = { id: string; name?: string; role?: string; description?: string };
type Profile = { personalityId: string; vector: Record<string, number> };
type Book = { personalityId?: string; title: { pt: string; en: string }; year?: number; url?: { pt?: string; en?: string } };
type Pipeline = {
  metadataStatus: string; portraitStatus: string; translationStatus: string;
  profileStatus: string; bookStatus: string; region?: string; period?: string;
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
  validation: { errors: string[]; warnings: string[]; status: 'error' | 'warning' | 'ok' };
};

type Payload = {
  axes: Axis[];
  stats: {
    totalEntries: number; runtime: number; staging: number; runtimeMale: number;
    runtimeFemale: number; plannedFemale: number; errors: number; warnings: number; ok: number;
  };
  personalities: Personality[];
};

type RepresentationFilter = 'all' | 'male' | 'female';
type StatusFilter = 'all' | 'error' | 'warning' | 'ok';
type SourceFilter = 'all' | 'runtime' | 'staging';

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return <span className={`studio-badge studio-badge--${tone}`}>{children}</span>;
}

function PersonalityStudio() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [representation, setRepresentation] = useState<RepresentationFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    fetch('/__dev/personality-studio/catalog.json', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not load catalog');
        return body as Payload;
      })
      .then((body) => {
        setPayload(body);
        const first = body.personalities[0];
        setSelectedKey((current) => current ?? (first ? `${first.source}:${first.id}` : null));
      })
      .catch((error: Error) => setLoadError(error.message));
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

  if (loadError) {
    return <main className="studio-shell"><section className="studio-empty"><h1>Personality Studio</h1><p>{loadError}</p><p>Run <code>npm run dev:studio</code> first.</p></section></main>;
  }
  if (!payload) {
    return <main className="studio-shell"><section className="studio-empty"><h1>Personality Studio</h1><p>Reading repository data…</p></section></main>;
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <span className="studio-kicker">12 Axes · local contributor tool</span>
          <h1>Personality Studio</h1>
          <p>Runtime + staging inspection. Read-only: nothing here writes to catalog files.</p>
        </div>
        <div className="studio-summary studio-summary--six">
          <div><strong>{payload.stats.runtime}</strong><span>Runtime</span></div>
          <div><strong>{payload.stats.staging}</strong><span>Staging</span></div>
          <div><strong>{payload.stats.runtimeMale}</strong><span>Men runtime</span></div>
          <div><strong>{payload.stats.plannedFemale}</strong><span>Women planned</span></div>
          <div><strong>{payload.stats.errors}</strong><span>Errors</span></div>
          <div><strong>{payload.stats.warnings}</strong><span>Warnings</span></div>
        </div>
      </header>

      <section className="studio-toolbar studio-toolbar--four" aria-label="Catalog filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, id, role or category…" aria-label="Search personalities" />
        <select value={source} onChange={(event) => setSource(event.target.value as SourceFilter)}>
          <option value="all">Runtime + staging</option>
          <option value="runtime">Runtime only</option>
          <option value="staging">Staging only</option>
        </select>
        <select value={representation} onChange={(event) => setRepresentation(event.target.value as RepresentationFilter)}>
          <option value="all">All representations</option>
          <option value="male">Men</option>
          <option value="female">Women</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
          <option value="all">All validation states</option>
          <option value="error">Errors</option>
          <option value="warning">Warnings</option>
          <option value="ok">Clean</option>
        </select>
        <span className="studio-result-count">{filtered.length} visible</span>
      </section>

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
                <span className={`studio-status-dot studio-status-dot--${personality.validation.status}`} aria-label={personality.validation.status} />
              </button>
            );
          })}
          {!filtered.length && <p className="studio-list-empty">No personalities match these filters.</p>}
        </aside>

        <article className="studio-detail">
          {selected ? (
            <>
              <section className="studio-profile-head">
                {selected.imagePath ? <img className="studio-portrait" src={selected.imagePath} alt={selected.name} /> : <div className="studio-portrait studio-portrait--missing">No portrait</div>}
                <div>
                  <div className="studio-badges">
                    <Badge tone={selected.source === 'runtime' ? 'good' : 'warn'}>{selected.source}</Badge>
                    <Badge>{selected.representation}</Badge>
                    <Badge>{selected.category}</Badge>
                    <Badge tone={selected.validation.status === 'ok' ? 'good' : selected.validation.status === 'warning' ? 'warn' : 'bad'}>{selected.validation.status}</Badge>
                  </div>
                  <h2>{selected.name}</h2>
                  <p className="studio-role">{selected.role || 'Role not staged'}{selected.lifespan ? ` · ${selected.lifespan}` : ''}</p>
                  <p>{selected.description || 'Description not staged yet.'}</p>
                  <div className="studio-source">
                    <strong>Portrait:</strong>{' '}
                    {selected.imageSourceUrl ? <a href={selected.imageSourceUrl} target="_blank" rel="noreferrer">{selected.imageSourceName || selected.imageSourceUrl}</a> : 'source metadata not staged'}
                    {selected.image.bytes ? <span> · {Math.round(selected.image.bytes / 1024)} KB</span> : null}
                    {selected.image.metadata?.width && selected.image.metadata?.height ? <span> · {selected.image.metadata.width}×{selected.image.metadata.height}</span> : null}
                  </div>
                </div>
              </section>

              {selected.pipeline ? (
                <section className="studio-panel studio-pipeline-panel">
                  <h3>Pipeline</h3>
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
                  <h3>Validation</h3>
                  {selected.validation.errors.length === 0 && selected.validation.warnings.length === 0 ? <p className="studio-ok">No issues detected.</p> : null}
                  {selected.validation.errors.map((message) => <p key={message} className="studio-issue studio-issue--error">{message}</p>)}
                  {selected.validation.warnings.map((message) => <p key={message} className="studio-issue studio-issue--warning">{message}</p>)}
                </div>

                <div className="studio-panel">
                  <h3>Audit & evidence</h3>
                  <dl className="studio-definition-list">
                    <div><dt>Permanent answers</dt><dd>{selected.audit.answerExists ? 'yes' : 'no'}</dd></div>
                    <div><dt>Pending output</dt><dd>{selected.audit.pendingExists ? 'yes' : 'no'}</dd></div>
                    <div><dt>Evidence dossier</dt><dd>{selected.evidence ? 'yes' : 'no'}</dd></div>
                    <div><dt>Sources</dt><dd>{selected.evidence?.sources?.length ?? 0}</dd></div>
                    <div><dt>Evidence fields</dt><dd>{Object.keys(selected.evidence?.evidence ?? {}).length}</dd></div>
                  </dl>
                </div>

                <div className="studio-panel">
                  <h3>English</h3>
                  {selected.translated ? <><strong>{selected.translated.name || selected.name}</strong><p className="studio-role">{selected.translated.role || 'Missing role'}</p><p>{selected.translated.description || 'Missing description'}</p></> : <p>No English draft/entry yet.</p>}
                </div>

                <div className="studio-panel">
                  <h3>Book</h3>
                  {selected.book ? <><strong>{selected.book.title.pt}</strong><p>{selected.book.title.en}</p><p className="studio-role">{selected.book.year ?? 'Year not set'}</p></> : <p>No book registered/staged.</p>}
                </div>
              </section>

              <section className="studio-panel studio-axis-panel">
                <h3>12-axis vector</h3>
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
                ) : <p>{selected.source === 'staging' ? `Not in runtime yet. profileStatus=${selected.pipeline?.profileStatus ?? 'unknown'}.` : 'No profile vector.'}</p>}
              </section>
            </>
          ) : <div className="studio-empty">Select a personality.</div>}
        </article>
      </section>
    </main>
  );
}

export default PersonalityStudio;

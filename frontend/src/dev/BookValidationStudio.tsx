import { useMemo, useState } from 'react';

type StudioBook = {
  personalityId?: string;
  title?: { pt?: string; en?: string };
  year?: number;
  url?: { pt?: string; en?: string };
  author?: string | null;
  associationType?: string | null;
};

type StudioPersonality = {
  source: 'runtime' | 'staging';
  id: string;
  name: string;
  representation: 'male' | 'female';
  book: StudioBook | null;
};

type Props = {
  personalities: StudioPersonality[];
  language: 'pt' | 'en';
};

type BookStatus = 'ok' | 'pending' | 'missing' | 'error';
type SexFilter = 'all' | 'male' | 'female';
type StatusFilter = 'all' | BookStatus;

function amazonUrlState(value: string | undefined, market: 'br' | 'us') {
  const raw = String(value ?? '').trim();
  if (!raw) return { present: false, valid: false, url: '' };
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const amazonHost = market === 'br'
      ? host === 'amazon.com.br' || host === 'www.amazon.com.br' || host.endsWith('.amazon.com.br')
      : host === 'amazon.com' || host === 'www.amazon.com' || host.endsWith('.amazon.com');
    const shortener = host === 'amzn.to';
    return {
      present: true,
      valid: parsed.protocol === 'https:' && (amazonHost || shortener),
      url: raw,
    };
  } catch {
    return { present: true, valid: false, url: raw };
  }
}

function searchUrl(personality: StudioPersonality, market: 'br' | 'us') {
  const title = market === 'br'
    ? personality.book?.title?.pt || personality.book?.title?.en
    : personality.book?.title?.en || personality.book?.title?.pt;
  const query = [title, personality.book?.author || personality.name]
    .filter(Boolean)
    .join(' ');
  const host = market === 'br' ? 'www.amazon.com.br' : 'www.amazon.com';
  return `https://${host}/s?k=${encodeURIComponent(query || personality.name)}`;
}

function bookStatus(personality: StudioPersonality): BookStatus {
  const book = personality.book;
  if (!book) return 'missing';

  const br = amazonUrlState(book.url?.pt, 'br');
  const us = amazonUrlState(book.url?.en, 'us');
  const coreValid = Boolean(book.title?.pt && book.title?.en && Number.isInteger(book.year));

  if (!coreValid || (br.present && !br.valid) || (us.present && !us.valid)) return 'error';
  if (!br.present || !us.present) return 'pending';
  return 'ok';
}

function statusTone(status: BookStatus) {
  if (status === 'ok') return 'good';
  if (status === 'error') return 'bad';
  return 'warn';
}

export default function BookValidationStudio({ personalities, language }: Props) {
  const [query, setQuery] = useState('');
  const [sex, setSex] = useState<SexFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const ui = language === 'pt' ? {
    title: 'Validação de livros',
    eyebrow: 'BOOK QA',
    intro: 'Auditoria local do catálogo de livros para homens e mulheres. O Studio valida estrutura e URLs; a edição pode ser conferida abrindo a Amazon.',
    all: 'Todos',
    men: 'Homens',
    women: 'Mulheres',
    allStates: 'Todos os estados',
    ok: 'Validado',
    pending: 'Pendente',
    missing: 'Sem livro',
    error: 'Erro',
    search: 'Buscar personalidade, livro ou autor…',
    personality: 'Personalidade',
    book: 'Livro',
    metadata: 'Metadados',
    amazonBr: 'Amazon BR',
    amazonUs: 'Amazon US',
    qa: 'QA',
    direct: 'Abrir',
    searchAmazon: 'Buscar',
    noBook: 'Nenhum livro associado',
    legacy: 'legado',
    author: 'autor',
    biography: 'biografia',
    other: 'associação',
    visible: 'visíveis',
    books: 'com livro',
    validated: 'links BR+US válidos',
    pendingLinks: 'aguardando links',
    withoutBook: 'sem livro',
    structural: 'Validação estrutural',
    manualHint: '“Validado” significa que os campos essenciais existem e os dois links têm formato Amazon válido. A disponibilidade comercial continua sendo conferida manualmente.',
  } : {
    title: 'Book validation',
    eyebrow: 'BOOK QA',
    intro: 'Local audit of the book catalog for men and women. Studio validates structure and URLs; the edition can be checked by opening Amazon.',
    all: 'All',
    men: 'Men',
    women: 'Women',
    allStates: 'All states',
    ok: 'Validated',
    pending: 'Pending',
    missing: 'No book',
    error: 'Error',
    search: 'Search personality, book or author…',
    personality: 'Personality',
    book: 'Book',
    metadata: 'Metadata',
    amazonBr: 'Amazon BR',
    amazonUs: 'Amazon US',
    qa: 'QA',
    direct: 'Open',
    searchAmazon: 'Search',
    noBook: 'No associated book',
    legacy: 'legacy',
    author: 'author',
    biography: 'biography',
    other: 'association',
    visible: 'visible',
    books: 'with book',
    validated: 'valid BR+US links',
    pendingLinks: 'waiting for links',
    withoutBook: 'without book',
    structural: 'Structural validation',
    manualHint: '“Validated” means required fields exist and both URLs have a valid Amazon shape. Commercial availability still needs a manual check.',
  };

  const runtime = useMemo(
    () => personalities.filter((personality) => personality.source === 'runtime'),
    [personalities],
  );

  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return runtime
      .map((personality) => ({ personality, status: bookStatus(personality) }))
      .filter(({ personality, status: rowStatus }) => {
        if (sex !== 'all' && personality.representation !== sex) return false;
        if (status !== 'all' && rowStatus !== status) return false;
        if (!normalized) return true;
        const values = [
          personality.id,
          personality.name,
          personality.book?.title?.pt,
          personality.book?.title?.en,
          personality.book?.author,
        ];
        return values.filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(normalized));
      })
      .sort((a, b) => {
        const rank: Record<BookStatus, number> = { error: 0, pending: 1, missing: 2, ok: 3 };
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
        return a.personality.name.localeCompare(b.personality.name, language === 'pt' ? 'pt-BR' : 'en');
      });
  }, [runtime, query, sex, status, language]);

  const totals = useMemo(() => {
    const states = runtime.map(bookStatus);
    return {
      runtime: runtime.length,
      books: runtime.filter((personality) => Boolean(personality.book)).length,
      ok: states.filter((value) => value === 'ok').length,
      pending: states.filter((value) => value === 'pending').length,
      missing: states.filter((value) => value === 'missing').length,
      error: states.filter((value) => value === 'error').length,
    };
  }, [runtime]);

  return (
    <section className="studio-book-qa" id="book-validation" aria-labelledby="book-validation-title">
      <div className="studio-book-qa-head">
        <div>
          <p className="studio-eyebrow">{ui.eyebrow}</p>
          <h2 id="book-validation-title">{ui.title}</h2>
          <p>{ui.intro}</p>
        </div>
        <div className="studio-book-qa-summary">
          <span><strong>{totals.books}</strong>{ui.books}</span>
          <span className="is-good"><strong>{totals.ok}</strong>{ui.validated}</span>
          <span className="is-warn"><strong>{totals.pending}</strong>{ui.pendingLinks}</span>
          <span><strong>{totals.missing}</strong>{ui.withoutBook}</span>
          {totals.error ? <span className="is-bad"><strong>{totals.error}</strong>{ui.error}</span> : null}
        </div>
      </div>

      <div className="studio-book-qa-controls">
        <div className="studio-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui.search} />
        </div>
        <div className="studio-segmented">
          {([
            ['all', ui.all],
            ['male', ui.men],
            ['female', ui.women],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className={sex === value ? 'is-active' : ''} onClick={() => setSex(value)}>{label}</button>
          ))}
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
          <option value="all">{ui.allStates}</option>
          <option value="ok">{ui.ok}</option>
          <option value="pending">{ui.pending}</option>
          <option value="missing">{ui.missing}</option>
          <option value="error">{ui.error}</option>
        </select>
        <span className="studio-result-count">{rows.length} {ui.visible}</span>
      </div>

      <div className="studio-book-table-wrap">
        <table className="studio-book-table">
          <thead>
            <tr>
              <th>{ui.personality}</th>
              <th>{ui.book}</th>
              <th>{ui.metadata}</th>
              <th>{ui.amazonBr}</th>
              <th>{ui.amazonUs}</th>
              <th>{ui.qa}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ personality, status: rowStatus }) => {
              const book = personality.book;
              const br = amazonUrlState(book?.url?.pt, 'br');
              const us = amazonUrlState(book?.url?.en, 'us');
              const association = book?.associationType === 'biography'
                ? ui.biography
                : book?.associationType === 'author'
                  ? ui.author
                  : book?.associationType
                    ? ui.other
                    : ui.legacy;
              return (
                <tr key={personality.id}>
                  <td>
                    <strong>{personality.name}</strong>
                    <span>{personality.id}</span>
                    <span>{personality.representation === 'female' ? ui.women : ui.men}</span>
                  </td>
                  <td>
                    {book ? (
                      <>
                        <strong>{language === 'en' ? (book.title?.en || book.title?.pt) : (book.title?.pt || book.title?.en)}</strong>
                        <span>{book.year ?? '—'}</span>
                      </>
                    ) : <span>{ui.noBook}</span>}
                  </td>
                  <td>
                    {book ? (
                      <>
                        <strong>{book.author || personality.name}</strong>
                        <span>{association}{!book.author || !book.associationType ? ` · ${ui.legacy}` : ''}</span>
                      </>
                    ) : <span>—</span>}
                  </td>
                  <td>
                    {br.valid ? (
                      <a className="studio-book-link" href={br.url} target="_blank" rel="noreferrer">{ui.direct}</a>
                    ) : (
                      <a className="studio-book-link studio-book-link--search" href={searchUrl(personality, 'br')} target="_blank" rel="noreferrer">{ui.searchAmazon}</a>
                    )}
                    {br.present && !br.valid ? <span className="studio-book-link-error">URL inválida</span> : null}
                  </td>
                  <td>
                    {us.valid ? (
                      <a className="studio-book-link" href={us.url} target="_blank" rel="noreferrer">{ui.direct}</a>
                    ) : (
                      <a className="studio-book-link studio-book-link--search" href={searchUrl(personality, 'us')} target="_blank" rel="noreferrer">{ui.searchAmazon}</a>
                    )}
                    {us.present && !us.valid ? <span className="studio-book-link-error">URL inválida</span> : null}
                  </td>
                  <td>
                    <span className={`studio-badge studio-badge--${statusTone(rowStatus)}`}>
                      {rowStatus === 'ok' ? ui.ok : rowStatus === 'pending' ? ui.pending : rowStatus === 'missing' ? ui.missing : ui.error}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="studio-book-qa-note"><strong>{ui.structural}:</strong> {ui.manualHint}</p>
    </section>
  );
}

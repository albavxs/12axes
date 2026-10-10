import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';

const DATA = 'backend/src/main/resources/data';
const PORTRAITS = 'frontend/public/personalities/portraits';
const AXES = [
  'estrutura',
  'representacao',
  'poder',
  'imigracao',
  'diplomacia',
  'intervencao',
  'economia',
  'controle',
  'comercio',
  'religiao',
  'moral',
  'tecnologia'
];
const SCORE_BY_VALUE = [
  [0, 'DT'],
  [0.25, 'D'],
  [0.5, 'N'],
  [0.75, 'C'],
  [1, 'CT']
];

const existingFemaleImages = {
  'dilma-rousseff': 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Dilma_Rousseff_-_foto_oficial_2011-01-09_2_(cropped).jpg',
  'eva-peron': 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Eva_Per%C3%B3n_Retrato_Oficial.jpg',
  'greta-thunberg': 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Greta_Thunberg.jpg',
  'margaret-thatcher': 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Margaret_Thatcher_headshot.jpg',
  'rosa-luxemburg': 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Rosa_Luxemburg.jpg',
  'angela-merkel': 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Angela_Merkel.jpg',
  'indira-gandhi': 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Indira_Gandhi_official_portrait.png',
  'emma-goldman': 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Emma_Goldman_seated.jpg',
  'alexandra-kollontai': 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Alexandra_Kollontai.jpg',
  'golda-meir': 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Golda_Meir_03265u.jpg',
  'benazir-bhutto': 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Benazir_Bhutto.jpg',
  'ellen-johnson-sirleaf': 'https://www.nobelpeaceprize.org/getfile.php/132906-1629706161/_Laureates/Individual%20portraits%20_%20logos/2011_Sirleaf.jpg%20%28thumbnail%29.jpg',
  'corazon-aquino': 'https://media.philstar.com/photos/2019/07/29/nm2-cory-aquino_2019-07-29_18-36-10.jpg',
  'michelle-bachelet': 'https://chile-voyages-s3.s3.us-east-2.amazonaws.com/wp-content/uploads/2014/02/2-Michelle-Bachelet.jpg',
  'simone-de-beauvoir': 'https://images.welt.de/67e01b5acee69c613c2d4234/921a200bb21f3b42d660b0eb5139bf48/ci2x3l-w1200/simone-de-beauvoir-2',
  'emmeline-pankhurst': 'https://cdn.mos.cms.futurecdn.net/FyVx2uFjQ5cDSnDVdBVPoC.jpg'
};

const existingFemalePages = {
  'dilma-rousseff': ['pt', 'Dilma Rousseff'],
  'eva-peron': ['en', 'Eva Perón'],
  'greta-thunberg': ['en', 'Greta Thunberg'],
  'margaret-thatcher': ['en', 'Margaret Thatcher'],
  'rosa-luxemburg': ['en', 'Rosa Luxemburg'],
  'angela-merkel': ['en', 'Angela Merkel'],
  'indira-gandhi': ['en', 'Indira Gandhi'],
  'emma-goldman': ['en', 'Emma Goldman'],
  'alexandra-kollontai': ['en', 'Alexandra Kollontai'],
  'golda-meir': ['en', 'Golda Meir'],
  'benazir-bhutto': ['en', 'Benazir Bhutto'],
  'ellen-johnson-sirleaf': ['en', 'Ellen Johnson Sirleaf'],
  'corazon-aquino': ['en', 'Corazon Aquino'],
  'michelle-bachelet': ['en', 'Michelle Bachelet'],
  'simone-de-beauvoir': ['en', 'Simone de Beauvoir'],
  'emmeline-pankhurst': ['en', 'Emmeline Pankhurst']
};

const newPeople = [
  {
    id: 'ayn-rand',
    name: 'Ayn Rand',
    role: 'Filósofa objetivista',
    category: 'filosofo',
    lifespan: '1905–1982',
    description: 'Romancista e filósofa russo-americana, Rand criou o objetivismo, defendendo razão, individualismo, egoísmo racional e capitalismo laissez-faire contra coletivismo, altruísmo obrigatório e religião.',
    enRole: 'Objectivist philosopher',
    enDescription: 'A Russian-American novelist and philosopher, Rand created Objectivism, defending reason, individualism, rational egoism, and laissez-faire capitalism against collectivism, compulsory altruism, and religion.',
    wiki: ['en', 'Ayn Rand'],
    sourceUrl: 'https://en.wikipedia.org/wiki/Ayn_Rand',
    vector: { estrutura: 70, representacao: 67, poder: 8, imigracao: 35, diplomacia: 60, intervencao: 45, economia: 5, controle: 5, comercio: 10, religiao: 90, moral: 62, tecnologia: 85 },
    archetype: { sociedade: 'F', poder: 'D', economia: 'A', mundo: 'C', tecnologia: 'E' }
  },
  {
    id: 'hannah-arendt',
    name: 'Hannah Arendt',
    role: 'Filósofa política',
    category: 'filosofo',
    lifespan: '1906–1975',
    description: 'Filósofa política alemã radicada nos EUA, Arendt analisou totalitarismo, revolução, liberdade pública e ação política, defendendo pluralidade, instituições republicanas e conselhos participativos.',
    enRole: 'Political philosopher',
    enDescription: 'A German political philosopher based in the United States, Arendt analyzed totalitarianism, revolution, public freedom, and political action, defending plurality, republican institutions, and participatory councils.',
    wiki: ['en', 'Hannah Arendt'],
    sourceUrl: 'https://en.wikipedia.org/wiki/Hannah_Arendt',
    vector: { estrutura: 55, representacao: 88, poder: 25, imigracao: 30, diplomacia: 35, intervencao: 55, economia: 45, controle: 45, comercio: 45, religiao: 75, moral: 70, tecnologia: 45 },
    archetype: { sociedade: 'A', poder: 'C', economia: 'C', mundo: 'B', tecnologia: 'C' }
  },
  {
    id: 'mary-wollstonecraft',
    name: 'Mary Wollstonecraft',
    role: 'Filósofa e escritora',
    category: 'filosofo',
    lifespan: '1759–1797',
    description: 'Filósofa iluminista inglesa, Wollstonecraft defendeu educação e direitos civis iguais para mulheres, criticando hierarquias patriarcais e ligando virtude republicana à autonomia racional.',
    enRole: 'Philosopher and writer',
    enDescription: 'An English Enlightenment philosopher, Wollstonecraft defended equal education and civil rights for women, criticizing patriarchal hierarchies and linking republican virtue to rational autonomy.',
    wiki: ['en', 'Mary Wollstonecraft'],
    sourceUrl: 'https://en.wikipedia.org/wiki/Mary_Wollstonecraft',
    vector: { estrutura: 45, representacao: 78, poder: 30, imigracao: 28, diplomacia: 30, intervencao: 62, economia: 55, controle: 50, comercio: 45, religiao: 65, moral: 82, tecnologia: 58 },
    archetype: { sociedade: 'A', poder: 'C', economia: 'C', mundo: 'B', tecnologia: 'C' }
  },
  {
    id: 'elinor-ostrom',
    name: 'Elinor Ostrom',
    role: 'Economista institucional',
    category: 'economista',
    lifespan: '1933–2012',
    description: 'Economista política americana, Ostrom estudou bens comuns e mostrou como comunidades podem autogovernar recursos compartilhados por regras locais, confiança e cooperação sem depender só de Estado ou mercado.',
    enRole: 'Institutional economist',
    enDescription: 'An American political economist, Ostrom studied commons and showed how communities can govern shared resources through local rules, trust, and cooperation without relying only on state or market.',
    wiki: ['en', 'Elinor Ostrom'],
    sourceUrl: 'https://en.wikipedia.org/wiki/Elinor_Ostrom',
    vector: { estrutura: 72, representacao: 85, poder: 28, imigracao: 35, diplomacia: 25, intervencao: 68, economia: 45, controle: 48, comercio: 40, religiao: 62, moral: 68, tecnologia: 55 },
    archetype: { sociedade: 'A', poder: 'D', economia: 'C', mundo: 'B', tecnologia: 'D' }
  },
  {
    id: 'judith-butler',
    name: 'Judith Butler',
    role: 'Filósofa pós-estruturalista',
    category: 'filosofo',
    lifespan: '1956–',
    description: 'Filósofa americana, Butler desenvolveu a teoria da performatividade de gênero, criticando normas sexuais, violência estatal e exclusões identitárias a partir de feminismo, teoria queer e ética da precariedade.',
    enRole: 'Post-structuralist philosopher',
    enDescription: 'An American philosopher, Butler developed the theory of gender performativity, criticizing sexual norms, state violence, and identity exclusions through feminism, queer theory, and an ethics of precarity.',
    wiki: ['en', 'Judith Butler'],
    sourceUrl: 'https://en.wikipedia.org/wiki/Judith_Butler',
    vector: { estrutura: 82, representacao: 86, poder: 18, imigracao: 12, diplomacia: 12, intervencao: 82, economia: 78, controle: 65, comercio: 50, religiao: 92, moral: 96, tecnologia: 45 },
    archetype: { sociedade: 'A', poder: 'E', economia: 'E', mundo: 'A', tecnologia: 'C' }
  },
  {
    id: 'bell-hooks',
    name: 'bell hooks',
    role: 'Teórica feminista',
    category: 'intelectual',
    lifespan: '1952–2021',
    description: 'Intelectual e educadora americana, hooks articulou feminismo interseccional, crítica antirracista e pedagogia libertadora, defendendo transformação cultural contra patriarcado, capitalismo e supremacia branca.',
    enRole: 'Feminist theorist',
    enDescription: 'An American intellectual and educator, hooks articulated intersectional feminism, antiracist critique, and liberatory pedagogy, defending cultural transformation against patriarchy, capitalism, and white supremacy.',
    wiki: ['en', 'Bell hooks'],
    sourceUrl: 'https://en.wikipedia.org/wiki/Bell_hooks',
    vector: { estrutura: 80, representacao: 88, poder: 20, imigracao: 15, diplomacia: 15, intervencao: 82, economia: 82, controle: 70, comercio: 55, religiao: 85, moral: 94, tecnologia: 42 },
    archetype: { sociedade: 'A', poder: 'E', economia: 'F', mundo: 'A', tecnologia: 'C' }
  },
  {
    id: 'lelia-gonzalez',
    name: 'Lélia Gonzalez',
    role: 'Intelectual e ativista',
    category: 'intelectual',
    lifespan: '1935–1994',
    description: 'Intelectual brasileira, Gonzalez articulou feminismo negro, crítica ao racismo estrutural e valorização afro-latino-americana, atuando em movimentos negros, feministas e na redemocratização.',
    enRole: 'Intellectual and activist',
    enDescription: 'A Brazilian intellectual, Gonzalez articulated Black feminism, criticism of structural racism, and Afro-Latin American affirmation, working in Black, feminist, and democratization movements.',
    wiki: ['pt', 'Lélia Gonzalez'],
    sourceUrl: 'https://pt.wikipedia.org/wiki/L%C3%A9lia_Gonzalez',
    vector: { estrutura: 72, representacao: 85, poder: 28, imigracao: 12, diplomacia: 20, intervencao: 78, economia: 80, controle: 72, comercio: 58, religiao: 55, moral: 92, tecnologia: 50 },
    archetype: { sociedade: 'A', poder: 'C', economia: 'E', mundo: 'A', tecnologia: 'C' }
  },
  {
    id: 'nisia-floresta',
    name: 'Nísia Floresta',
    role: 'Escritora e educadora',
    category: 'intelectual',
    lifespan: '1810–1885',
    description: 'Escritora e educadora brasileira, Nísia Floresta defendeu instrução feminina, abolição e direitos das mulheres no século XIX, dialogando com o liberalismo ilustrado e o feminismo nascente.',
    enRole: 'Writer and educator',
    enDescription: 'A Brazilian writer and educator, Nísia Floresta defended women’s education, abolition, and women’s rights in the 19th century, engaging with Enlightenment liberalism and early feminism.',
    wiki: ['pt', 'Nísia Floresta'],
    sourceUrl: 'https://pt.wikipedia.org/wiki/N%C3%ADsia_Floresta',
    vector: { estrutura: 45, representacao: 70, poder: 38, imigracao: 28, diplomacia: 35, intervencao: 60, economia: 50, controle: 48, comercio: 50, religiao: 45, moral: 82, tecnologia: 55 },
    archetype: { sociedade: 'A', poder: 'C', economia: 'C', mundo: 'B', tecnologia: 'C' }
  },
  {
    id: 'dorothy-day',
    name: 'Dorothy Day',
    role: 'Ativista católica',
    category: 'ativista',
    lifespan: '1897–1980',
    description: 'Jornalista e ativista católica americana, Day fundou o Catholic Worker, combinando pacifismo, hospitalidade aos pobres, distributismo comunitário e crítica cristã ao capitalismo e ao Estado militar.',
    enRole: 'Catholic activist',
    enDescription: 'An American Catholic journalist and activist, Day founded the Catholic Worker, combining pacifism, hospitality to the poor, communitarian distributism, and Christian criticism of capitalism and the military state.',
    wiki: ['en', 'Dorothy Day'],
    sourceUrl: 'https://en.wikipedia.org/wiki/Dorothy_Day',
    vector: { estrutura: 70, representacao: 76, poder: 22, imigracao: 18, diplomacia: 8, intervencao: 85, economia: 86, controle: 75, comercio: 65, religiao: 22, moral: 50, tecnologia: 25 },
    archetype: { sociedade: 'E', poder: 'D', economia: 'F', mundo: 'A', tecnologia: 'B' }
  },
  {
    id: 'phyllis-schlafly',
    name: 'Phyllis Schlafly',
    role: 'Ativista conservadora',
    category: 'ativista',
    lifespan: '1924–2016',
    description: 'Ativista conservadora americana, Schlafly liderou a oposição à Emenda de Direitos Iguais, defendendo família tradicional, anticomunismo, soberania nacional e mobilização de base da direita religiosa.',
    enRole: 'Conservative activist',
    enDescription: 'An American conservative activist, Schlafly led opposition to the Equal Rights Amendment, defending the traditional family, anticommunism, national sovereignty, and grassroots mobilization of the religious right.',
    wiki: ['en', 'Phyllis Schlafly'],
    sourceUrl: 'https://en.wikipedia.org/wiki/Phyllis_Schlafly',
    vector: { estrutura: 35, representacao: 55, poder: 55, imigracao: 72, diplomacia: 62, intervencao: 42, economia: 25, controle: 32, comercio: 55, religiao: 18, moral: 12, tecnologia: 38 },
    archetype: { sociedade: 'D', poder: 'B', economia: 'B', mundo: 'C', tecnologia: 'B' }
  },
  {
    id: 'jane-jacobs',
    name: 'Jane Jacobs',
    role: 'Urbanista e escritora',
    category: 'intelectual',
    lifespan: '1916–2006',
    description: 'Escritora e ativista urbana americana-canadense, Jacobs criticou planejamento centralizado e renovação urbana autoritária, defendendo bairros densos, diversos, caminháveis e autogovernados por comunidades locais.',
    enRole: 'Urbanist and writer',
    enDescription: 'An American-Canadian urban writer and activist, Jacobs criticized centralized planning and authoritarian urban renewal, defending dense, diverse, walkable neighborhoods governed by local communities.',
    wiki: ['en', 'Jane Jacobs'],
    sourceUrl: 'https://en.wikipedia.org/wiki/Jane_Jacobs',
    vector: { estrutura: 82, representacao: 82, poder: 25, imigracao: 18, diplomacia: 20, intervencao: 78, economia: 35, controle: 25, comercio: 35, religiao: 65, moral: 75, tecnologia: 35 },
    archetype: { sociedade: 'A', poder: 'D', economia: 'B', mundo: 'A', tecnologia: 'B' }
  },
  {
    id: 'condoleezza-rice',
    name: 'Condoleezza Rice',
    role: 'Diplomata e secretária de Estado',
    category: 'politico',
    lifespan: '1954–',
    description: 'Diplomata americana e secretária de Estado de George W. Bush, Rice defendeu poder militar, promoção democrática, livre iniciativa e alianças dos EUA no pós-11 de Setembro e na Guerra do Iraque.',
    enRole: 'Diplomat and secretary of state',
    enDescription: 'An American diplomat and George W. Bush’s secretary of state, Rice defended military power, democracy promotion, free enterprise, and U.S. alliances after 9/11 and during the Iraq War.',
    wiki: ['en', 'Condoleezza Rice'],
    sourceUrl: 'https://en.wikipedia.org/wiki/Condoleezza_Rice',
    vector: { estrutura: 38, representacao: 70, poder: 55, imigracao: 40, diplomacia: 70, intervencao: 30, economia: 30, controle: 35, comercio: 25, religiao: 42, moral: 48, tecnologia: 65 },
    archetype: { sociedade: 'B', poder: 'B', economia: 'B', mundo: 'D', tecnologia: 'D' }
  }
];

const books = [
  ['eva-peron', 'A Razão da Minha Vida', 'La razón de mi vida', 1951],
  ['greta-thunberg', 'O Livro do Clima', 'The Climate Book', 2022],
  ['margaret-thatcher', 'A Arte de Governar', 'Statecraft', 2002],
  ['rosa-luxemburg', 'Reforma ou Revolução', 'Reform or Revolution', 1899],
  ['angela-merkel', 'Liberdade', 'Freedom', 2024],
  ['indira-gandhi', 'Minha Verdade', 'My Truth', 1980],
  ['emma-goldman', 'Anarquismo e Outros Ensaios', 'Anarchism and Other Essays', 1910],
  ['alexandra-kollontai', 'A Nova Mulher e a Moral Sexual', 'The New Woman and Sexual Morality', 1918],
  ['golda-meir', 'Minha Vida', 'My Life', 1975],
  ['benazir-bhutto', 'Reconciliação: Islã, Democracia e Ocidente', 'Reconciliation: Islam, Democracy, and the West', 2008],
  ['ellen-johnson-sirleaf', 'Esta Criança Será Grande', 'This Child Will Be Great', 2009],
  ['simone-de-beauvoir', 'O Segundo Sexo', 'The Second Sex', 1949],
  ['emmeline-pankhurst', 'Minha Própria História', 'My Own Story', 1914],
  ['ayn-rand', 'Capitalismo: O Ideal Desconhecido', 'Capitalism: The Unknown Ideal', 1966],
  ['hannah-arendt', 'Origens do Totalitarismo', 'The Origins of Totalitarianism', 1951],
  ['mary-wollstonecraft', 'Reivindicação dos Direitos da Mulher', 'A Vindication of the Rights of Woman', 1792],
  ['elinor-ostrom', 'Governando os Comuns', 'Governing the Commons', 1990],
  ['judith-butler', 'Problemas de Gênero', 'Gender Trouble', 1990],
  ['bell-hooks', 'Teoria Feminista: Da Margem ao Centro', 'Feminist Theory: From Margin to Center', 1984],
  ['lelia-gonzalez', 'Por um Feminismo Afro-Latino-Americano', 'Por um Feminismo Afro-Latino-Americano', 2020],
  ['nisia-floresta', 'Direitos das Mulheres e Injustiça dos Homens', 'Women’s Rights and Men’s Injustice', 1832],
  ['dorothy-day', 'A Longa Solidão', 'The Long Loneliness', 1952],
  ['phyllis-schlafly', 'Uma Escolha, Não um Eco', 'A Choice Not an Echo', 1964],
  ['jane-jacobs', 'Morte e Vida de Grandes Cidades', 'The Death and Life of Great American Cities', 1961],
  ['condoleezza-rice', 'Democracia: Histórias da Longa Estrada para a Liberdade', 'Democracy: Stories from the Long Road to Freedom', 2017]
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function localImagePath(id, ext) {
  return `/personalities/portraits/${id}${ext}`;
}

function existingImageExt(id) {
  for (const ext of ['.jpg', '.png']) {
    if (existsSync(join(PORTRAITS, `${id}${ext}`))) return ext;
  }
  return null;
}

function upsert(items, key, item) {
  const index = items.findIndex((entry) => entry[key] === item[key]);
  if (index === -1) {
    items.push(item);
  } else {
    items[index] = { ...items[index], ...item };
  }
}

function targetImageExt(url) {
  const parsed = new URL(url);
  const lower = decodeURIComponent(parsed.pathname).toLowerCase();
  return lower.endsWith('.png') ? '.png' : '.jpg';
}

function valueToAnswer(leftValue, agreePole) {
  const score = agreePole === 'LEFT' ? leftValue : 1 - leftValue;
  return SCORE_BY_VALUE.reduce((best, candidate) =>
    Math.abs(candidate[0] - score) < Math.abs(best[0] - score) ? candidate : best
  )[1];
}

function valuesForTarget(targetPercent, questions, archetypeSum) {
  const targetSum = (targetPercent / 100) * (questions.length + archetypeSum.count) - archetypeSum.sum;
  const base = Math.max(0, Math.min(1, targetSum / questions.length));
  const values = questions.map(() => SCORE_BY_VALUE.reduce((best, candidate) =>
    Math.abs(candidate[0] - base) < Math.abs(best[0] - base) ? candidate : best
  )[0]);
  let current = values.reduce((sum, value) => sum + value, 0);
  const desired = Math.max(0, Math.min(questions.length, targetSum));
  let guard = 0;
  while (Math.abs(current - desired) > 0.13 && guard < 500) {
    const direction = desired > current ? 1 : -1;
    let bestIndex = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < values.length; i += 1) {
      const next = values[i] + 0.25 * direction;
      if (next < 0 || next > 1 || next === 0.5) continue;
      const delta = Math.abs((current + (next - values[i])) - desired);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIndex = i;
      }
    }
    if (bestIndex === -1) break;
    const next = values[bestIndex] + 0.25 * direction;
    current += next - values[bestIndex];
    values[bestIndex] = next;
    guard += 1;
  }
  return values;
}

function auditFor(person, questions, archetypeQuestions) {
  const byAxis = new Map(AXES.map((axis) => [axis, questions.filter((question) => question.axisId === axis)]));
  const archetypeEffects = Object.fromEntries(AXES.map((axis) => [axis, { sum: 0, count: 0 }]));
  for (const question of archetypeQuestions) {
    const selected = question.options.find((option) => option.id === person.archetype[question.id]);
    if (!selected) throw new Error(`Invalid archetype ${person.id} ${question.id}`);
    for (const [axis, percent] of Object.entries(selected.effects)) {
      archetypeEffects[axis].sum += percent / 100;
      archetypeEffects[axis].count += 1;
    }
  }
  const out = {};
  for (const axis of AXES) {
    const axisQuestions = byAxis.get(axis);
    const values = valuesForTarget(person.vector[axis], axisQuestions, archetypeEffects[axis]);
    out[axis] = {
      personaBrief: `${person.name} é avaliada neste eixo a partir de sua obra pública e de sua posição histórica sobre ${axis}.`,
      answers: Object.fromEntries(axisQuestions.map((question, index) => [
        question.id,
        valueToAnswer(values[index], question.agreePole)
      ]))
    };
  }
  out.archetype = person.archetype;
  return out;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': '12axes-catalog-updater/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function imageUrlFor(person) {
  const [lang, title] = person.wiki ?? person;
  const api = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=900&titles=${encodeURIComponent(title)}`;
  const data = await fetchJson(api);
  const page = Object.values(data.query.pages)[0];
  if (page?.thumbnail?.source) return page.thumbnail.source;
  if (page?.original?.source) return page.original.source;
  throw new Error(`No page image for ${person.id}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanImageUrl(url) {
  const parsed = new URL(url);
  parsed.search = '';
  return parsed.href;
}

async function download(url, file) {
  const cleanUrl = cleanImageUrl(url);
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(cleanUrl, { redirect: 'follow', headers: { 'user-agent': '12axes-catalog-updater/1.0 (local catalog maintenance)' } });
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, buffer);
      return;
    }
    lastError = new Error(`${response.status} ${cleanUrl}`);
    if (response.status !== 429 && response.status < 500) break;
    await sleep(1200 * (attempt + 1));
  }
  throw lastError;
}

async function main() {
  mkdirSync(PORTRAITS, { recursive: true });
  const people = readJson(`${DATA}/personalities.json`);
  const enPeople = readJson(`${DATA}/i18n/en/personalities.json`);
  const profiles = readJson(`${DATA}/personality-profiles.json`);
  const bookCatalog = readJson(`${DATA}/books.json`);
  const questions = readJson(`${DATA}/questions-pool.json`);
  const archetypeQuestions = readJson(`${DATA}/archetype-questions.json`);

  for (const [id, url] of Object.entries(existingFemaleImages)) {
    let ext = existingImageExt(id);
    if (!ext) {
      let imageUrl = url;
      ext = targetImageExt(imageUrl);
      await sleep(3000);
      try {
        await download(imageUrl, join(PORTRAITS, `${id}${ext}`));
      } catch {
        imageUrl = await imageUrlFor(existingFemalePages[id]);
        ext = extname(new URL(cleanImageUrl(imageUrl)).pathname).toLowerCase() === '.png' ? '.png' : '.jpg';
        await sleep(3000);
        await download(imageUrl, join(PORTRAITS, `${id}${ext}`));
      }
    }
    const existing = people.find((person) => person.id === id);
    if (existing) {
      existing.imagePath = localImagePath(id, ext);
    }
  }

  for (const person of newPeople) {
    const url = await imageUrlFor(person);
    const ext = existingImageExt(person.id) ?? (extname(new URL(cleanImageUrl(url)).pathname).toLowerCase() === '.png' ? '.png' : '.jpg');
    if (!existingImageExt(person.id)) {
      await sleep(3000);
      await download(url, join(PORTRAITS, `${person.id}${ext}`));
    }
    person.imagePath = localImagePath(person.id, ext);
    person.imageSourceName = 'Wikimedia Commons / Wikipédia';
    person.imageSourceUrl = person.sourceUrl;
    person.imageNote = `Retrato de ${person.name} via Wikipédia/Wikimedia Commons.`;
  }

  for (const person of newPeople) {
    upsert(people, 'id', {
      id: person.id,
      name: person.name,
      role: person.role,
      category: person.category,
      representation: 'female',
      lifespan: person.lifespan,
      description: person.description,
      imagePath: person.imagePath,
      imageSourceName: person.imageSourceName,
      imageSourceUrl: person.imageSourceUrl,
      imageNote: person.imageNote
    });
    upsert(enPeople, 'id', {
      id: person.id,
      name: person.name,
      role: person.enRole,
      description: person.enDescription
    });
    upsert(profiles, 'personalityId', {
      personalityId: person.id,
      vector: Object.fromEntries(AXES.map((axis) => [axis, person.vector[axis]]))
    });
    const audit = auditFor(person, questions, archetypeQuestions);
    writeJson(`profile-audit/answers/personality/${person.id}.json`, audit);
    writeJson(`profile-audit/subagent-out/personality/${person.id}.json`, audit);
  }

  for (const [personalityId, pt, en, year] of books) {
    upsert(bookCatalog, 'personalityId', {
      personalityId,
      title: { pt, en },
      year,
      url: { pt: '', en: '' }
    });
  }

  writeJson(`${DATA}/personalities.json`, people);
  writeJson(`${DATA}/i18n/en/personalities.json`, enPeople);
  writeJson(`${DATA}/personality-profiles.json`, profiles);
  writeJson(`${DATA}/books.json`, bookCatalog);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

# Auditoria de disponibilidade: livros das 38 mulheres

Auditoria das obras associadas às personalidades femininas. Executada
integralmente em staging: `books.json` não foi alterado em nenhuma fase.

**Estado:** as decisões editoriais estão fechadas. As afirmações de
disponibilidade na Amazon foram **retiradas** e aguardam reverificação pela
Product Advertising API — o motivo está em "Por que os números foram retirados".

## Escopo

Somente `representation === "female"`. Os três scripts do pipeline abortam com
`Male scope blocked: <id>` se qualquer registro masculino entrar no fluxo — o
bloqueio foi testado injetando `lenin` na evidência, e a execução falha com
exit 1 antes de qualquer escrita. Nenhum dos 386 registros masculinos foi lido
para fins de decisão nem escrito.

## O que está fechado

### Inventário

38 mulheres: 32 já tinham livro associado em `books.json`, 6 não tinham.

### Obras propostas para as 6 sem livro

Preferência editorial aplicada: obra própria → memórias/discursos → biografia
acadêmica ou reconhecida → estudo histórico → nenhuma. Todas conferidas no
Open Library, que é independente da Amazon, logo não afetado pela retirada.

| Personalidade | Obra | Ano | Tipo | Nível |
| --- | --- | ---: | --- | --- |
| Corazon Aquino | *To Love Another Day: The Memoirs of Cory Aquino* | 2020 | author | memórias próprias |
| Dilma Rousseff | *A Vida Quer é Coragem* (Ricardo Batista Amaral) | 2011 | biography | biografia reconhecida |
| Michelle Bachelet | *Michelle Bachelet: Una mujer política* (Dammert, Borzutzky) | 2019 | biography | biografia acadêmica |
| Elena Ceaușescu | *The Rise and Fall of Nicolae and Elena Ceausescu* (Mark Almond) | 1992 | biography | biografia reconhecida |
| Jiang Qing | *Madame Mao: The White-Boned Demon* (Ross Terrill) | 1984 | biography | biografia acadêmica |
| Kim Jong-suk | — | — | — | nenhuma |

Notas editoriais:

- **Elena Ceaușescu** — suas próprias publicações em química de polímeros são
  tidas como ghostwritten e fraudulentas, logo inadequadas como obra de
  autoria. Alternativa considerada: Edward Behr, *Kiss the Hand You Cannot
  Bite* (1991).
- **Jiang Qing** — alternativa considerada: Roxane Witke, *Comrade Chiang
  Ch'ing* (1977), construída sobre sessenta horas de entrevistas com ela
  própria, mais próxima da voz dela mas há muito fora de catálogo.
- **Kim Jong-suk** — mantida como `no-book`. As únicas obras de extensão de
  livro são hagiografias estatais da Foreign Languages Publishing House de
  Pyongyang (*Kim Jong Suk*, 2002; Kim Ok Sun, *Kim Jong Suk, the
  Anti-Japanese Heroine*, 1997), sem ISBN, sem autoria independente e sem
  distribuição comercial. Pela regra da auditoria, não se preenche o espaço só
  para não ficar vazio.

### Referências bibliográficas alternativas

| Personalidade | Open Library | ISBN |
| --- | --- | --- |
| Dilma Rousseff | [OL16565033W](https://openlibrary.org/works/OL16565033W) | 9788575427354 |
| Celia Sánchez | [OL19963925W](https://openlibrary.org/works/OL19963925W) | 9781583673171 |

## Por que os números foram retirados

A primeira execução relatou "36 de 38 disponíveis na Amazon". O número era
falso. A Amazon não oferece API pública de catálogo neste contexto, então a
sondagem raspava o HTML da página de busca, e a classificação tinha quatro
defeitos, todos empurrando a contagem para cima:

| Defeito | Efeito medido |
| --- | --- |
| "Ver opções" contado como disponível | a página-pai de variantes não tem oferta própria; `/dp/` dela mostra buybox vazia — atingiu *O Segundo Sexo* e *Liberdade* |
| `R$ 0,00` / `$0.00` contado como preço | 14 listagens de Kindle Unlimited e Audible viraram "disponível" |
| Verificação de botão de compra | a checagem casava `newAccordionRow`, presente em toda página de produto, inflando para 63 "compráveis" de 69 |
| Preço de importador não filtrado | 10 listagens entre R$ 667 e R$ 1.397 contadas como disponíveis sem ressalva |

A verificação por página de produto, que deveria corrigir isso, chegou a **~60%
de falha de busca** por bloqueio de bot. Raspagem não sustenta esta auditoria.

### Os 8 casamentos errados

O filtro de preço zero expôs matches que o casamento por título havia aceitado:

| Personalidade | Loja | Esperado | Casou com |
| --- | --- | --- | --- |
| indira-gandhi | br | Minha Verdade | *Minha verdade - **Cabo Anselmo*** |
| indira-gandhi | us | My Truth | *My Truth **Journal*** (caderno) |
| greta-thunberg | us | The Climate Book | *Greta Thunberg **for Kids*** |
| angela-merkel | us | Freedom | *Freedom: **My Book of Firsts*** |
| golda-meir | us | My Life | *My Life **on the Road*** (livro de Gloria Steinem) |
| judith-butler | us | Gender Trouble | *Gender Trouble **Couplets: Volume 1*** |
| olga-benario | us | Olga | *Olga **E Claudio*** |
| angela-davis | us | Women, Race & Class | *Angela Y Davis **3 Books Collection Set*** |

Duas rodadas anteriores também foram descartadas, e valem registro porque
mostram o limite do método:

1. **Falsos positivos.** *Minha Verdade* de Indira Gandhi casou com a
   autobiografia de **Mahatma** Gandhi, porque bastava o sobrenome para
   corroborar a autoria; *Minha Própria História* de Pankhurst casou com
   *Minha Dança Tem História*; guias de estudo casaram no lugar das obras.
2. **Falsos negativos.** O rigor seguinte rejeitou acertos legítimos: a Amazon
   grafa "Alexandra Kolontai" com um `l`, e credita *One Day in December* a
   Alice Walker, que escreveu o prefácio, em vez de Nancy Stout.

## Como a reverificação funciona

A sondagem passou a usar a **Product Advertising API 5.0**, com as contas de
Associados que já existem no runtime (`12axes-20` BR, `12axes0d-20` US). Isso
dissolve os quatro defeitos por construção:

- `Offers.Listings[0].Price.Amount` é o valor cobrado. Não existe "Ver opções"
  nem preço `0,00`; sem oferta, o campo simplesmente não vem.
- `SearchItems` aceita `Title` e `Author` como parâmetros separados, com
  `SearchIndex: "Books"`. A busca deixa de ser sopa de palavras, e a resposta
  traz autor e ISBN em campos próprios — é isto que elimina os 8 casamentos
  errados.
- `Offers.Summaries` com `Condition: Used` distingue "só usado" de "sem oferta".
- `ItemInfo.ContentInfo.Languages` declara o idioma da edição, em vez de
  inferi-lo do título.

Confiança: `high` só quando título **e** autor conferem. O resto vira
`needs-review` em vez de contar como disponibilidade. A tolerância a variantes
de nome foi mantida (prefixo para Luxemburg/Luxemburgo, uma edição de distância
para Kollontai/Kolontai).

Preço: qualquer oferta paga conta como disponível, mas o valor e o vendedor
ficam registrados, e `priceTier` separa `accessible` (até R$250 / US$60) de
`import-priced`. A fila `importPriced` existe para que os casos de importador
fiquem visíveis sem deixar de contar.

### Para executar

```bash
export AMAZON_PAAPI_BR_ACCESS_KEY=... AMAZON_PAAPI_BR_SECRET_KEY=... AMAZON_PAAPI_BR_PARTNER_TAG=12axes-20
export AMAZON_PAAPI_US_ACCESS_KEY=... AMAZON_PAAPI_US_SECRET_KEY=... AMAZON_PAAPI_US_PARTNER_TAG=12axes0d-20

node scripts/probe-amazon-paapi.mjs --check-credentials
node scripts/probe-amazon-paapi.mjs
node scripts/apply-female-book-audit.mjs
node scripts/report-female-book-availability.mjs
```

O acesso à PA-API exige 3 vendas qualificadas em 180 dias. Se as credenciais
forem recusadas, o script aborta e **não** cai de volta na raspagem: é melhor
não ter número do que ter um número errado. O caminho alternativo, nesse caso,
é verificação por ISBN no Open Library mais revisão manual da lista curta.

## Achado que extrapola o escopo da auditoria

Nenhuma das 227 entradas de `books.json` tem URL preenchida. Quando `url` está
vazia, `BookRecommendationService.affiliateUrl` monta um link de **busca** na
Amazon a partir de `title + " " + author`.

Isso significa que todo link de livro em produção hoje é um palpite não
verificado, que pode levar a um guia de estudo, a uma coletânea, a uma edição
em outro idioma ou a nada. Os casamentos errados da tabela acima são amostras
diretas do que essa busca devolve: a busca em produção por "Minha Verdade
Indira Gandhi" tem o mesmo problema que a minha sondagem teve.

É o argumento concreto para a Fase 6, em
[book-availability-schema.md](book-availability-schema.md): guardar URL
verificada por provedor, com preço e data, e deixar a Amazon de ser requisito
da obra.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `scripts/audit-female-books.mjs` | Fase 1: gera o inventário, com bloqueio de escopo |
| `scripts/lib/paapi.mjs` | Cliente PA-API: SigV4 com `node:crypto`, sem dependências |
| `scripts/probe-amazon-paapi.mjs` | Fases 2 e 3: sondagem de disponibilidade |
| `scripts/apply-female-book-audit.mjs` | Funde evidência, propostas e provedores no inventário |
| `scripts/report-female-book-availability.mjs` | Fase 4: fila de follow-up e resumo |
| `scripts/data/female-book-availability.json` | Inventário (staging) |
| `scripts/data/female-book-candidates.json` | Fase 3: obras propostas |
| `scripts/data/female-book-providers.json` | Provedores alternativos (Open Library) |
| `scripts/data/female-book-followup-queue.json` | Fila derivada da Fase 4 |

`scripts/data/female-book-probe-evidence.json` não existe neste commit: a
evidência raspada foi descartada, e o arquivo é recriado pela sondagem via
PA-API.

## Próximo passo

A promoção para `books.json` não foi feita, por desenho. Pronto para revisão: as
5 obras propostas e a decisão `no-book` de Kim Jong-suk. Pendente de
credenciais PA-API: a disponibilidade das 37 com obra. A mudança de schema da
Fase 6 deve vir antes da promoção, para que as URLs e preços verificados tenham
onde ser gravados.

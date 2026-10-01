# Plano de expansão da representação feminina — 12 Axes

> Status: em execução na branch `feat/women-leaders`
>
> Objetivo: ampliar a representação feminina do catálogo de personalidades de forma incremental, auditável e tecnicamente segura, preservando o caráter educativo e comparativo do 12 Axes.

## 1. Objetivos

### 1.1 Meta quantitativa

Estado medido no início desta frente:

- 386 personalidades masculinas.
- 16 personalidades femininas.
- Meta desta migração: pelo menos 193 personalidades femininas, equivalente a metade do catálogo masculino atual.
- Incremento necessário a partir da base inicial: +177 mulheres.

A meta quantitativa não substitui critérios de qualidade. Uma personalidade só conta como concluída quando satisfaz os critérios de integridade definidos neste documento.

### 1.2 Objetivos de produto

1. Tornar `Misto` o modo padrão sem impor proporção artificial entre homens e mulheres.
2. Permitir alternância entre `Misto`, `Homens` e `Mulheres` sem alterar as respostas ou o vetor do usuário.
3. Aumentar representação feminina em diferentes regiões, períodos históricos e categorias existentes no catálogo.
4. Garantir retratos funcionais e locais.
5. Garantir recomendações de livros coerentes com o filtro de representação selecionado.
6. Tornar a expansão verificável por testes e documentação.

## 2. Princípios metodológicos

### 2.1 Representação não altera compatibilidade

`representation` é metadata e filtro de catálogo. O gênero da personalidade não adiciona bônus, penalidade ou peso ao cálculo de compatibilidade.

O modo `mixed` usa ranking global por compatibilidade. Não deve existir intercalação forçada 50/50.

### 2.2 Perfis políticos precisam ser auditáveis

Os vetores de 12 eixos representam uma simplificação editorial para fins comparativos. Novos valores não devem ser derivados automaticamente apenas de rótulos como "esquerda", "direita", "liberal", "socialista" etc.

Para cada nova personalidade:

1. reunir fontes;
2. registrar evidências relevantes por eixo;
3. identificar e documentar incertezas;
4. revisar o vetor antes de torná-lo matchable;
5. evitar inferir uma posição quando não houver evidência suficiente.

### 2.3 Incrementos pequenos

Preferir lotes pequenos e revisáveis a um commit único com centenas de registros.

Cada lote deve manter backend e frontend em estado executável.

---

## 3. Estado já implementado

### 3.1 Representação

- campo `representation` integrado ao catálogo e aos matches;
- suporte a `male` e `female`;
- modo padrão do frontend alterado para `mixed`;
- ranking misto global, sem intercalação artificial;
- resultados separados para masculino, feminino e misto.

### 3.2 Catálogo feminino inicial

Primeiro conjunto com 16 mulheres:

- Dilma Rousseff
- Eva Perón
- Greta Thunberg
- Margaret Thatcher
- Rosa Luxemburg
- Angela Merkel
- Indira Gandhi
- Emma Goldman
- Alexandra Kollontai
- Golda Meir
- Benazir Bhutto
- Ellen Johnson Sirleaf
- Corazon Aquino
- Michelle Bachelet
- Simone de Beauvoir
- Emmeline Pankhurst

### 3.3 Retratos

Os 16 registros foram migrados para caminhos locais em:

`frontend/public/personalities/portraits/`

O catálogo não deve depender de hotlinks para renderizar retratos.

### 3.4 Livros

O resultado possui recomendações independentes para:

- masculino;
- feminino;
- misto.

A recomendação agora percorre o ranking completo. Se uma personalidade não possuir livro disponível/cadastrado, ela é ignorada e a próxima personalidade elegível é considerada até atingir `MAX_BOOKS = 3`.

---

## 4. Fase A — fechar integridade da infraestrutura

### A1. Teste real de assets

Problema: verificar apenas que `imagePath` não está vazio não garante que o arquivo exista.

Implementar validação:

- personalidade feminina possui `imagePath`;
- caminho começa com `/personalities/portraits/`;
- caminho não é HTTP/HTTPS;
- arquivo correspondente existe em `frontend/public`;
- extensão/formato aceito;
- opcionalmente detectar arquivo vazio/corrompido no pipeline.

**Critério de aceite:** nenhuma personalidade marcada como pronta pode cair no fallback de iniciais por asset ausente.

### A2. Testes do fallback de livros

Criar cobertura dedicada para:

1. primeiro match tem livro -> recomendado;
2. primeiro match não tem livro -> próximo elegível entra;
3. múltiplos matches sem livro -> busca continua;
4. nunca retorna mais de três;
5. não duplica personalidade;
6. mantém ordem de compatibilidade entre os elegíveis;
7. respeita PT/EN;
8. feminino consulta ranking feminino completo;
9. misto consulta ranking global completo.

**Critério de aceite:** ausência de livro nunca cria um buraco quando há outra obra elegível mais abaixo no ranking.

### A3. Validação do catálogo de livros

Uma entrada utilizável deve ter:

- `personalityId` existente;
- título não vazio;
- ano quando conhecido;
- localização PT/EN consistente;
- URL opcional.

URL vazia continua autorizada quando o produto usa a busca de loja como fallback.

---

## 5. Fase B — lote imediato: Rosa Parks, Lélia Gonzalez e Angela Davis

IDs propostos:

- `rosa-parks`
- `lelia-gonzalez`
- `angela-davis`

### B1. Metadata PT

Para cada personalidade:

- nome;
- função/descrição curta;
- categoria existente;
- representação `female`;
- período de vida;
- descrição editorial factual;
- `imagePath` local;
- origem/licença da imagem;
- nota de atribuição quando necessária.

### B2. Tradução EN

O catálogo inglês deve manter:

- mesmo ID;
- mesma categoria;
- mesma representação;
- mesmo asset;
- descrição e função traduzidas;
- metadata de imagem equivalente.

### B3. Retratos

Fluxo obrigatório:

1. localizar imagem;
2. confirmar licença/regras de reutilização;
3. preservar atribuição;
4. baixar asset;
5. normalizar nome para o ID;
6. adicionar em `frontend/public/personalities/portraits`;
7. testar existência;
8. verificar renderização.

Não copiar automaticamente imagens cujo status de direitos seja incerto.

### B4. Livros

Entradas preparadas:

- Rosa Parks — *Rosa Parks: My Story*;
- Lélia Gonzalez — *Por um Feminismo Afro-Latino-Americano*;
- Angela Davis — *Women, Race & Class*.

Antes do merge, revisar título, ano, autoria/edição e tradução exibida.

### B5. Perfis dos 12 eixos

Não bloquear pesquisa de metadata e assets por causa do vetor.

Criar uma ficha de auditoria por personalidade:

| Eixo | Evidência | Fonte | Confiança | Valor proposto | Revisado |
| --- | --- | --- | --- | ---: | --- |
| estrutura |  |  |  |  |  |
| representacao |  |  |  |  |  |
| poder |  |  |  |  |  |
| imigracao |  |  |  |  |  |
| diplomacia |  |  |  |  |  |
| intervencao |  |  |  |  |  |
| economia |  |  |  |  |  |
| controle |  |  |  |  |  |
| comercio |  |  |  |  |  |
| religiao |  |  |  |  |  |
| moral |  |  |  |  |  |
| tecnologia |  |  |  |  |  |

**Critério de aceite:** uma personalidade só entra no matching depois de o vetor completo ser revisado.

---

## 6. Fase C — pipeline de expansão até 193

### 6.1 Manifesto de migração

Criar um arquivo de acompanhamento, preferencialmente:

`scripts/data/female-expansion.json`

Campos sugeridos:

```json
{
  "id": "example",
  "name": "Example",
  "region": "latin-america",
  "period": "20th-century",
  "category": "ativista",
  "metadataStatus": "pending",
  "portraitStatus": "pending",
  "translationStatus": "pending",
  "profileStatus": "pending",
  "bookStatus": "pending"
}
```

Estados:

- `pending`
- `researching`
- `review`
- `ready`

O manifesto não participa do matching.

### 6.2 Organização dos lotes

Trabalhar inicialmente com lotes de aproximadamente 10–20 registros.

Usar dimensões descritivas para evitar concentração acidental:

- América Latina e Caribe;
- América do Norte;
- Europa;
- África;
- Oriente Médio;
- Sul da Ásia;
- Leste/Sudeste Asiático;
- diferentes períodos históricos;
- políticas e chefes de governo;
- ativistas;
- economistas;
- filósofas/teóricas;
- intelectuais;
- empresárias quando relevantes ao escopo.

Esses grupos são instrumentos de cobertura, não cotas de compatibilidade.

### 6.3 Próximos nomes já preparados parcialmente

Assets já existentes/preparados no trabalho atual podem tornar candidatas técnicas para lotes seguintes:

- Ayn Rand
- Hannah Arendt
- Mary Wollstonecraft
- Elinor Ostrom

Outros nomes podem ser adicionados ao manifesto depois de pesquisa e revisão.

---

## 7. Fase D — controle de progresso

Registrar métricas sem alterar o algoritmo de matching.

Exemplo:

```text
Female catalog target: 193
Ready: 19
In review: 12
Researching: 20
Pending: 142
Progress: 9.8%
```

Durante a migração, não tornar o CI vermelho simplesmente porque ainda não chegamos a 193.

Adicionar primeiro uma verificação informativa/progressiva.

Quando a meta for atingida, promover para uma invariável de regressão:

`femaleCount >= ceil(maleCount / 2)`

Antes dessa mudança, revisar se a intenção continua sendo acompanhar dinamicamente o número de homens ou congelar o alvo desta migração em 193.

---

## 8. Fase E — qualidade editorial

### 8.1 Descrições

Descrições devem:

- ser factuais;
- evitar linguagem promocional;
- evitar julgamento moral;
- distinguir fatos de interpretações contestadas;
- usar o mesmo nível de detalhe entre figuras comparáveis.

### 8.2 Fontes

Prioridade:

1. arquivos/documentos primários;
2. instituições públicas;
3. universidades;
4. fundações/arquivos oficiais;
5. enciclopédias e obras acadêmicas;
6. fontes secundárias reputadas.

Evitar usar redes sociais, páginas de fãs ou agregadores como fonte principal de perfil.

### 8.3 Cobertura dos eixos

Ausência de evidência não deve ser convertida automaticamente em `50`.

`50` significa posição central/modelada, não "não sabemos".

Quando um eixo tiver evidência insuficiente, a ficha deve registrar explicitamente a incerteza antes da revisão final.

---

## 9. Fase F — testes finais por lote

### Backend

```bash
cd backend
mvn test
mvn package -DskipTests
```

Validar:

- startup dos JSONs;
- IDs únicos;
- categorias;
- representação;
- perfis completos;
- valores 0–100;
- payload masculino/feminino/misto;
- fallback de livros;
- PT/EN.

### Frontend

```bash
cd frontend
npm ci
npm test
npm run build
```

Validar manualmente:

- aba Misto inicial;
- troca Misto -> Mulheres -> Homens;
- hero;
- matches por dimensão;
- retratos;
- modal de personalidade;
- livros;
- compartilhamento;
- mobile.

---

## 10. Estratégia de commits

Manter commits pequenos por responsabilidade.

Exemplo:

```text
test(books): cover recommendation fallback
test(personality): validate portrait assets
feat(personality): add batch metadata
feat(i18n): translate female personality batch
feat(books): add books for female batch
feat(assets): add licensed female portraits
data(profiles): add reviewed personality vectors
docs(personality): update female expansion progress
```

Evitar misturar refactor amplo com alteração de dados.

---

## 11. Critério de conclusão de uma personalidade

Uma personalidade é `ready` apenas quando:

- [ ] metadata PT completa;
- [ ] metadata EN completa;
- [ ] `representation = female`;
- [ ] categoria válida;
- [ ] retrato local existente;
- [ ] origem/licença registrada;
- [ ] perfil de 12 eixos completo e revisado;
- [ ] fontes de auditoria registradas;
- [ ] livro validado quando aplicável;
- [ ] backend carrega sem erro;
- [ ] testes passam;
- [ ] frontend renderiza sem fallback inesperado.

Não é obrigatório possuir livro para integrar o catálogo. O sistema deve simplesmente recomendar a próxima obra elegível.

---

## 12. Checkpoints de revisão

### Checkpoint 1 — infraestrutura
- assets validados;
- fallback de livros coberto por testes;
- manifesto criado.

### Checkpoint 2 — 19 mulheres
- Rosa Parks;
- Lélia Gonzalez;
- Angela Davis.

### Checkpoint 3 — primeiro lote ampliado
Revisar qualidade do processo antes de escalar.

### Checkpoint 4 — aproximadamente 50 mulheres
Auditar distribuição regional, temporal e por categoria.

### Checkpoint 5 — aproximadamente 100 mulheres
Revisar performance, UX, duplicatas e qualidade editorial.

### Checkpoint 6 — 150 mulheres
Auditoria pré-meta.

### Checkpoint 7 — 193 mulheres
- auditoria completa;
- ativar teste de regressão da meta;
- atualizar README;
- preparar PR upstream.

---

## 13. Ordem de execução imediata

1. adicionar testes específicos do fallback de livros;
2. melhorar validação de retratos para verificar o arquivo físico;
3. criar manifesto de expansão;
4. finalizar metadata PT/EN de Rosa Parks, Lélia Gonzalez e Angela Davis;
5. obter retratos reutilizáveis e registrar atribuições;
6. revisar entradas bibliográficas;
7. montar fichas de evidência dos 12 eixos;
8. revisar os vetores;
9. integrar os perfis aprovados;
10. executar suíte backend/frontend;
11. atualizar contagem e documentação;
12. iniciar o lote seguinte.

---

## 14. Definition of Done da frente inteira

A expansão é considerada concluída quando:

- o catálogo atingir pelo menos 193 mulheres para a base masculina usada como referência nesta migração;
- todos os registros femininos possuírem metadata PT/EN consistente;
- todos os retratos forem locais, existentes e rastreáveis;
- todos os perfis matchable tiverem 12 eixos completos e auditados;
- recomendações de livros fizerem fallback corretamente;
- Misto permanecer ranking global sem cota de gênero;
- testes backend/frontend passarem;
- build de produção passar;
- documentação refletir o comportamento real;
- nenhuma personalidade feminina depender de hotlink para funcionar;
- a PR estiver dividida e documentada de forma revisável.

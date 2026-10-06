# Contexto da feature — expansão da representação feminina

> Branch de trabalho: `feat/women-leaders`
>
> Este arquivo contém apenas o contexto estável da feature: objetivo, invariantes, arquitetura, metodologia e regras que não devem se perder entre sessões.

## 1. Objetivo

Expandir a representação feminina no catálogo de personalidades do 12 Axes sem alterar a lógica ideológica do produto.

Base de referência da frente:

- 386 personalidades masculinas;
- 16 mulheres no início da migração;
- meta da release atual: **200 mulheres no runtime**;
- as 172 candidatas em staging completam exatamente a passagem das 28 atuais para 200.

Estado atual após a primeira integração ampliada:

- 28 mulheres no runtime;
- 386 homens;
- 414 personalidades no total;
- 172 candidatas ainda no pipeline;
- 200 mulheres planejadas no total;
- meta de 200 totalmente coberta pelo planejamento, ainda sujeita aos gates editoriais e de auditoria.

## 2. Invariantes de produto

### Representação

`representation` é metadata de catálogo e filtro de resultado.

Ela não pode:

- alterar o vetor do usuário;
- adicionar bônus ou penalidade;
- alterar a compatibilidade ideológica;
- forçar proporção entre gêneros.

O modo padrão continua sendo `mixed`.

`mixed` significa ranking global de compatibilidade, e não 50% homens + 50% mulheres.

### Livros

As recomendações possuem rankings masculino, feminino e misto.

Se uma personalidade compatível não tiver livro válido no catálogo local, o serviço continua descendo o ranking até encontrar outra elegível.

Ter livro não é requisito para integrar uma personalidade.

### Retratos

Retratos femininos integrados devem usar assets locais em:

`frontend/public/personalities/portraits/`

Não voltar a hotlinks externos em `imagePath`.

O build do frontend executa a validação de retratos antes do TypeScript/Vite.

## 3. Arquivos que formam a feature

Runtime:

- `backend/src/main/resources/data/personalities.json`
- `backend/src/main/resources/data/personality-profiles.json`
- `backend/src/main/resources/data/i18n/en/personalities.json`
- `backend/src/main/resources/data/books.json`

Pipeline editorial:

- `scripts/data/female-expansion.json`
- `scripts/data/female-profile-evidence.json`
- `scripts/validate-female-expansion.mjs`

Auditoria dos vetores:

- `profile-audit/answers/personality/`
- `profile-audit/subagent-out/personality/`
- `profile-audit/validate.py`

Assets:

- `frontend/public/personalities/portraits/`
- `frontend/scripts/validate-personality-portraits.mjs`

## 4. Modelo editorial dos 12 eixos

Os vetores são uma interpretação editorial comparativa, não uma medição científica.

Fontes documentam fatos e posições. Elas não geram automaticamente números de 0–100.

Regras:

1. manter evidência histórica separada da interpretação editorial;
2. não inferir posição apenas por rótulos políticos;
3. não usar `50` como sinônimo de ausência de evidência;
4. registrar incerteza quando uma fonte não sustenta um eixo;
5. validar as 240 respostas com `profile-audit/validate.py`;
6. não reconstruir automaticamente um vetor que já passou por revisão;
7. promoção ao runtime exige revisão humana.

## 5. Estados do pipeline

Estados válidos:

- `pending`: ainda não iniciado;
- `researching`: pesquisa ativa;
- `review`: dossiê factual pronto para revisão;
- `proposed`: interpretação editorial proposta;
- `ready`: aprovado pelo mantenedor para integração.

Uma candidata em `review`, `proposed` ou `ready` precisa ter:

- `evidenceFile` apontando para `female-profile-evidence.json`;
- pelo menos 2 fontes no dossiê;
- evidência documentada em pelo menos 3 eixos.

O validator também deve garantir:

- nenhum ID duplicado;
- nenhuma candidata ativa já presente no runtime;
- registros marcados como integrados realmente presentes no runtime;
- `progress` sincronizado com runtime + pipeline;
- planejamento total não abaixo da meta.

## 6. O que aprendemos com a integração interrompida

Um `push` bem-sucedido não prova que todo o trabalho de um agente entrou no commit.

Nesta frente ocorreu o seguinte:

1. parte dos arquivos foi commitada e enviada;
2. runtime, livros, testes e auditorias ainda estavam apenas no working tree local;
3. o trabalho foi recuperado por uma branch de resgate;
4. as 12 auditorias foram validadas novamente;
5. a integração foi aplicada sobre o HEAD remoto atual;
6. manifest, evidence e validator foram reconciliados depois.

Protocolo obrigatório daqui em diante:

1. antes de `pull`, `reset`, `rebase` ou troca destrutiva, rodar `git status --short`;
2. se houver trabalho local importante, criar branch/commit de resgate;
3. confirmar o HEAD remoto antes de escrever;
4. nunca assumir que o conteúdo descrito numa conversa está realmente commitado;
5. depois de integrar runtime, executar o validator do pipeline para reconciliar contagens.

## 7. Regras de segurança operacional

Não executar cegamente `scripts/implement_female_representation.mjs`.

O script contém material editorial histórico e não é fonte de verdade para vetores já revisados.

Também evitar:

- commits por personalidade;
- alterar `main`;
- recriar vetores auditados;
- apagar candidatas só para voltar exatamente a 193;
- declarar teste como aprovado sem executá-lo;
- misturar mudanças editoriais grandes com refactors não relacionados.

## 8. Estratégia de commits

Por lote, preferir poucos commits consolidados:

1. pesquisa + pipeline + evidências;
2. integração do lote no runtime;
3. testes/correções, se necessários.

A documentação deve refletir o estado real depois da reconciliação, e não servir como log histórico de cada tentativa.

## 9. Critério de conclusão da frente

A frente termina quando:

- houver **200 mulheres integradas no runtime**;
- as 200 mulheres tiverem auditoria permanente de 240 respostas + arquétipo;
- os perfis integrados tiverem metadata PT/EN consistente;
- retratos forem locais e validados;
- vetores tiverem auditoria completa;
- livros fizerem fallback corretamente;
- filtros de representação não afetarem compatibilidade;
- validator estiver limpo;
- testes backend/frontend e build passarem;
- o estado final estiver documentado e pronto para revisão upstream.

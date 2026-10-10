# Plano de ação — expansão feminina

> Documento operacional vivo.
>
> Validar este plano antes de escalar além do lote atual de 40.

## 1. Estado de partida

Checkpoint após concluir a pesquisa factual da leva de 40:

- runtime feminino: **28**;
- pipeline ativo: **172**;
- planejamento total: **200**;
- meta mínima: **193**;
- em `review`: **62**;
- em `researching`: **0**;
- em `pending`: **110**.

Os 40 dossiês do lote atual possuem pelo menos duas fontes e três campos de evidência. Isso significa **pesquisa pronta para revisão**, não perfil político aprovado.

Metadata, tradução, retratos e vetores continuam sujeitos aos gates próprios. Em especial, nenhum dos 40 foi promovido para `ready` ou runtime.

A meta de 193 é mínima. Não remover candidatas já planejadas apenas para fazer o total voltar a 193.

## 2. Estratégia de escala por lotes

O lote experimental anterior teve 20 novas pesquisas.

A partir dele, usar crescimento por dobra apenas quando o processo anterior estiver estável:

```text
20  -> processo validado
40  -> pesquisa concluída; checkpoint atual em review
80  -> lote atual aberto após validação do mantenedor
30  -> lote final ainda pendente
```

A dobra vale para **pesquisa aberta**, não significa integrar 40 ou 80 perfis sem revisão.

Cada lote continua passando individualmente pelos mesmos gates.

Se um lote revelar queda de qualidade, excesso de retrabalho ou gargalo de validação humana, manter ou reduzir o tamanho em vez de dobrar.

## 3. Trabalho em paralelo

Existem duas filas distintas:

### Fila A — fechar os 22 em review

Objetivo: transformar pesquisa já feita em perfis realmente integráveis.

Para cada uma:

1. revisar fontes e evidências;
2. fechar metadata PT;
3. fechar tradução EN;
4. obter e validar retrato local;
5. revisar livro quando aplicável;
6. produzir/validar auditoria de 240 respostas;
7. validar o vetor;
8. revisão humana;
9. integrar runtime;
10. reconciliar manifest.

### Fila B — revisar a pesquisa das 40

Estas 40 concluíram a passada factual e estão agora em `review`:

1. Frances Willard
2. Carrie Chapman Catt
3. Lucy Stone
4. Frances Perkins
5. Eleanor Roosevelt
6. Ruth Bader Ginsburg
7. Sandra Day O'Connor
8. Geraldine Ferraro
9. Jeannette Rankin
10. Clara Barton
11. Jane Addams
12. Rachel Carson
13. Wangari Maathai
14. Funmilayo Ransome-Kuti
15. Joyce Banda
16. Miriam Makeba
17. Nadine Gordimer
18. Leymah Gbowee
19. Tawakkol Karman
20. Shirin Ebadi
21. Nawal El Saadawi
22. Huda Sha'arawi
23. Fatema Mernissi
24. Sarojini Naidu
25. Vijaya Lakshmi Pandit
26. Aruna Asaf Ali
27. Kamaladevi Chattopadhyay
28. Savitribai Phule
29. Begum Rokeya
30. Malala Yousafzai
31. Aung San Suu Kyi
32. Megawati Sukarnoputri
33. Sirimavo Bandaranaike
34. Tsai Ing-wen
35. Qiu Jin
36. Akiko Yosano
37. Raichō Hiratsuka
38. Tomoe Gozen
39. Olympe de Gouges
40. Flora Tristan

## 3A. Lote atual de 80

Após aprovação do checkpoint anterior, os próximos 80 candidatos foram movidos de `pending` para `researching`.

Estado do pipeline nesta abertura:

- 62 em `review`;
- 80 em `researching`;
- 30 em `pending`;
- 28 já integradas no runtime.

Abrir o lote significa iniciar pesquisa factual. Não autoriza vetor, `ready` ou promoção ao runtime.

## 3B. Primeiro subbloco dos 80

Primeiro subbloco dos 80 concluído:

- 20 novos dossiês factuais movidos para `review`;
- 60 permanecem em `researching`;
- 30 permanecem em `pending`.

Os 20 dossiês seguem a mesma regra dos lotes anteriores: pelo menos duas fontes e pelo menos três campos de evidência, sem proposta numérica automática.

## 4A. Metadata editorial em staging

Os 22 perfis mais antigos em review já possuem drafts factuais PT/EN em:

`scripts/data/female-metadata-drafts.json`

Regras:

- `metadataStatus = review` significa que o draft factual existe, não que foi aprovado para runtime;
- `translationStatus = review` significa que a versão EN foi preparada e ainda pode receber revisão;
- livros só recebem `bookStatus = review` quando existe uma obra identificada no staging;
- livro continua opcional;
- o arquivo de staging não participa do matching.

O próximo gargalo desses 22 é retrato/licença + revisão editorial do perfil de 12 eixos.

## 4B. Retratos locais em review

Os 22 perfis mais antigos agora possuem JPEG local em:

`frontend/public/personalities/portraits/<id>.jpg`

Cada draft registra:

- arquivo de origem;
- URL da fonte;
- licença;
- atribuição;
- caminho local.

Os arquivos foram normalizados proporcionalmente para JPEG, sem crop.

`portraitStatus = review` significa que a origem/licença e o arquivo físico estão prontos, mas o mantenedor ainda deve conferir visualmente se enquadramento e escolha da foto funcionam no produto.

## 4. Pipeline obrigatório por personalidade

### Etapa 1 — pesquisa

Priorizar:

1. documentos primários e arquivos oficiais;
2. instituições públicas;
3. universidades;
4. Nobel/organizações institucionais relevantes;
5. enciclopédias e bibliografia acadêmica reputada.

Gate para sair de `researching`:

- pelo menos 2 fontes úteis;
- evidência em pelo menos 3 eixos;
- fatos separados de interpretação editorial.

### Etapa 2 — metadata

Preparar:

- nome;
- role;
- categoria válida;
- lifespan;
- descrição PT curta e factual;
- descrição EN equivalente;
- `representation = female`.

Descrições devem permanecer próximas do padrão do catálogo e evitar texto promocional ou julgamento político.

### Etapa 3 — retrato

- usar asset local;
- registrar origem;
- registrar licença/atribuição quando necessária;
- verificar arquivo físico;
- validar pelo script de portraits.

Sem retrato válido, não promover para `ready`.

### Etapa 4 — livros

Livro é opcional.

Quando houver obra relevante:

- conferir título;
- autoria;
- ano;
- localização PT/EN;
- associação correta com `personalityId`.

A ausência de livro não bloqueia integração.

### Etapa 5 — auditoria política

Para cada perfil:

1. produzir as 240 respostas + arquétipo;
2. não trabalhar de trás para frente a partir de um vetor desejado;
3. evitar excesso de `N`;
4. calcular o vetor pelo pipeline oficial;
5. rodar:

```bash
python3 profile-audit/validate.py personality <id>
```

Avisos de proximidade devem ser revisados; falhas bloqueantes precisam ser corrigidas.

### Etapa 6 — revisão humana

A IA pode preparar evidências e proposta editorial.

A decisão de promover para `ready` fica com o mantenedor.

Somente depois disso o perfil entra no runtime.

## 5. Regra de commits por lote

Não criar um commit por personalidade.

Preferir:

### Commit A — pesquisa/pipeline

Inclui:

- manifest;
- evidence;
- metadata preparada;
- bibliografia preparada;
- documentação necessária.

### Commit B — integração

Inclui:

- personalities PT;
- personalities EN;
- personality profiles;
- livros;
- retratos;
- arquivos permanentes de auditoria;
- testes relacionados.

### Commit C — correções

Somente se testes ou validações encontrarem problemas.

## 6. Protocolo contra perda de trabalho

Antes de qualquer operação que possa substituir o working tree:

```bash
git status --short
git diff --stat
git ls-files --others --exclude-standard
```

Se houver trabalho ainda não commitado:

```bash
git switch -c rescue/<nome>
git add -A
git commit -m "chore: preserve interrupted work"
```

Só depois sincronizar a branch principal de trabalho.

Nunca usar `reset --hard` antes de preservar trabalho importante.

## 7. Validação após cada integração

### Pipeline

```bash
node scripts/validate-female-expansion.mjs
```

O validator deve verificar o runtime real, não números históricos hardcoded.

### Perfis

```bash
python3 profile-audit/validate.py personality <id>
```

### Backend

```bash
cd backend
mvn test
```

### Frontend

```bash
cd frontend
npm ci
npm test
npm run build
```

Não registrar um teste como aprovado se ele não foi executado.

## 8. Checkpoint antes de abrir 80

O lote de 80 só começa quando o lote de 40 demonstrar que o processo escala sem reduzir qualidade.

Validar:

- [ ] 40 possuem fontes suficientes;
- [ ] dossiês mantêm no mínimo 2 fontes e 3 eixos;
- [ ] nenhuma candidata foi promovida ao runtime antes dos gates;
- [ ] qualidade das descrições continua consistente;
- [ ] retratos não viraram gargalo sem controle;
- [ ] auditorias não aumentaram duplicatas artificiais;
- [ ] validator continua limpo;
- [ ] estratégia de commits continua consolidada;
- [ ] não houve perda de trabalho entre local e remoto;
- [ ] mantenedor aprova abrir 80.

## 9. Próxima sequência prevista

Se o lote de 40 for validado:

1. abrir 80 dos 110 restantes;
2. manter 30 em `pending`;
3. concluir review/integration progressivamente;
4. abrir os 30 finais depois do checkpoint de 80;
5. quando o runtime atingir pelo menos 193 mulheres, transformar a meta em teste de regressão;
6. realizar auditoria final de distribuição regional, temporal e de categorias;
7. preparar a PR upstream.

## 10. Definition of Done de cada lote

Um lote só é fechado quando:

- pesquisa está documentada;
- metadata PT/EN está consistente;
- retratos locais estão válidos;
- vetores integrados foram auditados;
- revisão humana ocorreu;
- runtime e manifest não se sobrepõem;
- `progress` foi recalculado;
- validator passou;
- testes aplicáveis foram executados;
- commit(s) do lote estão no remoto.

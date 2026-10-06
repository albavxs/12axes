# Plano de auditoria — 200 mulheres / 12 eixos

> Produção: `feat/women-leaders`
>
> Ferramenta de revisão: `dev/personality-studio`
>
> Gate de merge: **200 mulheres no runtime com perfil auditável e revisado**.

## Estado inicial verificado

- 28 mulheres já estão no runtime;
- 172 mulheres estão no staging;
- 12 das 28 atuais possuem arquivo permanente de auditoria das 240 respostas;
- 16 mulheres já em runtime ainda precisam de backfill de auditoria;
- as 172 candidatas ainda precisam concluir a auditoria antes da promoção;
- backlog total: **188 auditorias**.

O objetivo não é simplesmente preencher 12 números. Cada vetor deve ser reproduzível a partir das respostas registradas.

## Cálculo da fila

O Studio calcula a fila a partir do estado real do repositório nesta ordem:

1. mulheres já no runtime sem arquivo permanente de auditoria;
2. candidatas com `profileStatus=review`;
3. candidatas em `researching`;
4. candidatas em `pending`.

A fila é dividida em lotes de até **15 perfis**. Com o estado atual, são 13 lotes para as 188 auditorias pendentes.

Quando uma auditoria permanente aparece no repositório, o Studio recalcula automaticamente os totais e a posição da fila.

## Definition of Done por perfil

Uma mulher só está pronta quando:

1. metadata PT foi revisada;
2. tradução EN foi revisada;
3. retrato JPEG local foi revisado;
4. fonte, licença e atribuição do retrato estão registradas;
5. evidência factual está suficiente e revisada;
6. existem 240 respostas — 20 por eixo — mais o arquétipo;
7. `python3 profile-audit/validate.py personality <id>` passa;
8. o vetor é calculado pelo pipeline oficial a partir das respostas;
9. o mantenedor revisa o resultado;
10. os gates necessários são promovidos para `ready`;
11. o perfil entra no runtime;
12. a candidata deixa o staging ativo.

## Regra para os 12 eixos

Não escrever diretamente um vetor desejado.

O fluxo correto é:

```text
evidência factual
      ↓
240 respostas + arquétipo
      ↓
validate.py
      ↓
profile_vector.py
      ↓
vetor de 12 eixos
      ↓
revisão humana
      ↓
ready/runtime
```

Isso evita fabricar um perfil político só para preencher o catálogo e deixa cada resultado revisável pergunta por pergunta.

## Trabalho em paralelo

### Trilha A — auditoria

Atacar continuamente os lotes da fila.

Perfis ainda sem evidência suficiente continuam na fila, mas precisam terminar a pesquisa factual antes de responder as 240 perguntas.

### Trilha B — retratos e metadata

Enquanto a auditoria avança, fechar fotos, licenças, metadata e tradução. Uma trilha não deve esperar a outra quando o trabalho pode ser feito em paralelo.

### Trilha C — promoção

Quando todos os gates de uma candidata estão completos e revisados:

- gravar auditoria permanente;
- gravar vetor;
- integrar PT/EN/livro/retrato;
- mover para runtime;
- remover do staging;
- recalcular contagens.

## Studio

O Studio deve mostrar, no mínimo:

- mulheres planejadas: 200;
- auditorias permanentes concluídas;
- auditorias restantes;
- lote atribuído ao perfil selecionado;
- estado de foto, metadata, evidência e auditoria;
- ação de preparar/validar auditoria.

O Studio continua sendo ferramenta dev-only e não entra na PR de produção.

## Gate final da PR

`feat/women-leaders -> main` permanece draft até:

- [ ] 200 mulheres no runtime;
- [ ] 200 auditorias permanentes;
- [ ] 200 vetores revisados;
- [ ] staging feminino ativo zerado para esta leva;
- [ ] todos os portraits de runtime locais e válidos;
- [ ] validator da expansão passa;
- [ ] testes backend passam;
- [ ] testes frontend passam;
- [ ] build frontend passa;
- [ ] nenhuma implementação do Personality Studio aparece no diff de produção.

## Sincronização das branches

Enquanto a feature estiver aberta, `dev/personality-studio` deve conter o HEAD de `feat/women-leaders` como ancestral.

Assim:

```text
main
  └─ feat/women-leaders
       └─ dev/personality-studio  (+ tooling somente)
```

Mudança editorial entra primeiro na feature e depois é incorporada ao Studio. Mudança puramente de ferramenta fica apenas no Studio.

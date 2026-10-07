# Plano de migração — 10 perfis femininos para o pipeline novo

## Situação atual

As 10 personalidades foram integradas pelo mesmo modelo legado usado na expansão feminina anterior:

1. vetor editorial definido;
2. `personality-profiles.json` recebe o vetor diretamente;
3. metadados PT/EN entram no catálogo runtime;
4. o Studio passa a lê-las como perfis runtime.

Esse caminho resolve o bloqueio imediato de exibição dos 12 eixos, mas não deve ser o estado final do pipeline.

## Problema a contornar

O fluxo antigo conseguia gerar respostas de auditoria a partir de um vetor-alvo (`auditFor()` / `valuesForTarget()`).
O protocolo atual exige o contrário: respostas independentes primeiro, vetor calculado depois.

Também existe uma diferença operacional entre:
- `profileReady`: existe vetor canônico utilizável pelo produto;
- `auditReady`: existe uma auditoria permanente das 240 perguntas que justifica esse vetor;
- `portraitReady`: asset local, licença e atribuição aprovados.

Esses gates não devem ser tratados como a mesma coisa.

## Estratégia

### Fase 1 — compatibilidade imediata

Manter os 10 vetores atuais em `backend/src/main/resources/data/personality-profiles.json` para que produto e Studio funcionem.

Não voltar a usar `candidate.profileVector` ou `dossier.proposedVector` como fonte paralela de verdade.

### Fase 2 — auditoria independente

Para cada uma das 10:

1. usar o dossiê histórico como contexto;
2. responder as 240 perguntas + 5 arquétipos sem consultar o vetor runtime;
3. rodar `profile-audit/validate.py`;
4. calcular o vetor com `profile_vector.py`;
5. comparar o vetor auditado com o vetor legado.

A comparação serve apenas para detectar discrepâncias, nunca para ajustar respostas ao alvo.

### Fase 3 — reconciliação

Classificar por diferença máxima entre eixos:

- até 8 pontos: substituir pelo auditado automaticamente após revisão rápida;
- 8–15 pontos: revisar os eixos divergentes e as fontes;
- acima de 15 pontos: revisão editorial completa antes de alterar runtime.

Depois da aprovação:
- substituir o vetor legado pelo auditado;
- arquivar `profile-audit/answers/personality/<id>.json`;
- marcar `auditReady`;
- registrar a origem do vetor como auditada.

### Fase 4 — corrigir o Studio

Remover os atalhos introduzidos para `candidate.profileVector` / `proposalProfile`.

O Studio deve mostrar separadamente:
- vetor runtime;
- vetor calculado da auditoria pendente;
- diferença eixo a eixo;
- estado da auditoria.

Assim conseguimos revisar uma migração sem esconder o vetor que está em produção.

### Fase 5 — corrigir o importador legado

Transformar `scripts/implement_female_representation.mjs` em ferramenta de migração, não de geração de verdade histórica.

O importador pode continuar aceitando vetores legados, mas:
- não deve mais gerar `answers/personality/*.json` a partir do vetor;
- deve marcar novos vetores importados como `legacy/manual`;
- deve exigir auditoria posterior antes de considerar o perfil totalmente validado.

### Fase 6 — imagens e merge de produção

Antes do merge para `feat/women-leaders`:
- confirmar os 10 JPEGs em `frontend/public/personalities/portraits/`;
- otimizar imagens;
- validar atribuição/licença;
- executar validator de retratos;
- rodar build frontend e testes backend.

Só os dados finais entram em `feat/women-leaders`; código do Personality Studio permanece em `dev/personality-studio`.

## Resultado esperado

O projeto continua funcionando imediatamente com os vetores legados, mas migra gradualmente para o protocolo novo sem bloquear a expansão e sem fabricar auditorias a partir de números-alvo.

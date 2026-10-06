---
name: audit-female-200
description: Coordena a expansão feminina até 200 perfis auditáveis, pesquisando evidência 12/12 e disparando um subagente isolado por personalidade antes do merge.
---

# /audit_female_200

Objetivo: chegar a **200 mulheres no runtime, 200 auditorias permanentes e 200 vetores revisados**.

## Fonte de verdade

Não use `STATE.json` para esta frente. A fila é derivada do estado real:

```bash
python3 profile-audit/female_audit_queue.py
python3 profile-audit/female_audit_queue.py --batch N
```

Prioridade: runtime sem audit → staging review/proposed → researching → pending.

## Regra de paralelismo

Trabalhe um lote de até 15. Cada personalidade pertence a **um subagente independente**.

Nunca deixe dois subagentes editarem o mesmo JSON compartilhado em paralelo.

### Fase A — research

Para cada item `phase=research`, dispare simultaneamente um subagente de pesquisa de qualidade.
Ele deve:

1. ler metadata PT/EN da personalidade e o dossiê existente, se houver;
2. pesquisar fontes primárias/institucionais e literatura de referência;
3. preencher evidência específica para **todos os 12 eixos**;
4. não inventar posição a partir de rótulo partidário;
5. registrar incerteza no texto quando necessário, sem transformar falta de evidência em score 50;
6. escrever somente:
   `profile-audit/subagent-evidence/personality/<id>.json`
7. usar schema:
   `{"id":"...","sources":[{"url":"...","institution":"..."}],"evidence":{"estrutura":"...",...12 eixos...}}`.

Quando todos terminarem, o coordenador valida e mescla **sequencialmente**:

```bash
python3 profile-audit/merge_female_evidence.py <id> --check
python3 profile-audit/merge_female_evidence.py <id>
```

Depois rode novamente `female_audit_queue.py --batch N`.

### Fase B — audit

Somente itens `phase=audit` podem receber as 240 perguntas.

Para cada perfil, use o protocolo de `.claude/skills/audit-personality/SKILL.md` e
`profile-audit/README.md`:

- 12 personaBriefs;
- 20 respostas por eixo;
- 5 respostas de arquétipo;
- saída isolada em `profile-audit/subagent-out/personality/<id>.json`;
- nunca copiar respostas de outro perfil;
- nunca escrever o vetor desejado diretamente.

Dispare os subagentes simultaneamente. Depois, no coordenador:

1. `python3 profile-audit/validate.py personality <id>`;
2. ler erros e warnings;
3. relançar somente o perfil que falhar;
4. calcular vetor pelo pipeline oficial;
5. arquivar em `profile-audit/answers/personality/<id>.json`;
6. atualizar runtime/staging apenas depois da revisão humana.

## Gate

`review` pode ter pesquisa parcial. `proposed` e `ready` exigem 12/12.
`ready` exige também auditoria permanente.

Não promova uma candidata porque metadata/foto estão prontas.

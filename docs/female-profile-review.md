# Revisão editorial dos perfis femininos

Este arquivo é o gate humano entre pesquisa e runtime.

## Estados

- `pending`: ainda sem pesquisa suficiente.
- `researching`: fontes sendo reunidas.
- `review`: evidências factuais prontas para leitura.
- `proposed`: existe uma proposta editorial dos 12 eixos; ela ainda não é um dado aprovado.
- `ready`: proposta revisada pelo mantenedor e autorizada para entrar no matching.

## Regra de interpretação

Os 12 eixos são um modelo editorial do 12 Axes, não medições científicas de uma pessoa. Fontes sustentam fatos e posições documentadas; elas não produzem automaticamente um número de 0 a 100.

Uma proposta deve indicar:

1. evidência usada;
2. eixo ao qual a evidência foi relacionada;
3. grau de incerteza;
4. valor editorial proposto;
5. observação do revisor quando alterado.

## Checklist por lote

- [ ] fontes institucionais/acadêmicas registradas;
- [ ] descrição PT revisada;
- [ ] descrição EN revisada;
- [ ] retrato local com origem/licença;
- [ ] bibliografia revisada quando aplicável;
- [ ] evidência por eixo disponível;
- [ ] proposta numérica marcada como `proposed`;
- [ ] revisão humana concluída;
- [ ] `profileStatus = ready`;
- [ ] integração no runtime;
- [ ] testes backend;
- [ ] testes frontend.

## Regra para ausência de evidência

Não usar 50 como sinônimo de “desconhecido”. Quando não houver material suficiente, registrar a lacuna e manter a proposta em revisão.

## Promoção

Somente perfis `ready` podem ser copiados para `personality-profiles.json`. O script de validação do pipeline deve continuar tratando qualquer outro estado como bloqueado do runtime.

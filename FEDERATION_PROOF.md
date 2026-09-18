# Prova de Federação Real — Operador B

## Objetivo

Provar que dois operadores da Machine Bridge, pertencentes ao projeto e independentes em nível de repositório, conseguem trocar evidências vinculadas à propriedade da execução sem misturar as fronteiras de confiança, execução e reconciliação.

## Gates obrigatórios

1. O Operador A confia explicitamente na identidade do Operador B.
2. O Operador B confia explicitamente apenas na identidade esperada do Operador A para a prova.
3. Requisições e evidências são assinadas e vinculadas ao ownership.
4. O replay de uma requisição ou evidência já consumida falha de forma fechada ou é tratado de maneira idempotente.
5. Nenhum shell arbitrário ou caminho de linguagem natural para execução é introduzido.
6. Aceitação remota não é tratada como conclusão.
7. A conclusão só é reconciliada na origem a partir de evidência remota verificada e do hash do resultado.
8. Evidência ausente ou timeout nunca prova que não houve execução.
9. Rejeição remota nunca aciona failover automático entre peers.
10. A primeira prova utiliza uma capacidade limitada e não destrutiva (`worker.ping` ou equivalente).

## Evidências a preservar

- identificador da requisição/prova e hashes, sem payloads privados;
- identidade do Operador B selecionado;
- evidências assinadas de `accepted`, `rejected` e/ou `completed`;
- resultado da reconciliação na origem;
- identificadores de CI/runs relevantes à prova;
- resultado do teste de replay/idempotência.

## Estado atual

A superfície do Operador B foi inicializada. O runtime/transporte de implantação ainda não está instalado. Nenhuma afirmação de federação real concluída pode ser feita até que os gates acima sejam exercitados atravessando efetivamente a fronteira entre os repositórios.

## Convenção documental

Documentação voltada a pessoas é mantida em português (pt-BR). Identificadores de código, campos de protocolo, schemas e nomes técnicos permanecem em inglês quando necessário para compatibilidade.

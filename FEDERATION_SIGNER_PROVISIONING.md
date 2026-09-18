# Provisionamento da identidade operacional do Operador B

## Objetivo

Conectar o `createExternalMeshSigner` a uma chave Ed25519 persistente sem colocar a chave privada no repositório, logs, artefatos ou payloads da federação.

## Estado atual

A interface criptográfica está implementada, mas nenhuma identidade de B deve ser tratada como operacional enquanto a posse contínua da chave privada não tiver sido demonstrada. Chaves públicas anteriormente publicadas sem posse persistente comprovada não constituem identidade operacional.

## Contrato de implantação

O ambiente de execução deve fornecer a chave privada por um mecanismo secreto externo ao Git. O adaptador de implantação converte esse segredo exclusivamente em uma função `signBytes(bytes)`. O restante do Machine Bridge recebe somente a chave pública, fingerprint e assinatura.

Requisitos:

1. Ed25519.
2. segredo persistente entre execuções autorizadas;
3. segredo nunca gravado no checkout;
4. segredo nunca impresso em logs;
5. chave pública derivada da privada deve coincidir com a identidade publicada;
6. falha de acesso, divergência ou rotação não autorizada deve falhar fechado;
7. rotação exige nova prova de posse e atualização explícita do pin;
8. perda da chave coloca a identidade em `unavailable`; não gerar substituta silenciosamente.

## GitHub Actions

Uma implantação possível é um Actions Secret configurado manualmente no repositório do Operador B. O workflow deve recebê-lo somente no passo de assinatura. O valor não deve aparecer em argumentos de linha de comando nem ser persistido em arquivo versionado.

Este repositório não provisiona automaticamente esse segredo. A presença de código de signer ou de uma chave pública não prova que o segredo existe.

## Gate para prova federativa real

A prova A→B→A só pode ser declarada quando:

- A possui identidade operacional com posse comprovada;
- B possui identidade operacional com posse comprovada;
- A envia statement Mesh assinado e pinado por B;
- B valida e executa o probe restrito;
- B produz evidência Mesh assinada pela identidade operacional de B;
- A valida B pelo Trust Store canônico e reconcilia o mesmo requestId/resultHash;
- replay/idempotência são verificados de forma durável.

Até todos os itens ocorrerem, o estado é preparação de federação, não prova de federação ao vivo.

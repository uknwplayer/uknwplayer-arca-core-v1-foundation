# Transporte de Federação via GitHub — V1

## Objetivo

Usar o próprio repositório independente do Operador B como superfície de rendezvous para a primeira prova real A ↔ B, sem introduzir servidor próprio ou serviço pago.

## Fronteira

O Operador A publica uma requisição assinada em `federation/inbox/<requestId>.json` no repositório do Operador B. O B valida identidade, assinatura, validade, replay e capacidade antes de executar `worker.ping`. O resultado correlacionado é publicado em `federation/outbox/<requestId>.json`.

A existência de um arquivo no inbox não significa aceitação nem execução. Somente evidência/resultados verificados podem alterar a interpretação na origem.

## Restrições

- somente o repositório project-owned do Operador B é aceito;
- IDs não podem conter caminhos ou traversal;
- nenhuma credencial é persistida nos arquivos;
- nenhuma ação arbitrária é autorizada;
- não há failover automático;
- transporte e autorização permanecem camadas separadas.

## Estado

Este adaptador define e testa a fronteira de transporte. A primeira travessia A → B → A só será declarada concluída após uma requisição real, assinada e verificável ser materializada e processada entre os dois repositórios.

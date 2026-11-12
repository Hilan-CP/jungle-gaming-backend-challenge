# Modelo de dados
- Foi implementado o modelo padrão sugerido nas orientações do projeto
- Esquemas criados a partir de `EntitySchema` de forma programática usando classes de estado, desta forma, as classes de domínio (entity) são intocadas pelo ORM
- As buscas retornam estados que são convertidos para entidades através de factories (rehydrate)
- Em operações de inserção, o estado é criado recebendo a entidade via construtor
- Em operações de atualização, primeiro o estado é criado recebendo a entidade via construtor, depois o estado gerenciado é buscado na memória e por fim é feito um assign para atualizar o estado gerenciado com os dados do estado recebido

# Validações de request
- Foi usado a validação built-in do NestJS com `class-validator` e `class-transformer`

# Serviços
- Foi usado a biblioteca `canonicalize` (conforme RFC 8785) junto com `sha256` para fazer o hash dos payloads
- Foi usado lock otimista versionado automaticamente pelo MikroORM conforme sugerido nas orientações do projeto
- Para idempotência foram usados tanto a `Idempotency-Key` quanto o par `providerId + externalTransactionId`
- Transações de criação de carteira e processamento de aposta são atômicas controladas por `em.transactional()`

# Workers
- Foram implementados dois workers para processar mensagens da SQS, ambos com polling definido nas variáveis de ambiente
- O worker `OutboxPublisherWorker` publica mensagens da fila outbox para a SQS
- O worker `SqsConsumerWorker` processa mensagens da fila de consumo

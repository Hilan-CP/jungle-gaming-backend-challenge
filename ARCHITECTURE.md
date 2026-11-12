# Modelo de dados
- Foi criado um esquema a partir de `EntitySchema` de forma programática para evitar usar decorators nas entidades de domínio
- Foi implementado o modelo padrão sugerido nas orientações do projeto

# Validações de request
- Foi usado a validação built-in do NestJS com `class-validator` e `class-transformer`

# Serviços
- Foi usado a biblioteca `canonicalize` (conforme RFC 8785) junto com `sha256` para fazer o hash dos payloads
- Foi usado lock otimista versionado do MikroORM conforme sugerido nas orientações do projeto
- Para idempotência foram usados tanto a `Idempotency-Key` quanto o par `providerId + externalTransactionId`
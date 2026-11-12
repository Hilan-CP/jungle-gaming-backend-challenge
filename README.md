# Wager & Wallet Service - Jungle Gaming

Aplicação backend desenvolvida como parte do **desafio técnico de engenharia de software da Jungle Gaming**. O sistema implementa uma API financeira e de apostas, gerenciando carteiras de jogadores, livro-razão contábil imutável (Audit Ledger), transações idempotentes de apostas (BET, WIN, LOSS, REFUND, ROLLBACK) e reconciliação de saldos.

---

## 🏛 Decisões de Arquitetura

As decisões técnicas, padrões de projeto e motivações arquiteturais estão documentadas no arquivo [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 📁 Estrutura de Pastas

```text
├── src/
│   ├── controller/               # Controladores HTTP (REST API / Swagger)
│   ├── dto/                      # Data Transfer Objects com validações class-validator e OpenAPI
│   ├── entity/                   # Entidades de domínio e Value Objects (Wallet, Money, Ledger, etc.)
│   │   └── database-schema/      # Mapeamentos e esquemas de persistência do MikroORM
│   ├── error/                    # Erros customizados e exceções de domínio
│   ├── migrations/               # Migrações versionadas do banco de dados (MikroORM)
│   ├── repository/               # Camada de repositórios e acesso a dados
│   ├── service/                  # Casos de uso e serviços de aplicação (WageringService, WalletService)
│   ├── util/                     # Utilitários compartilhados (como hash canônico de payloads)
│   ├── app.module.ts             # Módulo raiz do NestJS e injeção de dependências
│   ├── main.ts                   # Ponto de entrada da aplicação HTTP e configuração do Swagger
│   └── mikro-orm.config.ts       # Configurações de conexão e banco de dados do MikroORM
├── test/                         # Testes e2e e configurações do Jest
├── docker-compose.yaml           # Serviços de infraestrutura local (PostgreSQL, LocalStack, pgAdmin)
└── package.json                  # Scripts e dependências do projeto
```

---

## 🚀 Como Executar o Projeto

### 1. Pré-requisitos
* [Bun](https://bun.sh/) (versão 1.4.4+ recomendada para evitar problemas com ORM)
* [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/)

### 2. Variáveis de Ambiente
Copie o arquivo de exemplo para configurar o ambiente:

```bash
cp .env.example .env
```

### 3. Subir a Infraestrutura (Docker Compose)
Inicie os serviços de banco de dados (PostgreSQL), mensageria (LocalStack SQS) e gerência (pgAdmin):

```bash
docker compose up -d
```

* **PostgreSQL:** `localhost:5432` (banco `wager_db`, usuário `postgres`, senha `postgres`)
* **LocalStack:** `http://localhost:4566`
* **pgAdmin:** `http://localhost:5050` (email: `me@example.com`, senha: `123456`)

### 4. Instalar Dependências
```bash
bun install
```

### 5. Executar as Migrações do Banco de Dados
Aplique o schema no PostgreSQL:

```bash
bun run migration:up
```

### 6. Executar a Aplicação

* **Modo de desenvolvimento (com hot-reload):**
  ```bash
  bun run start:dev
  ```

* **Modo de produção:**
  ```bash
  bun run build
  bun run start:prod
  ```

A documentação interativa da API estará disponível via Swagger em `http://localhost:3000/api/docs`.

---

## 🧪 Outros Scripts Úteis

* **Testes unitários e e2e:**
  ```bash
  bun run test        # Executar testes unitários
  bun run test:e2e    # Executar testes ponta a ponta
  bun run test:cov    # Relatório de cobertura
  ```
* **Linting e Formatação:**
  ```bash
  bun run lint        # Verificação de código com oxlint
  bun run format      # Formatação automática com prettier
  ```
* **Migrações:**
  ```bash
  bun run migration:create  # Criar nova migration
  bun run migration:down    # Reverter última migration
  ```

---

## 📝 Convenção de Commits
* `feat`: Nova funcionalidade completa/parcial
* `fix`: Correção de bug
* `docs`: Alterações na documentação
* `refactor`: Mudança no código que não altera comportamento
* `test`: Adição ou ajuste de testes
* `chore`: Atualização, configuração ou estruturação do projeto
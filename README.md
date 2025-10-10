# mcp-db-bridge

[English](#english) | [Português](#português)

---

## English

[![Version](https://img.shields.io/npm/v/mcp-db-bridge)](https://www.npmjs.com/package/mcp-db-bridge)


MCP (Model Context Protocol) server for MySQL, PostgreSQL & SQLite with granular permissions, multi-DB support, and cloud-ready SSL/TLS. Built with adapter pattern for extensibility.

### Features

- 🔌 **Multi-Database**: MySQL, PostgreSQL, SQLite
- 🏗️ **Adapter Pattern**: Clean and extensible architecture
- ☁️ **Cloud-Ready**: SSL/TLS for AWS RDS, Google Cloud SQL, Azure Database
- 🔒 **Security First**: Read-only mode + granular schema permissions
- 🌐 **Multi-DB Mode**: Simultaneous access to multiple schemas/databases
- 🔄 **Transactions**: Automatic BEGIN/COMMIT/ROLLBACK
- 🚀 **HTTP Mode**: Optional remote HTTP server (Express)

### Installation

```bash
npm install mcp-db-bridge
# or
pnpm add mcp-db-bridge
```

### Quick Start

#### MySQL (Local)

```bash
# .env
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=password
DB_NAME=mydb
```

#### PostgreSQL (Local)

```bash
# .env
DB_TYPE=postgresql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASS=password
DB_NAME=mydb
```

#### SQLite (In-Memory)

```bash
# .env
DB_TYPE=sqlite
SQLITE_DB=:memory:
```

#### Run

```bash
pnpm build
pnpm start
# or
node dist/index.js
```

### Configuration

#### Database Types

```bash
DB_TYPE=mysql          # MySQL
DB_TYPE=postgresql     # PostgreSQL
DB_TYPE=sqlite         # SQLite
```

#### Connection Settings

**Generic (All Databases)**

```bash
DB_HOST=127.0.0.1
DB_PORT=3306           # MySQL: 3306, PostgreSQL: 5432
DB_USER=root
DB_PASS=password
DB_NAME=mydb           # Leave empty for multi-DB mode
DB_CONNECTION_LIMIT=10
```

**MySQL-Specific (Backward Compatibility)**

```bash
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASS=password
MYSQL_DB=mydb
MYSQL_SOCKET_PATH=/tmp/mysql.sock  # Unix socket (priority over host/port)
```

**PostgreSQL-Specific**

```bash
POSTGRESQL_HOST=127.0.0.1
POSTGRESQL_PORT=5432
POSTGRESQL_DB=mydb
```

**SQLite-Specific**

```bash
SQLITE_DB=:memory:              # In-memory database
SQLITE_DB=/var/lib/app/data.db  # File-based database
```

### Security & Permissions

#### Read-Only Mode

Blocks **all** write operations at application level:

```bash
DB_READ_ONLY_MODE=true
```

#### Global Write Permissions

Fine-grained operation control by type (applied globally):

```bash
ALLOW_INSERT_OPERATION=true   # Allow INSERT
ALLOW_UPDATE_OPERATION=true   # Allow UPDATE
ALLOW_DELETE_OPERATION=false  # Block DELETE
ALLOW_DDL_OPERATION=false     # Block CREATE/ALTER/DROP/TRUNCATE
```

#### Schema-Specific Permissions

Override global permissions for specific schemas:

```bash
# Format: "schema1:true,schema2:false,schema3:true"
SCHEMA_INSERT_PERMISSIONS=prod_db:false,test_db:true,staging_db:true
SCHEMA_UPDATE_PERMISSIONS=prod_db:false,test_db:true,staging_db:true
SCHEMA_DELETE_PERMISSIONS=prod_db:false,test_db:false,staging_db:false
SCHEMA_DDL_PERMISSIONS=prod_db:false,test_db:true,staging_db:false
```

**How it works:**
- If schema has specific permission → use it
- Otherwise → use global flag

**Example:**
```bash
# Global: INSERT blocked
ALLOW_INSERT_OPERATION=false

# test_db can insert, prod_db cannot
SCHEMA_INSERT_PERMISSIONS=test_db:true,prod_db:false

# Result:
# - INSERT on test_db: ✅ allowed (schema permission)
# - INSERT on prod_db: ❌ blocked (schema permission)
# - INSERT on other_db: ❌ blocked (global permission)
```

### Multi-DB Mode

Access multiple databases/schemas through a single connection.

#### Activation

Leave `DB_NAME` empty (MySQL/PostgreSQL only):

```bash
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=password
DB_NAME=                # Empty = multi-DB mode
```

#### Write Protection

By default, multi-DB mode is **read-only** for security. To allow writes:

```bash
MULTI_DB_WRITE_MODE=true  # ⚠️ Use with caution!
```

**Recommendation:** Use `SCHEMA_*_PERMISSIONS` for granular control instead of `MULTI_DB_WRITE_MODE=true`.

#### Complete Example

```bash
# Multi-DB with granular permissions
DB_TYPE=mysql
DB_NAME=                                    # Multi-DB mode
ALLOW_INSERT_OPERATION=false                # Global: blocked
SCHEMA_INSERT_PERMISSIONS=test_db:true      # Exception: test_db can insert
SCHEMA_UPDATE_PERMISSIONS=test_db:true      # Exception: test_db can update
SCHEMA_DELETE_PERMISSIONS=test_db:false     # test_db: DELETE blocked
SCHEMA_DDL_PERMISSIONS=test_db:true         # test_db: DDL allowed
```

### SSL/TLS for Cloud Databases

#### AWS RDS (MySQL/PostgreSQL)

```bash
DB_TYPE=mysql
DB_HOST=myinstance.123456789012.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
# Optional: DB_SSL_CA=/path/to/aws-rds-ca-cert.pem
```

#### Google Cloud SQL (PostgreSQL)

```bash
DB_TYPE=postgresql
DB_HOST=34.123.45.67
DB_PORT=5432
DB_SSL=true
DB_SSL_CA=/path/to/server-ca.pem
DB_SSL_CERT=/path/to/client-cert.pem
DB_SSL_KEY=/path/to/client-key.pem
```

#### Azure Database for MySQL

```bash
DB_TYPE=mysql
DB_HOST=myserver.mysql.database.azure.com
DB_PORT=3306
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

### Remote MCP (HTTP Server)

Run MCP server via HTTP with authentication:

```bash
# .env
IS_REMOTE_MCP=true
REMOTE_SECRET_KEY=your-secret-key-here
PORT=3000
```

Endpoint: `POST http://localhost:3000/mcp`

Header: `Authorization: Bearer your-secret-key-here`

### Architecture

```
src/
├── db/
│   ├── adapters/
│   │   ├── types.ts              # Interfaces and types
│   │   ├── factory.ts            # Factory pattern
│   │   ├── mysql.adapter.ts      # MySQL via mysql2
│   │   ├── postgresql.adapter.ts # PostgreSQL via pg
│   │   └── sqlite.adapter.ts     # SQLite via better-sqlite3
│   ├── index.ts                  # Core query handlers
│   ├── utils.ts                  # SQL parsing (node-sql-parser)
│   └── permissions.ts            # Schema permission checks
├── config/
│   └── index.ts                  # Environment configuration
├── utils/
│   └── index.ts                  # Logging & utilities
└── types/
    └── index.ts                  # Type definitions
```

#### Adapter Pattern

Each adapter implements the `DatabaseAdapter` interface:

```typescript
export interface DatabaseAdapter {
  readonly type: DatabaseType;
  createPool(config: ConnectionConfig): Promise<DatabasePool>;
  executeQuery<T>(pool: DatabasePool, sql: string, params?: any[]): Promise<T>;
  setReadOnly(connection: DatabaseConnection): Promise<void>;
  unsetReadOnly(connection: DatabaseConnection): Promise<void>;
  normalizeResult(result: any): NormalizedResult;
  supportsReadOnlyMode(): boolean;
}
```

#### Transaction Flows

**Read Operations:**
```
BEGIN → SET TRANSACTION READ ONLY → QUERY → ROLLBACK → RESET TO READ WRITE
```

**Write Operations:**
```
BEGIN → QUERY → COMMIT (or ROLLBACK on error)
```

### Examples

#### MySQL with Unix Socket

```bash
DB_TYPE=mysql
MYSQL_SOCKET_PATH=/tmp/mysql.sock
DB_USER=root
DB_PASS=password
DB_NAME=mydb
```

#### PostgreSQL Multi-DB with Permissions

```bash
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=password
DB_NAME=                                      # Multi-DB mode
SCHEMA_INSERT_PERMISSIONS=app_db:true         # app_db can insert
SCHEMA_UPDATE_PERMISSIONS=app_db:true         # app_db can update
SCHEMA_DELETE_PERMISSIONS=app_db:false        # app_db: DELETE blocked
```

#### SQLite Read-Only

```bash
DB_TYPE=sqlite
SQLITE_DB=/var/lib/data/production.db
DB_READ_ONLY_MODE=true
```

#### AWS RDS MySQL with SSL

```bash
DB_TYPE=mysql
DB_HOST=prod.abc123.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASS=secure_password
DB_NAME=production
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
ALLOW_INSERT_OPERATION=false
ALLOW_UPDATE_OPERATION=false
ALLOW_DELETE_OPERATION=false
ALLOW_DDL_OPERATION=false
```

### Development

```bash
pnpm dev              # Run in dev mode (tsx)
pnpm build            # Compile TypeScript
pnpm watch            # Watch mode
pnpm exec             # Build + run with .env
```

### Testing

```bash
pnpm test              # Run all tests (setup + vitest run)
pnpm test:watch        # Watch mode
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests (MySQL, socket, permissions)
pnpm test:e2e          # End-to-end tests
pnpm test:coverage     # Coverage report
```

**Test Structure:**
```
tests/
├── unit/           # Isolated functions (query parsing, utils)
├── integration/    # Real database operations
└── e2e/           # Complete MCP server workflows
```

### Performance Tuning

#### Connection Pool

```bash
DB_CONNECTION_LIMIT=20  # Default: 10
```

#### Disable Read-Only Transactions (MySQL)

⚠️ **Not recommended** - reduces security:

```bash
MYSQL_DISABLE_READ_ONLY_TRANSACTIONS=true
```

### Environment Variables Reference

#### Core Database Settings

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DB_TYPE` | Database type | `mysql` | `mysql`, `postgresql`, `sqlite` |
| `DB_HOST` | Database host | `127.0.0.1` | `localhost`, `db.example.com` |
| `DB_PORT` | Database port | `3306` | `3306` (MySQL), `5432` (PostgreSQL) |
| `DB_USER` | Database user | `root` | `admin`, `postgres` |
| `DB_PASS` | Database password | `""` | `secure_password` |
| `DB_NAME` | Database name | `undefined` | `mydb`, `""` (multi-DB) |
| `DB_CONNECTION_LIMIT` | Pool size | `10` | `20` |

#### Security Settings

| Variable | Description | Default | Values |
|----------|-------------|---------|--------|
| `DB_READ_ONLY_MODE` | Global read-only mode | `false` | `true`, `false` |
| `ALLOW_INSERT_OPERATION` | Global INSERT permission | `false` | `true`, `false` |
| `ALLOW_UPDATE_OPERATION` | Global UPDATE permission | `false` | `true`, `false` |
| `ALLOW_DELETE_OPERATION` | Global DELETE permission | `false` | `true`, `false` |
| `ALLOW_DDL_OPERATION` | Global DDL permission | `false` | `true`, `false` |
| `MULTI_DB_WRITE_MODE` | Allow writes in multi-DB | `false` | `true`, `false` |

#### Schema Permissions

| Variable | Format | Example |
|----------|--------|---------|
| `SCHEMA_INSERT_PERMISSIONS` | `schema:bool,schema:bool` | `test_db:true,prod_db:false` |
| `SCHEMA_UPDATE_PERMISSIONS` | `schema:bool,schema:bool` | `test_db:true,prod_db:false` |
| `SCHEMA_DELETE_PERMISSIONS` | `schema:bool,schema:bool` | `test_db:false,prod_db:false` |
| `SCHEMA_DDL_PERMISSIONS` | `schema:bool,schema:bool` | `test_db:true,prod_db:false` |

#### SSL/TLS Settings

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DB_SSL` | Enable SSL/TLS | Cloud DBs | `true`, `false` |
| `DB_SSL_REJECT_UNAUTHORIZED` | Strict SSL validation | Production | `true`, `false` |
| `DB_SSL_CA` | CA certificate path | Cloud SQL | `/path/to/ca.pem` |
| `DB_SSL_CERT` | Client certificate | Cloud SQL | `/path/to/cert.pem` |
| `DB_SSL_KEY` | Client key | Cloud SQL | `/path/to/key.pem` |

#### Remote MCP Settings

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `IS_REMOTE_MCP` | Enable HTTP mode | No | `true`, `false` |
| `REMOTE_SECRET_KEY` | Auth token | If remote | `your-secret-key` |
| `PORT` | HTTP server port | No | `3000` |

### Troubleshooting

#### Connection Errors

**MySQL socket not found:**
```bash
# Check socket path
sudo mysql -u root -p -e "SELECT @@socket;"

# Set in .env
MYSQL_SOCKET_PATH=/var/run/mysqld/mysqld.sock
```

**PostgreSQL connection refused:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check port
sudo netstat -tulpn | grep 5432
```

#### Permission Errors

**"Operation not allowed in read-only mode":**
```bash
# Check global read-only mode
DB_READ_ONLY_MODE=false

# Check multi-DB mode
MULTI_DB_WRITE_MODE=true  # If needed

# Or use schema permissions
SCHEMA_INSERT_PERMISSIONS=mydb:true
```

**"INSERT not allowed for schema 'mydb'":**
```bash
# Check global permission
ALLOW_INSERT_OPERATION=true

# Or add schema exception
SCHEMA_INSERT_PERMISSIONS=mydb:true
```

### License

MIT

### Credits

- **mcp-server-mysql**: [@benborla](https://github.com/benborla/mcp-server-mysql)

---

## Português

[![Version](https://img.shields.io/npm/v/mcp-db-bridge)](https://www.npmjs.com/package/mcp-db-bridge)


Servidor MCP (Model Context Protocol) para MySQL, PostgreSQL e SQLite com permissões granulares, suporte multi-DB e SSL/TLS pronto para nuvem. Construído com adapter pattern para extensibilidade.

### Funcionalidades

- 🔌 **Multi-Database**: MySQL, PostgreSQL, SQLite
- 🏗️ **Adapter Pattern**: Arquitetura limpa e extensível
- ☁️ **Cloud-Ready**: SSL/TLS para AWS RDS, Google Cloud SQL, Azure Database
- 🔒 **Security First**: Modo read-only + permissões granulares por schema
- 🌐 **Multi-DB Mode**: Acesso simultâneo a múltiplos schemas/databases
- 🔄 **Transações**: BEGIN/COMMIT/ROLLBACK automático
- 🚀 **Modo HTTP**: Servidor HTTP remoto opcional (Express)

### Instalação

```bash
npm install mcp-db-bridge
# ou
pnpm add mcp-db-bridge
```

### Início Rápido

#### MySQL (Local)

```bash
# .env
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=password
DB_NAME=mydb
```

#### PostgreSQL (Local)

```bash
# .env
DB_TYPE=postgresql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASS=password
DB_NAME=mydb
```

#### SQLite (In-Memory)

```bash
# .env
DB_TYPE=sqlite
SQLITE_DB=:memory:
```

#### Executar

```bash
pnpm build
pnpm start
# ou
node dist/index.js
```

### Configuração

#### Tipos de Banco de Dados

```bash
DB_TYPE=mysql          # MySQL
DB_TYPE=postgresql     # PostgreSQL
DB_TYPE=sqlite         # SQLite
```

#### Configurações de Conexão

**Genéricas (Todos os Bancos)**

```bash
DB_HOST=127.0.0.1
DB_PORT=3306           # MySQL: 3306, PostgreSQL: 5432
DB_USER=root
DB_PASS=password
DB_NAME=mydb           # Deixe vazio para modo multi-DB
DB_CONNECTION_LIMIT=10
```

**Específicas do MySQL (Compatibilidade)**

```bash
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASS=password
MYSQL_DB=mydb
MYSQL_SOCKET_PATH=/tmp/mysql.sock  # Unix socket (prioridade sobre host/port)
```

**Específicas do PostgreSQL**

```bash
POSTGRESQL_HOST=127.0.0.1
POSTGRESQL_PORT=5432
POSTGRESQL_DB=mydb
```

**Específicas do SQLite**

```bash
SQLITE_DB=:memory:              # Database em memória
SQLITE_DB=/var/lib/app/data.db  # Database em arquivo
```

### Segurança & Permissões

#### Modo Read-Only

Bloqueia **todas** as operações de escrita em nível de aplicação:

```bash
DB_READ_ONLY_MODE=true
```

#### Permissões Globais de Escrita

Controle fino de operações por tipo (aplicado globalmente):

```bash
ALLOW_INSERT_OPERATION=true   # Permite INSERT
ALLOW_UPDATE_OPERATION=true   # Permite UPDATE
ALLOW_DELETE_OPERATION=false  # Bloqueia DELETE
ALLOW_DDL_OPERATION=false     # Bloqueia CREATE/ALTER/DROP/TRUNCATE
```

#### Permissões Específicas por Schema

Sobrescreve permissões globais para schemas específicos:

```bash
# Formato: "schema1:true,schema2:false,schema3:true"
SCHEMA_INSERT_PERMISSIONS=prod_db:false,test_db:true,staging_db:true
SCHEMA_UPDATE_PERMISSIONS=prod_db:false,test_db:true,staging_db:true
SCHEMA_DELETE_PERMISSIONS=prod_db:false,test_db:false,staging_db:false
SCHEMA_DDL_PERMISSIONS=prod_db:false,test_db:true,staging_db:false
```

**Como funciona:**
- Se schema tem permissão específica → usa ela
- Caso contrário → usa flag global

**Exemplo:**
```bash
# Global: INSERT bloqueado
ALLOW_INSERT_OPERATION=false

# test_db pode inserir, prod_db não pode
SCHEMA_INSERT_PERMISSIONS=test_db:true,prod_db:false

# Resultado:
# - INSERT em test_db: ✅ permitido (permissão do schema)
# - INSERT em prod_db: ❌ bloqueado (permissão do schema)
# - INSERT em other_db: ❌ bloqueado (permissão global)
```

### Modo Multi-DB

Acessa múltiplos databases/schemas através de uma única conexão.

#### Ativação

Deixe `DB_NAME` vazio (MySQL/PostgreSQL apenas):

```bash
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=password
DB_NAME=                # Vazio = modo multi-DB
```

#### Proteção de Escrita

Por padrão, modo multi-DB é **read-only** por segurança. Para permitir escritas:

```bash
MULTI_DB_WRITE_MODE=true  # ⚠️ Use com cautela!
```

**Recomendação:** Use `SCHEMA_*_PERMISSIONS` para controle granular ao invés de `MULTI_DB_WRITE_MODE=true`.

#### Exemplo Completo

```bash
# Multi-DB com permissões granulares
DB_TYPE=mysql
DB_NAME=                                    # Modo multi-DB
ALLOW_INSERT_OPERATION=false                # Global: bloqueado
SCHEMA_INSERT_PERMISSIONS=test_db:true      # Exceção: test_db pode inserir
SCHEMA_UPDATE_PERMISSIONS=test_db:true      # Exceção: test_db pode atualizar
SCHEMA_DELETE_PERMISSIONS=test_db:false     # test_db: DELETE bloqueado
SCHEMA_DDL_PERMISSIONS=test_db:true         # test_db: DDL permitido
```

### SSL/TLS para Bancos na Nuvem

#### AWS RDS (MySQL/PostgreSQL)

```bash
DB_TYPE=mysql
DB_HOST=myinstance.123456789012.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
# Opcional: DB_SSL_CA=/path/to/aws-rds-ca-cert.pem
```

#### Google Cloud SQL (PostgreSQL)

```bash
DB_TYPE=postgresql
DB_HOST=34.123.45.67
DB_PORT=5432
DB_SSL=true
DB_SSL_CA=/path/to/server-ca.pem
DB_SSL_CERT=/path/to/client-cert.pem
DB_SSL_KEY=/path/to/client-key.pem
```

#### Azure Database for MySQL

```bash
DB_TYPE=mysql
DB_HOST=myserver.mysql.database.azure.com
DB_PORT=3306
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

### MCP Remoto (Servidor HTTP)

Execute o servidor MCP via HTTP com autenticação:

```bash
# .env
IS_REMOTE_MCP=true
REMOTE_SECRET_KEY=your-secret-key-here
PORT=3000
```

Endpoint: `POST http://localhost:3000/mcp`

Header: `Authorization: Bearer your-secret-key-here`

### Arquitetura

```
src/
├── db/
│   ├── adapters/
│   │   ├── types.ts              # Interfaces e tipos
│   │   ├── factory.ts            # Factory pattern
│   │   ├── mysql.adapter.ts      # MySQL via mysql2
│   │   ├── postgresql.adapter.ts # PostgreSQL via pg
│   │   └── sqlite.adapter.ts     # SQLite via better-sqlite3
│   ├── index.ts                  # Core query handlers
│   ├── utils.ts                  # SQL parsing (node-sql-parser)
│   └── permissions.ts            # Schema permission checks
├── config/
│   └── index.ts                  # Configuração de ambiente
├── utils/
│   └── index.ts                  # Logging & utilitários
└── types/
    └── index.ts                  # Definições de tipos
```

#### Adapter Pattern

Cada adapter implementa a interface `DatabaseAdapter`:

```typescript
export interface DatabaseAdapter {
  readonly type: DatabaseType;
  createPool(config: ConnectionConfig): Promise<DatabasePool>;
  executeQuery<T>(pool: DatabasePool, sql: string, params?: any[]): Promise<T>;
  setReadOnly(connection: DatabaseConnection): Promise<void>;
  unsetReadOnly(connection: DatabaseConnection): Promise<void>;
  normalizeResult(result: any): NormalizedResult;
  supportsReadOnlyMode(): boolean;
}
```

#### Fluxos de Transação

**Operações de Leitura:**
```
BEGIN → SET TRANSACTION READ ONLY → QUERY → ROLLBACK → RESET TO READ WRITE
```

**Operações de Escrita:**
```
BEGIN → QUERY → COMMIT (ou ROLLBACK em caso de erro)
```

### Exemplos

#### MySQL com Unix Socket

```bash
DB_TYPE=mysql
MYSQL_SOCKET_PATH=/tmp/mysql.sock
DB_USER=root
DB_PASS=password
DB_NAME=mydb
```

#### PostgreSQL Multi-DB com Permissões

```bash
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=password
DB_NAME=                                      # Modo multi-DB
SCHEMA_INSERT_PERMISSIONS=app_db:true         # app_db pode inserir
SCHEMA_UPDATE_PERMISSIONS=app_db:true         # app_db pode atualizar
SCHEMA_DELETE_PERMISSIONS=app_db:false        # app_db: DELETE bloqueado
```

#### SQLite Read-Only

```bash
DB_TYPE=sqlite
SQLITE_DB=/var/lib/data/production.db
DB_READ_ONLY_MODE=true
```

#### AWS RDS MySQL com SSL

```bash
DB_TYPE=mysql
DB_HOST=prod.abc123.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASS=secure_password
DB_NAME=production
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
ALLOW_INSERT_OPERATION=false
ALLOW_UPDATE_OPERATION=false
ALLOW_DELETE_OPERATION=false
ALLOW_DDL_OPERATION=false
```

### Desenvolvimento

```bash
pnpm dev              # Executar em modo dev (tsx)
pnpm build            # Compilar TypeScript
pnpm watch            # Modo watch
pnpm exec             # Build + executar com .env
```

### Testes

```bash
pnpm test              # Executar todos os testes (setup + vitest run)
pnpm test:watch        # Modo watch
pnpm test:unit         # Apenas testes unitários
pnpm test:integration  # Testes de integração (MySQL, socket, permissões)
pnpm test:e2e          # Testes end-to-end
pnpm test:coverage     # Relatório de cobertura
```

**Estrutura de Testes:**
```
tests/
├── unit/           # Funções isoladas (parsing de queries, utils)
├── integration/    # Operações reais de banco de dados
└── e2e/           # Fluxos completos do servidor MCP
```

### Ajustes de Performance

#### Connection Pool

```bash
DB_CONNECTION_LIMIT=20  # Padrão: 10
```

#### Desabilitar Transações Read-Only (MySQL)

⚠️ **Não recomendado** - reduz segurança:

```bash
MYSQL_DISABLE_READ_ONLY_TRANSACTIONS=true
```

### Referência de Variáveis de Ambiente

#### Configurações Principais do Banco

| Variável | Descrição | Padrão | Exemplo |
|----------|-----------|--------|---------|
| `DB_TYPE` | Tipo de banco | `mysql` | `mysql`, `postgresql`, `sqlite` |
| `DB_HOST` | Host do banco | `127.0.0.1` | `localhost`, `db.example.com` |
| `DB_PORT` | Porta do banco | `3306` | `3306` (MySQL), `5432` (PostgreSQL) |
| `DB_USER` | Usuário do banco | `root` | `admin`, `postgres` |
| `DB_PASS` | Senha do banco | `""` | `secure_password` |
| `DB_NAME` | Nome do banco | `undefined` | `mydb`, `""` (multi-DB) |
| `DB_CONNECTION_LIMIT` | Tamanho do pool | `10` | `20` |

#### Configurações de Segurança

| Variável | Descrição | Padrão | Valores |
|----------|-----------|--------|---------|
| `DB_READ_ONLY_MODE` | Modo global read-only | `false` | `true`, `false` |
| `ALLOW_INSERT_OPERATION` | Permissão global de INSERT | `false` | `true`, `false` |
| `ALLOW_UPDATE_OPERATION` | Permissão global de UPDATE | `false` | `true`, `false` |
| `ALLOW_DELETE_OPERATION` | Permissão global de DELETE | `false` | `true`, `false` |
| `ALLOW_DDL_OPERATION` | Permissão global de DDL | `false` | `true`, `false` |
| `MULTI_DB_WRITE_MODE` | Permitir escritas em multi-DB | `false` | `true`, `false` |

#### Permissões por Schema

| Variável | Formato | Exemplo |
|----------|---------|---------|
| `SCHEMA_INSERT_PERMISSIONS` | `schema:bool,schema:bool` | `test_db:true,prod_db:false` |
| `SCHEMA_UPDATE_PERMISSIONS` | `schema:bool,schema:bool` | `test_db:true,prod_db:false` |
| `SCHEMA_DELETE_PERMISSIONS` | `schema:bool,schema:bool` | `test_db:false,prod_db:false` |
| `SCHEMA_DDL_PERMISSIONS` | `schema:bool,schema:bool` | `test_db:true,prod_db:false` |

#### Configurações SSL/TLS

| Variável | Descrição | Necessária | Exemplo |
|----------|-----------|------------|---------|
| `DB_SSL` | Habilitar SSL/TLS | Bancos Cloud | `true`, `false` |
| `DB_SSL_REJECT_UNAUTHORIZED` | Validação SSL estrita | Produção | `true`, `false` |
| `DB_SSL_CA` | Caminho do certificado CA | Cloud SQL | `/path/to/ca.pem` |
| `DB_SSL_CERT` | Certificado do cliente | Cloud SQL | `/path/to/cert.pem` |
| `DB_SSL_KEY` | Chave do cliente | Cloud SQL | `/path/to/key.pem` |

#### Configurações MCP Remoto

| Variável | Descrição | Necessária | Exemplo |
|----------|-----------|------------|---------|
| `IS_REMOTE_MCP` | Habilitar modo HTTP | Não | `true`, `false` |
| `REMOTE_SECRET_KEY` | Token de autenticação | Se remoto | `your-secret-key` |
| `PORT` | Porta do servidor HTTP | Não | `3000` |

### Solução de Problemas

#### Erros de Conexão

**Socket MySQL não encontrado:**
```bash
# Verificar caminho do socket
sudo mysql -u root -p -e "SELECT @@socket;"

# Configurar no .env
MYSQL_SOCKET_PATH=/var/run/mysqld/mysqld.sock
```

**Conexão PostgreSQL recusada:**
```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# Verificar porta
sudo netstat -tulpn | grep 5432
```

#### Erros de Permissão

**"Operation not allowed in read-only mode":**
```bash
# Verificar modo global read-only
DB_READ_ONLY_MODE=false

# Verificar modo multi-DB
MULTI_DB_WRITE_MODE=true  # Se necessário

# Ou usar permissões de schema
SCHEMA_INSERT_PERMISSIONS=mydb:true
```

**"INSERT not allowed for schema 'mydb'":**
```bash
# Verificar permissão global
ALLOW_INSERT_OPERATION=true

# Ou adicionar exceção de schema
SCHEMA_INSERT_PERMISSIONS=mydb:true
```

### Licença

MIT

### Créditos

- **mcp-server-mysql**: [@benborla](https://github.com/benborla/mcp-server-mysql)

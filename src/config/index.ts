import * as dotenv from "dotenv";
import { SchemaPermissions } from "../types/index.js";
import { parseSchemaPermissions } from "../utils/index.js";
import type { DatabaseType } from "../db/adapters/types.js";

export const MCP_VERSION = "2.0.2";

// @INFO: Load environment variables from .env file
dotenv.config();

// @INFO: Database type configuration
export const DB_TYPE = (process.env.DB_TYPE || "mysql") as DatabaseType;

// @INFO: Read-only mode configuration (double protection: app + database)
export const DB_READ_ONLY_MODE = process.env.DB_READ_ONLY_MODE === "true";

// @INFO: Update the environment setup to ensure database is correctly set
if (process.env.NODE_ENV === "test" && !process.env.MYSQL_DB) {
  process.env.MYSQL_DB = "mcp_test_db"; // @INFO: Ensure we have a database name for tests
}

// Write operation flags (global defaults)
export const ALLOW_INSERT_OPERATION =
  process.env.ALLOW_INSERT_OPERATION === "true";
export const ALLOW_UPDATE_OPERATION =
  process.env.ALLOW_UPDATE_OPERATION === "true";
export const ALLOW_DELETE_OPERATION =
  process.env.ALLOW_DELETE_OPERATION === "true";
export const ALLOW_DDL_OPERATION = process.env.ALLOW_DDL_OPERATION === "true";

// Transaction mode control
export const MYSQL_DISABLE_READ_ONLY_TRANSACTIONS = 
  process.env.MYSQL_DISABLE_READ_ONLY_TRANSACTIONS === "true";

// Schema-specific permissions
export const SCHEMA_INSERT_PERMISSIONS: SchemaPermissions =
  parseSchemaPermissions(process.env.SCHEMA_INSERT_PERMISSIONS);
export const SCHEMA_UPDATE_PERMISSIONS: SchemaPermissions =
  parseSchemaPermissions(process.env.SCHEMA_UPDATE_PERMISSIONS);
export const SCHEMA_DELETE_PERMISSIONS: SchemaPermissions =
  parseSchemaPermissions(process.env.SCHEMA_DELETE_PERMISSIONS);
export const SCHEMA_DDL_PERMISSIONS: SchemaPermissions = parseSchemaPermissions(
  process.env.SCHEMA_DDL_PERMISSIONS,
);

// Remote MCP configuration
export const IS_REMOTE_MCP = process.env.IS_REMOTE_MCP === "true";
export const REMOTE_SECRET_KEY = process.env.REMOTE_SECRET_KEY || "";
export const PORT = process.env.PORT || 3000;

// Check if we're in multi-DB mode (no specific DB set)
export const isMultiDbMode = (() => {
  // Para MySQL/PostgreSQL, multi-DB é quando não há database definido
  if (DB_TYPE === "mysql" || DB_TYPE === "postgresql") {
    const dbVar = DB_TYPE === "mysql" ? process.env.MYSQL_DB : process.env.POSTGRESQL_DB;
    return !dbVar || dbVar.trim() === "";
  }
  // SQLite sempre tem um database (arquivo ou :memory:)
  return false;
})();

// Database connection configuration helper
function getConnectionConfig() {
  const baseConfig = {
    user: process.env.DB_USER || process.env.MYSQL_USER || "root",
    password: process.env.DB_PASS ?? process.env.MYSQL_PASS ?? "",
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || "10"),
  };

  // SSL configuration (para clouds AWS RDS, GCP Cloud SQL, Azure Database)
  const sslConfig =
    process.env.DB_SSL === "true"
      ? {
          ssl: {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
            ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
            ...(process.env.DB_SSL_CERT ? { cert: process.env.DB_SSL_CERT } : {}),
            ...(process.env.DB_SSL_KEY ? { key: process.env.DB_SSL_KEY } : {}),
          },
        }
      : {};

  // Configuração específica por tipo de banco
  if (DB_TYPE === "mysql") {
    return {
      ...baseConfig,
      ...(process.env.MYSQL_SOCKET_PATH
        ? { socketPath: process.env.MYSQL_SOCKET_PATH }
        : {
            host: process.env.DB_HOST || process.env.MYSQL_HOST || "127.0.0.1",
            port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || "3306"),
          }),
      database: process.env.DB_NAME || process.env.MYSQL_DB || undefined,
      ...sslConfig,
    };
  }

  if (DB_TYPE === "postgresql") {
    return {
      ...baseConfig,
      host: process.env.DB_HOST || process.env.POSTGRESQL_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || process.env.POSTGRESQL_PORT || "5432"),
      database: process.env.DB_NAME || process.env.POSTGRESQL_DB || undefined,
      ...sslConfig,
    };
  }

  if (DB_TYPE === "sqlite") {
    return {
      ...baseConfig,
      database: process.env.DB_NAME || process.env.SQLITE_DB || ":memory:",
    };
  }

  return baseConfig;
}

export const mcpConfig = {
  server: {
    name: "mcp-db-bridge",
    version: MCP_VERSION,
    connectionTypes: ["stdio", "streamableHttp"],
  },
  database: getConnectionConfig(),
  // Mantém mysql para backward compatibility (deprecated)
  mysql: {
    ...(process.env.MYSQL_SOCKET_PATH
      ? { socketPath: process.env.MYSQL_SOCKET_PATH }
      : {
          host: process.env.MYSQL_HOST || "127.0.0.1",
          port: Number(process.env.MYSQL_PORT || "3306"),
        }),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASS ?? "",
    database: process.env.MYSQL_DB || undefined,
    connectionLimit: 10,
    authPlugins: {
      mysql_clear_password: () => () => Buffer.from(process.env.MYSQL_PASS || ""),
    },
    ...(process.env.MYSQL_SSL === "true"
      ? {
          ssl: {
            rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === "true",
          },
        }
      : {}),
  },
  paths: {
    schema: "schema",
  },
};

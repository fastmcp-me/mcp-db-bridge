import Database from "better-sqlite3";
import { log } from "../../utils/index.js";
import type {
  DatabaseAdapter,
  DatabaseType,
  ConnectionConfig,
  DatabasePool,
  DatabaseConnection,
  NormalizedResult,
} from "./types.js";

class SQLiteConnection implements DatabaseConnection {
  private inTransaction = false;

  constructor(private db: Database.Database) {}

  async query<T = any>(sql: string, params?: any[]): Promise<T> {
    try {
      // SQLite é síncrono, mas vamos manter a interface async
      const trimmedSql = sql.trim().toLowerCase();

      if (
        trimmedSql.startsWith("select") ||
        trimmedSql.startsWith("pragma") ||
        trimmedSql.startsWith("show")
      ) {
        // Query que retorna dados
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...(params ?? []));
        return rows as T;
      } else {
        // Query que modifica dados (INSERT, UPDATE, DELETE, DDL)
        const stmt = this.db.prepare(sql);
        const info = stmt.run(...(params ?? []));
        return info as T;
      }
    } catch (error) {
      log("error", "Error executing SQLite query:", error);
      throw error;
    }
  }

  async beginTransaction(): Promise<void> {
    if (this.inTransaction) return;
    this.db.prepare("BEGIN").run();
    this.inTransaction = true;
  }

  async commit(): Promise<void> {
    if (!this.inTransaction) return;
    this.db.prepare("COMMIT").run();
    this.inTransaction = false;
  }

  async rollback(): Promise<void> {
    if (!this.inTransaction) return;
    this.db.prepare("ROLLBACK").run();
    this.inTransaction = false;
  }

  release(): void {
    // SQLite não tem conceito de release de connection
    // mas mantemos o método para compatibilidade
  }
}

class SQLitePool implements DatabasePool {
  private connection: SQLiteConnection;

  constructor(private db: Database.Database) {
    this.connection = new SQLiteConnection(db);
  }

  async getConnection(): Promise<DatabaseConnection> {
    // SQLite não tem pool real, sempre retorna a mesma connection
    return this.connection;
  }

  async end(): Promise<void> {
    this.db.close();
  }
}

export class SQLiteAdapter implements DatabaseAdapter {
  readonly type: DatabaseType = "sqlite";

  async createPool(config: ConnectionConfig): Promise<DatabasePool> {
    try {
      // SQLite usa database como path do arquivo
      // Se database for ":memory:", cria banco em memória
      const dbPath = config.database ?? ":memory:";

      const db = new Database(dbPath, {
        // verbose: (msg) => log("info", `SQLite: ${msg}`),
      });

      log("info", `SQLite database created successfully: ${dbPath}`);
      return new SQLitePool(db);
    } catch (error) {
      log("error", "Error creating SQLite database:", error);
      throw error;
    }
  }

  async executeQuery<T>(
    pool: DatabasePool,
    sql: string,
    params?: any[],
  ): Promise<T> {
    let connection: DatabaseConnection | undefined;
    try {
      connection = await pool.getConnection();
      const result = await connection.query(sql, params);
      return result as T;
    } catch (error) {
      log("error", "Error executing SQLite query:", error);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async setReadOnly(connection: DatabaseConnection): Promise<void> {
    // SQLite não tem SET TRANSACTION READ ONLY equivalente
    // Mas pode abrir o database em modo read-only
    // Como já abrimos o DB, vamos apenas logar
    log(
      "warn",
      "SQLite does not support SET TRANSACTION READ ONLY at runtime",
    );
  }

  async unsetReadOnly(connection: DatabaseConnection): Promise<void> {
    // Não faz nada no SQLite
  }

  normalizeResult(result: any): NormalizedResult {
    if (!result) {
      return { rows: [] };
    }

    // Se for um RunResult (INSERT, UPDATE, DELETE, DDL)
    if ("changes" in result || "lastInsertRowid" in result) {
      return {
        rows: [],
        affectedRows: result.changes ?? 0,
        insertId: Number(result.lastInsertRowid ?? 0),
        changedRows: result.changes ?? 0,
      };
    }

    // Se for um array de rows (SELECT)
    if (Array.isArray(result)) {
      return { rows: result };
    }

    return { rows: [] };
  }

  supportsReadOnlyMode(): boolean {
    return false; // SQLite não suporta SET TRANSACTION READ ONLY em tempo de execução
  }
}

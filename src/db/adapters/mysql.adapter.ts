import * as mysql2 from "mysql2/promise";
import { log } from "../../utils/index.js";
import type {
  DatabaseAdapter,
  DatabaseType,
  ConnectionConfig,
  DatabasePool,
  DatabaseConnection,
  NormalizedResult,
} from "./types.js";

class MySQLConnection implements DatabaseConnection {
  constructor(private connection: mysql2.PoolConnection) {}

  async query<T = any>(sql: string, params?: any[]): Promise<T> {
    const result = await this.connection.query(sql, params);
    return (Array.isArray(result) ? result[0] : result) as T;
  }

  async beginTransaction(): Promise<void> {
    await this.connection.beginTransaction();
  }

  async commit(): Promise<void> {
    await this.connection.commit();
  }

  async rollback(): Promise<void> {
    await this.connection.rollback();
  }

  release(): void {
    this.connection.release();
  }
}

class MySQLPool implements DatabasePool {
  constructor(private pool: mysql2.Pool) {}

  async getConnection(): Promise<DatabaseConnection> {
    const connection = await this.pool.getConnection();
    return new MySQLConnection(connection);
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}

export class MySQLAdapter implements DatabaseAdapter {
  readonly type: DatabaseType = "mysql";

  async createPool(config: ConnectionConfig): Promise<DatabasePool> {
    try {
      const poolConfig: mysql2.PoolOptions = {
        ...(config.socketPath
          ? { socketPath: config.socketPath }
          : {
              host: config.host ?? "127.0.0.1",
              port: config.port ?? 3306,
            }),
        user: config.user ?? "root",
        password: config.password ?? "",
        database: config.database,
        connectionLimit: config.connectionLimit ?? 10,
        authPlugins: {
          mysql_clear_password: () => () => Buffer.from(config.password ?? ""),
        },
        ...(config.ssl
          ? {
              ssl: {
                rejectUnauthorized: config.ssl.rejectUnauthorized ?? true,
                ...(config.ssl.ca ? { ca: config.ssl.ca } : {}),
                ...(config.ssl.cert ? { cert: config.ssl.cert } : {}),
                ...(config.ssl.key ? { key: config.ssl.key } : {}),
              },
            }
          : {}),
      };

      const pool = mysql2.createPool(poolConfig);
      log("info", "MySQL pool created successfully");
      return new MySQLPool(pool);
    } catch (error) {
      log("error", "Error creating MySQL pool:", error);
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
      log("error", "Error executing MySQL query:", error);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async setReadOnly(connection: DatabaseConnection): Promise<void> {
    await connection.query("SET SESSION TRANSACTION READ ONLY");
  }

  async unsetReadOnly(connection: DatabaseConnection): Promise<void> {
    await connection.query("SET SESSION TRANSACTION READ WRITE");
  }

  normalizeResult(result: any): NormalizedResult {
    if (!result) {
      return { rows: [] };
    }

    // Se for um ResultSetHeader (INSERT, UPDATE, DELETE, DDL)
    if (
      "affectedRows" in result ||
      "insertId" in result ||
      "changedRows" in result
    ) {
      return {
        rows: [],
        affectedRows: result.affectedRows ?? 0,
        insertId: result.insertId ?? 0,
        changedRows: result.changedRows ?? 0,
      };
    }

    // Se for um array de rows (SELECT)
    if (Array.isArray(result)) {
      return { rows: result };
    }

    return { rows: [] };
  }

  supportsReadOnlyMode(): boolean {
    return true;
  }
}

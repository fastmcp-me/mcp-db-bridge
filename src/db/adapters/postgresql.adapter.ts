import pg from "pg";
import { log } from "../../utils/index.js";
import type {
  DatabaseAdapter,
  DatabaseType,
  ConnectionConfig,
  DatabasePool,
  DatabaseConnection,
  NormalizedResult,
} from "./types.js";

const { Pool } = pg;

class PostgreSQLConnection implements DatabaseConnection {
  constructor(private client: pg.PoolClient) {}

  async query<T = any>(sql: string, params?: any[]): Promise<T> {
    const result = await this.client.query(sql, params);
    return result as T;
  }

  async beginTransaction(): Promise<void> {
    await this.client.query("BEGIN");
  }

  async commit(): Promise<void> {
    await this.client.query("COMMIT");
  }

  async rollback(): Promise<void> {
    await this.client.query("ROLLBACK");
  }

  release(): void {
    this.client.release();
  }
}

class PostgreSQLPool implements DatabasePool {
  constructor(private pool: pg.Pool) {}

  async getConnection(): Promise<DatabaseConnection> {
    const client = await this.pool.connect();
    return new PostgreSQLConnection(client);
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}

export class PostgreSQLAdapter implements DatabaseAdapter {
  readonly type: DatabaseType = "postgresql";

  async createPool(config: ConnectionConfig): Promise<DatabasePool> {
    try {
      const poolConfig: pg.PoolConfig = {
        host: config.host ?? "127.0.0.1",
        port: config.port ?? 5432,
        user: config.user ?? "postgres",
        password: config.password ?? "",
        database: config.database,
        max: config.connectionLimit ?? 10,
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

      const pool = new Pool(poolConfig);
      log("info", "PostgreSQL pool created successfully");
      return new PostgreSQLPool(pool);
    } catch (error) {
      log("error", "Error creating PostgreSQL pool:", error);
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
      log("error", "Error executing PostgreSQL query:", error);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async setReadOnly(connection: DatabaseConnection): Promise<void> {
    await connection.query("SET TRANSACTION READ ONLY");
  }

  async unsetReadOnly(connection: DatabaseConnection): Promise<void> {
    await connection.query("SET TRANSACTION READ WRITE");
  }

  normalizeResult(result: any): NormalizedResult {
    if (!result) {
      return { rows: [] };
    }

    // PostgreSQL retorna QueryResult com rows e rowCount
    if ("rows" in result) {
      return {
        rows: result.rows ?? [],
        affectedRows: result.rowCount ?? 0,
      };
    }

    // Fallback para array direto
    if (Array.isArray(result)) {
      return { rows: result };
    }

    return { rows: [] };
  }

  supportsReadOnlyMode(): boolean {
    return true;
  }
}

export type DatabaseType = "mysql" | "postgresql" | "sqlite";

export interface ConnectionConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  socketPath?: string;
  connectionLimit?: number;
  ssl?: {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
}

export interface NormalizedResult {
  rows: any[];
  affectedRows?: number;
  insertId?: number;
  changedRows?: number;
}

export interface DatabaseConnection {
  query<T = any>(sql: string, params?: any[]): Promise<T>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

export interface DatabasePool {
  getConnection(): Promise<DatabaseConnection>;
  end(): Promise<void>;
}

export interface DatabaseAdapter {
  readonly type: DatabaseType;
  createPool(config: ConnectionConfig): Promise<DatabasePool>;
  executeQuery<T>(pool: DatabasePool, sql: string, params?: any[]): Promise<T>;
  setReadOnly(connection: DatabaseConnection): Promise<void>;
  unsetReadOnly(connection: DatabaseConnection): Promise<void>;
  normalizeResult(result: any): NormalizedResult;
  supportsReadOnlyMode(): boolean;
}

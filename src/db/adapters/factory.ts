import { log } from "../../utils/index.js";
import type { DatabaseAdapter, DatabaseType } from "./types.js";
import { MySQLAdapter } from "./mysql.adapter.js";
import { PostgreSQLAdapter } from "./postgresql.adapter.js";
import { SQLiteAdapter } from "./sqlite.adapter.js";

export class AdapterFactory {
  static createAdapter(type: DatabaseType): DatabaseAdapter {
    log("info", `Creating database adapter for type: ${type}`);

    switch (type) {
      case "mysql":
        return new MySQLAdapter();
      case "postgresql":
        return new PostgreSQLAdapter();
      case "sqlite":
        return new SQLiteAdapter();
      default:
        throw new Error(
          `Unsupported database type: ${type}. Supported types: mysql, postgresql, sqlite`,
        );
    }
  }
}

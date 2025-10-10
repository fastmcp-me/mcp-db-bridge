import { performance } from "perf_hooks";
import { isMultiDbMode, DB_TYPE, DB_READ_ONLY_MODE, MYSQL_DISABLE_READ_ONLY_TRANSACTIONS, mcpConfig as config } from "./../config/index.js";

import {
  isDDLAllowedForSchema,
  isInsertAllowedForSchema,
  isUpdateAllowedForSchema,
  isDeleteAllowedForSchema,
} from "./permissions.js";
import { extractSchemaFromQuery, getQueryTypes } from "./utils.js";

import { log } from "./../utils/index.js";
import { AdapterFactory } from "./adapters/factory.js";
import type { DatabaseAdapter, DatabasePool, DatabaseConnection } from "./adapters/types.js";

// Create the appropriate adapter based on DB_TYPE
const adapter: DatabaseAdapter = AdapterFactory.createAdapter(DB_TYPE);

// Force read-only mode in multi-DB mode unless explicitly configured otherwise
if (isMultiDbMode && process.env.MULTI_DB_WRITE_MODE !== "true") {
  log("error", "Multi-DB mode detected - enabling read-only mode for safety");
}

// @INFO: Check if running in test mode
const isTestEnvironment = process.env.NODE_ENV === "test" || process.env.VITEST;

// @INFO: Safe way to exit process (not during tests)
function safeExit(code: number): void {
  if (!isTestEnvironment) {
    process.exit(code);
  } else {
    log("error", `[Test mode] Would have called process.exit(${code})`);
  }
}

// @INFO: Lazy load Database pool
let poolPromise: Promise<DatabasePool>;

const getPool = (): Promise<DatabasePool> => {
  if (!poolPromise) {
    poolPromise = adapter.createPool(config.database);
  }
  return poolPromise;
};

async function executeQuery<T>(sql: string, params?: any[]): Promise<T> {
  let connection: DatabaseConnection | undefined;
  try {
    const pool = await getPool();
    connection = await pool.getConnection();
    const result = await connection.query(sql, params);
    return result as T;
  } catch (error) {
    log("error", "Error executing query:", error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
      log("error", "Connection released");
    }
  }
}

// @INFO: New function to handle write operations
async function executeWriteQuery<T>(sql: string): Promise<T> {
  let connection: DatabaseConnection | undefined;
  try {
    const pool = await getPool();
    connection = await pool.getConnection();
    log("error", "Write connection acquired");

    // Extract schema for permissions (if needed)
    const schema = extractSchemaFromQuery(sql);

    // @INFO: Begin transaction for write operation
    await connection.beginTransaction();

    try {
      // @INFO: Execute the write query
      const startTime = performance.now();
      const result = await connection.query(sql);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Normalize result based on adapter
      const normalized = adapter.normalizeResult(result);

      // @INFO: Commit the transaction
      await connection.commit();

      // @INFO: Format the response based on operation type
      let responseText;

      // Check the type of query
      const queryTypes = await getQueryTypes(sql);
      const isUpdateOperation = queryTypes.some((type) => ["update"].includes(type));
      const isInsertOperation = queryTypes.some((type) => ["insert"].includes(type));
      const isDeleteOperation = queryTypes.some((type) => ["delete"].includes(type));
      const isDDLOperation = queryTypes.some((type) => ["create", "alter", "drop", "truncate"].includes(type));

      if (isInsertOperation) {
        responseText = `Insert successful on schema '${schema || "default"}'. Affected rows: ${normalized.affectedRows ?? 0}, Last insert ID: ${normalized.insertId ?? 0}`;
      } else if (isUpdateOperation) {
        responseText = `Update successful on schema '${schema || "default"}'. Affected rows: ${normalized.affectedRows ?? 0}, Changed rows: ${normalized.changedRows ?? 0}`;
      } else if (isDeleteOperation) {
        responseText = `Delete successful on schema '${schema || "default"}'. Affected rows: ${normalized.affectedRows ?? 0}`;
      } else if (isDDLOperation) {
        responseText = `DDL operation successful on schema '${schema || "default"}'.`;
      } else {
        responseText = JSON.stringify(normalized.rows, null, 2);
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
          {
            type: "text",
            text: `Query execution time: ${duration.toFixed(2)} ms`,
          },
        ],
        isError: false,
      } as T;
    } catch (error: unknown) {
      // @INFO: Rollback on error
      log("error", "Error executing write query:", error);
      await connection.rollback();

      return {
        content: [
          {
            type: "text",
            text: `Error executing write operation: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      } as T;
    }
  } catch (error: unknown) {
    log("error", "Error in write operation transaction:", error);
    return {
      content: [
        {
          type: "text",
          text: `Database connection error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    } as T;
  } finally {
    if (connection) {
      connection.release();
      log("error", "Write connection released");
    }
  }
}

async function executeReadOnlyQuery<T>(sql: string): Promise<T> {
  let connection: DatabaseConnection | undefined;
  try {
    // Check if global read-only mode is enabled
    if (DB_READ_ONLY_MODE) {
      const queryTypes = await getQueryTypes(sql);
      const isWriteOperation = queryTypes.some((type) =>
        ["insert", "update", "delete", "create", "alter", "drop", "truncate"].includes(type),
      );
      if (isWriteOperation) {
        log("error", "Write operations are blocked by DB_READ_ONLY_MODE");
        return {
          content: [
            {
              type: "text",
              text: "Error: Write operations are disabled by DB_READ_ONLY_MODE. Ask the administrator to update the configuration.",
            },
          ],
          isError: true,
        } as T;
      }
    }

    // Check the type of query
    const queryTypes = await getQueryTypes(sql);

    // Get schema for permission checking
    const schema = extractSchemaFromQuery(sql);

    const isUpdateOperation = queryTypes.some((type) => ["update"].includes(type));
    const isInsertOperation = queryTypes.some((type) => ["insert"].includes(type));
    const isDeleteOperation = queryTypes.some((type) => ["delete"].includes(type));
    const isDDLOperation = queryTypes.some((type) => ["create", "alter", "drop", "truncate"].includes(type));

    // Check schema-specific permissions
    if (isInsertOperation && !isInsertAllowedForSchema(schema)) {
      log(
        "error",
        `INSERT operations are not allowed for schema '${schema || "default"}'. Configure SCHEMA_INSERT_PERMISSIONS.`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error: INSERT operations are not allowed for schema '${schema || "default"}'. Ask the administrator to update SCHEMA_INSERT_PERMISSIONS.`,
          },
        ],
        isError: true,
      } as T;
    }

    if (isUpdateOperation && !isUpdateAllowedForSchema(schema)) {
      log(
        "error",
        `UPDATE operations are not allowed for schema '${schema || "default"}'. Configure SCHEMA_UPDATE_PERMISSIONS.`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error: UPDATE operations are not allowed for schema '${schema || "default"}'. Ask the administrator to update SCHEMA_UPDATE_PERMISSIONS.`,
          },
        ],
        isError: true,
      } as T;
    }

    if (isDeleteOperation && !isDeleteAllowedForSchema(schema)) {
      log(
        "error",
        `DELETE operations are not allowed for schema '${schema || "default"}'. Configure SCHEMA_DELETE_PERMISSIONS.`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error: DELETE operations are not allowed for schema '${schema || "default"}'. Ask the administrator to update SCHEMA_DELETE_PERMISSIONS.`,
          },
        ],
        isError: true,
      } as T;
    }

    if (isDDLOperation && !isDDLAllowedForSchema(schema)) {
      log(
        "error",
        `DDL operations are not allowed for schema '${schema || "default"}'. Configure SCHEMA_DDL_PERMISSIONS.`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error: DDL operations are not allowed for schema '${schema || "default"}'. Ask the administrator to update SCHEMA_DDL_PERMISSIONS.`,
          },
        ],
        isError: true,
      } as T;
    }

    // For write operations that are allowed, use executeWriteQuery
    if (
      (isInsertOperation && isInsertAllowedForSchema(schema)) ||
      (isUpdateOperation && isUpdateAllowedForSchema(schema)) ||
      (isDeleteOperation && isDeleteAllowedForSchema(schema)) ||
      (isDDLOperation && isDDLAllowedForSchema(schema))
    ) {
      return executeWriteQuery(sql);
    }

    // For read-only operations, continue with the original logic
    const pool = await getPool();
    connection = await pool.getConnection();
    log("error", "Read-only connection acquired");

    // Set read-only mode (if supported and not disabled)
    const shouldUseReadOnly = adapter.supportsReadOnlyMode() && !MYSQL_DISABLE_READ_ONLY_TRANSACTIONS;
    if (shouldUseReadOnly) {
      await adapter.setReadOnly(connection);
    } else {
      log("info", "Read-only transactions disabled or not supported by adapter");
    }

    // Begin transaction
    await connection.beginTransaction();

    try {
      // Execute query
      const startTime = performance.now();
      const result = await connection.query(sql);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Normalize result based on adapter
      const normalized = adapter.normalizeResult(result);

      // Rollback transaction (since it's read-only)
      await connection.rollback();

      // Reset to read-write mode (only if we set it to read-only)
      if (shouldUseReadOnly) {
        await adapter.unsetReadOnly(connection);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(normalized.rows, null, 2),
          },
          {
            type: "text",
            text: `Query execution time: ${duration.toFixed(2)} ms`,
          },
        ],
        isError: false,
      } as T;
    } catch (error) {
      // Rollback transaction on query error
      log("error", "Error executing read-only query:", error);
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    // Ensure we rollback and reset transaction mode on any error
    log("error", "Error in read-only query transaction:", error);
    try {
      if (connection) {
        await connection.rollback();
        // Reset to read-write mode (only if we set it to read-only)
        if (adapter.supportsReadOnlyMode() && !MYSQL_DISABLE_READ_ONLY_TRANSACTIONS) {
          await adapter.unsetReadOnly(connection);
        }
      }
    } catch (cleanupError) {
      // Ignore errors during cleanup
      log("error", "Error during cleanup:", cleanupError);
    }
    throw error;
  } finally {
    if (connection) {
      connection.release();
      log("error", "Read-only connection released");
    }
  }
}

export {
  isTestEnvironment,
  safeExit,
  executeQuery,
  getPool,
  executeWriteQuery,
  executeReadOnlyQuery,
  poolPromise,
};

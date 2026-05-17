import pg from "pg";

import { getDatabaseUrl } from "./config.js";

export type DatabasePool = pg.Pool;
export type DatabaseClient = pg.PoolClient;

export function createDatabasePool(connectionString = getDatabaseUrl()): DatabasePool {
  return new pg.Pool({
    connectionString,
    max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? "10", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

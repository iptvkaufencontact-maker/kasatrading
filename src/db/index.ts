import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool as NodePostgresPool } from "pg";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { parseEnv } from "@neon/env";
import neonProject from "../../neon";

/**
 * Database access for the whole app (Drizzle on top of Postgres).
 *
 * `neon deploy` / `neon env pull` provide:
 *   DATABASE_URL          -> pooled Neon endpoint (-pooler): used by the running app
 *   DATABASE_URL_UNPOOLED -> direct endpoint: used by drizzle-kit for schema changes
 *
 * Driver selection:
 *   - Neon hosts  -> @neondatabase/serverless (Neon's own driver). Simple queries go over
 *     low-latency HTTP (same transport as `neon(process.env.DATABASE_URL)`), while
 *     transactions — which the order workflow relies on — run over WebSocket.
 *     The plain HTTP `neon()` client alone cannot run `db.transaction()`.
 *   - Any other Postgres (local development) -> node-postgres.
 */
export type Database = PgDatabase<PgQueryResultHKT>;

const { postgres } = parseEnv(neonProject, ["DATABASE_URL"]);
const databaseUrl = postgres.databaseUrl;

export function isNeonUrl(url: string) {
  try { return /\.neon\.(tech|build)$/i.test(new URL(url).hostname); } catch { return false; }
}

export const databaseDriver: "neon-serverless" | "node-postgres" = isNeonUrl(databaseUrl) ? "neon-serverless" : "node-postgres";

const poolOptions = {
  connectionString: databaseUrl,
  // Long-running Node server: a small pool is enough. Neon computes scale to zero when idle,
  // so recycle idle clients quickly and leave time for a cold-start resume before failing.
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
};

function onIdleClientError(error: Error) {
  // An idle client can be dropped when the compute suspends; without a handler
  // node-postgres-compatible pools surface that as an uncaught error and crash the process.
  console.warn("Idle database client error (connection will be re-established):", error.message);
}

function createDatabase(): Database {
  if (databaseDriver === "neon-serverless") {
    // Older Node versions have no global WebSocket: fall back to `ws`.
    if (typeof globalThis.WebSocket === "undefined") neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
    // One-shot Pool.query() calls use HTTP fetch; transactions keep a WebSocket connection.
    neonConfig.poolQueryViaFetch = true;
    const pool = new NeonPool(poolOptions);
    pool.on("error", onIdleClientError);
    return drizzleNeon(pool);
  }
  const pool = new NodePostgresPool({ ...poolOptions, keepAlive: true });
  pool.on("error", onIdleClientError);
  return drizzleNodePostgres(pool);
}

const globalForDb = globalThis as typeof globalThis & { __kasaDatabase?: Database };

export const db: Database = globalForDb.__kasaDatabase ?? createDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__kasaDatabase = db;
}

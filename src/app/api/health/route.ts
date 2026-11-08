import { databaseDriver, db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

type HealthRow = { database: string; version: string; now: string };

/** Liveness check: proves the app can reach its Postgres service. Never exposes credentials. */
export async function GET() {
  try {
    const started = Date.now();
    const result = (await db.execute(
      sql`select current_database() as database, version() as version, now()::text as now`,
    )) as { rows: HealthRow[] };
    const row = result.rows[0];
    const host = safeHost(process.env.DATABASE_URL);
    return Response.json({
      ok: true,
      database: {
        name: row?.database,
        provider: host && /\.neon\.(tech|build)$/i.test(host) ? "neon" : "postgres",
        driver: databaseDriver,
        pooled: host?.includes("-pooler") ?? false,
        version: row?.version?.split(" on ")[0],
        serverTime: row?.now,
        latencyMs: Date.now() - started,
      },
    });
  } catch (error) {
    console.error("Health check failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}

function safeHost(url: string | undefined) {
  try { return url ? new URL(url).hostname : undefined; } catch { return undefined; }
}

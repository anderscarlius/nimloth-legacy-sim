// Delad test-hjälp: äkta Postgres krävs (I1-grinden är en DB-trigger —
// att mocka pg.Pool skulle inte bevisa någonting om den).
// CI kör en postgres:16-alpine service-container; lokalt: valfri Postgres
// med PG*-env satta, se README "Köra tester lokalt".

import pg from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function testPoolConfig() {
  return {
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 5433),
    database: process.env.PGDATABASE ?? "legacy_sim",
    user: process.env.PGUSER ?? "legacy_sim",
    password: process.env.PGPASSWORD ?? "legacy_sim",
  };
}

export async function freshTestPool(): Promise<pg.Pool> {
  const pool = new pg.Pool(testPoolConfig());
  const sql = readFileSync(
    path.join(__dirname, "..", "..", "migrations", "001-notes.sql"),
    "utf-8",
  );
  await pool.query(sql);
  await pool.query("TRUNCATE notes");
  return pool;
}

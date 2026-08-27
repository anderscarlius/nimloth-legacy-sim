// pg-pool + migrate runner. En tabell, en migration — S2:s hårda tak
// gäller minst lika mycket för denna fil som för endpoint-antalet.

import pg from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SimConfig } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type Pool = pg.Pool;

export function createPool(cfg: SimConfig["db"]): pg.Pool {
  return new pg.Pool({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    max: 5,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Enkel, avgränsad retry — inte cohort-service-stilens exponentiella
// backoff-klass. Det vore affärslogik i en tjänst som per S2 inte ska ha
// någon. Fem försök, en sekund emellan, räcker för lokal docker-compose-
// uppstart.
export async function migrate(pool: pg.Pool, migrationsDir: string = path.join(__dirname, "..", "migrations")): Promise<void> {
  const sql = readFileSync(path.join(migrationsDir, "001-notes.sql"), "utf-8");
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await pool.query(sql);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < 5) await sleep(1000);
    }
  }
  throw lastErr;
}

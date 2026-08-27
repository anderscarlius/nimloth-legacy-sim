// nimloth-legacy-sim — B4-bevisets legacy-motpart.
//
// REKVISITA, INTE PRODUKT. Se README.md innan du lägger till något här.
// Exakt fem endpoints. Ingen sjätte. Ingen affärslogik utöver den som
// redan finns nedan.

import express, { type Request, type Response } from "express";
import type pg from "pg";
import { createPool, migrate } from "./db.js";
import { loadConfig } from "./config.js";

const TIMESTAMP_FORMAT_SQL = `TO_CHAR($COL$, 'YYYY-MM-DD HH24:MI:SS')`;

function selectColumns(): string {
  return [
    "id",
    "patient_no",
    "care_unit",
    "text",
    "author_sign",
    TIMESTAMP_FORMAT_SQL.replace("$COL$", "created_at") + " AS created_at",
    TIMESTAMP_FORMAT_SQL.replace("$COL$", "signed_at") + " AS signed_at",
  ].join(", ");
}

export function buildApp(pool: pg.Pool): express.Express {
  const app = express();
  app.use(express.json());

  // 1/5 — POST /notes — skapa en osignerad anteckning.
  app.post("/notes", async (req: Request, res: Response) => {
    const { patient_no, care_unit, text, author_sign } = req.body ?? {};
    if (
      typeof patient_no !== "string" || patient_no.length === 0 ||
      typeof care_unit !== "string" || care_unit.length === 0 ||
      typeof text !== "string" || text.length === 0 ||
      typeof author_sign !== "string" || author_sign.length !== 4
    ) {
      res.status(400).json({
        fel: "ogiltig-post",
        meddelande: "patient_no, care_unit, text krävs (icke-tomma); author_sign måste vara exakt 4 tecken.",
      });
      return;
    }
    const result = await pool.query(
      `INSERT INTO notes (patient_no, care_unit, text, author_sign)
       VALUES ($1, $2, $3, $4)
       RETURNING ${selectColumns()}`,
      [patient_no, care_unit, text, author_sign],
    );
    res.status(201).json(result.rows[0]);
  });

  // 2/5 — GET /notes/by-patient/:patient_no — lista för en patient.
  // Egen dialekt: /by-patient/-prefix i stället för query-param, för att
  // undvika att kollidera med /notes/:id (se README för resonemanget).
  app.get("/notes/by-patient/:patient_no", async (req: Request, res: Response) => {
    const result = await pool.query(
      `SELECT ${selectColumns()} FROM notes WHERE patient_no = $1 ORDER BY created_at ASC`,
      [req.params.patient_no],
    );
    res.status(200).json(result.rows);
  });

  // 3/5 — GET /notes/:id — en post.
  app.get("/notes/:id", async (req: Request, res: Response) => {
    const result = await pool.query(
      `SELECT ${selectColumns()} FROM notes WHERE id = $1`,
      [req.params.id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ fel: "hittades-inte" });
      return;
    }
    res.status(200).json(result.rows[0]);
  });

  // 4/5 — POST /notes/:id/sign — signera, gör raden orörbar (I1).
  app.post("/notes/:id/sign", async (req: Request, res: Response) => {
    const existing = await pool.query(
      `SELECT id, signed_at FROM notes WHERE id = $1`,
      [req.params.id],
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ fel: "hittades-inte" });
      return;
    }
    if (existing.rows[0].signed_at !== null) {
      res.status(409).json({ fel: "redan-signerad" });
      return;
    }
    const result = await pool.query(
      `UPDATE notes SET signed_at = (NOW() AT TIME ZONE 'Europe/Stockholm')
       WHERE id = $1
       RETURNING ${selectColumns()}`,
      [req.params.id],
    );
    res.status(200).json(result.rows[0]);
  });

  // 5/5 — GET /healthz
  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: "nimloth-legacy-sim" });
  });

  return app;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const pool = createPool(cfg.db);
  await migrate(pool);
  const app = buildApp(pool);
  app.listen(cfg.port, () => {
    // eslint-disable-next-line no-console
    console.log(`nimloth-legacy-sim lyssnar på :${cfg.port}`);
  });
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("fatalt fel vid uppstart:", err);
    process.exit(1);
  });
}

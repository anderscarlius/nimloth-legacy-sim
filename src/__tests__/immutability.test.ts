// I1 (Spec_B4_Reversibel_Skrivvag_Anteckning_v0.1.md §5, S4 i B4 Etapp
// 1-prompten): en signerad anteckning får aldrig muteras, i någon
// riktning. Kodgrind, inte löfte — testet går direkt mot Postgres,
// förbi applikationslagret, för att bevisa att triggern håller även om
// någon skriver SQL direkt.

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type pg from "pg";
import { freshTestPool } from "./test-db.js";

let pool: pg.Pool;

beforeEach(async () => {
  pool = await freshTestPool();
});

afterAll(async () => {
  await pool?.end();
});

describe("I1 — signerat är orörbart (databastrigger)", () => {
  it("tillåter UPDATE innan signering", async () => {
    const inserted = await pool.query(
      `INSERT INTO notes (patient_no, care_unit, text, author_sign) VALUES ('p1', 'enhet-a', 'ursprunglig text', 'ABCD') RETURNING id`,
    );
    const id = inserted.rows[0].id;
    await expect(
      pool.query(`UPDATE notes SET text = 'redigerad text' WHERE id = $1`, [id]),
    ).resolves.toBeDefined();
  });

  it("tillåter signeringen själv (signed_at NULL -> satt)", async () => {
    const inserted = await pool.query(
      `INSERT INTO notes (patient_no, care_unit, text, author_sign) VALUES ('p1', 'enhet-a', 'text', 'ABCD') RETURNING id`,
    );
    const id = inserted.rows[0].id;
    await expect(
      pool.query(`UPDATE notes SET signed_at = NOW() WHERE id = $1`, [id]),
    ).resolves.toBeDefined();
  });

  it("FÄLLER: UPDATE av text efter signering avvisas av triggern", async () => {
    const inserted = await pool.query(
      `INSERT INTO notes (patient_no, care_unit, text, author_sign) VALUES ('p1', 'enhet-a', 'signerad text', 'ABCD') RETURNING id`,
    );
    const id = inserted.rows[0].id;
    await pool.query(`UPDATE notes SET signed_at = NOW() WHERE id = $1`, [id]);

    await expect(
      pool.query(`UPDATE notes SET text = 'försök att ändra efter signering' WHERE id = $1`, [id]),
    ).rejects.toThrow(/orörbar/);
  });

  it("FÄLLER: ett andra försök att ändra signed_at efter signering avvisas", async () => {
    const inserted = await pool.query(
      `INSERT INTO notes (patient_no, care_unit, text, author_sign) VALUES ('p1', 'enhet-a', 'text', 'ABCD') RETURNING id`,
    );
    const id = inserted.rows[0].id;
    await pool.query(`UPDATE notes SET signed_at = NOW() WHERE id = $1`, [id]);

    await expect(
      pool.query(`UPDATE notes SET signed_at = NOW() WHERE id = $1`, [id]),
    ).rejects.toThrow(/orörbar/);
  });

  it("FÄLLER: DELETE av en signerad rad avvisas", async () => {
    const inserted = await pool.query(
      `INSERT INTO notes (patient_no, care_unit, text, author_sign) VALUES ('p1', 'enhet-a', 'text', 'ABCD') RETURNING id`,
    );
    const id = inserted.rows[0].id;
    await pool.query(`UPDATE notes SET signed_at = NOW() WHERE id = $1`, [id]);

    await expect(pool.query(`DELETE FROM notes WHERE id = $1`, [id])).rejects.toThrow(
      /kan inte raderas/,
    );
  });

  it("tillåter DELETE av en osignerad rad", async () => {
    const inserted = await pool.query(
      `INSERT INTO notes (patient_no, care_unit, text, author_sign) VALUES ('p1', 'enhet-a', 'text', 'ABCD') RETURNING id`,
    );
    const id = inserted.rows[0].id;
    await expect(pool.query(`DELETE FROM notes WHERE id = $1`, [id])).resolves.toBeDefined();
  });
});

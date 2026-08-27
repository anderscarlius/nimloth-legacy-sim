import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type pg from "pg";
import type express from "express";
import { buildApp } from "../index.js";
import { freshTestPool } from "./test-db.js";

let pool: pg.Pool;
let app: express.Express;

beforeEach(async () => {
  pool = await freshTestPool();
  app = buildApp(pool);
});

afterAll(async () => {
  await pool?.end();
});

describe("GET /healthz", () => {
  it("svarar ok", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "nimloth-legacy-sim" });
  });
});

describe("POST /notes", () => {
  it("skapar en osignerad anteckning", async () => {
    const res = await request(app).post("/notes").send({
      patient_no: "1001",
      care_unit: "vc-lund-norr",
      text: "Status: opåverkad. Bedömning: väntar provsvar.",
      author_sign: "ABCD",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.signed_at).toBeNull();
    // Egen dialekt: lokal tid utan zon, "YYYY-MM-DD HH24:MI:SS" — inget "T", inget "Z".
    expect(res.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("avvisar author_sign som inte är exakt 4 tecken", async () => {
    const res = await request(app).post("/notes").send({
      patient_no: "1001",
      care_unit: "vc-lund-norr",
      text: "text",
      author_sign: "ABCDE",
    });
    expect(res.status).toBe(400);
  });

  it("avvisar tom text", async () => {
    const res = await request(app).post("/notes").send({
      patient_no: "1001",
      care_unit: "vc-lund-norr",
      text: "",
      author_sign: "ABCD",
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /notes/by-patient/:patient_no", () => {
  it("listar bara den patientens anteckningar, i tidsordning", async () => {
    await request(app).post("/notes").send({ patient_no: "1001", care_unit: "e1", text: "första", author_sign: "AAAA" });
    await request(app).post("/notes").send({ patient_no: "1002", care_unit: "e1", text: "annan patient", author_sign: "BBBB" });
    await request(app).post("/notes").send({ patient_no: "1001", care_unit: "e1", text: "andra", author_sign: "AAAA" });

    const res = await request(app).get("/notes/by-patient/1001");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].text).toBe("första");
    expect(res.body[1].text).toBe("andra");
  });

  it("returnerar tom lista för okänd patient (inte 404 — egen dialekt)", async () => {
    const res = await request(app).get("/notes/by-patient/okand-patient");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /notes/:id", () => {
  it("hämtar en post", async () => {
    const created = await request(app).post("/notes").send({
      patient_no: "1001", care_unit: "e1", text: "text", author_sign: "AAAA",
    });
    const res = await request(app).get(`/notes/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it("404 för okänt id", async () => {
    const res = await request(app).get("/notes/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});

describe("POST /notes/:id/sign", () => {
  it("signerar en osignerad anteckning", async () => {
    const created = await request(app).post("/notes").send({
      patient_no: "1001", care_unit: "e1", text: "text", author_sign: "AAAA",
    });
    const res = await request(app).post(`/notes/${created.body.id}/sign`);
    expect(res.status).toBe(200);
    expect(res.body.signed_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("409 vid signering av en redan signerad anteckning", async () => {
    const created = await request(app).post("/notes").send({
      patient_no: "1001", care_unit: "e1", text: "text", author_sign: "AAAA",
    });
    await request(app).post(`/notes/${created.body.id}/sign`);
    const res = await request(app).post(`/notes/${created.body.id}/sign`);
    expect(res.status).toBe(409);
  });

  it("404 vid signering av okänt id", async () => {
    const res = await request(app).post("/notes/00000000-0000-0000-0000-000000000000/sign");
    expect(res.status).toBe(404);
  });
});

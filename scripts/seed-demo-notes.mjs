#!/usr/bin/env node
// Seedar en liten, realistisk anteckningshistorik för B4-demopatienten
// (patient_no "1001", motsvarar maria-demo-comorbid-001 via
// legacy_patient_identity i migration-gateway). Skrivna direkt mot
// legacy-sim:s egna API — de föreställer historik som fanns INNAN B4
// någonsin existerade, inte skrivningar genom gatewayen.
//
// Körs:
//   LEGACY_SIM_BASE_URL=http://localhost:11601 node scripts/seed-demo-notes.mjs

const BASE_URL = process.env.LEGACY_SIM_BASE_URL ?? "http://localhost:11601";
const PATIENT_NO = process.env.SEED_PATIENT_NO ?? "1001";
const CARE_UNIT = process.env.SEED_CARE_UNIT ?? "vc-lund-norr";

const NOTES = [
  {
    text: "Status: Nybesök diabetes typ 2. Pat välmående, inga hypoglykemier. Bedömning: HbA1c 68 mmol/mol, något över målvärde. Åtgärd: metformin-dos oförändrad, återbesök 3 mån.",
    author_sign: "ANCA",
    sign: true,
  },
  {
    text: "Status: Telefonkontakt ang blodtrycksvärden hemma, medel 148/92. Bedömning: otillräcklig kontroll. Åtgärd: insatt hydroklortiazid 12.5mg, kontroll 2 veckor.",
    author_sign: "BSVN",
    sign: true,
  },
  {
    text: "Status: Återbesök. Blodtryck nu 132/84 på ny medicinering, biverkningar ej rapporterade. Bedömning: god respons. Åtgärd: fortsatt oförändrad behandling, årskontroll diabetes.",
    author_sign: "ANCA",
    sign: true,
  },
  {
    text: "Status: Preliminär anteckning inför morgondagens återbesök — ej klar.",
    author_sign: "ANCA",
    sign: false,
  },
];

async function main() {
  const created = [];
  for (const note of NOTES) {
    const resp = await fetch(`${BASE_URL}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_no: PATIENT_NO,
        care_unit: CARE_UNIT,
        text: note.text,
        author_sign: note.author_sign,
      }),
    });
    if (resp.status !== 201) {
      console.error(`FEL: kunde inte skapa anteckning (${resp.status})`, await resp.text());
      process.exit(1);
    }
    const body = await resp.json();
    if (note.sign) {
      const signResp = await fetch(`${BASE_URL}/notes/${body.id}/sign`, { method: "POST" });
      if (signResp.status !== 200) {
        console.error(`FEL: kunde inte signera ${body.id} (${signResp.status})`);
        process.exit(1);
      }
    }
    created.push({ id: body.id, signed: note.sign });
    console.log(`✓ ${body.id} — ${note.sign ? "signerad" : "osignerad"} — ${note.author_sign}`);
  }
  console.log(`\n${created.length} anteckningar seedade för patient_no=${PATIENT_NO}, care_unit=${CARE_UNIT}.`);
}

main().catch((err) => {
  console.error("fatalt fel:", err);
  process.exit(1);
});

# nimloth-legacy-sim

**Detta är rekvisita, inte en produkt. Ingen leverantör är utpekad.**

## Vad detta är

En avsiktligt enkel, generisk motpart som beter sig som ett svenskt journalsystem av äldre snitt — utan att påstå sig vara TakeCare, Melior, Cosmic eller något annat namngivet system. Den byggdes för att ge [B4 — reversibel skrivväg](https://github.com/anderscarlius/nimloth-docs/blob/main/Spec_B4_Reversibel_Skrivvag_Anteckning_v0.1.md) en trovärdig, olik motpart att migrera en skrivväg till och från. Se `Spec_B4_Reversibel_Skrivvag_Anteckning_v0.1.md` §2 i `nimloth-docs` för det fulla resonemanget om varför Nimloths egen Postgres-FHIR-store inte duger som legacy-simulator.

Ligger i ett eget repo (beslut D4) av arkitektoniska skäl, inte historiska: den ska vara slängbar av konstruktion och ska aldrig kunna förväxlas med produktkod i `nimloth-core`.

## Det hårda taket — läs detta innan du ändrar något

- **En tabell.** `notes`. Ingen mer.
- **Fem endpoints.** Se nedan. **Den får aldrig få en sjätte.** Om ett behov uppstår som kräver en sjätte endpoint: stanna och fråga innan du bygger den. Det behovet hör troligen hemma i den riktiga gatewayen (`services/migration-gateway` i `nimloth-core`), inte här.
- **Ingen affärslogik.** Ingen validering utöver typkontroll, ingen beräkning, ingen orkestrering.
- **Inga beroenden utöver `express` + `pg`.** Lägg inte till ett ORM, en valideringsramverk, en loggningsbibliotek. Om det känns som att du behöver ett — det är ett tecken på att koden du skriver hör hemma någon annanstans.

Växer den här tjänsten är B4-beviset i fara: hela poängen är att en CIO ska kunna se att legacy-sidan är trivial jämfört med Nimloth-sidan. En sofistikerad simulator undergräver argumentet den ska stödja.

## Avsiktlig olikhet mot Nimloth

| Egenskap | Här | Nimloth |
|---|---|---|
| Anteckningens form | Fritext i `text`, sökordskonvention i innehållet (`Status:`, `Bedömning:`, `Åtgärd:`) | openEHR-composition, `progress_note.v1` |
| Patientidentitet | Lokalt `patient_no` (löpnummer, inte globalt unikt) | EHR-id + personnummer |
| Författare | `author_sign` — exakt fyra tecken, ingen roll, ingen HSA-koppling | HSA-id, roll, enhet |
| Signering | `signed_at` sätts en gång; raden blir orörbar (databastrigger, se `migrations/001-notes.sql`) | Composition committas, versionerad |
| Tidsstämpel | Lokal tid utan zon, `YYYY-MM-DD HH24:MI:SS` | ISO 8601 med zon |
| API | Egen, inkonsekvent dialekt (se `/notes/by-patient/:patient_no` — inte en REST-purists val) | FHIR R4 SE-fasad + openEHR |

Om en verklig region senare kommer in i bilden läggs deras egen dialekt till som en utbytbar mappningsprofil ovanpå denna generiska kärna — ingen sådan profil finns här idag, och ska inte läggas till förrän den faktiskt behövs (D6).

## Endpoints

1. `POST /notes` — skapa en osignerad anteckning. Body: `{ patient_no, care_unit, text, author_sign }`. `author_sign` måste vara exakt 4 tecken.
2. `GET /notes/by-patient/:patient_no` — lista en patients anteckningar, tidsordnat. Tom lista (inte 404) för okänd patient.
3. `GET /notes/:id` — en post.
4. `POST /notes/:id/sign` — signera. 409 om redan signerad, 404 om okänt id.
5. `GET /healthz`.

## I1 — signerat är orörbart

En Postgres-trigger (`migrations/001-notes.sql`) avvisar varje `UPDATE` eller `DELETE` mot en rad där `signed_at` redan är satt — oavsett om anropet kommer från applikationskoden eller direkt SQL. Detta är en kodgrind, inte en applikationsregel: `src/__tests__/immutability.test.ts` går direkt mot databasen för att bevisa det.

## Köra lokalt

```bash
docker compose up -d      # egen Postgres, port enligt Portstrategi.md (11601-blocket)
pnpm install               # eller npm/yarn — inget workspace, fristående repo
pnpm dev
```

## Köra tester lokalt

Kräver en riktig Postgres (I1-testet är en databastrigger — att mocka `pg.Pool` skulle inte bevisa någonting). Sätt `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` om standardvärdena (`localhost:5433/legacy_sim/legacy_sim/legacy_sim`) inte matchar din uppsättning, kör sedan:

```bash
pnpm test
```

CI kör mot en `postgres:16-alpine`-service-container, se `.github/workflows/ci.yml`.

## Portallokering

`11601` (deploy-universum, kategorin "Rekvisita & engångsmotparter", 11600–11799) — se `Portstrategi.md` i `nimloth-docs`. Medvetet **inte** i 11400-blocket (CDR & domäntjänster) trots att tjänsten funktionellt liknar en domäntjänst — portkartan ska koda samma arkitekturgräns som repo-valet.

## Vad detta INTE är

- Inte ett riktigt legacy-system. Inte en produkt. Se D6 i `Spec_B4_Reversibel_Skrivvag_Anteckning_v0.1.md`.
- Inte deployad till Moria eller något annat delat system (S1, B4 Etapp 1). Körs lokalt bara.
- Inte skriven mot riktiga patienter. Endast syntetiska (S3).

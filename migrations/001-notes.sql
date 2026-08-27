-- nimloth-legacy-sim — enda tabellen (S2: hårt tak, en tabell).
--
-- Avsiktligt olik Nimloth (Spec_B4_Reversibel_Skrivvag_Anteckning_v0.1.md §2):
-- fritext, lokalt patient_no, fyrteckens author_sign, lokal tid utan zon.

CREATE TABLE IF NOT EXISTS notes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_no    TEXT NOT NULL,
    care_unit     TEXT NOT NULL,
    text          TEXT NOT NULL,
    author_sign   CHAR(4) NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Europe/Stockholm'),
    signed_at     TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS notes_patient_no_idx ON notes (patient_no);

-- I1 (Spec B4 §5) — kodgrind, inte löfte: en signerad anteckning får
-- aldrig muteras i någon riktning. Så snart signed_at är satt är hela
-- raden orörbar, inklusive själva signeringsfältet. Detta är en
-- databastrigger, inte bara applikationslogik — testet i
-- src/__tests__/immutability.test.ts går direkt mot Postgres för att
-- bevisa att grinden håller även om applikationskoden kringgås.
CREATE OR REPLACE FUNCTION notes_reject_mutation_after_sign()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.signed_at IS NOT NULL THEN
        RAISE EXCEPTION 'notes: raden % är signerad (signed_at=%) och därmed orörbar (I1)', OLD.id, OLD.signed_at
            USING ERRCODE = '23000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notes_immutable_after_sign ON notes;
CREATE TRIGGER notes_immutable_after_sign
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION notes_reject_mutation_after_sign();

-- Samma grind mot DELETE — en signerad rad kan inte tas bort heller.
CREATE OR REPLACE FUNCTION notes_reject_delete_after_sign()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.signed_at IS NOT NULL THEN
        RAISE EXCEPTION 'notes: raden % är signerad (signed_at=%) och kan inte raderas (I1)', OLD.id, OLD.signed_at
            USING ERRCODE = '23000';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notes_no_delete_after_sign ON notes;
CREATE TRIGGER notes_no_delete_after_sign
    BEFORE DELETE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION notes_reject_delete_after_sign();

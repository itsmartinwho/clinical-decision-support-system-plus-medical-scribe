// The bundled demo data is made from supabase/seed.sql and the patient
// migration by scripts/demo-data; this fails when the two have drifted apart.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDemoFixture, PATIENT_MIGRATION_FILE, SEED_FILE, serializeFixture,
} from '../../../../scripts/demo-data/fixture-from-sql';

const root = join(__dirname, '..', '..', '..', '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

describe('demo fixture', () => {
  const built = buildDemoFixture({ seedSql: read(SEED_FILE), patientMigrationSql: read(PATIENT_MIGRATION_FILE) });

  it('matches the seed (run `pnpm demo:fixture` if this fails)', () => {
    expect(read('src/data/demo/fixture.json')).toBe(serializeFixture(built));
  });

  it('holds the seed patient, her encounters and the migration alert', () => {
    const t = built.tables;
    expect(t.patients.map((p) => `${p.first_name} ${p.last_name}`)).toEqual(['Dorothy Robinson']);
    expect(t.encounters.map((e) => e.encounter_id)).toHaveLength(4);
    expect(t.encounters.every((e) => e.transcript && e.soap_note)).toBe(true);
    expect(t.alerts.map((a) => a.title)).toEqual(['Possible Systemic Lupus Erythematosus']);
    // Every child row points at a patient and encounter in the fixture.
    const ids = new Set(t.encounters.map((e) => e.id));
    for (const row of [...t.conditions, ...t.lab_results, ...t.differential_diagnoses]) {
      expect(ids.has(row.encounter_id as string)).toBe(true);
    }
  });
});

// Builds the bundled demo data from the SQL that seeds a real database, so the
// two cannot drift: `pnpm demo:fixture` writes src/data/demo/fixture.json from
// these files, and tests/frontend/unit/lib/demoFixture.test.ts fails when the
// committed JSON no longer matches them.
//
// What it reproduces is `supabase db reset`: the migrations, then seed.sql.
// - seed.sql carries the patient, her four encounters and their conditions,
//   lab results and differential diagnoses as one JSON document; the rows are
//   upserted the way its PL/pgSQL does (conditions and labs on their id,
//   encounters on the patient and business id, differentials replaced).
// - 20250227153000_insert_dorothy_robinson.sql makes the patient row the seed
//   fills in, an encounter -003 that the seed then replaces, and one row in the
//   alerts table, which the seed does not touch. Only that alert is taken from
//   it: everything else it inserts is overwritten by the seed.
// Ids the database would generate (gen_random_uuid) are derived from stable
// names instead, so the fixture is the same on every run. Pure: no file access.

import { createHash } from 'node:crypto';
import type {
  DemoAlertRow, DemoConditionRow, DemoDifferentialRow, DemoEncounterRow,
  DemoFixture, DemoLabResultRow, DemoPatientRow, Json,
} from '../../src/data/demo/types';

export const SEED_FILE = 'supabase/seed.sql';
export const PATIENT_MIGRATION_FILE = 'supabase/migrations/20250227153000_insert_dorothy_robinson.sql';

/** A UUID (version 5 layout) derived from a name, standing in for gen_random_uuid(). */
export function stableUuid(name: string): string {
  const h = createHash('sha1').update(`foresight-demo:${name}`).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** The JSON document seed.sql assigns to `enriched_data`. */
export function extractSeedJson(seedSql: string): any[] {
  const open = ':= $json$';
  const start = seedSql.indexOf(open);
  if (start < 0) throw new Error(`${SEED_FILE}: no "enriched_data JSONB := $json$" block found`);
  const end = seedSql.indexOf('$json$;', start + open.length);
  if (end < 0) throw new Error(`${SEED_FILE}: the $json$ block is not closed`);
  const doc = JSON.parse(seedSql.slice(start + open.length, end));
  if (!Array.isArray(doc)) throw new Error(`${SEED_FILE}: enriched_data is not an array`);
  return doc;
}

// ---------------------------------------------------------------------------
// A small reader for the literal VALUES list of an INSERT: strings ('' escaped
// or dollar quoted), numbers, NULL, TRUE, FALSE, a bare identifier (a PL/pgSQL
// variable) and a trailing ::cast. Anything else throws, so a migration written
// another way fails the build of the fixture instead of being misread.
// ---------------------------------------------------------------------------
type SqlValue = { kind: 'literal'; value: string | number | boolean | null; cast?: string } | { kind: 'ident'; name: string };

function readValues(sql: string, from: number): { values: SqlValue[]; end: number } {
  const values: SqlValue[] = [];
  let i = from;
  const skip = () => {
    for (;;) {
      while (i < sql.length && /\s/.test(sql[i])) i++;
      if (sql.startsWith('--', i)) { while (i < sql.length && sql[i] !== '\n') i++; continue; }
      break;
    }
  };
  for (;;) {
    skip();
    let v: SqlValue;
    const ch = sql[i];
    if (ch === "'") {
      let s = '';
      i++;
      for (;;) {
        if (i >= sql.length) throw new Error('Unterminated string in VALUES');
        if (sql[i] === "'" && sql[i + 1] === "'") { s += "'"; i += 2; continue; }
        if (sql[i] === "'") { i++; break; }
        s += sql[i++];
      }
      v = { kind: 'literal', value: s };
    } else if (ch === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i))?.[0];
      if (!tag) throw new Error(`Unexpected "$" in VALUES at ${i}`);
      const close = sql.indexOf(tag, i + tag.length);
      if (close < 0) throw new Error(`Unterminated ${tag} string in VALUES`);
      v = { kind: 'literal', value: sql.slice(i + tag.length, close) };
      i = close + tag.length;
    } else if (/[-\d.]/.test(ch)) {
      const num = /^-?\d+(\.\d+)?/.exec(sql.slice(i))?.[0];
      if (!num) throw new Error(`Bad number in VALUES at ${i}`);
      v = { kind: 'literal', value: Number(num) };
      i += num.length;
    } else {
      const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i))?.[0];
      if (!word) throw new Error(`Unexpected "${ch}" in VALUES at ${i}`);
      i += word.length;
      skip();
      if (sql[i] === '(') throw new Error(`Function call ${word}(...) in VALUES is not supported`);
      const upper = word.toUpperCase();
      if (upper === 'NULL') v = { kind: 'literal', value: null };
      else if (upper === 'TRUE' || upper === 'FALSE') v = { kind: 'literal', value: upper === 'TRUE' };
      else v = { kind: 'ident', name: word };
    }
    skip();
    if (sql.startsWith('::', i)) {
      const cast = /^::([A-Za-z_]+)/.exec(sql.slice(i));
      if (!cast) throw new Error(`Bad cast in VALUES at ${i}`);
      if (v.kind === 'literal') v.cast = cast[1].toLowerCase();
      i += cast[0].length;
      skip();
    }
    values.push(v);
    if (sql[i] === ',') { i++; continue; }
    if (sql[i] === ')') return { values, end: i + 1 };
    throw new Error(`Expected "," or ")" in VALUES at ${i}, found "${sql[i]}"`);
  }
}

/** Every `INSERT INTO public.<table> (cols) VALUES (...)` in a file, as column → value. */
export function readInserts(sql: string, table: string): Array<Record<string, SqlValue>> {
  const rows: Array<Record<string, SqlValue>> = [];
  const re = new RegExp(`INSERT\\s+INTO\\s+public\\.${table}\\s*\\(([^)]*)\\)\\s*VALUES\\s*\\(`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const cols = m[1].split(',').map((c) => c.trim()).filter(Boolean);
    const { values, end } = readValues(sql, m.index + m[0].length);
    if (values.length !== cols.length) {
      throw new Error(`INSERT INTO ${table}: ${cols.length} columns but ${values.length} values`);
    }
    rows.push(Object.fromEntries(cols.map((c, k) => [c, values[k]])));
    re.lastIndex = end;
  }
  return rows;
}

function literal(v: SqlValue | undefined): Json {
  if (!v || v.kind === 'ident') return null;
  if (v.cast === 'jsonb' || v.cast === 'json') return JSON.parse(String(v.value));
  return v.value;
}

/** The timestamp a migration's file name carries (YYYYMMDDHHMMSS_...), as ISO. */
function migrationTime(file: string): string {
  const m = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_/.exec(file);
  if (!m) throw new Error(`${file}: no timestamp in the name`);
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+00:00`;
}

const str = (v: unknown): string | null => (v === undefined || v === null ? null : String(v));
const num = (v: unknown): number | null => (v === undefined || v === null || v === '' ? null : Number(v));

function upsertBy<T>(rows: T[], row: T, same: (a: T, b: T) => boolean): void {
  const at = rows.findIndex((r) => same(r, row));
  if (at >= 0) rows[at] = { ...rows[at], ...row };
  else rows.push(row);
}

export function buildDemoFixture(input: { seedSql: string; patientMigrationSql: string }): DemoFixture {
  const sha1 = createHash('sha1').update(input.seedSql).update('\0').update(input.patientMigrationSql).digest('hex');
  const patients: DemoPatientRow[] = [];
  const encounters: DemoEncounterRow[] = [];
  const conditions: DemoConditionRow[] = [];
  const labResults: DemoLabResultRow[] = [];
  const differentials: DemoDifferentialRow[] = [];
  const alerts: DemoAlertRow[] = [];

  for (const item of extractSeedJson(input.seedSql)) {
    const p = item.patient_complete_data;
    if (!p?.patient_id) throw new Error(`${SEED_FILE}: an entry has no patient_complete_data.patient_id`);
    const patientUuid = stableUuid(`patient:${p.patient_id}`);
    const stamp = str(p.updated_at) ?? str(p.created_at) ?? migrationTime(PATIENT_MIGRATION_FILE);
    upsertBy(patients, {
      id: patientUuid,
      patient_id: p.patient_id,
      first_name: str(p.first_name),
      last_name: str(p.last_name),
      gender: str(p.gender),
      birth_date: str(p.birth_date),
      race: str(p.race),
      ethnicity: str(p.ethnicity),
      marital_status: str(p.marital_status),
      language: str(p.language),
      poverty_percentage: num(p.poverty_percentage),
      photo_url: str(p.photo_url),
      alerts: Array.isArray(p.alerts) ? p.alerts : null,
      created_at: str(p.created_at) ?? stamp,
      updated_at: stamp,
      extra_data: p.extra_data ?? null,
    }, (a, b) => a.patient_id === b.patient_id);

    for (const e of p.encounters ?? []) {
      const businessId = str(e.encounter_business_id);
      if (!businessId || !e.encounter_id) throw new Error(`${SEED_FILE}: an encounter of ${p.patient_id} has no ids`);
      const existing = encounters.find((r) => r.patient_supabase_id === patientUuid && r.encounter_id === businessId);
      const encounterUuid = existing?.id ?? String(e.encounter_id);
      const created = str(e.created_at) ?? stamp;
      upsertBy(encounters, {
        id: encounterUuid,
        encounter_id: businessId,
        patient_supabase_id: patientUuid,
        encounter_type: str(e.encounter_type),
        status: str(e.status),
        scheduled_start_datetime: str(e.scheduled_start_datetime),
        scheduled_end_datetime: str(e.scheduled_end_datetime),
        actual_start_datetime: str(e.actual_start_datetime),
        actual_end_datetime: str(e.actual_end_datetime),
        reason_code: str(e.reason_code),
        reason_display_text: str(e.reason_display_text),
        transcript: str(e.transcript),
        soap_note: str(e.soap_note),
        treatments: e.treatments ?? null,
        diagnosis_rich_content: null,
        treatments_rich_content: null,
        observations: Array.isArray(e.observations) ? e.observations.map(String) : null,
        prior_auth_justification: str(e.prior_auth_justification),
        insurance_status: str(e.insurance_status),
        is_deleted: false,
        created_at: created,
        updated_at: str(e.updated_at) ?? created,
        extra_data: e.extra_data ?? null,
      }, (a, b) => a.id === b.id);

      for (const c of e.conditions ?? []) {
        upsertBy(conditions, {
          id: String(c.condition_id),
          patient_id: patientUuid,
          encounter_id: encounterUuid,
          code: String(c.code),
          description: str(c.description),
          category: String(c.category),
          clinical_status: str(c.clinical_status),
          verification_status: str(c.verification_status),
          onset_date: str(c.onset_date),
          recorded_date: null,
          note: str(c.note),
          created_at: created,
          updated_at: created,
          extra_data: null,
        }, (a, b) => a.id === b.id);
      }

      for (const l of e.lab_results ?? []) {
        upsertBy(labResults, {
          id: String(l.lab_id),
          patient_id: patientUuid,
          encounter_id: encounterUuid,
          name: String(l.name),
          value: str(l.value),
          value_type: str(l.value_type),
          units: str(l.units),
          date_time: str(l.date_time),
          reference_range: str(l.reference_range),
          flag: str(l.flag),
          interpretation: str(l.interpretation),
          created_at: created,
          updated_at: created,
          extra_data: null,
        }, (a, b) => a.id === b.id);
      }

      // DELETE ... WHERE encounter_id = encounter_uuid, then INSERT each.
      for (let k = differentials.length - 1; k >= 0; k--) {
        if (differentials[k].encounter_id === encounterUuid) differentials.splice(k, 1);
      }
      for (const d of e.differential_diagnoses ?? []) {
        differentials.push({
          id: stableUuid(`differential:${encounterUuid}:${d.rank_order}:${d.diagnosis_name}`),
          patient_id: patientUuid,
          encounter_id: encounterUuid,
          diagnosis_name: String(d.diagnosis_name),
          likelihood: num(d.likelihood),
          key_factors: str(d.key_factors),
          rank_order: num(d.rank_order),
          created_at: created,
          updated_at: created,
          extra_data: null,
        });
      }
    }
  }

  // The migration's alert rows: it looks the patient up by business id into
  // v_patient_uuid, which is the only variable its VALUES use.
  const patientBusinessId = /WHERE\s+patient_id\s*=\s*'([^']+)'/i.exec(input.patientMigrationSql)?.[1];
  const alertPatient = patients.find((p) => p.patient_id === patientBusinessId);
  const alertTime = migrationTime(PATIENT_MIGRATION_FILE);
  for (const row of readInserts(input.patientMigrationSql, 'alerts')) {
    if (row.patient_id?.kind !== 'ident' || !alertPatient) {
      throw new Error(`${PATIENT_MIGRATION_FILE}: an alert whose patient the seed does not have`);
    }
    const title = String(literal(row.title));
    alerts.push({
      id: stableUuid(`alert:${alertPatient.patient_id}:${title}`),
      patient_id: alertPatient.id,
      encounter_id: null,
      alert_type: String(literal(row.alert_type)),
      severity: String(literal(row.severity) ?? 'INFO'),
      category: str(literal(row.category)),
      title,
      message: String(literal(row.message)),
      suggestion: str(literal(row.suggestion)),
      confidence_score: num(literal(row.confidence_score)),
      source_reasoning: str(literal(row.source_reasoning)),
      processing_model: str(literal(row.processing_model)),
      context_data: literal(row.context_data),
      status: String(literal(row.status) ?? 'active'),
      is_real_time: Boolean(literal(row.is_real_time) ?? false),
      is_post_consultation: Boolean(literal(row.is_post_consultation) ?? false),
      acknowledged: false,
      created_at: alertTime,
      updated_at: alertTime,
      expires_at: null,
    });
  }

  return {
    source: { files: [SEED_FILE, PATIENT_MIGRATION_FILE], sha1 },
    tables: {
      patients,
      encounters,
      conditions,
      lab_results: labResults,
      differential_diagnoses: differentials,
      alerts,
    },
  };
}

export function serializeFixture(fixture: DemoFixture): string {
  return `${JSON.stringify(fixture, null, 2)}\n`;
}

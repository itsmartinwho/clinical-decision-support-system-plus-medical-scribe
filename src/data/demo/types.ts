// Row shapes of the bundled demo data: the tables as `supabase db reset`
// leaves them, column for column (supabase/migrations/20241201000000_base_schema.sql).

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface DemoPatientRow {
  id: string;
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  birth_date: string | null;
  race: string | null;
  ethnicity: string | null;
  marital_status: string | null;
  language: string | null;
  poverty_percentage: number | null;
  photo_url: string | null;
  alerts: Json[] | null;
  created_at: string;
  updated_at: string;
  extra_data: { [key: string]: Json } | null;
}

export interface DemoEncounterRow {
  id: string;
  encounter_id: string;
  patient_supabase_id: string;
  encounter_type: string | null;
  status: string | null;
  scheduled_start_datetime: string | null;
  scheduled_end_datetime: string | null;
  actual_start_datetime: string | null;
  actual_end_datetime: string | null;
  reason_code: string | null;
  reason_display_text: string | null;
  transcript: string | null;
  soap_note: string | null;
  treatments: Json | null;
  diagnosis_rich_content: Json | null;
  treatments_rich_content: Json | null;
  observations: string[] | null;
  prior_auth_justification: string | null;
  insurance_status: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  extra_data: { [key: string]: Json } | null;
}

export interface DemoConditionRow {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  code: string;
  description: string | null;
  category: string;
  clinical_status: string | null;
  verification_status: string | null;
  onset_date: string | null;
  recorded_date: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  extra_data: { [key: string]: Json } | null;
}

export interface DemoLabResultRow {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  name: string;
  value: string | null;
  value_type: string | null;
  units: string | null;
  date_time: string | null;
  reference_range: string | null;
  flag: string | null;
  interpretation: string | null;
  created_at: string;
  updated_at: string;
  extra_data: { [key: string]: Json } | null;
}

export interface DemoDifferentialRow {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  diagnosis_name: string;
  likelihood: number | null;
  key_factors: string | null;
  rank_order: number | null;
  created_at: string;
  updated_at: string;
  extra_data: { [key: string]: Json } | null;
}

export interface DemoAlertRow {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  alert_type: string;
  severity: string;
  category: string | null;
  title: string;
  message: string;
  suggestion: string | null;
  confidence_score: number | null;
  source_reasoning: string | null;
  processing_model: string | null;
  context_data: Json | null;
  status: string;
  is_real_time: boolean;
  is_post_consultation: boolean;
  acknowledged: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface DemoTables {
  patients: DemoPatientRow[];
  encounters: DemoEncounterRow[];
  conditions: DemoConditionRow[];
  lab_results: DemoLabResultRow[];
  differential_diagnoses: DemoDifferentialRow[];
  alerts: DemoAlertRow[];
}

export interface DemoFixture {
  /** Where the rows come from, and a hash of those sources, so a stored session can tell it is stale. */
  source: { files: string[]; sha1: string };
  tables: DemoTables;
}

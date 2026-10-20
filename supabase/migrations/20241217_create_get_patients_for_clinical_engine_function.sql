-- Migration: Create function to get patients/encounters for clinical engine processing
-- Description: This function identifies patients with clinical transcripts but minimal existing clinical results
-- The tables it reads are made by 20241201000000_base_schema.sql.
CREATE OR REPLACE FUNCTION get_patients_for_clinical_engine()
RETURNS TABLE (
  patient_id TEXT,
  first_name TEXT,
  last_name TEXT,
  encounter_uuid UUID,
  encounter_id TEXT,
  transcript TEXT,
  transcript_length INT,
  diff_dx_count BIGINT,
  conditions_count BIGINT
)
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.patient_id,
    p.first_name,
    p.last_name,
    e.id as encounter_uuid,
    e.encounter_id,
    e.transcript, -- Ensure transcript is selected
    length(e.transcript) as transcript_length,
    (SELECT COUNT(*) FROM differential_diagnoses dd WHERE dd.encounter_id = e.id) as diff_dx_count,
    (SELECT COUNT(*) FROM conditions c WHERE c.encounter_id = e.id) as conditions_count
  FROM patients p
  JOIN encounters e ON p.id = e.patient_supabase_id
  WHERE e.transcript IS NOT NULL
    AND length(e.transcript) > 100
    AND (
      (SELECT COUNT(*) FROM differential_diagnoses dd WHERE dd.encounter_id = e.id) < 3
      OR (SELECT COUNT(*) FROM conditions c WHERE c.encounter_id = e.id AND c.category = 'encounter-diagnosis') = 0
    )
  ORDER BY p.patient_id, e.encounter_id;
END;
$$ LANGUAGE plpgsql; 
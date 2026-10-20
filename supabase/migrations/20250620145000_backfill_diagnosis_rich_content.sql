-- Backfill diagnosis_rich_content for existing encounters
-- Copies descriptions from conditions table into a markdown text block when the enriched field is NULL.
-- Run once. Safe to re-run (idempotent).

BEGIN;

WITH aggregated AS (
  SELECT
    encounter_id,
    string_agg(description, E'\n') AS diag_text
  FROM conditions
  WHERE description IS NOT NULL
  GROUP BY encounter_id
)
UPDATE encounters e
SET diagnosis_rich_content = jsonb_build_object(
  'content_type', 'text/markdown',
  'text_content', aggregated.diag_text,
  'rich_elements', '[]'::jsonb,
  'created_at', NOW(),
  'version', '1.0'
)
FROM aggregated
WHERE e.id = aggregated.encounter_id
  AND (e.diagnosis_rich_content IS NULL OR e.diagnosis_rich_content = 'null');

COMMIT; 
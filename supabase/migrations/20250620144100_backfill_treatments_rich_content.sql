-- Backfill treatments_rich_content for existing encounters
-- Copies legacy "treatments" JSON data into the enriched field when the enriched field is NULL.
-- Run once. Safe to re-run (idempotent).

-- NOTE: Adjust schema/table names if they differ.

BEGIN;

-- Update encounters lacking enriched treatments
UPDATE encounters
SET treatments_rich_content = jsonb_build_object(
  'content_type', 'application/json',
  'text_content', to_jsonb(treatments),
  'rich_elements', '[]'::jsonb,
  'created_at', NOW(),
  'version', '1.0'
)
WHERE (treatments_rich_content IS NULL OR treatments_rich_content = 'null')
  AND treatments IS NOT NULL
  AND treatments <> 'null';

COMMIT; 
-- Fix diagnosis_rich_content schema mismatch
-- Converts legacy {charts, tables, markdown} format to standard RichContent format
-- This prevents crashes in RichTreatmentEditor which expects rich_elements array

BEGIN;

-- First, backup and convert legacy diagnosis format to standard RichContent
UPDATE encounters
SET diagnosis_rich_content = jsonb_build_object(
  'content_type', 'text/markdown',
  'text_content', COALESCE(diagnosis_rich_content->>'markdown', ''),
  'rich_elements', 
    CASE 
      WHEN diagnosis_rich_content->'tables' IS NOT NULL 
           AND jsonb_typeof(diagnosis_rich_content->'tables') = 'array'
           AND jsonb_array_length(diagnosis_rich_content->'tables') > 0 THEN
        (WITH numbered_tables AS (
          SELECT elem, row_number() OVER() as table_number
          FROM jsonb_array_elements(diagnosis_rich_content->'tables') AS elem
        )
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', 'table_' || table_number,
            'type', 'table',
            'position', table_number - 1,
            'data', elem,
            'editable', true
          )
        ) FROM numbered_tables)
      ELSE '[]'::jsonb
    END,
  'created_at', NOW(),
  'version', '1.0'
)
WHERE diagnosis_rich_content IS NOT NULL 
  AND diagnosis_rich_content ? 'markdown'  -- Has legacy format
  AND NOT diagnosis_rich_content ? 'rich_elements';  -- Doesn't have new format

COMMIT; 
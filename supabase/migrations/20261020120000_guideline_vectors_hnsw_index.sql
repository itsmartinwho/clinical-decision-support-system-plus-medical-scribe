-- Replace the guideline vectors' ivfflat index with HNSW.
--
-- 20250128_create_clinical_guidelines_schema.sql made an ivfflat index with
-- lists = 100. ivfflat splits the rows into that many lists and, at the
-- default ivfflat.probes = 1, searches only the nearest one; with a few dozen
-- rows most lists are empty, so match_guidelines(match_count => 5) can return
-- a single row. HNSW needs no training and no tuning for the row count, and
-- returns the requested number of neighbours at any size. Needs pgvector 0.5
-- or later (Supabase has it).
--
-- Not applied to the hosted project by this change: run it there on purpose.

DROP INDEX IF EXISTS idx_guideline_vectors_embedding;

CREATE INDEX IF NOT EXISTS idx_guideline_vectors_embedding_hnsw
  ON guideline_vectors
  USING hnsw (embedding vector_cosine_ops);

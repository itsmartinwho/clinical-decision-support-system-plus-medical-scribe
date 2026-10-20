-- Let the browser edit a differential diagnosis, as the caller.
--
-- PUT /api/differential-diagnoses used the service role, which bypasses RLS,
-- so anyone who could reach the route could edit any row however the policies
-- read. It now runs as the anon role like the rest of the client, which means
-- the table must allow the edit itself.
--
-- The route writes four columns and no others, so that is all that is granted:
-- a differential can be edited but not re-parented to another patient or
-- encounter. Nothing new is reachable by the roles that way: they can already
-- insert and delete rows in this table.
--
-- Safe to run twice.

grant update (diagnosis_name, likelihood, key_factors, rank_order)
  on public.differential_diagnoses to anon, authenticated;

drop policy if exists differential_diagnoses_update on public.differential_diagnoses;
create policy differential_diagnoses_update on public.differential_diagnoses
  for update to anon, authenticated using (true) with check (true);

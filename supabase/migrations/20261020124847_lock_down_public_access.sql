-- Lock down public access to the Foresight demo database.
--
-- Before this migration every table in `public` had row level security off,
-- and `anon` and `authenticated` (the roles behind the public anon key that
-- ships in every browser) held every privilege on them, TRUNCATE included.
-- Anyone holding the key could rewrite or wipe the demo.
--
-- After it: RLS is on for every table; the two roles hold only the verbs the
-- app's browser client really uses, with row policies on top; neither can
-- TRUNCATE, TRIGGER or REFERENCE anything. `service_role` (the server routes
-- and the guideline ingesters) bypasses RLS and is untouched.
--
-- What the browser client does with the anon key
-- (src/lib/supabaseDataService.ts, unifiedAlertsService.ts,
--  clinicalEngineServiceV3.ts, the encounter editing hooks, guideline search):
--
--   patients                read, create
--   encounters              read, create, edit, soft-delete / restore, and
--                           hard-delete (the trash's "permanent delete", and
--                           "discard" on a consultation just started)
--   conditions              read, create, replace the encounter diagnosis
--   differential_diagnoses  read, create, replace an encounter's whole set
--   lab_results             read
--   alerts                  read, create, update (accept / dismiss / ...)
--   guidelines_docs         read
--   guideline_vectors       read, through match_guidelines()
--   guidelines_refresh_log  nothing (only the service-role scheduler and
--                           ingesters touch it)
--
-- No policy anywhere allows deleting a patient or a guideline.
--
-- Safe to run twice: every statement is idempotent.


-- 1. Row level security on every app table ------------------------------------

alter table public.patients               enable row level security;
alter table public.encounters             enable row level security;
alter table public.conditions             enable row level security;
alter table public.differential_diagnoses enable row level security;
alter table public.lab_results            enable row level security;
alter table public.alerts                 enable row level security;
alter table public.guidelines_docs        enable row level security;
alter table public.guideline_vectors      enable row level security;
alter table public.guidelines_refresh_log enable row level security;


-- 2. Privileges: start from nothing, grant back what the client uses ----------

revoke all on table
  public.patients,
  public.encounters,
  public.conditions,
  public.differential_diagnoses,
  public.lab_results,
  public.alerts,
  public.guidelines_docs,
  public.guideline_vectors,
  public.guidelines_refresh_log,
  public.active_patient_alerts
from anon, authenticated;

grant select, insert                 on public.patients               to anon, authenticated;
grant select, insert, update, delete on public.encounters             to anon, authenticated;
grant select, insert, delete         on public.conditions             to anon, authenticated;
grant select, insert, delete         on public.differential_diagnoses to anon, authenticated;
grant select                         on public.lab_results            to anon, authenticated;
grant select, insert, update         on public.alerts                 to anon, authenticated;
grant select                         on public.guidelines_docs        to anon, authenticated;
grant select                         on public.guideline_vectors      to anon, authenticated;
-- guidelines_refresh_log: no grant at all.

-- Nothing the browser inserts uses a sequence; the three left are the
-- guideline tables', which only the service role writes.
revoke all on sequence
  public.guideline_vectors_id_seq,
  public.guidelines_docs_id_seq,
  public.guidelines_refresh_log_id_seq
from anon, authenticated;

-- The view joins alerts, patients and encounters. It was owned by postgres and
-- ran as it, which skips RLS on all three; run it as the caller instead.
alter view public.active_patient_alerts set (security_invoker = true);
grant select on public.active_patient_alerts to anon, authenticated;


-- 3. Row policies --------------------------------------------------------------

-- patients: the client lists and creates them; it never edits or deletes one.
drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients
  for select to anon, authenticated using (true);

drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients
  for insert to anon, authenticated with check (true);

-- encounters: the client creates them live, edits their notes, soft-deletes and
-- restores them (is_deleted), and hard-deletes in two places: the trash's
-- "permanent delete" (a row already is_deleted) and "discard" on a consultation
-- just started (a row created moments ago). Anything else, the seeded history
-- above all, has to go through the trash first.
drop policy if exists encounters_select on public.encounters;
create policy encounters_select on public.encounters
  for select to anon, authenticated using (true);

drop policy if exists encounters_insert on public.encounters;
create policy encounters_insert on public.encounters
  for insert to anon, authenticated with check (coalesce(is_deleted, false) = false);

drop policy if exists encounters_update on public.encounters;
create policy encounters_update on public.encounters
  for update to anon, authenticated using (true) with check (true);

drop policy if exists encounters_delete on public.encounters;
create policy encounters_delete on public.encounters
  for delete to anon, authenticated
  using (coalesce(is_deleted, false) or created_at > now() - interval '1 day');

-- conditions: the client only replaces an encounter's primary diagnosis
-- (delete + insert, category 'encounter-diagnosis'); a patient's other
-- conditions are never deleted.
drop policy if exists conditions_select on public.conditions;
create policy conditions_select on public.conditions
  for select to anon, authenticated using (true);

drop policy if exists conditions_insert on public.conditions;
create policy conditions_insert on public.conditions
  for insert to anon, authenticated with check (true);

drop policy if exists conditions_delete on public.conditions;
create policy conditions_delete on public.conditions
  for delete to anon, authenticated using (category = 'encounter-diagnosis');

-- differential_diagnoses: regenerated as a set (delete the encounter's rows,
-- insert the new ones). Edits go through a service-role route, so no UPDATE.
drop policy if exists differential_diagnoses_select on public.differential_diagnoses;
create policy differential_diagnoses_select on public.differential_diagnoses
  for select to anon, authenticated using (true);

drop policy if exists differential_diagnoses_insert on public.differential_diagnoses;
create policy differential_diagnoses_insert on public.differential_diagnoses
  for insert to anon, authenticated with check (true);

drop policy if exists differential_diagnoses_delete on public.differential_diagnoses;
create policy differential_diagnoses_delete on public.differential_diagnoses
  for delete to anon, authenticated using (true);

-- lab_results: read only.
drop policy if exists lab_results_select on public.lab_results;
create policy lab_results_select on public.lab_results
  for select to anon, authenticated using (true);

-- alerts: the client raises them and updates their state; it never deletes one.
drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts
  for select to anon, authenticated using (true);

drop policy if exists alerts_insert on public.alerts;
create policy alerts_insert on public.alerts
  for insert to anon, authenticated with check (true);

drop policy if exists alerts_update on public.alerts;
create policy alerts_update on public.alerts
  for update to anon, authenticated using (true) with check (true);

-- guidelines: read only. Ingestion, embedding and the refresh log are written
-- by the service role, which bypasses RLS.
drop policy if exists guidelines_docs_select on public.guidelines_docs;
create policy guidelines_docs_select on public.guidelines_docs
  for select to anon, authenticated using (true);

drop policy if exists guideline_vectors_select on public.guideline_vectors;
create policy guideline_vectors_select on public.guideline_vectors
  for select to anon, authenticated using (true);

-- guidelines_refresh_log: RLS on and no policy, so only the service role sees it.


-- 4. Functions -----------------------------------------------------------------
-- None is SECURITY DEFINER, so all of them run as the caller and meet the
-- policies above. get_patients_for_clinical_engine(), match_guidelines() and
-- search_guidelines_text() are called by the client and keep EXECUTE.
-- trigger_set_timestamp() is a trigger function and cannot be called directly.
-- These two are maintenance jobs the client never calls: the second inserts a
-- duplicate set of alerts on every call, so keep them to the service role.

revoke execute on function public.cleanup_expired_alerts()
  from public, anon, authenticated;
revoke execute on function public.migrate_patient_alerts_to_unified_system()
  from public, anon, authenticated;

grant execute on function public.cleanup_expired_alerts() to service_role;
grant execute on function public.migrate_patient_alerts_to_unified_system() to service_role;

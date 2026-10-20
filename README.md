# Clinical decision support system, plus a medical scribe

A 2025 prototype of clinical decision support in the browser, called Foresight. It listens to a consultation, writes the notes, raises alerts while the doctor and patient talk, and answers clinical questions, all over a small pseudo-EMR.

[![Clinical decision support system with proactive alerts, scribe, notes and a pseudo-EMR (3 min 50 s)](https://cdn.loom.com/sessions/thumbnails/4c6c327fe0554e4caa6f5345789f72c2-b23743124f72c0d2.gif)](https://www.loom.com/share/4c6c327fe0554e4caa6f5345789f72c2)

The video narrates it as "ForSight". Live demo: [foresight-cdss-mvp.vercel.app](https://foresight-cdss-mvp.vercel.app).

> This is a prototype, not a medical device, and not for clinical use. Every patient in it is synthetic: invented people on records from EMRBots' artificial patient dataset, with transcripts and notes generated for the prototype.

## What it does

- **Scribe and notes.** A consultation is transcribed live with Deepgram's medical model, speakers separated. From the transcript it drafts a SOAP note, a diagnosis and a treatment plan, each editable in place, and drafts referral and prior authorization forms.
- **Clinical engine.** The pipeline behind those drafts. From the transcript and the chart it ranks differential diagnoses by likelihood, settles on a primary diagnosis with a confidence, plans treatment with a decision tree, writes the SOAP note, and drafts a referral or prior authorization when one is needed. Results are stored in FHIR-shaped tables (conditions, differentials, encounters).
- **Alerts.** While the consultation runs, each new stretch of transcript is picked up every ten seconds to be checked for drug interactions, missing labs, comorbidities, questions worth asking and diagnostic gaps, and when it ends the whole consultation goes to a reasoning model for review. Each pass is one call to OpenAI's Responses API (`OpenAIClient.processAlerts` in `src/lib/ai/gpt-models.ts`) with the patient's chart, its answer held to a schema of those alert types, and the alerts it raises are saved to the alerts table, where the alerts dashboard reads them. The ten-second timer, and the sessions it serves, live in the server's memory, so the passes during a consultation suit one long-running server (`pnpm start`) better than serverless functions.
- **Advisor.** A chat for clinical questions that can take a patient's chart as context, and writes and runs Python (OpenAI's Code Interpreter) to draw charts.
- **Pseudo-EMR.** A dashboard of upcoming consultations, a patient list, and a workspace per patient with encounters, diagnoses, labs and everything else in one view. There is also a searchable library of clinical guidelines (USPSTF, NICE, NCI PDQ, RxNorm).

On first visit the dashboard offers a guided demo, which plays back a consultation with the seed patient.

## Stack

Next.js 14 (App Router), React 18 and TypeScript, Tailwind CSS and shadcn/ui. Supabase (Postgres, with pgvector for the guidelines). OpenAI for the language models, Deepgram for transcription. Deployed on Vercel.

## Run it

You need Node 24, pnpm 10, a Supabase project, an OpenAI API key and, for live transcription, a Deepgram API key.

```
pnpm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project's URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Its anon key, for reads and writes from the app |
| `SUPABASE_SERVICE_ROLE_KEY` | Its service role key, for the server routes, the guideline ingestion and the data scripts |
| `OPENAI_API_KEY` | The advisor, the clinical engine, the alerts and the guideline embeddings |
| `DEEPGRAM_API_KEY` | Live transcription. It stays on the server, which trades it for a 30-second token each time the browser opens a transcription socket; the key needs Member permissions |
| `API_BASE_URL` | Only for `scripts/batch_clinical_engine_processing.ts`; defaults to `http://localhost:3000` |

The app was built with Supabase's anon and service role keys. Supabase is retiring those by the end of 2026 in favour of publishable and secret keys, which may need a newer `@supabase/supabase-js`.

Set up the database from `supabase/`: the migrations make the tables, and `supabase/seed.sql` adds one synthetic patient, Dorothy Robinson, with four encounters. With the [Supabase CLI](https://supabase.com/docs/guides/cli):

```
supabase link --project-ref <your-project-ref>
supabase db push --include-seed
```

Without it, run each file in `supabase/migrations/` in name order in the SQL editor, then `supabase/seed.sql`. The tables have no row-level security, so the anon key can read and write all of them: fine for synthetic data, not for anything else.

Then:

```
pnpm dev
```

and open `http://localhost:3000`.

The guidelines library starts empty. `pnpm run setup:guidelines` ingests and embeds the sources; see [docs/clinical-guidelines.md](docs/clinical-guidelines.md).

`pnpm build` builds without any keys set. `pnpm lint` passes with warnings. `pnpm test:unit` runs the Vitest suites, several of which have fallen behind the components and fail. `pnpm test:py` tests the earlier Python prototype of the engine, after `pip install -r src/clinical_engine_prototype/prototype_requirements.txt`; some of those fail too.

## Models

The model names are in `src/types/ai-models.ts`. The advisor uses `gpt-4o-mini`, or `gpt-4o` in think mode, through the Responses API; the clinical engine uses `gpt-4o-mini`; the alerts are set to `gpt-4o-mini` during the consultation and `gpt-5.6-sol` after it; the guideline search embeds with `text-embedding-ada-002`. OpenAI shuts `gpt-4o` and `gpt-4o-mini` down on 14 January 2027 and suggests `gpt-6-luna` in their place. Transcription is Deepgram's `nova-3-medical`.

## Where things are

```
src/app/             pages, and the API routes under api/ (advisor, clinical-engine, alerts, forms, guidelines)
src/components/      the views, the consultation panel, the editors, and shadcn/ui under ui/
src/lib/             the clinical engine (clinicalEngineServiceV3.ts), the alerts, the Supabase data layer, prompts
src/services/        the guideline ingesters and search, and the guided demo
supabase/            migrations and the seed
scripts/             guideline setup, a batch run of the engine, and the synthetic data tools
tests/               Vitest, Playwright and Storybook
docs/                one guide per part
```

`src/clinical_engine_prototype/` is an earlier Python version of the engine. The app does not call it.

The guides in `docs/` go deeper: [the advisor](docs/advisor.md), [the clinical engine](docs/clinical-engine.md), [the alerts](docs/alert-system.md), [transcription](docs/transcription.md), [the guidelines](docs/clinical-guidelines.md), [the guided demo](docs/demo_system.md), [the architecture](docs/architecture.md) and [the front end](docs/frontend_guide.md). They were written as it was built, so some details have drifted. How the synthetic data was made is in [scripts/synthetic-data/](scripts/synthetic-data/).

## Licence

MIT, see [LICENSE](LICENSE).

By José (JJ) Martín Quesada, [@itsmartinwho](https://github.com/itsmartinwho).

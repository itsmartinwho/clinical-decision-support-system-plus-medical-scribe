# Advisor

A chat for clinical questions. It can take a patient's chart as context, and it
writes and runs Python to draw a chart when that helps.

## How it works

`GET /api/advisor` (`src/app/api/advisor/route.ts`) streams the answer as
server-sent events. It sends one request to OpenAI's Responses API, with the
`code_interpreter` tool in an `auto` container. The request carries the whole
conversation and, when a patient is selected, a summary of their chart:
demographics, each encounter's SOAP content, lab results and alerts.

- Standard mode uses `gpt-4o-mini`; think mode uses `gpt-4o`. The model names are
  in `src/types/ai-models.ts`. OpenAI shuts both down on 2027-01-14 and suggests
  `gpt-6-luna`.
- The advisor used the Assistants API until OpenAI shut it down on 2026-08-26.

## Query parameters

- `payload`: JSON, `{ "messages": [{ "role": "user", "content": "..." }] }`
- `think`: `"true"` for think mode
- `patientId`: optional, the patient whose chart to include
- `specialty`: optional; read but not used yet (`enrichWithGuidelines` in the
  route would add matching guidelines, and nothing calls it)

## Events

Each event is `data: <JSON>`:

- `{ "content": "..." }`: a piece of the Markdown answer
- `{ "type": "tool_code_chunk", "language": "python", "content": "..." }`: a piece of the code being run
- `{ "type": "code_interpreter_image_id", "file_id": "cfile_...", "container_id": "cntr_..." }`: a chart the code saved
- `{ "error": "..." }`: the request failed
- `[DONE]`: the answer is complete

## Charts

A chart is a file in the container the code ran in. When the answer is done the
route lists the container's image files and sends their ids. The client loads
each one from `GET /api/advisor/image/<file_id>?container_id=<container_id>`.
Containers expire after 20 idle minutes, and their files with them.

## Front end

`src/components/views/AdvisorView.tsx` renders the stream as it arrives with
`smd.js` (streaming Markdown), then renders the finished answer sanitised with
DOMPurify.

## Environment

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, to read the
  patient's chart

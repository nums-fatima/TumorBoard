# TumorBoard

A multi-agent oncology research assistant. Four specialist agents — Literature, Clinical Trials,
Guideline, and Biomarker — investigate a question in parallel against real public data sources, and
a synthesizer agent merges their findings into a conversational answer plus a structured research
report with graded evidence and citations. Named after the real "tumor board": the multidisciplinary
panel of specialists who jointly review a cancer case.

## Architecture

```
backend/   FastAPI + WebSocket, Python, OpenRouter (Qwen)
frontend/  Vite + React + TypeScript + Tailwind v4
```

- **Orchestrator** extracts structured intent (cancer type, gene/biomarker, drug) from the question,
  classifies each message as a NEW research topic or a FOLLOWUP on the current one, and fans the 4
  agents out concurrently (`asyncio.gather`) for NEW topics.
- **Literature agent** — PubMed E-utilities (esearch/efetch), no API key needed.
- **Clinical Trial agent** — ClinicalTrials.gov API v2.
- **Biomarker agent** — CIViC GraphQL API (curated variant/evidence database).
- **Guideline agent** — NCI PDQ treatment summaries, navigated with a recursive-language-model (RLM)
  pattern: the LLM is given the document's section outline and recursively chooses which sections to
  expand (`READ: <section>` / `FINAL: <answer>`) instead of pre-chunked embedding retrieval. This is
  deliberately the only RAG-shaped piece in the system that uses RLM — the other three sources are
  short, structured API responses where plain retrieval is the right tool.
- **Synthesizer** drafts the streamed reply and a structured report (evidence-level notes,
  contradictions/caveats between agents, full citation list).
- Every agent lifecycle event (dispatch, sub-step, completion) goes through one `emit()` call that
  drives both a colored terminal trace (`rich`) and the frontend's live agent-status panel — same
  data, two views.
- **Smart routing**: follow-up messages ("can you simplify that?") skip the agent fan-out entirely and
  reuse the previous turn's findings; only genuinely new research questions re-run the full pipeline
  and produce a new report.

## Setup

### Backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux
```

Copy `.env.example` to `.env` and fill in your OpenRouter key:

```
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=qwen/qwen-2.5-72b-instruct
```

Run it:

```bash
./.venv/Scripts/python -m uvicorn app.main:app --port 8800 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/ws` to the backend on port 8800.

## Notes

- ClinicalTrials.gov, CIViC, and cancer.gov sit behind TLS fingerprint-based bot detection that blocks
  plain `httpx`/`requests` clients regardless of headers; the tool layer uses `curl_cffi` (Chrome
  impersonation) for those three, plain `httpx` for PubMed.
- NCI PDQ has no public search API, so the Guideline agent uses a small curated map of cancer type ->
  verified-live PDQ summary URL (`backend/app/tools/pdq.py`). Unrecognized cancer types fall back to
  "no guideline available" rather than guessing a URL.
- CIViC's `diseaseName` filter requires its own controlled vocabulary (e.g. "Lung Non-small Cell
  Carcinoma", not "NSCLC") — mapped alongside the PDQ cancer-type keys in `backend/app/tools/civic.py`.

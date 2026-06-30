from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.agents.orchestrator import classify_message, extract_intent, run_agents
from app.config import settings
from app.llm.openrouter import OpenRouterProvider
from app.models.schemas import AgentResult, ExtractedIntent
from app.observability.trace import console, emit
from app.report.synthesizer import build_report, stream_followup_reply, stream_reply
from app.tools.document_parser import (
    extract_text_from_pdf,
    extract_text_from_txt,
    parse_genomic_report,
    parsed_to_summary,
)
from app.ws.manager import SafeSocket

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = OpenRouterProvider()

# In-memory document store: upload_id → {filename, text, parsed}
# Keyed by upload_id generated at upload time; cleared when server restarts
_documents: dict[str, dict] = {}


@dataclass
class ChatSession:
    conversation: list[dict[str, str]] = field(default_factory=list)
    last_question: str | None = None
    last_results: list[AgentResult] = field(default_factory=list)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)) -> dict:
    """
    Accept a genomic report (PDF or TXT), extract its text, and return an
    upload_id the frontend includes with subsequent chat messages so the
    backend can ground the research in that patient's molecular profile.
    """
    data = await file.read()
    filename = file.filename or "report"

    if filename.lower().endswith(".pdf"):
        text = extract_text_from_pdf(data)
    else:
        text = extract_text_from_txt(data)

    if not text.strip():
        return {"error": "Could not extract text from file. Make sure it is not a scanned image PDF."}

    upload_id = str(uuid.uuid4())
    _documents[upload_id] = {"filename": filename, "text": text, "parsed": None}

    # Return a short preview so the frontend can confirm extraction worked
    preview = " ".join(text.split())[:200]
    return {
        "upload_id": upload_id,
        "filename": filename,
        "preview": preview,
        "char_count": len(text),
    }


@app.websocket("/ws/chat")
async def chat_ws(raw_ws: WebSocket) -> None:
    await raw_ws.accept()
    ws = SafeSocket(raw_ws)
    console.print(f"[bold green]Client connected[/bold green] ({raw_ws.client.host})")
    await emit(ws, "Orchestrator", "ready", "connected, waiting for a question")

    sessions: dict[str, ChatSession] = {}

    try:
        while True:
            data = await ws.receive_json()
            question = (data.get("message") or "").strip()
            chat_id = data.get("chat_id") or "default"
            upload_id = data.get("upload_id")
            if not question:
                continue

            # ── Resolve any attached genomic document ─────────────────────
            doc_context: str | None = None
            doc_intent_override: ExtractedIntent | None = None

            if upload_id and upload_id in _documents:
                doc = _documents[upload_id]
                await emit(ws, "Orchestrator", "running", f"parsing genomic report: {doc['filename']}")

                if doc["parsed"] is None:
                    doc["parsed"] = await parse_genomic_report(llm, doc["text"])

                parsed = doc["parsed"]
                doc_context = parsed_to_summary(parsed)

                # Build intent from the report so agents search the right biomarkers
                cancer = parsed.get("cancer_type") or ""
                biomarkers = parsed.get("actionable_biomarkers") or []
                gene = biomarkers[0] if biomarkers else None
                from app.tools.pdq import CANCER_TYPE_URLS
                cancer_key = next(
                    (k for k in CANCER_TYPE_URLS if k.lower() in cancer.lower()), None
                )
                doc_intent_override = ExtractedIntent(
                    raw_question=question,
                    cancer_type_free_text=cancer or None,
                    cancer_type_key=cancer_key,
                    gene_or_biomarker=gene,
                    drug_or_therapy=None,
                )
                await emit(
                    ws, "Orchestrator", "running",
                    f"report parsed — cancer: {cancer}, key biomarker: {gene}",
                )

            # ── Per-chat session state ─────────────────────────────────────
            session = sessions.setdefault(chat_id, ChatSession())
            session.conversation.append({"role": "user", "content": question})

            route = await classify_message(llm, session.last_question, question)
            await emit(ws, "Orchestrator", "running", f"routed as {route}")

            reply_chunks: list[str] = []

            if route == "NEW":
                # Prefer document-derived intent over free-text extraction
                intent = doc_intent_override or await extract_intent(llm, question)
                await emit(
                    ws, "Orchestrator", "running",
                    f"intent: cancer_type={intent.cancer_type_key or intent.cancer_type_free_text}, "
                    f"gene={intent.gene_or_biomarker}, drug={intent.drug_or_therapy}",
                )

                results = await run_agents(llm, intent, ws)
                session.last_question = question
                session.last_results = results

                await emit(ws, "Synthesizer", "running", "cross-checking agent findings and drafting reply")

                # Pass document context so the synthesizer personalises the reply
                async for chunk in stream_reply(llm, question, results, patient_context=doc_context):
                    reply_chunks.append(chunk)
                    await ws.send_json({"type": "token", "content": chunk})

                report = await build_report(llm, question, results, patient_context=doc_context)
                await ws.send_json({"type": "report", "report": report})
                await emit(ws, "Synthesizer", "done", "report ready")
            else:
                await emit(ws, "Orchestrator", "done", "follow-up — reusing prior findings")
                await emit(ws, "Synthesizer", "running", "drafting follow-up reply from existing findings")
                async for chunk in stream_followup_reply(llm, session.conversation, session.last_question, session.last_results):
                    reply_chunks.append(chunk)
                    await ws.send_json({"type": "token", "content": chunk})
                await emit(ws, "Synthesizer", "done", "follow-up answered")

            session.conversation.append({"role": "assistant", "content": "".join(reply_chunks)})
            await ws.send_json({"type": "done"})
    except WebSocketDisconnect:
        console.print("[bold red]Client disconnected[/bold red]")

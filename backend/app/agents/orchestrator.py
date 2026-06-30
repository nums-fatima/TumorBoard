from __future__ import annotations

import asyncio
import json

from app.agents.biomarker import BiomarkerAgent
from app.agents.clinical_trial import ClinicalTrialAgent
from app.agents.guideline import GuidelineAgent
from app.agents.literature import LiteratureAgent
from app.llm.base import LLMProvider
from app.models.schemas import AgentResult, ExtractedIntent
from app.observability.trace import JsonSendable, emit
from app.tools.pdq import CANCER_TYPE_URLS

INTENT_SYSTEM_PROMPT = (
    "Extract structured oncology query intent from the user's question as strict JSON with "
    'exactly these keys: {"cancer_type_free_text": str|null, "cancer_type_key": str|null, '
    '"gene_or_biomarker": str|null, "drug_or_therapy": str|null}. '
    f"cancer_type_key must be one of {list(CANCER_TYPE_URLS.keys())} (pick the closest match) "
    "or null if none fit. Output ONLY the JSON object, no prose, no markdown fences."
)


CLASSIFY_SYSTEM_PROMPT = (
    "You are routing messages in an oncology research chat. Given the PREVIOUS research question "
    "(if any) and the NEW message, decide whether the new message is a NEW research question that "
    "needs a fresh investigation (a different cancer type, gene/biomarker, or drug, or otherwise a "
    "substantially new topic), or a FOLLOWUP (a clarification, follow-up question, or remark about "
    "the same topic / the previous answer). Respond with EXACTLY one word: NEW or FOLLOWUP."
)


async def classify_message(llm: LLMProvider, previous_question: str | None, new_message: str) -> str:
    if not previous_question:
        return "NEW"
    messages = [
        {"role": "system", "content": CLASSIFY_SYSTEM_PROMPT},
        {"role": "user", "content": f"PREVIOUS question: {previous_question}\nNEW message: {new_message}"},
    ]
    raw = (await llm.complete(messages)).strip().upper()
    return "FOLLOWUP" if "FOLLOWUP" in raw else "NEW"


async def extract_intent(llm: LLMProvider, question: str) -> ExtractedIntent:
    messages = [
        {"role": "system", "content": INTENT_SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]
    raw = await llm.complete(messages)
    data: dict = {}
    try:
        start, end = raw.index("{"), raw.rindex("}") + 1
        data = json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        pass

    allowed = ExtractedIntent.model_fields
    return ExtractedIntent(raw_question=question, **{k: v for k, v in data.items() if k in allowed})


async def run_agents(llm: LLMProvider, intent: ExtractedIntent, ws: JsonSendable | None) -> list[AgentResult]:
    async def guideline_substep(title: str) -> None:
        await emit(ws, "Guideline", "running", f"expanding section: {title}")

    agents = [
        LiteratureAgent(),
        ClinicalTrialAgent(),
        BiomarkerAgent(),
        GuidelineAgent(llm, on_substep=guideline_substep),
    ]

    async def run_one(agent) -> AgentResult:
        await emit(ws, agent.name, "running", "dispatched")
        try:
            result = await agent.run(intent)
        except Exception as exc:  # noqa: BLE001 - one agent's external API failing shouldn't sink the report
            await emit(ws, agent.name, "error", str(exc))
            return AgentResult(agent=agent.name, summary=f"Agent failed: {exc}")
        await emit(ws, agent.name, "done", result.summary)
        return result

    await emit(ws, "Orchestrator", "running", f"dispatching {len(agents)} agents for: {intent.raw_question!r}")
    results = await asyncio.gather(*(run_one(a) for a in agents))
    await emit(ws, "Orchestrator", "done", "all agents reported back")
    return list(results)

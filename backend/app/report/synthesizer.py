from __future__ import annotations

import json
from collections.abc import AsyncIterator

from app.llm.base import LLMProvider
from app.models.schemas import AgentResult

REPLY_SYSTEM_PROMPT = """You are TumorBoard, a multi-agent oncology research assistant.
Four specialist agents have gathered real data for you: Literature (PubMed), Clinical Trials \
(ClinicalTrials.gov), Biomarker (CIViC), and Guideline (NCI PDQ). Using ONLY those findings, \
write a COMPREHENSIVE, STRUCTURED research response in markdown.

MANDATORY FORMAT:
- Use ## section headings for every major topic (aim for 5-7 sections tailored to the question)
- **Bold** all drug names, gene/mutation names, biomarkers, and critical clinical terms on first use
- Use bullet points or numbered lists when enumerating trials, papers, or evidence items
- Cite specific quantitative data wherever provided: PFS, ORR, hazard ratios, NCT numbers, PMIDs
- Tag evidence strength per claim: "Phase III RCT", "CIViC Level A", "preclinical", "case series"
- Always include a ## Caveats & Contradictions section flagging any gaps or disagreements between sources
- Be THOROUGH and CLINICALLY PRECISE — this is a research report, not a brief summary
- Never invent citations, statistics, or claims not present in the provided agent findings

Aim for sections such as:
## Overview, ## Clinical Evidence, ## Active Clinical Trials, ## Treatment Guidelines, \
## Biomarker Significance, ## Resistance & Emerging Strategies, ## Caveats & Contradictions, ## Summary"""

REPORT_SYSTEM_PROMPT = """Using the same agent findings, produce a comprehensive structured JSON \
research report with EXACTLY this shape (no extra keys, no markdown fences):
{
  "summary": "3-5 sentence executive summary, clinically substantive with specific data points",
  "evidence_level_notes": "paragraph discussing evidence quality, Phase levels, statistical \
significance, and CIViC evidence grades for the key claims",
  "contradictions": ["specific contradiction or caveat 1", "caveat 2"],
  "sections": [
    {"agent": "agent name", "summary": "comprehensive 2-4 sentence summary of all key findings \
from this agent, with specific numbers, NCT IDs, PMIDs, or CIViC IDs where available"}
  ],
  "suggested_followups": [
    "A specific follow-up research question the clinician might naturally ask next?",
    "Another clinically relevant follow-up question?",
    "A third distinct follow-up question about resistance, combinations, or related biomarkers?"
  ]
}
Be thorough in every field. suggested_followups must be exactly 3 short, specific, \
clinically useful questions that build on what was found. Output ONLY the JSON object."""

FOLLOWUP_SYSTEM_PROMPT = (
    "You are TumorBoard, an oncology research assistant. The user is following up on the previous "
    "research turn -- answer conversationally using the findings already gathered below plus the "
    "conversation so far. Use **bold** for key terms and bullet points where helpful. "
    "Don't invent new citations or claims the findings don't support."
)


def _findings_block(question: str, results: list[AgentResult]) -> str:
    parts = [f"Original question: {question}", ""]
    for r in results:
        parts.append(f"[{r.agent}] {r.summary}")
        for finding in r.findings[:10]:
            parts.append(f"  - {json.dumps(finding, default=str)[:1000]}")
    return "\n".join(parts)


async def stream_reply(
    llm: LLMProvider,
    question: str,
    results: list[AgentResult],
    patient_context: str | None = None,
) -> AsyncIterator[str]:
    content = _findings_block(question, results)
    if patient_context:
        content = f"{patient_context}\n\n{content}"
    messages = [
        {"role": "system", "content": REPLY_SYSTEM_PROMPT},
        {"role": "user", "content": content},
    ]
    async for chunk in llm.stream(messages):
        yield chunk


async def stream_followup_reply(
    llm: LLMProvider,
    conversation: list[dict[str, str]],
    last_question: str | None,
    last_results: list[AgentResult],
) -> AsyncIterator[str]:
    findings_context = _findings_block(last_question or "(none)", last_results) if last_results else "(no prior findings)"
    messages = [
        {"role": "system", "content": FOLLOWUP_SYSTEM_PROMPT},
        {"role": "user", "content": f"Findings from the previous research turn:\n{findings_context}"},
        *conversation,
    ]
    async for chunk in llm.stream(messages):
        yield chunk


async def build_report(
    llm: LLMProvider,
    question: str,
    results: list[AgentResult],
    patient_context: str | None = None,
) -> dict:
    content = _findings_block(question, results)
    if patient_context:
        content = f"{patient_context}\n\n{content}"
    messages = [
        {"role": "system", "content": REPORT_SYSTEM_PROMPT},
        {"role": "user", "content": content},
    ]
    raw = await llm.complete(messages)
    try:
        start, end = raw.index("{"), raw.rindex("}") + 1
        report = json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        report = {"summary": raw, "evidence_level_notes": "", "contradictions": [], "sections": []}

    report["sources"] = [
        {"agent": r.agent, "label": c.label, "url": c.url, "source_type": c.source_type}
        for r in results
        for c in r.citations
    ]
    return report

from __future__ import annotations

from collections.abc import Awaitable, Callable

from app.agents.base import Agent
from app.llm.base import LLMProvider
from app.models.schemas import AgentResult, Citation, ExtractedIntent
from app.tools.pdq import load_guideline
from app.tools.rlm import navigate


class GuidelineAgent(Agent):
    name = "Guideline"

    def __init__(self, llm: LLMProvider, on_substep: Callable[[str], Awaitable[None]] | None = None):
        self.llm = llm
        self.on_substep = on_substep

    async def run(self, intent: ExtractedIntent) -> AgentResult:
        if not intent.cancer_type_key:
            return AgentResult(
                agent=self.name,
                summary="No NCI PDQ guideline matched this cancer type in the demo dataset.",
            )

        doc = await load_guideline(intent.cancer_type_key)
        if doc is None:
            return AgentResult(agent=self.name, summary="Guideline document could not be loaded.")

        answer, sections_read = await navigate(self.llm, doc, intent.raw_question, on_step=self.on_substep)

        citations = [Citation(label=f"NCI PDQ: {title}", url=doc.url, source_type="pdq") for title in sections_read]
        summary = f"Reviewed {len(sections_read)} guideline section(s): {', '.join(sections_read) or 'none'}."
        return AgentResult(
            agent=self.name,
            summary=summary,
            findings=[{"answer": answer, "sections_read": sections_read, "source_url": doc.url}],
            citations=citations,
        )

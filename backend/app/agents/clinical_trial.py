from __future__ import annotations

from app.agents.base import Agent
from app.models.schemas import AgentResult, Citation, ExtractedIntent
from app.tools.clinicaltrials import search_trials


class ClinicalTrialAgent(Agent):
    name = "ClinicalTrial"

    async def run(self, intent: ExtractedIntent) -> AgentResult:
        condition = intent.cancer_type_free_text or intent.raw_question
        trials = await search_trials(condition, intervention=intent.drug_or_therapy, page_size=12)
        citations = [Citation(label=f"{t['nct_id']}: {t['title']}", url=t["url"], source_type="clinicaltrials") for t in trials]
        summary = (
            f"Found {len(trials)} clinical trials for '{condition}'"
            + (f" + {intent.drug_or_therapy}" if intent.drug_or_therapy else "")
            + "."
            if trials
            else f"No matching clinical trials found for '{condition}'."
        )
        return AgentResult(agent=self.name, summary=summary, findings=trials, citations=citations)

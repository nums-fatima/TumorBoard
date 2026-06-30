from __future__ import annotations

from app.agents.base import Agent
from app.models.schemas import AgentResult, Citation, ExtractedIntent
from app.tools.civic import CANCER_TYPE_TO_CIVIC_DISEASE, gene_overview, search_evidence


class BiomarkerAgent(Agent):
    name = "Biomarker"

    async def run(self, intent: ExtractedIntent) -> AgentResult:
        findings: list[dict] = []
        citations: list[Citation] = []

        if intent.gene_or_biomarker:
            gene = await gene_overview(intent.gene_or_biomarker)
            if gene:
                findings.append({"type": "gene_overview", **gene})

        disease = CANCER_TYPE_TO_CIVIC_DISEASE.get(intent.cancer_type_key or "")
        evidence = await search_evidence(disease=disease, therapy=intent.drug_or_therapy, first=12)
        findings.extend({"type": "evidence_item", **e} for e in evidence)
        citations.extend(
            Citation(label=f"CIViC EID:{e['civic_id']} - {e['molecular_profile']}", url=e["url"], source_type="civic")
            for e in evidence
        )

        summary = (
            f"CIViC: {len(evidence)} curated evidence items"
            + (f" for {intent.gene_or_biomarker}" if intent.gene_or_biomarker else "")
            + "."
            if evidence or findings
            else "No CIViC biomarker evidence found for this query."
        )
        return AgentResult(agent=self.name, summary=summary, findings=findings, citations=citations)

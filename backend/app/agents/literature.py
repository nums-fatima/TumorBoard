from __future__ import annotations

from app.agents.base import Agent
from app.models.schemas import AgentResult, Citation, ExtractedIntent
from app.tools.pubmed import search_literature


class LiteratureAgent(Agent):
    name = "Literature"

    async def run(self, intent: ExtractedIntent) -> AgentResult:
        # PubMed's automatic term mapping ANDs every word together, so a long
        # descriptive phrase (e.g. "EGFR exon 19 deletion osimertinib NSCLC")
        # often returns zero hits even when the underlying topic is well
        # covered. Fall back to progressively shorter/coarser queries built
        # from the same entities rather than failing outright.
        candidates = [
            " ".join(p for p in [intent.gene_or_biomarker, intent.drug_or_therapy, intent.cancer_type_free_text] if p),
            " ".join(p for p in [_first_token(intent.gene_or_biomarker), intent.drug_or_therapy, intent.cancer_type_free_text] if p),
            " ".join(p for p in [intent.drug_or_therapy, intent.cancer_type_free_text] if p),
            intent.drug_or_therapy or intent.cancer_type_free_text or intent.raw_question,
        ]

        articles: list[dict] = []
        used_term = candidates[-1]
        for term in dict.fromkeys(c for c in candidates if c):  # dedupe, keep order
            articles = await search_literature(term, retmax=12)
            used_term = term
            if articles:
                break

        citations = [
            Citation(label=f"{a['title']} ({a['year']})", url=a["url"], source_type="pubmed") for a in articles
        ]
        summary = (
            f"Found {len(articles)} relevant PubMed articles for '{used_term}'."
            if articles
            else f"No relevant PubMed articles found for '{used_term}'."
        )
        return AgentResult(agent=self.name, summary=summary, findings=articles, citations=citations)


def _first_token(text: str | None) -> str | None:
    if not text:
        return None
    return text.split()[0]

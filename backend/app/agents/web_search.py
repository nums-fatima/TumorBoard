from __future__ import annotations

from app.agents.base import Agent
from app.config import settings
from app.models.schemas import AgentResult, Citation, ExtractedIntent

TRUSTED_DOMAINS = [
    "nih.gov", "cancer.gov", "cancer.org", "clinicaltrials.gov",
    "nccn.org", "fda.gov", "who.int", "nejm.org", "thelancet.com",
    "jamanetwork.com", "bmj.com", "pubmed.ncbi.nlm.nih.gov",
    "mayoclinic.org", "onclive.com", "ascopost.com", "esmo.org",
]


class WebSearchAgent(Agent):
    name = "Web Sources"

    async def run(self, intent: ExtractedIntent) -> AgentResult:
        if not settings.tavily_api_key:
            return AgentResult(agent=self.name, summary="Web Search skipped — no TAVILY_API_KEY configured.")

        from tavily import AsyncTavilyClient

        query = " ".join(p for p in [
            intent.gene_or_biomarker,
            intent.drug_or_therapy,
            intent.cancer_type_free_text,
        ] if p) or intent.raw_question

        client = AsyncTavilyClient(api_key=settings.tavily_api_key)
        try:
            response = await client.search(
                query=query,
                search_depth="advanced",
                include_domains=TRUSTED_DOMAINS,
                max_results=8,
            )
        except Exception as exc:
            return AgentResult(agent=self.name, summary=f"Web search failed: {exc}")

        results = response.get("results", [])
        if not results:
            return AgentResult(agent=self.name, summary=f"No trusted-domain results found for '{query}'.")

        findings = [
            {"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("content", "")[:400]}
            for r in results
        ]
        citations = [
            Citation(label=r.get("title", r.get("url", "")), url=r.get("url", ""), source_type="web")
            for r in results
        ]
        return AgentResult(
            agent=self.name,
            summary=f"Found {len(results)} results from trusted medical sources for '{query}'.",
            findings=findings,
            citations=citations,
        )

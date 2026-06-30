from __future__ import annotations

from pydantic import BaseModel, Field


class Citation(BaseModel):
    label: str
    url: str
    source_type: str  # "pubmed" | "clinicaltrials" | "civic" | "pdq"


class AgentResult(BaseModel):
    agent: str
    summary: str
    findings: list[dict] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    note: str = ""


class ExtractedIntent(BaseModel):
    raw_question: str
    cancer_type_free_text: str | None = None
    cancer_type_key: str | None = None
    gene_or_biomarker: str | None = None
    drug_or_therapy: str | None = None

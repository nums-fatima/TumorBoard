from __future__ import annotations

import io
import json

from pypdf import PdfReader

from app.llm.base import LLMProvider

PARSE_SYSTEM_PROMPT = """You are a clinical genomicist parsing a molecular/genomic sequencing report.
Extract the following information and return ONLY a valid JSON object — no prose, no markdown:
{
  "cancer_type": "primary cancer diagnosis in plain English, e.g. Non-Small Cell Lung Cancer",
  "cancer_stage": "stage if mentioned, else null",
  "key_variants": [
    {"gene": "gene symbol", "variant": "specific mutation/alteration", "vaf": "VAF % if present", "tier": "Tier I/II/III if mentioned", "classification": "pathogenic/VUS/etc"}
  ],
  "tmb": "TMB value and classification, e.g. 'Low (0.33 mut/Mb)' or null",
  "msi_status": "MSS / MSI-H / MSI-L / unknown",
  "pd_l1": "PD-L1 expression or CPS score if present, else null",
  "hrd": "HRD score or status if present, else null",
  "prior_therapies": ["list of prior therapies mentioned in report"],
  "actionable_biomarkers": ["list of clinically actionable biomarkers, e.g. 'EGFR exon 19 deletion'"],
  "specimen_type": "tissue / liquid biopsy / FFPE / etc"
}
Use null for fields not present in the report. Keep variant descriptions clinically precise."""


def extract_text_from_pdf(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages).strip()


def extract_text_from_txt(data: bytes) -> str:
    return data.decode("utf-8", errors="ignore").strip()


async def parse_genomic_report(llm: LLMProvider, report_text: str) -> dict:
    messages = [
        {"role": "system", "content": PARSE_SYSTEM_PROMPT},
        {"role": "user", "content": f"Report text (first 6000 chars):\n\n{report_text[:6000]}"},
    ]
    raw = await llm.complete(messages)
    try:
        start, end = raw.index("{"), raw.rindex("}") + 1
        return json.loads(raw[start:end])
    except (ValueError, json.JSONDecodeError):
        return {}


def parsed_to_summary(parsed: dict) -> str:
    """Convert parsed genomic data into a readable context block for the synthesizer."""
    lines = ["=== PATIENT GENOMIC REPORT CONTEXT ==="]
    if parsed.get("cancer_type"):
        lines.append(f"Cancer type: {parsed['cancer_type']}")
    if parsed.get("cancer_stage"):
        lines.append(f"Stage: {parsed['cancer_stage']}")
    if parsed.get("specimen_type"):
        lines.append(f"Specimen: {parsed['specimen_type']}")
    if parsed.get("key_variants"):
        lines.append("Detected variants:")
        for v in parsed["key_variants"]:
            vaf = f" (VAF {v['vaf']})" if v.get("vaf") else ""
            tier = f" [{v['tier']}]" if v.get("tier") else ""
            lines.append(f"  • {v['gene']} {v['variant']}{vaf}{tier}")
    if parsed.get("actionable_biomarkers"):
        lines.append(f"Actionable biomarkers: {', '.join(parsed['actionable_biomarkers'])}")
    if parsed.get("tmb"):
        lines.append(f"TMB: {parsed['tmb']}")
    if parsed.get("msi_status"):
        lines.append(f"MSI: {parsed['msi_status']}")
    if parsed.get("pd_l1"):
        lines.append(f"PD-L1: {parsed['pd_l1']}")
    if parsed.get("hrd"):
        lines.append(f"HRD: {parsed['hrd']}")
    if parsed.get("prior_therapies"):
        lines.append(f"Prior therapies: {', '.join(parsed['prior_therapies'])}")
    lines.append("=== END PATIENT CONTEXT ===")
    return "\n".join(lines)

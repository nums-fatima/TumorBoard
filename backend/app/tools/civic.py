from __future__ import annotations

from app.tools.http_client import post_json

GRAPHQL_URL = "https://civicdb.org/api/graphql"

# CIViC's diseaseName filter requires a close match to its own controlled
# vocabulary ("Lung Non-small Cell Carcinoma", not "NSCLC") -- it does not
# fuzzy-match. Map our existing cancer_type_key taxonomy (shared with the PDQ
# guideline lookup) to CIViC's exact disease names, verified live against the
# API rather than guessed.
CANCER_TYPE_TO_CIVIC_DISEASE: dict[str, str] = {
    "nsclc": "Lung Non-small Cell Carcinoma",
    "sclc": "Lung Small Cell Carcinoma",
    "breast": "Breast Cancer",
    "prostate": "Prostate Cancer",
    "colorectal": "Colorectal Cancer",
    "pancreatic": "Pancreatic Cancer",
    "melanoma": "Melanoma",
    "aml": "Acute Myeloid Leukemia",
    "ovarian": "Epithelial Ovarian Cancer",
}

EVIDENCE_QUERY = """
query($disease: String, $therapy: String, $first: Int) {
  evidenceItems(diseaseName: $disease, therapyName: $therapy, first: $first) {
    edges {
      node {
        id
        description
        evidenceLevel
        evidenceDirection
        significance
        evidenceType
        disease { name }
        therapies { name }
        molecularProfile { name }
        source { citation sourceType sourceUrl }
      }
    }
  }
}
"""

GENE_QUERY = """
query($symbol: [String!]) {
  genes(entrezSymbols: $symbol, first: 1) {
    edges {
      node {
        name
        description
        variants(first: 8) {
          edges { node { name } }
        }
      }
    }
  }
}
"""


async def search_evidence(disease: str | None = None, therapy: str | None = None, first: int = 6) -> list[dict]:
    if not disease and not therapy:
        return []
    variables = {"disease": disease, "therapy": therapy, "first": first}
    data = await post_json(GRAPHQL_URL, json_body={"query": EVIDENCE_QUERY, "variables": variables})
    edges = data.get("data", {}).get("evidenceItems", {}).get("edges", [])
    return [_parse_evidence(e["node"]) for e in edges]


async def gene_overview(gene_symbol: str) -> dict | None:
    data = await post_json(GRAPHQL_URL, json_body={"query": GENE_QUERY, "variables": {"symbol": [gene_symbol]}})
    edges = data.get("data", {}).get("genes", {}).get("edges", [])
    if not edges:
        return None
    node = edges[0]["node"]
    variants = [v["node"]["name"] for v in node.get("variants", {}).get("edges", [])]
    return {"name": node["name"], "description": node.get("description", ""), "known_variants": variants}


def _parse_evidence(node: dict) -> dict:
    source = node.get("source") or {}
    return {
        "civic_id": node.get("id"),
        "description": node.get("description", ""),
        "evidence_level": node.get("evidenceLevel", ""),
        "evidence_direction": node.get("evidenceDirection", ""),
        "significance": node.get("significance", ""),
        "evidence_type": node.get("evidenceType", ""),
        "disease": (node.get("disease") or {}).get("name", ""),
        "therapies": [t["name"] for t in node.get("therapies", [])],
        "molecular_profile": (node.get("molecularProfile") or {}).get("name", ""),
        "citation": source.get("citation", ""),
        "url": source.get("sourceUrl") or f"https://civicdb.org/evidence/{node.get('id')}",
    }

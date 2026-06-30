from __future__ import annotations

import xml.etree.ElementTree as ET

from app.tools.http_client import get_json, get_text

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


async def search_literature(term: str, retmax: int = 6) -> list[dict]:
    """Search PubMed for `term` and return structured records with abstracts."""
    search_data = await get_json(
        ESEARCH_URL,
        params={"db": "pubmed", "term": term, "retmode": "json", "retmax": retmax, "sort": "relevance"},
    )
    ids = search_data.get("esearchresult", {}).get("idlist", [])
    if not ids:
        return []

    xml_text = await get_text(EFETCH_URL, params={"db": "pubmed", "id": ",".join(ids), "retmode": "xml"})
    return _parse_articles(xml_text)


def _parse_articles(xml_text: str) -> list[dict]:
    root = ET.fromstring(xml_text)
    records = []
    for article in root.findall(".//PubmedArticle"):
        pmid = article.findtext(".//PMID", default="")
        title = article.findtext(".//ArticleTitle", default="").strip()
        journal = article.findtext(".//Journal/Title", default="")
        year = article.findtext(".//JournalIssue/PubDate/Year") or article.findtext(
            ".//JournalIssue/PubDate/MedlineDate", default=""
        )
        abstract_parts = [el.text or "" for el in article.findall(".//Abstract/AbstractText")]
        abstract = " ".join(part.strip() for part in abstract_parts if part).strip()
        pub_types = [el.text for el in article.findall(".//PublicationTypeList/PublicationType") if el.text]

        if not pmid or not title:
            continue
        records.append(
            {
                "pmid": pmid,
                "title": title,
                "journal": journal,
                "year": year,
                "abstract": abstract or "(No abstract available)",
                "publication_types": pub_types,
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            }
        )
    return records

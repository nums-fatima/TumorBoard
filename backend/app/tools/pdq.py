from __future__ import annotations

from bs4 import BeautifulSoup

from app.tools.http_client import get_text

# NCI PDQ professional-version treatment summaries. There's no public search
# API for PDQ, so this is a small curated map of cancer type -> verified-live
# summary URL (each checked manually to resolve with a 200). Good enough for a
# demo; unrecognized cancer types fall back to "no guideline available" rather
# than guessing a URL.
CANCER_TYPE_URLS: dict[str, str] = {
    "nsclc": "https://www.cancer.gov/types/lung/hp/non-small-cell-lung-treatment-pdq",
    "sclc": "https://www.cancer.gov/types/lung/hp/small-cell-lung-treatment-pdq",
    "breast": "https://www.cancer.gov/types/breast/hp/breast-treatment-pdq",
    "prostate": "https://www.cancer.gov/types/prostate/hp/prostate-treatment-pdq",
    "colorectal": "https://www.cancer.gov/types/colorectal/hp/colon-treatment-pdq",
    "pancreatic": "https://www.cancer.gov/types/pancreatic/hp/pancreatic-treatment-pdq",
    "melanoma": "https://www.cancer.gov/types/skin/hp/melanoma-treatment-pdq",
    "aml": "https://www.cancer.gov/types/leukemia/hp/adult-aml-treatment-pdq",
    "ovarian": "https://www.cancer.gov/types/ovarian/hp/ovarian-epithelial-treatment-pdq",
}


class GuidelineDocument:
    """A long NCI PDQ guideline page exposed as a navigable outline instead of
    pre-chunked embeddings -- the recursive-navigation primitives an RLM-style
    agent calls to decide what to expand, rather than a fixed top-k retrieval."""

    def __init__(self, url: str, soup: BeautifulSoup):
        self.url = url
        self._sections: dict[str, str] = {}
        self._outline: list[dict[str, str]] = []
        self._build(soup)

    def _build(self, soup: BeautifulSoup) -> None:
        main = soup.find("main") or soup
        current_title: str | None = None
        buffer: list[str] = []

        def flush() -> None:
            if current_title is not None:
                text = " ".join(buffer).strip()
                if text:
                    self._sections[current_title] = text

        for tag in main.find_all(["h2", "h3", "p", "li"]):
            if tag.name in ("h2", "h3"):
                flush()
                current_title = tag.get_text(strip=True)
                buffer = []
                if current_title:
                    self._outline.append({"level": tag.name, "title": current_title})
            else:
                text = tag.get_text(" ", strip=True)
                if text:
                    buffer.append(text)
        flush()

    def list_sections(self) -> list[dict[str, str]]:
        return self._outline

    def read_section(self, title: str) -> str:
        if title in self._sections:
            return self._sections[title]
        # tolerate loose/partial title matches from the LLM
        for known_title, text in self._sections.items():
            if title.lower() in known_title.lower() or known_title.lower() in title.lower():
                return text
        return ""


async def load_guideline(cancer_type_key: str) -> GuidelineDocument | None:
    url = CANCER_TYPE_URLS.get(cancer_type_key.lower())
    if not url:
        return None
    html = await get_text(url)
    soup = BeautifulSoup(html, "lxml")
    return GuidelineDocument(url, soup)

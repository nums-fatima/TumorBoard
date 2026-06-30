from __future__ import annotations

from app.tools.http_client import get_json

STUDIES_URL = "https://clinicaltrials.gov/api/v2/studies"

FIELDS = ",".join(
    [
        "NCTId",
        "BriefTitle",
        "OverallStatus",
        "Phase",
        "Condition",
        "InterventionName",
        "BriefSummary",
        "StartDate",
        "LeadSponsorName",
    ]
)


async def search_trials(condition: str, intervention: str | None = None, page_size: int = 6) -> list[dict]:
    params = {"query.cond": condition, "fields": FIELDS, "pageSize": page_size}
    if intervention:
        params["query.intr"] = intervention

    data = await get_json(STUDIES_URL, params=params)
    return [_parse_study(s) for s in data.get("studies", [])]


def _parse_study(study: dict) -> dict:
    proto = study.get("protocolSection", {})
    ident = proto.get("identificationModule", {})
    status = proto.get("statusModule", {})
    design = proto.get("designModule", {})
    conditions = proto.get("conditionsModule", {}).get("conditions", [])
    interventions = [i.get("name", "") for i in proto.get("armsInterventionsModule", {}).get("interventions", [])]
    sponsor = proto.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name", "")
    summary = proto.get("descriptionModule", {}).get("briefSummary", "")

    nct_id = ident.get("nctId", "")
    return {
        "nct_id": nct_id,
        "title": ident.get("briefTitle", ""),
        "status": status.get("overallStatus", ""),
        "phase": ", ".join(design.get("phases", [])) or "N/A",
        "conditions": conditions,
        "interventions": interventions,
        "sponsor": sponsor,
        "summary": summary,
        "url": f"https://clinicaltrials.gov/study/{nct_id}",
    }

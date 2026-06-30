from __future__ import annotations

import asyncio
from typing import Any

from curl_cffi.requests import AsyncSession

# Several of these public health APIs (ClinicalTrials.gov, CIViC, cancer.gov)
# sit behind bot-detection that fingerprints the TLS/HTTP client, not just the
# User-Agent header. curl_cffi impersonates a real Chrome handshake so plain
# httpx-blocked endpoints respond normally. A couple of retries absorbs the
# occasional first-request DNS hiccup seen with curl_cffi's async resolver.
_IMPERSONATE = "chrome120"
_RETRIES = 3
_TIMEOUT = 25


async def request(
    method: str,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
):
    last_exc: Exception | None = None
    async with AsyncSession() as session:
        for attempt in range(_RETRIES):
            try:
                resp = await session.request(
                    method,
                    url,
                    params=params,
                    json=json_body,
                    impersonate=_IMPERSONATE,
                    timeout=_TIMEOUT,
                )
                resp.raise_for_status()
                return resp
            except Exception as exc:  # noqa: BLE001 - retry any transient failure
                last_exc = exc
                await asyncio.sleep(0.5 * (attempt + 1))
    raise last_exc


async def get_json(url: str, *, params: dict[str, Any] | None = None) -> Any:
    resp = await request("GET", url, params=params)
    return resp.json()


async def get_text(url: str, *, params: dict[str, Any] | None = None) -> str:
    resp = await request("GET", url, params=params)
    return resp.text


async def post_json(url: str, *, json_body: dict[str, Any]) -> Any:
    resp = await request("POST", url, json_body=json_body)
    return resp.json()

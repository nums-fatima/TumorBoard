from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

import httpx

from app.config import settings
from app.llm.base import LLMProvider

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# OpenRouter routes a single model id across multiple upstream providers
# (DeepInfra, Novita, ...); when the primary is rate-limited the fallback
# occasionally 400s instead of serving the request. A few retries with
# backoff smooths over this without needing per-provider pinning.
RETRIES = 3
RETRY_BACKOFF_SECONDS = 1.5


class OpenRouterProvider(LLMProvider):
    def __init__(self, model: str | None = None) -> None:
        self.model = model or settings.openrouter_model

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": settings.app_name,
        }

    async def complete(self, messages: list[dict[str, str]]) -> str:
        last_exc: Exception | None = None
        async with httpx.AsyncClient(timeout=60) as client:
            for attempt in range(RETRIES):
                try:
                    resp = await client.post(
                        OPENROUTER_URL,
                        headers=self._headers(),
                        json={"model": self.model, "messages": messages},
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
                except (httpx.HTTPStatusError, httpx.TransportError) as exc:
                    last_exc = exc
                    await asyncio.sleep(RETRY_BACKOFF_SECONDS * (attempt + 1))
        raise last_exc

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        last_exc: Exception | None = None
        async with httpx.AsyncClient(timeout=60) as client:
            for attempt in range(RETRIES):
                try:
                    async with client.stream(
                        "POST",
                        OPENROUTER_URL,
                        headers=self._headers(),
                        json={"model": self.model, "messages": messages, "stream": True},
                    ) as resp:
                        resp.raise_for_status()
                        async for line in resp.aiter_lines():
                            if not line or not line.startswith("data: "):
                                continue
                            payload = line[len("data: "):]
                            if payload.strip() == "[DONE]":
                                break
                            chunk = json.loads(payload)
                            delta = chunk["choices"][0]["delta"].get("content")
                            if delta:
                                yield delta
                    return
                except httpx.HTTPStatusError as exc:
                    last_exc = exc
                    await asyncio.sleep(RETRY_BACKOFF_SECONDS * (attempt + 1))
        raise last_exc

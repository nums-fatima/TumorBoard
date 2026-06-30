from __future__ import annotations

import asyncio

from fastapi import WebSocket


class SafeSocket:
    """Serializes sends on one WebSocket connection. Multiple agents emit
    status/results concurrently via asyncio.gather, so writes need a lock to
    avoid interleaving frames on the wire."""

    def __init__(self, ws: WebSocket):
        self._ws = ws
        self._lock = asyncio.Lock()

    async def send_json(self, payload: dict) -> None:
        async with self._lock:
            await self._ws.send_json(payload)

    async def receive_json(self) -> dict:
        return await self._ws.receive_json()

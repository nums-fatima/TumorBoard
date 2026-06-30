from __future__ import annotations

from datetime import datetime
from typing import Protocol

from rich.console import Console

console = Console()

AGENT_COLORS = {
    "Orchestrator": "bold magenta",
    "Literature": "bold cyan",
    "ClinicalTrial": "bold green",
    "Guideline": "bold yellow",
    "Biomarker": "bold blue",
    "Synthesizer": "bold red",
}


class JsonSendable(Protocol):
    async def send_json(self, payload: dict) -> None: ...


async def emit(ws: JsonSendable | None, agent: str, status: str, message: str) -> None:
    """Single source of truth for agent activity: one call drives both the
    terminal trace (rich, colored, timestamped) and the WebSocket event that
    powers the frontend's agent-status panel."""
    color = AGENT_COLORS.get(agent, "white")
    ts = datetime.now().strftime("%H:%M:%S")
    console.print(f"[dim]{ts}[/dim] [{color}]\\[{agent}][/{color}] {status}: {message}")
    if ws is not None:
        await ws.send_json({"type": "agent_status", "agent": agent, "status": status, "message": message})

from __future__ import annotations

from abc import ABC, abstractmethod

from app.models.schemas import AgentResult, ExtractedIntent


class Agent(ABC):
    name: str

    @abstractmethod
    async def run(self, intent: ExtractedIntent) -> AgentResult:
        ...

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class LLMProvider(ABC):
    @abstractmethod
    async def complete(self, messages: list[dict[str, str]]) -> str:
        ...

    @abstractmethod
    def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        ...

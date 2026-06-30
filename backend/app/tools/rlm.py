from __future__ import annotations

from collections.abc import Awaitable, Callable

from app.llm.base import LLMProvider
from app.tools.pdq import GuidelineDocument

MAX_HOPS = 4
SECTION_CHAR_LIMIT = 4000

NAV_SYSTEM_PROMPT = (
    "You are navigating a long clinical guideline document section by section instead of "
    "reading the whole thing at once. You'll be given the document's outline and a clinical "
    "question. At each step, respond with EXACTLY ONE line, either:\n"
    "READ: <exact section title from the outline>\n"
    "to expand a section you need, or:\n"
    "FINAL: <your answer, grounded only in the sections you've read, with brief inline section refs>\n"
    "when you have enough information. Use the fewest reads needed; don't read sections that "
    "are obviously irrelevant to the question."
)


async def navigate(
    llm: LLMProvider,
    doc: GuidelineDocument,
    question: str,
    on_step: Callable[[str], Awaitable[None]] | None = None,
) -> tuple[str, list[str]]:
    """Recursive context navigation: the model decides which sections of a long
    document to expand into, one hop at a time, instead of us pre-chunking and
    embedding the whole thing. Returns (final_answer, titles_read)."""
    outline_text = "\n".join(f"- {s['title']}" for s in doc.list_sections())
    history: list[dict[str, str]] = [
        {"role": "system", "content": NAV_SYSTEM_PROMPT},
        {"role": "user", "content": f"Document outline:\n{outline_text}\n\nQuestion: {question}"},
    ]
    read_titles: list[str] = []

    for _ in range(MAX_HOPS):
        reply = (await llm.complete(history)).strip()

        if reply.upper().startswith("FINAL:"):
            return reply.split(":", 1)[1].strip(), read_titles

        if reply.upper().startswith("READ:"):
            title = reply.split(":", 1)[1].strip()
            section_text = doc.read_section(title)
            read_titles.append(title)
            if on_step:
                await on_step(title)
            history.append({"role": "assistant", "content": reply})
            if section_text:
                history.append(
                    {"role": "user", "content": f"Section '{title}':\n{section_text[:SECTION_CHAR_LIMIT]}"}
                )
            else:
                history.append(
                    {
                        "role": "user",
                        "content": f"No section matched '{title}'. Pick another exact title from the outline, or respond FINAL.",
                    }
                )
            continue

        history.append({"role": "assistant", "content": reply})
        history.append({"role": "user", "content": "Respond with exactly one line starting with READ: or FINAL:"})

    history.append({"role": "user", "content": "Give your FINAL answer now, based only on what you've read so far."})
    reply = await llm.complete(history)
    return reply.split("FINAL:", 1)[-1].strip(), read_titles

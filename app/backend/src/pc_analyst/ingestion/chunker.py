"""Section-aware sentence chunker.

We chunk by concatenating sentences until we hit a target character budget,
then emit a chunk whose ``char_start`` / ``char_end`` are exact offsets
into the original normalized plaintext. Section boundaries always end a
chunk so chunks never straddle ``Item 1A`` / ``Item 7`` etc.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable

from .html_parser import HtmlExtract, Section


# Conservative sentence splitter. Works well enough on SEC filing prose;
# we avoid the nltk dependency to keep cold-start tiny.
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z(\[\"'])")


@dataclass
class Chunk:
    chunk_index: int
    section_header: str | None
    char_start: int
    char_end: int
    text: str
    token_count: int = 0
    taxonomy_hits: list[str] = field(default_factory=list)
    page: int | None = None


def _section_at(sections: list[Section], offset: int) -> Section | None:
    current: Section | None = None
    for sec in sections:
        if sec.start <= offset:
            current = sec
        else:
            break
    return current


def _split_sentences(text: str, base_offset: int) -> list[tuple[int, int, str]]:
    """Return (start, end, sentence) tuples absolute to the document."""
    spans: list[tuple[int, int, str]] = []
    pos = 0
    for match in _SENTENCE_END.finditer(text):
        end = match.start() + 1           # include the punctuation
        sent = text[pos:end].strip()
        if sent:
            # re-anchor whitespace-trimmed offsets
            offset_in = text.index(sent, pos)
            spans.append((base_offset + offset_in, base_offset + offset_in + len(sent), sent))
        pos = match.end()
    if pos < len(text):
        tail = text[pos:].strip()
        if tail:
            offset_in = text.index(tail, pos)
            spans.append((base_offset + offset_in, base_offset + offset_in + len(tail), tail))
    return spans


class SectionChunker:
    """Produce ~``target_chars`` chunks bounded by section headers."""

    def __init__(
        self,
        target_chars: int = 1200,
        overlap_chars: int = 150,
        min_chars: int = 200,
    ) -> None:
        self.target_chars = target_chars
        self.overlap_chars = overlap_chars
        self.min_chars = min_chars

    def chunk(self, extract: HtmlExtract) -> list[Chunk]:
        text = extract.text
        sections = extract.sections
        # Divide the document into segments bounded by sections. If no
        # sections were found, treat the whole doc as one segment.
        if sections:
            segments: list[tuple[int, int, str | None]] = []
            for sec in sections:
                segments.append((sec.start, sec.end or len(text), sec.header))
            if sections[0].start > 0:
                segments.insert(0, (0, sections[0].start, None))
        else:
            segments = [(0, len(text), None)]

        chunks: list[Chunk] = []
        idx = 0
        for seg_start, seg_end, header in segments:
            seg_text = text[seg_start:seg_end]
            sentences = _split_sentences(seg_text, seg_start)
            if not sentences:
                continue
            buf: list[tuple[int, int, str]] = []
            buf_len = 0
            for s_start, s_end, s_text in sentences:
                buf.append((s_start, s_end, s_text))
                buf_len += len(s_text) + 1
                if buf_len >= self.target_chars:
                    chunks.append(self._flush(buf, idx, header))
                    idx += 1
                    buf, buf_len = self._overlap_tail(buf)
            if buf and buf_len >= self.min_chars:
                chunks.append(self._flush(buf, idx, header))
                idx += 1
            elif buf and chunks:
                # Too-short trailing buffer -> append to previous chunk
                prev = chunks[-1]
                last_end = buf[-1][1]
                chunks[-1] = Chunk(
                    chunk_index=prev.chunk_index,
                    section_header=prev.section_header,
                    char_start=prev.char_start,
                    char_end=last_end,
                    text=text[prev.char_start:last_end],
                    token_count=max(1, (last_end - prev.char_start) // 4),
                )
        return chunks

    def _flush(
        self,
        buf: list[tuple[int, int, str]],
        idx: int,
        header: str | None,
    ) -> Chunk:
        start = buf[0][0]
        end = buf[-1][1]
        joined = " ".join(s for _, _, s in buf)
        return Chunk(
            chunk_index=idx,
            section_header=header,
            char_start=start,
            char_end=end,
            text=joined,
            token_count=max(1, len(joined) // 4),   # rough token estimate
        )

    def _overlap_tail(
        self, buf: list[tuple[int, int, str]]
    ) -> tuple[list[tuple[int, int, str]], int]:
        tail: list[tuple[int, int, str]] = []
        tail_len = 0
        for item in reversed(buf):
            tail.insert(0, item)
            tail_len += len(item[2]) + 1
            if tail_len >= self.overlap_chars:
                break
        return tail, tail_len


def chunks_from_html(
    extract: HtmlExtract,
    *,
    target_chars: int = 1200,
    overlap_chars: int = 150,
) -> Iterable[Chunk]:
    yield from SectionChunker(target_chars=target_chars, overlap_chars=overlap_chars).chunk(extract)

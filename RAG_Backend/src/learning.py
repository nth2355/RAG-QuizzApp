from .rag import retrieve, fetch_all_chunks, render_prompt, format_citations
from .filters import filters_to_dict
from .llm import invoke_llm
from .config import settings
from .schemas import Summary, QuizItem, QuizSet, Flashcard, FlashcardSet
import json
from pydantic import ValidationError
import time
from .cache import (
    summary_cache,
    quiz_cache,
    flashcard_cache
)
import hashlib

SUMMARIZE_SINGLE_TEMPLATE = "summary.jinja2"
SUMMARY_MAP_TEMPLATE = "summary.jinja2"
SUMMARY_REDUCE_TEMPLATE = "summary_reduce.jinja2"
QUIZ_TEMPLATE = "quiz.jinja2"
FLASHCARDS_TEMPLATE = "flashcard.jinja2"



def _resolve_target(document, query, filters, k, retrieval_k):
    effective_filters = filters_to_dict(filters) or {}

    if document:
        effective_filters["filename"] = document

    if query:
        chunks = retrieve(query, k=k or retrieval_k, filters=effective_filters)
        return chunks, "query", query

    if effective_filters:
        chunks = fetch_all_chunks(filters=effective_filters)
        scope = "document" if document else "filter"
        target = ", ".join(f"{k}={v}" for k, v in effective_filters.items())
        return chunks, scope, target

    return fetch_all_chunks(filters=None), "corpus", None


def summarize_learning(document=None, query=None, filters=None, k=None, length="medium", focus="Tổng quan", instructions=""):
    chunks, scope, target = _resolve_target(
        document, query, filters, k, settings.summarize_retrieval_k
    )
    if not chunks:
        raise ValueError("Không có nội dung tài liệu để tóm tắt.")
    cache_key = _cache_key(chunks, scope, target, length, focus, instructions)
    cached = summary_cache.get(cache_key)
    if cached is not None:
        return cached
    prompt_options = dict(length=length, focus=focus, instructions=instructions)
    batches = _batches(chunks)
    if len(batches) == 1:
        prompt = render_prompt(SUMMARIZE_SINGLE_TEMPLATE, chunks=chunks, **prompt_options)
        payload = _parse_json(invoke_llm(prompt))
        summary_text, key_points = _validate_summary_payload(payload)
    else:
        partials = []
        for batch in batches:
            payload = _parse_json(invoke_llm(render_prompt(SUMMARY_MAP_TEMPLATE, chunks=batch, **prompt_options)))
            summary_text, key_points = _validate_summary_payload(payload)
            partials.append({"summary": summary_text, "key_points": key_points})
            time.sleep(0.5)

        while len(json.dumps(partials, ensure_ascii=False)) > settings.max_context_chars:
            reduced = []
            groups, group, size = [], [], 0
            for partial in partials:
                cost = len(json.dumps(partial, ensure_ascii=False))
                if cost > settings.max_context_chars:
                    raise RuntimeError("Bản tóm tắt trung gian quá dài. Vui lòng thử lại.")
                if group and size + cost > settings.max_context_chars:
                    groups.append(group)
                    group, size = [], 0
                group.append(partial)
                size += cost
            if group:
                groups.append(group)
            if len(groups) >= len(partials):
                raise RuntimeError("Không thể thu gọn tài liệu trong giới hạn ngữ cảnh.")
            for group in groups:
                payload = _parse_json(invoke_llm(render_prompt(SUMMARY_REDUCE_TEMPLATE, partials=group, **prompt_options)))
                summary, points = _validate_summary_payload(payload)
                reduced.append({"summary": summary, "key_points": points})
            partials = reduced
        prompt = render_prompt(SUMMARY_REDUCE_TEMPLATE, partials=partials, **prompt_options)
        print("CALLING GEMINI...")
        payload = _parse_json(invoke_llm(prompt))
        summary_text, key_points = _validate_summary_payload(payload)

    result = Summary(
        scope=scope,
        target=target,
        summary=summary_text,
        key_points=key_points,
        citations=format_citations(chunks),
        chunks=chunks,
    )

    summary_cache[cache_key] = result
    return result

def _validate_summary_payload(payload):
    summary_text = payload.get("summary", "")
    key_points = payload.get("key_points", [])

    if not summary_text:
        summary_text = "Không thể tạo bản tóm tắt từ nội dung này."

    return summary_text, key_points

def _parse_json(text):
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1].removesuffix("```").strip()
    try:
        obj = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Mô hình trả về JSON không hợp lệ. Vui lòng thử lại.") from exc

    if not isinstance(obj, dict):
        raise RuntimeError("Mô hình phải trả về một đối tượng JSON.")
    return obj

def _validate_items(payload, key, model_class, dedup_field, label, valid_markers):
    raw_items = payload.get(key) or []
    items, seen = [], set()

    for raw in raw_items:
        try:
            item = model_class.model_validate(raw)
        except ValidationError:
            continue

        norm = str(getattr(item, dedup_field, "")).strip().lower()
        if not norm or norm in seen:
            continue

        seen.add(norm)
        markers = [m for m in item.source_markers if m in valid_markers]
        items.append(item.model_copy(update={"source_markers": markers}))

    if not items:
        raise RuntimeError(f"No valid {label} produced.")

    return items

def generate_quiz(document=None, query=None, filters=None, count=None, k=None, difficulty="medium"):

    chunks, scope, target = _resolve_target(
        document, query, filters, k, settings.generation_retrieval_k
    )
    print("TOTAL CHUNKS =", len(chunks))
    chunks = _generation_context(chunks)
    cache_key = _cache_key(chunks, scope, target, "quiz", count, difficulty)
    cached = quiz_cache.get(cache_key)
    if cached is not None:
        return cached

    n = count or settings.quiz_default_count
    valid_markers = {f"S{i}" for i in range(1, len(chunks) + 1)}
    prompt = render_prompt(QUIZ_TEMPLATE, chunks=chunks, count=n, difficulty=difficulty)

    print("QUIZ PROMPT LENGTH =", len(prompt))
    print("QUIZ CHUNKS =", len(chunks))
    payload = _parse_json(invoke_llm(prompt))

    items = _validate_items(payload, "items", QuizItem, "question", "quiz items", valid_markers)
    result = QuizSet(
        scope=scope,
        target=target,
        items=items[:n],
        chunks=chunks,
        citations=format_citations(chunks)
    )

    quiz_cache[cache_key] = result

    return result

def generate_flashcards(document=None, query=None, filters=None, count=None, k=None):
    chunks, scope, target = _resolve_target(
        document, query, filters, k, settings.generation_retrieval_k
    )

    chunks = _generation_context(chunks)
    cache_key = _cache_key(chunks, scope, target, "flashcard", count)
    cached = flashcard_cache.get(cache_key)
    if cached is not None:
        return cached
    n = count or settings.flash_card_default_count
    valid_markers = {f"S{i}" for i in range(1, len(chunks) + 1)}
    prompt = render_prompt(FLASHCARDS_TEMPLATE, chunks=chunks, count=n)
    payload = _parse_json(invoke_llm(prompt))

    cards = _validate_items(payload, "cards", Flashcard, "front", "flashcards", valid_markers)

    result = FlashcardSet(
        scope=scope,
        target=target,
        cards=cards[:n],
        chunks=chunks,
        citations=format_citations(chunks)
    )

    flashcard_cache[cache_key] = result

    return result

def _cache_key(chunks, *options):
    payload = {
        "chunks": [c.model_dump() for c in chunks],
        "options": options,
        "provider": settings.llm_provider,
        "models": [settings.gemini_model, settings.hf_model, settings.llm_temperature],
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _batches(chunks):
    batches, current, size = [], [], 0
    for chunk in chunks:
        if len(chunk.text) > settings.max_context_chars:
            raise ValueError("Một đoạn tài liệu vượt giới hạn ngữ cảnh. Hãy giảm chunk_size và lập chỉ mục lại.")
        if current and (size + len(chunk.text) > settings.max_context_chars or len(current) >= settings.summarize_batch_size):
            batches.append(current)
            current, size = [], 0
        current.append(chunk)
        size += len(chunk.text)
    if current:
        batches.append(current)
    return batches


def _generation_context(chunks):
    if not chunks:
        raise ValueError("Không có nội dung tài liệu. PDF scan cần được OCR trước khi tải lên.")
    if sum(len(c.text) for c in chunks) <= settings.max_context_chars:
        return chunks
    # Sample the entire document rather than silently considering only its opening pages.
    selected = []
    size = 0
    step = max(1, len(chunks) // settings.generation_retrieval_k)
    for chunk in chunks[::step]:
        if size + len(chunk.text) <= settings.max_context_chars:
            selected.append(chunk)
            size += len(chunk.text)
    if not selected:
        raise ValueError("Nội dung vượt giới hạn ngữ cảnh. Hãy giảm chunk_size.")
    return selected

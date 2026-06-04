from rag import retrieve, fetch_all_chunks, render_prompt, format_citations
from llm import invoke_llm 
from config import settings
from schemas import Summary, QuizItem, QuizSet, Flashcard, FlashcardSet
import json
from pydantic import ValidationError
import time

SUMMARIZE_SINGLE_TEMPLATE = "summary.jinja2"
SUMMARY_MAP_TEMPLATE = "summary.jinja2"
SUMMARY_REDUCE_TEMPLATE = "summary.jinja2"
QUIZ_TEMPLATE = "quiz.jinja2"
FLASHCARDS_TEMPLATE = "flashcard.jinja2"

def _resolve_target(document, query, filters, k, retrieval_k):
    effective_filters = dict(filters or {})
    
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

import time  # Hãy đảm bảo dòng này đã được import ở đầu file learning.py

def summarize_learning(document=None, query=None, filters=None, k=None):
    chunks, scope, target = _resolve_target(
        document, query, filters, k, settings.summarize_retrieval_k
    )
    
    if len(chunks) <= settings.summarize_batch_size:
        prompt = render_prompt(SUMMARIZE_SINGLE_TEMPLATE, chunks=chunks)
        payload = _parse_json(invoke_llm(prompt))
        summary_text, key_points = _validate_summary_payload(payload)
    else:
        partials = []
        for start in range(0, len(chunks), settings.summarize_batch_size):
            batch = chunks[start : start+settings.summarize_batch_size]
            payload = _parse_json(invoke_llm(render_prompt(SUMMARY_MAP_TEMPLATE, chunks=batch)))
            summary_text, key_points = _validate_summary_payload(payload)
            partials.append({"summary": summary_text, "key_points": key_points})
            time.sleep(0.5) 
            
        prompt = render_prompt(SUMMARY_REDUCE_TEMPLATE, partials=partials)
        payload = _parse_json(invoke_llm(prompt))
        summary_text, key_points = _validate_summary_payload(payload)
        
    return Summary(
        scope=scope,
        target=target,
        summary=summary_text,
        key_points=key_points,
        citations=format_citations(chunks),
        chunks=chunks,
    )     
    
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
    obj = json.loads(cleaned)
    
    if not isinstance(obj, (dict, list)):
        raise RuntimeError("Expected JSON object or array.")
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

def generate_quiz(document=None, query=None, filters=None, count=None, k=None):
    chunks, scope, target = _resolve_target(
        document, query, filters, k, settings.generation_retrieval_k
    )
    
    n = count or settings.quiz_default_count
    # Sửa lỗi cú pháp biến chạy vòng lặp từ số 1 thành chữ i
    valid_markers = {f"S{i}" for i in range(1, len(chunks) + 1)}
    prompt = render_prompt(QUIZ_TEMPLATE, chunks=chunks, count=n)
    payload = _parse_json(invoke_llm(prompt))
    
    items = _validate_items(payload, "items", QuizItem, "question", "quiz items", valid_markers)
    return QuizSet(
        scope=scope,
        target=target,
        items=items,
        chunks=chunks,
        citations=format_citations(chunks)
    )
    
def generate_flashcards(document=None, query=None, filters=None, count=None, k=None):
    chunks, scope, target = _resolve_target(
        document, query, filters, k, settings.generation_retrieval_k
    )
    # SỬA: flashcards_default_count -> flash_card_default_count
    n = count or settings.flash_card_default_count 
    valid_markers = {f"S{i}" for i in range(1, len(chunks) + 1)}
    prompt = render_prompt(FLASHCARDS_TEMPLATE, chunks=chunks, count=n)
    payload = _parse_json(invoke_llm(prompt))

    cards = _validate_items(payload, "cards", Flashcard, "front", "flashcards", valid_markers)

    return FlashcardSet(
        scope=scope,
        target=target, 
        cards=cards, 
        chunks=chunks,
        citations=format_citations(chunks)
    )
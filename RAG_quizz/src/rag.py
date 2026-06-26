from functools import lru_cache
from .config import settings
from .store import get_vector_store, scroll_all
from .filters import filter_to_qdrant  # Sửa lại hàm map qdrant đúng chuẩn
from .schemas import RetrievedChunk, ChunkMetadata, Citation, RagAnswer
from jinja2 import Environment, FileSystemLoader, StrictUndefined
from pathlib import Path
from .llm import invoke_llm

PROMPTS_DIR = Path(__file__).parent / "prompts"
ANSWER_TEMPLATE = "answer.jinja2"

def retrieve(query, k=None, filters=None, collection_name=None):
    qdrant_filter = filter_to_qdrant(filters)

    hits = get_vector_store(collection_name).similarity_search_with_score(
        query=query,
        k=k or settings.top_k,
        filter=qdrant_filter,
    )

    print("\n===== RETRIEVAL =====")
    for i, (doc, score) in enumerate(hits):
        print(f"{i+1}. score={score:.4f}")
        print(doc.page_content[:150])
        print("------------------")

    return [
        RetrievedChunk(
            text=doc.page_content,
            score=float(score),
            metadata=ChunkMetadata(**doc.metadata)
        )
        for doc, score in hits
    ]

def fetch_all_chunks(filters=None, collection_name=None):
    name = collection_name or settings.qdrant_collection
    results = []
    
    for page in scroll_all(name, scroll_filter=filter_to_qdrant(filters)):
        for point in page:
            payload = point.payload or {}
            # Thư viện Qdrant / Langchain lưu trữ text trong trường page_content hoặc dính vào metadata tùy phiên bản
            meta = payload.get("metadata") or {}
            text = payload.get("page_content") or payload.get("text") or ""
            
            if meta and text:
                results.append(RetrievedChunk(text=text, score=0.0, metadata=ChunkMetadata(**meta)))
    return sorted(results, key=lambda r: (
        r.metadata.filename,
        r.metadata.page,
        int(r.metadata.chunk_id.rsplit(":", 1)[-1]) if ":" in r.metadata.chunk_id else 0,
    ))

@lru_cache(maxsize=1)
def _jinja_env():
    return Environment(
        loader=FileSystemLoader(str(PROMPTS_DIR)),
        autoescape=False, undefined=StrictUndefined,
        trim_blocks=True, lstrip_blocks=True,
    )
    
def render_prompt(template_name, **context):
    return _jinja_env().get_template(template_name).render(**context)

def format_citations(chunks):
    return [
        Citation(
            source_index=i, 
            source_marker=f"S{i}",  
            filename=c.metadata.filename, 
            page=c.metadata.page,
            section=c.metadata.section,
            chunk_id=c.metadata.chunk_id,
        )
        for i, c in enumerate(chunks, start=1)
    ]

def answer(question, k=None, filters=None, collection_name=None):
    chunks = retrieve(question, k=k, filters=filters, collection_name=collection_name)
    print("TOTAL CHUNKS =", len(chunks))

    for i, c in enumerate(chunks):
        print(
            f"Chunk {i+1}:",
            len(c.text)
        )
    
    if not chunks:
        return RagAnswer(
            question=question,
            answer="Tôi không đủ thông tin ngữ cảnh được cung cấp để trả lời."   
        )
    prompt = render_prompt(ANSWER_TEMPLATE, question=question, chunks=chunks)
    print("PROMPT LENGTH =", len(prompt))
    text = invoke_llm(prompt)
    
    return RagAnswer(
        question=question,
        answer=text.strip(),
        citations=format_citations(chunks),
        chunks=chunks
    )
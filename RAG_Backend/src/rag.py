from functools import lru_cache
from .config import settings
from .store import get_vector_store, scroll_all, get_reranker
from .filters import filter_to_qdrant 
from .schemas import RetrievedChunk, ChunkMetadata, Citation, RagAnswer
from jinja2 import Environment, FileSystemLoader, StrictUndefined
from pathlib import Path
from .llm import invoke_llm
import torch
import numpy as np
from tqdm import tqdm

PROMPTS_DIR = Path(__file__).parent / "prompts"
ANSWER_TEMPLATE = "answer.jinja2"

def retrieve(query, k=None, filters=None, collection_name=None):
    qdrant_filter = filter_to_qdrant(filters)
    
    target_k = k or settings.top_k
    fetch_k = min(target_k * 3, 32)

    hits = get_vector_store(collection_name).similarity_search_with_score(
        query=query,
        k=fetch_k, 
        filter=qdrant_filter,
    )
    if not hits:
        return []
    
    # Kích hoạt Rerank
    tokenizer, model = get_reranker()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    pairs = [[query, doc.page_content] for doc, _ in hits]
    all_scores = []
    
    # Cấu hình Batch Size để xử lý song song nhiều cặp (mặc định 8 cặp/lần)
    batch_size = 8
    
    print(f"\n--- ĐANG TIẾN HÀNH RE-RANKING CHO {len(pairs)} CHUNKS ---")
    
    with torch.no_grad():
        for i in tqdm(range(0, len(pairs), batch_size), desc="Re-ranking Progress"):
            batch_pairs = pairs[i : i + batch_size]
            
            inputs = tokenizer(
                batch_pairs, 
                padding=True, 
                truncation=True, 
                return_tensors='pt', 
                max_length=512
            )
            
            safe_inputs = {}
            for key, val in inputs.items():
                if isinstance(val, torch.Tensor):
                    safe_inputs[key] = val.to(device)
                else:
                    safe_inputs[key] = torch.tensor(val).to(device)            
            
            outputs = model(**safe_inputs)
            batch_scores = outputs.logits.view(-1).float()
            batch_scores = torch.sigmoid(batch_scores).cpu().numpy()
            
            # Khắc phục lỗi mảng 0 chiều khi batch chỉ có 1 phần tử
            if batch_scores.ndim == 0:
                batch_scores = np.array([float(batch_scores)])
                
            all_scores.extend(batch_scores)
    
    # Ép mảng điểm chung nếu cần
    all_scores = np.array(all_scores)
    if all_scores.ndim == 0:
        all_scores = np.array([float(all_scores)])

    reranked_results = []
    for idx, (doc, _) in enumerate(hits):
        reranked_results.append({
            "doc": doc,
            "new_score": float(all_scores[idx])
        })
    
    reranked_results.sort(key=lambda x: x["new_score"], reverse=True)
    
    final_hits = reranked_results[:target_k]

    print("\n===== RE-RANKED RETRIEVAL HOÀN TẤT =====")
    for i, res in enumerate(final_hits):
        print(f"{i+1}. Re-rank score={res['new_score']:.4f}")
        print(res['doc'].page_content[:150])
        print("------------------")

    return [
        RetrievedChunk(
            text=res['doc'].page_content,
            score=res['new_score'],
            metadata=ChunkMetadata(**res['doc'].metadata)
        )
        for res in final_hits
    ]

def fetch_all_chunks(filters=None, collection_name=None):
    name = collection_name or settings.qdrant_collection
    results = []
    
    for page in scroll_all(name, scroll_filter=filter_to_qdrant(filters)):
        for point in page:
            payload = point.payload or {}
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
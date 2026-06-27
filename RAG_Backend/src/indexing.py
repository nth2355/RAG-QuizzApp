import hashlib
from langchain_community.document_loaders import PyPDFLoader
from .config import settings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from collections import defaultdict
from .schemas import ChunkMetadata
import uuid
from .store import get_vector_store, ensure_collection
from .utils import discover_pdfs
from pathlib import Path
from qdrant_client import models
import time

def _document_id(path):
    raw = f"{path.name}:{path.stat().st_size}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def _chunk_id(doc_id, page, index):
    return f"{doc_id}:{page}:{index}"

def _load_pdf(path):
    pages = PyPDFLoader(str(path)).load()
    doc_id = _document_id(path)
    
    for doc in pages:
        page_number = int(doc.metadata.get("page", 0))+1
        doc.metadata = {
            "document_id": doc_id,
            "filename": path.name,
            "source": str(path.resolve()),
            "page": page_number,
            "section": doc.metadata.get("section")
        }
    return pages



def _splitter (chunk_size=None, chunk_overlap=None):
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size or settings.chunk_size,
        chunk_overlap=chunk_overlap or settings.chunk_overlap,
        separators=["\n\n", "\n", ". ", ""],
        keep_separator=False,
    )
    
    
def build_chunks(pdf_paths, chunk_size=None, chunk_overlap=None, chunker=None):
    page_docs = []
    for path in pdf_paths:
        page_docs.extend(_load_pdf(path))
    
    splitter = chunker or _splitter(chunk_size, chunk_overlap)
    chunks =splitter.split_documents(page_docs)
    per_doc_counter = defaultdict(int)
    for chunk in chunks:
        doc_id = chunk.metadata["document_id"]
        idx = per_doc_counter[doc_id]
        per_doc_counter[doc_id] += 1
        
        
        meta = ChunkMetadata (
            document_id = doc_id,
            filename = chunk.metadata["filename"],
            source = chunk.metadata["source"],
            page = chunk.metadata["page"],
            chunk_id = _chunk_id(doc_id,chunk.metadata['page'], idx),
            section = chunk.metadata.get("section"),
        )
        chunk.metadata = meta.model_dump()
    return chunks


def index_chunks(chunks, collection_name=None):
    if not chunks:
        return 0 
    ids = [str(uuid.uuid5(uuid.NAMESPACE_DNS, c.metadata["chunk_id"]))for c in chunks]
    get_vector_store(collection_name=collection_name).add_documents(chunks, ids=ids)
    return len(chunks)

def ingest(recreate=False, collection_name = None, chunker = None, chunk_size=None, chunk_overlap=None):
    pdfs = discover_pdfs()
    ensure_collection(recreate=recreate, collection_name = collection_name)
    chunks = build_chunks(pdfs, chunker=chunker, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return index_chunks(chunks, collection_name=collection_name)

import time

def save_and_ingest_pdf(filename, file_bytes):
    t0 = time.time()

    safe_name = Path(filename).name
    dest = settings.data_dir / safe_name

    with open(dest, "wb") as f:
        f.write(file_bytes)

    print("SAVE:", time.time() - t0)

    t1 = time.time()

    chunks = build_chunks([dest])
    print("TOTAL CHUNKS:", len(chunks))

    print("CHUNK:", time.time() - t1)

    t2 = time.time()

    indexed_count = index_chunks(chunks)

    print("INDEX:", time.time() - t2)

    print("TOTAL:", time.time() - t0)

    return {
        "filename": safe_name,
        "chunk_indexed": indexed_count
    }

def delete_document(filename, collection_name=None):
    # 1. Xóa file vật lý trong thư mục data trước
    safe_name = Path(filename).name
    file_path = settings.data_dir / safe_name
    if file_path.exists():
        file_path.unlink()
        
    # 2. Xóa dữ liệu Vector liên quan đến file này trong Qdrant
    store = get_vector_store(collection_name=collection_name)
    
    client = store.client

    client.delete(
    collection_name=store.collection_name,
    points_selector=models.FilterSelector(
        filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="metadata.filename",
                    match=models.MatchValue(
                        value=safe_name
                    )
                )
            ]
        )
    )
)
    del store
    import gc
    gc.collect()
            
    return {"status": "success", "message": f"Đã xóa hoàn toàn tài liệu {safe_name}"}
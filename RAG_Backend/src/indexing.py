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

from sqlalchemy.orm import Session
from src.database.models import Document
from fastapi import HTTPException

def _document_id(path):
    raw = f"{path.name}:{path.stat().st_size}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]
def _chunk_id(doc_id, page, index):
    return f"{doc_id}:{page}:{index}"
def _load_pdf(path, document_id=None, original_filename=None):
    pages = PyPDFLoader(str(path)).load()
    doc_id = document_id or _document_id(path)
    filename = original_filename or path.name
    
    for doc in pages:
        page_number = int(doc.metadata.get("page", 0))+1
        doc.metadata = {
            "document_id": doc_id,
            "filename": filename,
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

def build_chunks(pdf_paths, chunk_size=None, chunk_overlap=None, chunker=None, document_id=None, original_filename=None):
    page_docs = []
    for path in pdf_paths:
        page_docs.extend(_load_pdf(path, document_id=document_id, original_filename=original_filename))
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

def save_and_ingest_pdf(filename, file_bytes, user_id: int, db: Session):
    t0 = time.time()

    safe_name = Path(filename).name
    stored_filename = f"{user_id}_{int(time.time())}_{safe_name}"
    dest = settings.data_dir / stored_filename

    # Ensure settings.data_dir exists
    settings.data_dir.mkdir(parents=True, exist_ok=True)

    with open(dest, "wb") as f:
        f.write(file_bytes)

    print("SAVE:", time.time() - t0)

    # 1. Insert into PostgreSQL DB with status "processing"
    db_doc = Document(
        user_id=user_id,
        original_filename=safe_name,
        stored_filename=stored_filename,
        status="processing"
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    t1 = time.time()

    try:
        # Use str(db_doc.id) as the document_id for metadata
        chunks = build_chunks([dest], document_id=str(db_doc.id), original_filename=safe_name)
        print("TOTAL CHUNKS:", len(chunks))

        print("CHUNK:", time.time() - t1)

        t2 = time.time()

        indexed_count = index_chunks(chunks)

        print("INDEX:", time.time() - t2)

        # 2. Update status to "ready"
        db_doc.status = "ready"
        db.commit()
    except Exception as e:
        db_doc.status = "error"
        db.commit()
        # Clean up disk file
        if dest.exists():
            dest.unlink()
        raise e

    print("TOTAL:", time.time() - t0)

    return {
        "filename": safe_name,
        "chunk_indexed": indexed_count
    }

def delete_document(filename, user_id: int, db: Session, collection_name=None):
    safe_name = Path(filename).name
    
    # 1. Find document in Postgres DB
    db_doc = db.query(Document).filter(
        Document.user_id == user_id,
        Document.original_filename == safe_name
    ).first()
    
    if not db_doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu này trong hệ thống của bạn.")

    # 2. Xóa file vật lý trong thư mục data sử dụng stored_filename
    file_path = settings.data_dir / db_doc.stored_filename
    if file_path.exists():
        file_path.unlink()
        
    # 3. Xóa dữ liệu Vector liên quan đến file này trong Qdrant sử dụng metadata.document_id
    store = get_vector_store(collection_name=collection_name)
    client = store.client

    client.delete(
        collection_name=store.collection_name,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="metadata.document_id",
                        match=models.MatchValue(
                            value=str(db_doc.id)
                        )
                    )
                ]
            )
        )
    )
    del store
    import gc
    gc.collect()

    # 4. Xóa bản ghi trong DB
    db.delete(db_doc)
    db.commit()
            
    return {"status": "success", "message": f"Đã xóa hoàn toàn tài liệu {safe_name}"}
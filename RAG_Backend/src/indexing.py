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
        chunk_size=settings.chunk_size if chunk_size is None else chunk_size,
        chunk_overlap=settings.chunk_overlap if chunk_overlap is None else chunk_overlap,
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

def _delete_vectors(document_id, collection_name=None):
    from .store import get_qdrant_client
    client = get_qdrant_client()
    name = collection_name or settings.qdrant_collection
    if client.collection_exists(name):
        client.delete(
            collection_name=name,
            points_selector=models.FilterSelector(filter=models.Filter(must=[
                models.FieldCondition(key="metadata.document_id", match=models.MatchValue(value=str(document_id)))
            ])),
            wait=True,
        )


def save_and_ingest_pdf(filename, file_bytes, user_id: int, db: Session):
    from .cache import clear_learning_caches
    safe_name = Path(filename.replace("\\", "/")).name
    if not safe_name.lower().endswith(".pdf") or b"%PDF-" not in file_bytes[:1024]:
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận tệp PDF hợp lệ.")
    if len(file_bytes) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Tệp vượt giới hạn dung lượng cho phép.")
    if db.query(Document).filter(Document.user_id == user_id, Document.original_filename == safe_name).first():
        raise HTTPException(status_code=409, detail="Tên tài liệu đã tồn tại. Hãy đổi tên hoặc xóa bản cũ trước.")
    stored_filename = f"{user_id}_{uuid.uuid4().hex}.pdf"
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    dest = settings.data_dir / stored_filename
    db_doc = Document(user_id=user_id, original_filename=safe_name, stored_filename=stored_filename, status="processing")
    try:
        dest.write_bytes(file_bytes)
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
    except Exception:
        db.rollback()
        dest.unlink(missing_ok=True)
        raise
    try:
        try:
            chunks = build_chunks([dest], document_id=str(db_doc.id), original_filename=safe_name)
        except Exception as exc:
            raise HTTPException(status_code=422, detail="Không đọc được PDF. Tệp có thể hỏng hoặc được mã hóa.") from exc
        if not chunks or not any(c.page_content.strip() for c in chunks):
            raise HTTPException(status_code=422, detail="PDF không có văn bản đọc được. Hãy OCR tệp scan trước.")
        indexed_count = index_chunks(chunks)
        db_doc.status = "ready"
        db.commit()
    except Exception:
        db.rollback()
        db_doc.status = "error"
        db.commit()
        try:
            _delete_vectors(db_doc.id)
        except Exception:
            # The error record remains excluded from retrieval and can be deleted again.
            pass
        dest.unlink(missing_ok=True)
        raise
    clear_learning_caches()
    return {"filename": safe_name, "chunk_indexed": indexed_count}


def delete_document(filename, user_id: int, db: Session, collection_name=None, document_id=None):
    from .cache import clear_learning_caches
    query = db.query(Document).filter(Document.user_id == user_id)
    if document_id is not None:
        query = query.filter(Document.id == document_id)
    else:
        query = query.filter(Document.original_filename == Path(filename).name)
    matches = query.all()
    if not matches:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu của bạn.")
    if len(matches) > 1:
        raise HTTPException(status_code=409, detail="Có nhiều tài liệu cùng tên. Hãy xóa bằng mã tài liệu.")
    db_doc = matches[0]
    # Persist the state first: failed deletion can be retried and never serves incomplete data.
    db_doc.status = "deleting"
    db.commit()
    try:
        _delete_vectors(db_doc.id, collection_name)
        (settings.data_dir / db_doc.stored_filename).unlink(missing_ok=True)
        db.delete(db_doc)
        db.commit()
    except Exception:
        db.rollback()
        raise
    clear_learning_caches()
    return {"status": "success", "message": f"Đã xóa tài liệu {db_doc.original_filename}"}

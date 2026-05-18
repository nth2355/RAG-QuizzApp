from langchain_huggingface import HuggingFaceEmbeddings
from functools import lru_cache
from config import settings
from qdrant_client import QdrantClient
from langchain_qdrant import QdrantVectorStore
from qdrant_client import models as qmodels

@lru_cache(maxsize=1)
def get_embeddings():
    return HuggingFaceEmbeddings(
        model_name = settings.embedding_model,
        model_kwargs = {"device": settings.hf_device},
        encode_kwargs = {"normalize_embeddings": True},
    )
    
    
@lru_cache(maxsize=1)
def get_client():
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return QdrantClient(path=str(settings.storage_dir))
    
def get_vector_store(collection_name = None):
    return QdrantVectorStore(
        client = get_client(),
        collection_name=collection_name or settings.qdrant_collection,
        embedding=get_embeddings(),
    )
    
INDEX_PAYLOAD_FIELD= {
    "metadata.document_id": qmodels.PayloadSchemaType.KEYWORD,
    "metadata.filename": qmodels.PayloadSchemaType.KEYWORD,
    "metadata.page": qmodels.PayloadSchemaType.INTEGER,
}

def ensure_collection(recreate=False, collection_name=None):
    client = get_client()
    name = collection_name or settings.qdrant_collection
    exists = client.collection_exists(name)
    
    if exists and recreate:
        client.delete_collection(name)
        exists=False
    if not exists:
        dim = len(get_embeddings().embed_query("dimension probe"))
        client.create_collection(
            collection_name=name,
            vectors_config=qmodels.VectorParams(size=dim, distance=qmodels.Distance.COSINE),
        )
    
    payload_schema = client.get_collection(name).payload_schema or {}
    for field, schema in INDEX_PAYLOAD_FIELD.items():
        if payload_schema.get(field) is None:
            client.create_payload_index(name, field_name=field, field_schema=schema)
    

def scroll_all(collection_name, scroll_filter=None):
    client = get_client()
    offset = None
    while True:
        # Gọi lệnh scroll của Qdrant
        page, next_offset = client.scroll(
            collection_name=collection_name,
            scroll_filter=scroll_filter,
            limit=100, # Mỗi lần lấy 100 bản ghi
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        yield page # Trả về từng trang dữ liệu
        if next_offset is None: # Nếu không còn trang tiếp theo thì dừng
            break
        offset = next_offset
        
def list_documents(collection_name=None):
    """
    Quét database Qdrant bằng tính năng nhóm (Group) 
    để lấy ra danh sách các file duy nhất đã được nạp thành công.
    """
    client = get_client()
    name = collection_name or settings.qdrant_collection
    
    if not client.collection_exists(name):
        return []
        
    groups = client.group(
        collection_name=name,
        group_by="metadata.document_id",
        limit=1,
        group_size=1
    )
    
    results = []
    for g in groups.groups:
        if not g.hits:
            continue
        payload = g.hits[0].payload
        meta = payload.get("metadata", {}) if payload else {}
        
        if meta.get("filename"):
            results.append({
                "document_id": meta.get("document_id"),
                "filename": meta.get("filename"),
                "source": meta.get("source")
            })
            
    return results
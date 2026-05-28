from qdrant_client import QdrantClient
from qdrant_client import models as qmodels
from langchain_qdrant import QdrantVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from config import settings

# 1. Khởi tạo Embedding Model đồng bộ với cấu hình trong config.py
# Sử dụng HuggingFaceEmbeddings để tải model GreenNode
def get_embedding_model():
    return HuggingFaceEmbeddings(
        model_name=settings.embedding_mdel,
        model_kwargs={'device': 'cuda' if settings.hf_device >= 0 else 'cpu'}
    )

# 2. Khởi tạo Qdrant Client cục bộ theo storage_dir
def get_qdrant_client():
    # Tạo thư mục lưu trữ nếu chưa có
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return QdrantClient(path=str(settings.storage_dir))

# 3. Hàm đảm bảo Collection tồn tại (Được gọi trong indexing.py)
def ensure_collection(recreate=False, collection_name=None):
    client = get_qdrant_client()
    name = collection_name or settings.qdrant_collection
    
    if recreate and client.collection_exists(name):
        client.delete_collection(name)
        
    if not client.collection_exists(name):
        # Model GreenNode-Embedding-Large có kích thước vector là 1024
        client.create_collection(
            collection_name=name,
            vectors_config=qmodels.VectorParams(
                size=1024, 
                distance=qmodels.Distance.COSINE
            )
        )

# 4. Hàm lấy Vector Store để thêm/tìm kiếm tài liệu (Được gọi trong indexing.py và rag.py)
def get_vector_store(collection_name=None):
    name = collection_name or settings.qdrant_collection
    return QdrantVectorStore(
        client=get_qdrant_client(),
        collection_name=name,
        embedding=get_embedding_model()
    )

# 5. Hàm cuộn qua toàn bộ dữ liệu (Được gọi trong hàm fetch_all_chunks của rag.py)
def scroll_all(collection_name, scroll_filter=None):
    client = get_qdrant_client()
    offset = None
    while True:
        res, next_offset = client.scroll(
            collection_name=collection_name,
            scroll_filter=scroll_filter,
            limit=100,
            with_payload=True,
            with_vectors=False,
            offset=offset
        )
        if not res:
            break
            
        # Biến đổi cấu trúc trả về thành định dạng LangChain Document payload để khớp với rag.py
        # rag.py mong muốn point.payload chứa 'metadata' và 'page_content' (hoặc 'text')
        valid_points = []
        for point in res:
            # Qdrant của LangChain lưu text trong trường "page_content" bên trong payload
            valid_points.append(point)
            
        yield valid_points
        
        if next_offset is None:
            break
        offset = next_offset

# 6. Hàm lấy danh sách tài liệu duy nhất (Được gọi trong api.py tại endpoint /documents)
def list_documents():
    client = get_qdrant_client()
    name = settings.qdrant_collection
    
    if not client.collection_exists(name):
        return []
        
    # Scroll lấy payload để gom nhóm các filename độc nhất
    res, _ = client.scroll(
        collection_name=name,
        limit=10000, # Lấy số lượng đủ lớn để quét các file
        with_payload=True,
        with_vectors=False
    )
    
    seen_docs = {}
    for point in res:
        payload = point.payload or {}
        meta = payload.get("metadata") or {}
        doc_id = meta.get("document_id")
        filename = meta.get("filename")
        source = meta.get("source")
        
        if doc_id and doc_id not in seen_docs:
            seen_docs[doc_id] = {
                "document_id": doc_id,
                "filename": filename,
                "source": source,
                "size_bytes": None # Qdrant không lưu size file gốc, để None để khớp Schema
            }
            
    return list(seen_docs.values())
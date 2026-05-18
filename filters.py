from pydantic import BaseModel, model_validator
from qdrant_client import models as qmodels

class MetadataFilter(BaseModel):
    filename: str | None = None
    filenames: list[str] | None = None
    page: int | None = None
    section: str | None = None
    document_id: str | None = None

    @model_validator(mode="after")
    def _normalize(self) -> "MetadataFilter":
        #Lấy danh sách từ filenames để xử lý
        source_names = self.filenames if self.filenames else ([self.filename] if self.filename else [])
        names = [n.strip() for n in source_names if isinstance(n, str) and n.strip()]

        if not names:
            self.filename = None
            self.filenames = None
        elif len(names) == 1:
            self.filename, self.filenames = names[0], None
        else:
            # Nếu có nhiều file, ẩn filename đơn, giữ lại danh sách filenames
            self.filename, self.filenames = None, names

        # Normalize các trường còn lại
        if isinstance(self.section, str):
            self.section = self.section.strip() or None
        if isinstance(self.document_id, str):
            self.document_id = self.document_id.strip() or None
            
        return self
    
def _coerce_filter(filters):
    if filters is None:
        return None
    if isinstance(filters, MetadataFilter):
        return filters
    if isinstance(filters, dict):
        return MetadataFilter(**filters)
    return None

    
def filters_to_dict(filters):
    f = _coerce_filter(filters)
    return None if f is None else f.model_dump(exclude_none =True) or None

def filter_to_qdrant(filters):
    flat = filters_to_dict(filters)
    if not flat:
        return None
    
    conditions = []
    for field, value in flat.items():
        if field == "filenames" and isinstance(value, list):
            conditions.append(qmodels.FieldCondition(
                
            key="metadata.filename", match=qmodels.MatchValue(any=value)
            ))
        elif isinstance(value, (str, int)):
            conditions.append(qmodels.FieldCondition(
                key=f"metadata.{field}", match=qmodels.MatchValue(value=value)
            ))
    return qmodels.Filter(must=conditions) if conditions else None
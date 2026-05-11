from pydantic import BaseModel, model_validator

class MetadataFilter(BaseModel):
    filename: str | None = None
    filenames: list[str] | None = None
    page: int | None = None
    section: str | None = None
    document_id : str | None = None
    
    @model_validator(mode="after")
    def _normalize(self) -> "MetadataFilter":
        names = [n.strip() for n in (self.filename or []) if isinstance(n, str) and n.strip()]
        if not names:
            self.filenames = None
        elif len(names) == 1:
            self.filename, self.filenames = names[0], None
        else:
            self.filename, self.filenames, self.page = None, names, None
        
        
        if self.filename is not None:
            self.filename = self.filename.strip() or None
        if self.section is not None:
            self.section = self.section.strip() or None
        if self.document_id is not None:
            self.document_id = self.document_id.strip() or None
            
        return self
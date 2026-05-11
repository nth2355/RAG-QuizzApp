from pathlib import Path
from config import settings

def discover_pdfs():
    data_dir = settings.data_dir
    
    if not data_dir.exists():
        data_dir.mkdir(parents=True)
    return list(data_dir.glob("*.pdf"))
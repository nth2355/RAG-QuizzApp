import typer
import json
import httpx
from pathlib import Path
from .indexing import ingest as ingest_data_dir
from .rag import answer, retrieve
from .learning import summarize_learning
from .export import export 

# Khởi tạo ứng dụng Typer
app = typer.Typer(help="Hệ thống quản lý học tập RAG CLI")

def _parse_filters(filters_str: str | None) -> dict | None:
    """Hàm bổ trợ để parse tham số filter từ CLI thành dict"""
    if not filters_str:
        return None
    try:
        return json.loads(filters_str)
    except json.JSONDecodeError:
        return {"filename": filters_str}

def _print_answer(ans: str):
    typer.echo("\n" + "="*20 + " TRẢ LỜI " + "="*20)
    typer.echo(ans)
    typer.echo("="*49 + "\n")

def _print_sources(chunks):
    typer.echo("--- Nguồn trích dẫn ---")
    for i, c in enumerate(chunks, start=1):
        filename = c.metadata.filename if hasattr(c.metadata, 'filename') else c.metadata.get('filename', 'Unknown')
        page = c.metadata.page if hasattr(c.metadata, 'page') else c.metadata.get('page', 0)
        typer.echo(f"S{i}. Tài liệu: {filename} - Trang {page} (Score: {c.score:.4f})")

@app.command()
def ingest(recreate: bool = typer.Option(False, "--recreate", "-r", help="Xóa và tạo lại collection mới")):
    """Đọc toàn bộ file PDF trong thư mục data và lưu vào Vector DB"""
    typer.echo("Đang tiến hành trích xuất và lưu chỉ mục dữ liệu...")
    count = ingest_data_dir(recreate=recreate)
    typer.echo(f" Hoàn thành! Đã index thành công {count} đoạn dữ liệu (chunks).")
    
@app.command()
def ask(
    question: str = typer.Argument(..., help="Câu hỏi cần RAG trả lời"), 
    k: int = typer.Option(None, "--top-k", "-k", help="Số lượng chunk tối đa cần lấy"), 
    filters: str = typer.Option(None, "--filters", "-f", help="Bộ lọc (Tên file hoặc JSON string)")
):
    """Hỏi đáp dựa trên tài liệu đã được index"""
    parsed_filter = _parse_filters(filters)
    result = answer(question, k=k, filters=parsed_filter)
    _print_answer(result.answer)
    if result.chunks:
        _print_sources(result.chunks)
    
@app.command("debug-retrieval")
def debug_retrieval(
    question: str = typer.Argument(..., help="Câu hỏi cần test truy xuất"), 
    k: int = typer.Option(None, "--top-k", "-k"), 
    filters: str = typer.Option(None, "--filters", "-f")
):
    """Kiểm tra xem hệ thống lấy ra những chunk nào và độ chuẩn xác (score) bao nhiêu"""
    parsed_filter = _parse_filters(filters)
    chunks = retrieve(question, k=k, filters=parsed_filter)
    typer.echo(json.dumps([c.model_dump() for c in chunks], ensure_ascii=False, indent=2))
    
@app.command("summarize")
def summarize(
    document: str = typer.Option(None, "--doc", "-d", help="Tên file cụ thể cần tóm tắt"), 
    query: str = typer.Option(None, "--query", "-q", help="Tìm kiếm nội dung cụ thể để tóm tắt"), 
    filters: str = typer.Option(None, "--filters", "-f"), 
    k: int = typer.Option(None, "--top-k", "-k"), 
    output: str = typer.Option(None, "--output", "-o", help="Đường dẫn file để xuất kết quả (VD: bando.md)"), 
    fmt: str = typer.Option("text", "--format", help="Định dạng xuất file: text | md | json")
):
    """Tóm tắt tài liệu hoặc tóm tắt theo bộ lọc nội dung"""
    typer.echo("Đang xử lý tóm tắt (Quá trình này có thể mất ít phút dựa trên độ dài tài liệu)...")
    parsed_filter = _parse_filters(filters)
    
    result = summarize_learning(document=document, query=query, filters=parsed_filter, k=k)
    
    # Sử dụng hàm export từ file export.py để in ra màn hình hoặc ghi file
    out_path = Path(output) if output else None
    exported_text = export(result, fmt=fmt, output=out_path)
    
    if out_path:
        typer.echo(f" Đã xuất bản tóm tắt thành công ra file: {output}")
    else:
        typer.echo("\n" + "="*20 + " BẢN TÓM TẮT TÀI LIỆU " + "="*20)
        typer.echo(exported_text)

if __name__ == "__main__":
    app()
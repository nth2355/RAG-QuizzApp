from typing import Literal

ExportFormat = Literal["text", "md", "json"]

def export(model, *, fmt="text", output=None):
    if fmt == "json":
        text = model.model_dump_json(indent=2) + "\n"
    elif fmt in {"text", "md"}:
        text = _to_markdown(model)
    else:
        raise ValueError(f"Unknown fmt `{fmt}`. Expected `text`|`md`|`json`")
    if output is None:
        return text
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(text, encoding="utf-8")
    return output

def _to_markdown(model) -> str:
    """
    Chuyển đổi các đối tượng Pydantic (RagAnswer, Summary, Quiz, v.v.) 
    sang định dạng văn bản Markdown để hiển thị hoặc xuất file.
    """
    lines = []

    # 1.Xử lý cho đối tượng Trả lời câu hỏi (RagAnswer)
    if hasattr(model, "question") and hasattr(model, "answer"):
        lines.append(f"# Câu hỏi: {model.question}\n")
        lines.append(f"{model.answer}\n")
        
        # Thêm phần trích dẫn nếu có
        if hasattr(model, "citations") and model.citations:
            lines.append("### Tài liệu tham khảo:")
            for c in model.citations:
                lines.append(f"- **[{c.source_marker}]** {c.filename} (Trang {c.page})")
            lines.append("")

    # 2. Xử lý cho đối tượng Tóm tắt (Summary)
    elif hasattr(model, "summary") and hasattr(model, "key_points"):
        lines.append(f"# Tóm tắt tài liệu\n")
        lines.append(f"{model.summary}\n")
        
        if model.key_points:
            lines.append("### Các ý chính:")
            for point in model.key_points:
                lines.append(f"- {point}")
            lines.append("")

    # 3. Xử lý cho danh sách câu hỏi trắc nghiệm (Quiz) hoặc Flashcards
    # Giả sử model là một danh sách hoặc object chứa danh sách
    elif isinstance(model, list):
        for i, item in enumerate(model, 1):
            lines.append(f"### Mục {i}")
            lines.append(str(item)) # Hoặc logic chi tiết cho từng loại item
            lines.append("")

    # 4. Trường hợp mặc định nếu không khớp các mẫu trên
    else:
        return str(model)

    return "\n".join(lines)
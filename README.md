# RAG Learning — chạy trực tiếp trên Windows

Ứng dụng học từ PDF: hỏi đáp có nguồn, tóm tắt, quiz và flashcard. Không cần Docker hoặc PostgreSQL để chạy local. Backend dùng SQLite; Qdrant chạy nhúng trong tiến trình Python.

## Khởi chạy

1. Cài Python 3.11 và Node.js 22 nếu máy chưa có.
2. Chạy `setup.cmd` ở thư mục gốc để cài dependency. Script sử dụng môi trường Python còn hoạt động, hoặc tạo `RAG_Backend/.venv-local`; không xóa môi trường cũ.
3. Điền `RAG_GOOGLE_API_KEY` trong `RAG_Backend/.env`. Không chia sẻ file này. Nếu file chưa tồn tại, setup tạo từ mẫu và sinh JWT secret ngẫu nhiên.
4. Chạy `start-backend.cmd` và `start-frontend.cmd` trong hai cửa sổ terminal.
5. Mở http://127.0.0.1:5173. API docs: http://127.0.0.1:8000/docs. Dừng từng tiến trình bằng Ctrl+C.

Các file CMD gọi PowerShell với ExecutionPolicy Bypass chỉ cho tiến trình đó, không đổi chính sách hệ thống. Không cần kích hoạt venv bằng Activate.ps1.

## Dữ liệu và cấu hình

- `RAG_Backend/.env.local` ghi đè cấu hình `.env`. Trên máy hiện tại, nó chọn SQLite tại `RAG_Backend/storage/rag.db`.
- Đây là database local mới: tài khoản và lịch sử trong PostgreSQL cũ chưa được di chuyển. PostgreSQL, PDF và vector cũ không bị xóa. PDF/vector cũ không tự xuất hiện trong tài khoản SQLite; cần tải lại PDF hoặc thực hiện migration riêng.
- PDF nằm trong `RAG_Backend/data`, vector local mới trong `RAG_Backend/storage/qdrant-local`. Vector cũ trong `storage/qdrant` được giữ riêng để tránh trùng document ID giữa PostgreSQL và SQLite. Sao lưu các thư mục này cùng SQLite khi backend đã dừng.
- Muốn dùng PostgreSQL cài trực tiếp: đặt `RAG_DATABASE_URL` trong `.env.local` thành URL PostgreSQL với hostname `localhost` và thông tin đăng nhập đúng. Không dùng hostname Docker `postgre_db`.
- Chỉ chạy một backend cho mỗi thư mục Qdrant local. Không dùng nhiều worker hoặc chạy CLI đồng thời trên cùng storage.
- Embedding và reranker tải ở lần dùng AI đầu tiên. Cần Internet và dung lượng cho mô hình; chạy CPU được nhưng chậm hơn GPU. Cache nằm trong `hf_cache` khi dùng launcher.
- Upload giới hạn mặc định 25 MB, chỉ nhận PDF có văn bản. PDF scan cần OCR trước. Đổi giới hạn bằng `RAG_MAX_UPLOAD_BYTES`.
- `VITE_API_URL` trong `RAG_Frontend/.env` mặc định là `http://localhost:8000`; dùng URL local tương ứng. CORS cho phép localhost và 127.0.0.1 cổng 5173.
- Đáp án được trả về cho chức năng tự học. Điểm được backend tính lại từ lựa chọn, nhưng ứng dụng chưa phải hệ thống thi chống gian lận.

## Kiểm tra

Frontend: `cd RAG_Frontend` rồi `npm.cmd test` và `npm.cmd run build`.

Backend: tại `RAG_Backend`, chạy `venv\Scripts\python.exe -m unittest discover -s tests -v` (thay `venv` bằng môi trường đang dùng). Test dùng database/vector tạm và giả lập LLM, không gọi dịch vụ AI và không thay đổi dữ liệu thật.

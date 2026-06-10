# Software Requirements Report (SRR) - Frontend Blueprint

## 1. Tổng quan dự án (Project Overview)

### Mục tiêu dự án
RAG Quiz Application là một nền tảng học tập tích hợp Retrieval-Augmented Generation (RAG), cho phép người dùng:
- Upload tài liệu PDF để xây dựng kho kiến thức cá nhân
- Tương tác với tài liệu thông qua chat AI (hỏi-đáp)
- Tạo tóm tắt nội dung tài liệu
- Sinh bài kiểm tra trắc nghiệm từ tài liệu
- Sinh flashcard cho ôn tập chủ động

### Phạm vi Frontend
- Giao diện người dùng (Streamlit-based, có thể tái thiết kế với React/Vue)
- Quản lý tài liệu (upload, xóa, chọn lọc)
- Interface chat tương tác với AI
- Công cụ tạo tóm tắt, quiz, flashcard
- Quản lý trạng thái phiên làm việc

---

## 2. Các vai trò người dùng (User Roles & Permissions)

### User Roles
1. **Learner (Học viên)**
   - Vai trò chính của ứng dụng
   - Quyền: Upload tài liệu, hỏi-đáp, tạo quiz, tạo flashcard, xem kết quả, xóa tài liệu cá nhân
   - Màn hình được truy cập: Dashboard chính, Chat, Quiz, Flashcards, Document Manager

2. **Curator (Quản trị viên tài liệu)**
   - Có thể tạo bộ tài liệu chia sẻ cho nhóm (tính năng phát triển trong tương lai)
   - Quyền: Quản lý thư viện tài liệu tập trung

3. **Guest (Khách)**
   - Không xác thực
   - Quyền: Xem demo, không thể lưu hoặc tải tài liệu

---

## 3. Sơ đồ trang & Luồng điều hướng (Sitemap & Routing)

### Cấu trúc URL dự kiến
- `/` → Dashboard chính
- `/documents` → Quản lý tài liệu
- `/chat` → RAG Chat Interface
- `/summarize` → Summarization Tool
- `/quiz` → Quiz Generator & Viewer
- `/flashcards` → Flashcard Manager

### Route Types
- **Public Routes**: /
- **Protected Routes**: /documents, /chat, /summarize, /quiz, /flashcards

---

## 4. Chi tiết chức năng (Feature Specifications)

### 4.1 Document Management

**UI Components:**
- Sidebar upload panel with drag-drop support
- Document list with name, date, page count
- Delete button with confirmation modal
- Search/filter by filename

**User Actions:**
- Drag-and-drop PDF upload
- Click upload to send file
- Select document to make active
- Delete document with confirmation
- Search/filter documents

**Data Flow:**
- POST /documents → Upload file
- GET /documents → Fetch list
- DELETE /documents/{filename} → Delete

**Validations:**
- File must be PDF
- File size validation
- Duplicate filename handling

---

### 4.2 RAG Chat Interface

**UI Components:**
- Chat message list (user & AI bubbles)
- Text input with Send button
- Document scope selector
- Loading spinner with "Thinking..." message
- Citations as clickable links
- Clear history button

**User Actions:**
- Type question & send
- Select document scope
- Click citation to view source
- Clear chat history
- Copy response
- Regenerate response

**Data Flow:**
- POST /ask → Send question + document filter
- Response: answer + citations with page references

**State Management:**
- Chat history in session state
- Current document selection
- Loading state tracking
- API timeout: 900s (15 minutes)

---

### 4.3 Summarization Tool

**UI Components:**
- Document multi-selector dropdown
- Summary options: length (short/medium/long), focus area
- Custom prompt text area
- Summary display with key points
- Source references section
- Copy & download buttons

**User Actions:**
- Select documents
- Choose summary length/focus
- Click "Generate Summary"
- Copy or download summary
- Edit prompt & regenerate

**Data Flow:**
- POST /summarize → document_filter + optional query
- Response: summary_text + key_points + source_markers
- Caching by MD5 hash

---

### 4.4 Quiz Generation & Taking

**UI Components:**
- Quiz generator: document selector, num questions, difficulty
- Quiz taker: question display, 4 multiple-choice options
- Progress bar showing question number
- Explanation modal after answer selection
- Results page with score & review
- Source references for each question

**User Actions:**
- Select documents & quiz options
- Generate quiz
- Click answer option (A/B/C/D)
- View explanation
- Navigate with Previous/Next
- Finish & view results
- Review all answers
- Export results

**Data Flow:**
- POST /quiz → document_filter + num_questions + difficulty
- Response: questions array with correct_index, explanation, source_markers
- State: current_question_index, user_answers, score calculation

---

### 4.5 Flashcard Study

**UI Components:**
- Flashcard generator: document selector, num cards, card type
- Flashcard flip animation (front/back)
- Progress indicator: X / Total cards
- Navigation: Previous/Next buttons
- Status buttons: "Know This" / "Need Review"
- Study stats: cards reviewed, mastered, remaining
- Results page with study summary

**User Actions:**
- Generate flashcards
- Flip card to view answer
- Navigate cards
- Mark cards as known/need review
- Shuffle cards
- Reset session
- Export flashcards
- Study again

**Data Flow:**
- POST /flashcards → document_filter + num_cards
- Response: Flashcard[] with front, back, hint, topic
- State: current_card_index, card_statuses, shuffle_enabled

---

## 5. Kiến trúc Component

### Global Components
- Header (logo, user menu, stats)
- Sidebar (navigation, document upload, document list)
- Footer (copyright, links)

### Feature Components
- DocumentUploader, DocumentList, DocumentCard
- ChatInterface, MessageBubble, ChatInput, Citation
- SummarizationTool, DocumentSelector, SummaryDisplay
- QuizGenerator, QuizTaker, QuestionCard, QuizResults
- FlashcardGenerator, FlashcardStudy, FlashcardResults

---

## 6. Yêu cầu phi chức năng (Non-Functional Requirements)

### Responsive Design
- Mobile (<640px): Single column, collapsible sidebar
- Tablet (640-1024px): Two column layout
- Desktop (>1024px): Full featured layout

### Performance
- Initial load: <3s (desktop), <5s (mobile)
- Chat response: <15s (avg), <30s (p95)
- Pagination: 20 items per page
- Lazy loading: Message virtualization

### Browser Support
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### State Management
- Global: Redux/Zustand for documents, auth, UI state
- Local: React Context or component state
- Session: localStorage for persistence

### Security
- HTTPS only
- Session timeout: 30 minutes
- File validation on upload
- GDPR compliance

---

## 7. Backend Integration

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| /health | GET | - | {status} |
| /documents | GET | - | DocumentInfo[] |
| /documents | POST | FormData | DocumentInfo |
| /documents/{filename} | DELETE | - | {status} |
| /ask | POST | AskRequest | RagAnswer |
| /summarize | POST | SummarizeRequest | Summary |
| /quiz | POST | QuizzRequest | QuizSet |
| /flashcards | POST | FlashcardsRequest | FlashcardSet |

---

## 8. Configuration

- Embedding Model: GreenNode/GreenNode-Embedding-Large-VN-Mixed-V1
- LLM Providers: Gemini (default), HuggingFace, vLLM
- Chunk Size: 1000 tokens, Overlap: 150 tokens
- Top-K: 5 chunks
- Vector DB: Qdrant
- API Base: http://localhost:8000

---

## 9. Future Enhancements

1. User authentication & role-based access
2. Shared document libraries
3. Analytics dashboard
4. Full-text search
5. Export features (PDF, Excel, Anki)
6. Offline mode
7. Mobile app
8. Custom LLM integration
9. Progress tracking


import streamlit as st
import httpx
import json
from config import settings
import time

API_URL = settings.api_url

# Cấu hình giao diện chuẩn Dashboard Workspace
st.set_page_config(
    page_title="RAG Learning Dashboard", 
    layout="wide", 
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    .block-container { padding-top: 1.5rem; padding-bottom: 1rem; }
    .stButton>button { border-radius: 6px; }
    div[data-testid="stExpander"] { border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 10px; }
</style>
""", unsafe_allow_html=True)

def _api(method: str, path: str, **kwargs):
    try:
        # TĂNG TIMEOUT LÊN 900 GIÂY (15 PHÚT) để CPU thoải mái xử lý Embedding nặng
        limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
        with httpx.Client(limits=limits, timeout=900.0) as client:
            response = client.request(method, f"{API_URL}{path}", **kwargs)
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        st.error("❌ Hệ thống đang xử lý tài liệu lớn, thời gian tính toán của CPU vượt quá dự kiến. Vui lòng kiểm tra lại log Backend!")
        return None
    except Exception as e:
        st.error(f"Mất kết nối tới Backend: {e}")
        return None

# --- BẮT ĐẦU VẼ SIDEBAR ---
st.sidebar.title("RAG Hub Center")
st.sidebar.markdown("---")

st.sidebar.subheader("📤 Tải tài liệu lên")
uploaded_file = st.sidebar.file_uploader("Chọn file PDF học tập", type=["pdf"], label_visibility="collapsed")

if uploaded_file:
    if st.sidebar.button("🚀 Tiến hành Ingest", use_container_width=True):
        progress_bar = st.sidebar.progress(0)
        status_text = st.sidebar.empty()
        
        status_text.caption("⏳ 1. Đang đọc dữ liệu file...")
        progress_bar.progress(15)
        time.sleep(0.3)
        
        files = {"file": (uploaded_file.name, uploaded_file.getvalue(), "application/pdf")}
        
        status_text.caption("⚡ 2. Đang phân mảnh và trích xuất ngữ cảnh...")
        progress_bar.progress(40)
        
        progress_bar.progress(65)
        status_text.caption("🤖 3. GreenNode AI đang tính toán Embedding & Nạp Qdrant...")
        
        res = _api("POST", "/upload", files=files)
        
        if res:
            progress_bar.progress(100)
            status_text.empty()
            st.sidebar.success(f"Đã nạp xong {res['chunk_indexed']} chunks!")
            time.sleep(1.5)
            st.rerun()
        else:
            progress_bar.empty()
            status_text.empty()
            st.sidebar.error("❌ Ingest thất bại. Vui lòng kiểm tra lại Backend FastAPI!")

st.sidebar.markdown("---")

docs = _api("GET", "/documents") or []
filenames = [d["filename"] for d in docs]

st.sidebar.subheader("Phạm vi học tập")
selected_file = st.sidebar.selectbox(
    "Chọn tài liệu cần làm việc:",
    ["Tất cả tài liệu"] + filenames,
    label_visibility="collapsed"
)
# Nút xóa tài liệu được chọn
if selected_file != "Tất cả tài liệu":
    st.sidebar.markdown("<br>", unsafe_allow_html=True)
    if st.sidebar.button(f"🗑️ Xóa tài liệu hiện tại", use_container_width=True, type="secondary"):
        with st.sidebar.spinner("Đang xóa tài liệu khỏi hệ thống..."):
            res = _api("DELETE", f"/documents/{selected_file}")
            if res:
                # RESET LẠI CÁC TRẠNG THÁI GIAO DIỆN ĐỂ KHÔNG BỊ DÍNH CACHE FILE CŨ
                if "active_quiz" in st.session_state:
                    del st.session_state.active_quiz
                if "active_cards" in st.session_state:
                    del st.session_state.active_cards
                
                st.sidebar.success(f"Đã xóa xong {selected_file}!")
                time.sleep(1)
                st.rerun()

st.sidebar.markdown("<br><br>", unsafe_allow_html=True)
st.sidebar.metric(label="Tổng số tài liệu trong kho", value=len(filenames))

# KHÔNG GIAN MAIN DASHBOARD
col_header_1, col_header_2 = st.columns([7, 3])
with col_header_1:
    st.title("Không Gian Học Tập Thông Minh")
with col_header_2:
    st.markdown(f"<p style='text-align: right; margin-top: 25px;'>Nguồn dữ liệu: <b>{selected_file}</b></p>", unsafe_allow_html=True)

st.markdown("---")

col_chat, col_tools = st.columns([6, 4], gap="large")

with col_chat:
    st.subheader("💬 Trợ lý học tập AI")
    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []

    chat_container = st.container(height=450)
    with chat_container:
        if not st.session_state.chat_history:
            st.sidebar.empty()
            st.info("Hãy nhập câu hỏi bên dưới. Tôi sẽ tìm kiếm các đoạn ngữ cảnh phù hợp nhất từ tài liệu để trả lời bạn một cách trung thực.")
        for message in st.session_state.chat_history:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])
                if message.get("citations"):
                    with st.expander("🔍 Nguồn trích dẫn tài liệu"):
                        for c in message["citations"]:
                            st.caption(f"• **[{c['source_marker']}]** {c['filename']} - Trang {c['page']}")

    with st.form(key="chat_form", clear_on_submit=True):
        user_query = st.text_input("Đặt câu hỏi về nội dung tài liệu:", placeholder="Mô hình này giải quyết bài toán gì?...", label_visibility="collapsed")
        submit_button = st.form_submit_button(label="Gửi câu hỏi", use_container_width=True, type="primary")
        
        if submit_button and user_query.strip():
            st.session_state.chat_history.append({"role": "user", "content": user_query})
            req_body = {"question": user_query}
            if selected_file != "Tất cả tài liệu":
                req_body["filters"] = {"filename": selected_file}
                
            with st.spinner("AI đang tra cứu tài liệu..."):
                res = _api("POST", "/ask", json=req_body)
                if res:
                    st.session_state.chat_history.append({
                        "role": "assistant",
                        "content": res["answer"],
                        "citations": res.get("citations")
                    })
            st.rerun()

with col_tools:
    st.subheader("🛠️ Bộ công cụ học chủ động")
    
    # --- CÔNG CỤ 1: TÓM TẮT ĐA TÀI LIỆU ---
    with st.expander("📝 Tóm tắt & Ý chính cốt lõi", expanded=False):
        sum_query = st.text_input("Tóm tắt theo chủ đề (Để trống nếu muốn tóm tắt toàn bộ):", placeholder="Ví dụ: Đánh giá kết quả, phương pháp nghiên cứu...")
        if st.button("⚡ Thực hiện tóm tắt", use_container_width=True):
            req = {}
            if selected_file != "Tất cả tài liệu":
                req["document"] = selected_file
            if sum_query.strip():
                req["query"] = sum_query.strip()
                
            with st.spinner("Hệ thống đang bóc tách ngữ cảnh và gửi sang Gemini xử lý (Có thể mất 1-2 phút do máy chạy CPU)..."):
                res = _api("POST", "/summarize", json=req)
                if res:
                    st.markdown("#### ✨ Tổng quan tài liệu")
                    st.write(res["summary"])
                    st.markdown("#### 🔑 Các luận điểm chính")
                    for p in res["key_points"]:
                        st.markdown(f"- {p}")

    # --- CÔNG CỤ 2: TRẮC NGHIỆM PHẢN XẠ (QUIZ) ---
    with st.expander("✏️ Làm bài tập trắc nghiệm nhanh", expanded=False):
        quiz_count = st.slider("Số lượng câu hỏi sinh ra:", min_value=3, max_value=15, value=5, key="quiz_cnt_slider")
        if st.button("🧩 Tạo đề ôn tập", use_container_width=True):
            req = {"count": quiz_count}
            if selected_file != "Tất cả tài liệu":
                req["document"] = selected_file
                
            with st.spinner("AI đang trích xuất dữ liệu làm Quiz..."):
                res = _api("POST", "/quiz", json=req)
                if res and res.get("items"):
                    st.session_state.active_quiz = res["items"]
                    st.success(f"Đã biên soạn xong {len(res['items'])} câu hỏi dựa theo tài liệu!")
        
        if "active_quiz" in st.session_state:
            st.markdown("---")
            for idx, item in enumerate(st.session_state.active_quiz, 1):
                st.markdown(f"**Câu {idx}: {item['question']}**")
                options_letters = ['A', 'B', 'C', 'D']
                formatted_options = [f"{options_letters[i]}. {opt}" for i, opt in enumerate(item['options'])]
                st.radio(f"Chọn đáp án cho câu {idx}:", formatted_options, key=f"q_choice_{idx}", label_visibility="collapsed")
                
                with st.expander(f"🔑 Kiểm tra đáp án Câu {idx}"):
                    st.info(f"Đáp án đúng hoàn toàn là: **{options_letters[item['correct_index']]}**")
                    st.caption(f"**Giải thích khoa học:** {item['explanation']}")
                    if item.get("source_markers"):
                        st.caption(f"📍 Vị trí nguồn dữ liệu: {', '.join(item['source_markers'])}")
                st.markdown("<br>", unsafe_allow_html=True)

    # --- CÔNG CỤ 3: FLASHCARDS HỌC CHỦ ĐỘNG ---
    with st.expander("📇 Thẻ ghi nhớ Flashcards (Lật mặt)", expanded=False):
        fc_count = st.slider("Số lượng thẻ ghi nhớ:", min_value=3, max_value=20, value=6, key="fc_cnt_slider")
        if st.button("🃏 Khởi tạo Flashcards", use_container_width=True):
            req = {"count": fc_count}
            if selected_file != "Tất cả tài liệu":
                req["document"] = selected_file
                
            with st.spinner("Đang thiết kế thẻ học..."):
                res = _api("POST", "/flashcards", json=req)
                if res and res.get("cards"):
                    st.session_state.active_cards = res["cards"]
                    st.success(f"Đã tạo {len(res['cards'])} thẻ flashcards thành công!")
                    
        if "active_cards" in st.session_state:
            st.markdown("---")
            for idx, card in enumerate(st.session_state.active_cards, 1):
                st.markdown(f"**🎴 THẺ SỐ {idx}**")
                st.info(f"**Mặt trước (Khái niệm/Câu hỏi):**\n\n{card['front']}")
                if card.get("hint"):
                    st.caption(f"💡 *Gợi ý nhỏ:* {card['hint']}")
                    
                with st.expander("🔄 Nhấn vào đây để LẬT THẺ xem định nghĩa"):
                    st.success(f"**Mặt sau (Định nghĩa sự thật):**\n\n{card['back']}")
                st.markdown("<br>", unsafe_allow_html=True)
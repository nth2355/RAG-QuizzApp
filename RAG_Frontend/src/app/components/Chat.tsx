import {
    AlertTriangle,
    BookOpen,
    Bot,
    CheckCheck,
    ChevronDown,
    Copy,
    ExternalLink,
    FileText,
    Loader2,
    RefreshCw,
    Send,
    Trash2,
    User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { askQuestion } from "../services/api";
import { useApp, ChatMessage } from "../context/AppContext";
import { trackQuestion } from "../services/activityTracker";

interface Citation {
  source_marker: string;
  filename: string;
  page: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: string | Date;
}

export function Chat() {
  const { selectedDoc, setSelectedDoc, documentsList, chatHistory, setChatHistory, refreshStats } = useApp();
  const messages = chatHistory;
  const setMessages = setChatHistory;

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const docs = ["Tất cả tài liệu", ...documentsList.map((doc) => doc.filename)];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput("");

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: q,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    try {
      const response = await askQuestion({
        question: q,
        filters:
          selectedDoc !== "Tất cả tài liệu"
            ? { filename: selectedDoc }
            : undefined,
      });

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.answer,
        citations: response.citations.map((c) => ({
          source_marker: c.source_marker,
          filename: c.filename,
          page: c.page,
        })),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      // Track activity
      trackQuestion(q, selectedDoc !== "Tất cả tài liệu" ? selectedDoc : undefined);
      refreshStats();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get response";
      setError(errorMessage);
      console.error("Error sending message:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatTime = (d: string | Date) => {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex h-full" style={{ height: "calc(100vh - 60px)" }}>
      {/* Sidebar */}
      <div
        className="flex flex-col shrink-0 p-4 gap-4"
        style={{
          width: 260,
          borderRight: "1px solid var(--border)",
          background: "var(--card)",
        }}
      >
        {error && (
          <div
            className="rounded-xl p-3 flex items-center gap-2"
            style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}
          >
            <AlertTriangle size={14} color="#ef4444" />
            <div style={{ fontSize: 11, color: "#7f1d1d" }}>{error}</div>
            <button
              onClick={() => setError(null)}
              style={{ marginLeft: "auto", color: "#7f1d1d" }}
            >
              ×
            </button>
          </div>
        )}

        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--muted-foreground)",
              display: "block",
              marginBottom: 8,
            }}
          >
            Phạm vi tài liệu
          </label>
          <div className="relative">
            <button
              onClick={() => setDocOpen(!docOpen)}
              className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors"
              style={{
                background: "var(--muted)",
                fontSize: 13,
                color: "var(--foreground)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen size={14} color="var(--primary)" />
                <span className="truncate">{selectedDoc}</span>
              </div>
              <ChevronDown
                size={14}
                color="var(--muted-foreground)"
                style={{
                  transform: docOpen ? "rotate(180deg)" : "",
                  transition: "transform 0.2s",
                }}
              />
            </button>
            {docOpen && (
              <div
                className="absolute z-10 w-full rounded-xl overflow-hidden mt-1"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                }}
              >
                {docs.map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setSelectedDoc(d);
                      setDocOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                    style={{
                      fontSize: 13,
                      color:
                        d === selectedDoc ? "var(--primary)" : "var(--foreground)",
                      background:
                        d === selectedDoc ? "#ede9fe" : "transparent",
                    }}
                  >
                    <FileText size={13} />
                    <span className="truncate">{d}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors w-full"
            style={{
              background: "#fee2e2",
              color: "#ef4444",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <Trash2 size={14} /> Xóa lịch sử chat
          </button>
        )}

        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--muted-foreground)",
              marginBottom: 8,
            }}
          >
            Gợi ý câu hỏi
          </div>
          <div className="space-y-2">
            {[
              "Nội dung chính của tài liệu là gì?",
              "Các khái niệm quan trọng là gì?",
              "Có thể giải thích với ví dụ không?",
              "Tài liệu này dạy về cái gì?",
            ].map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                disabled={loading}
                className="w-full text-left rounded-xl px-3 py-2 transition-colors"
                style={{
                  background: "var(--muted)",
                  fontSize: 12,
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="flex items-center justify-center rounded-2xl" style={{ width: 64, height: 64, background: "#ede9fe" }}>
                <Bot size={28} color="#6366f1" />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>Chat với AI</h3>
                <p style={{ fontSize: 14, color: "var(--muted-foreground)", maxWidth: 380 }}>
                  Hỏi bất kỳ câu hỏi nào về tài liệu của bạn. AI sẽ trả lời dựa trên nội dung tài liệu và cung cấp nguồn tham chiếu.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex items-center justify-center rounded-xl shrink-0 mt-1" style={{ width: 32, height: 32, background: "#ede9fe" }}>
                  <Bot size={16} color="#6366f1" />
                </div>
              )}

              <div style={{ maxWidth: "70%" }}>
                <div
                  className="rounded-2xl px-4 py-3"
                  style={{
                    background: msg.role === "user" ? "var(--primary)" : "var(--card)",
                    color: msg.role === "user" ? "#fff" : "var(--foreground)",
                    border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                  }}
                >
                  <pre style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>
                    {msg.content}
                  </pre>
                </div>

                {/* Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.citations.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 cursor-pointer transition-colors"
                        style={{
                          background: "#ede9fe",
                          border: "1px solid #c4b5fd",
                          fontSize: 11,
                        }}
                      >
                        <FileText size={10} color="#6366f1" />
                        <span style={{ color: "#4f46e5" }}>
                          {c.filename.replace(".pdf", "")} · tr.{c.page}
                        </span>
                        <ExternalLink size={9} color="#6366f1" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1 mt-2">
                    <button
                      onClick={() => copyText(msg.id, msg.content)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-muted"
                      style={{
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {copied === msg.id ? (
                        <CheckCheck size={12} color="#10b981" />
                      ) : (
                        <Copy size={12} />
                      )}
                      {copied === msg.id ? "Đã sao chép" : "Sao chép"}
                    </button>
                    <button
                      onClick={() => {
                        const msgIndex = messages.indexOf(msg);
                        if (msgIndex > 0 && messages[msgIndex - 1].role === "user") {
                          sendMessage(messages[msgIndex - 1].content);
                        }
                      }}
                      disabled={loading}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-muted"
                      style={{
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      <RefreshCw size={12} /> Tạo lại
                    </button>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#94a3b8",
                        marginLeft: "auto",
                      }}
                    >
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                )}

                {msg.role === "user" && (
                  <div className="flex justify-end mt-1">
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{formatTime(msg.timestamp)}</span>
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex items-center justify-center rounded-xl shrink-0 mt-1" style={{ width: 32, height: 32, background: "var(--primary)" }}>
                  <User size={16} color="#fff" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 32, height: 32, background: "#ede9fe" }}>
                <Bot size={16} color="#6366f1" />
              </div>
              <div className="rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <Loader2 size={14} color="#6366f1" className="animate-spin" />
                <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Đang suy nghĩ...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 p-4" style={{ borderTop: "1px solid var(--border)", background: "var(--card)" }}>
          <div className="flex items-end gap-3 rounded-2xl px-4 py-3" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Hỏi về tài liệu của bạn... (Enter để gửi, Shift+Enter xuống dòng)"
              rows={1}
              className="flex-1 resize-none bg-transparent outline-none"
              style={{ fontSize: 14, color: "var(--foreground)", maxHeight: 120, lineHeight: 1.5 }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="flex items-center justify-center rounded-xl shrink-0 transition-all"
              style={{
                width: 40,
                height: 40,
                background: input.trim() && !loading ? "var(--primary)" : "var(--muted)",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              }}
            >
              <Send size={16} color={input.trim() && !loading ? "#fff" : "var(--muted-foreground)"} />
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 8 }}>
            AI có thể mắc sai sót. Hãy xác minh thông tin từ nguồn gốc tài liệu.
          </div>
        </div>
      </div>
    </div>
  );
}

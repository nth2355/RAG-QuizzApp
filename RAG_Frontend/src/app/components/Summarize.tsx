import {
    AlertTriangle,
    AlignLeft,
    BookMarked,
    CheckCheck,
    ChevronDown,
    Copy,
    Download,
    FileText,
    List,
    Loader2,
    RefreshCw,
    Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
    summarizeDocument,
    Summary as SummaryResponse
} from "../services/api";
import { useApp } from "../context/AppContext";
import { trackSummarize } from "../services/activityTracker";

const LENGTHS = [
  { value: "short", label: "Ngắn gọn", desc: "~100 từ" },
  { value: "medium", label: "Trung bình", desc: "~300 từ" },
  { value: "long", label: "Chi tiết", desc: "~600 từ" },
];

const FOCUSES = [
  "Tổng quan",
  "Khái niệm chính",
  "Ví dụ thực tế",
  "Ứng dụng",
  "So sánh",
  "Kết luận",
];

export function Summarize() {
  const { selectedDoc, setSelectedDoc, documentsList, refreshStats } = useApp();
  const [length, setLength] = useState("medium");
  const [focus, setFocus] = useState("Tổng quan");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const result = await summarizeDocument({
        document: selectedDoc !== "Tất cả tài liệu" ? selectedDoc : undefined,
        query: customPrompt || undefined,
      });
      setSummary(result);
      trackSummarize(selectedDoc !== "Tất cả tài liệu" ? selectedDoc : undefined);
      refreshStats();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate summary";
      setError(errorMessage);
      console.error("Error generating summary:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 flex gap-6" style={{ minHeight: "calc(100vh - 60px)" }}>
      {/* Config panel */}
      <div className="shrink-0 space-y-5" style={{ width: 280 }}>
        {error && (
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}
          >
            <AlertTriangle size={18} color="#ef4444" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#7f1d1d" }}>
                Error
              </div>
              <div style={{ fontSize: 12, color: "#991b1b" }}>{error}</div>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto"
              style={{ color: "#7f1d1d" }}
            >
              ×
            </button>
          </div>
        )}

        {/* Document selector */}
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <h3
            className="flex items-center gap-2"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--foreground)",
            }}
          >
            <FileText size={15} color="#6366f1" /> Chọn tài liệu
          </h3>
          <select
            value={selectedDoc}
            onChange={(e) => setSelectedDoc(e.target.value)}
            className="w-full bg-[#f8fafc] dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-2 text-xs outline-none"
          >
            <option value="Tất cả tài liệu">📚 Tất cả tài liệu</option>
            {documentsList.map((doc) => (
              <option key={doc.document_id} value={doc.filename}>
                📄 {doc.filename.replace(".pdf", "")}
              </option>
            ))}
          </select>
        </div>

        {/* Length */}
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--foreground)",
            }}
          >
            Độ dài tóm tắt
          </h3>
          <div className="space-y-2">
            {LENGTHS.map((l) => (
              <label
                key={l.value}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer transition-all"
                style={{
                  border: `1.5px solid ${
                    length === l.value ? "#6366f1" : "var(--border)"
                  }`,
                  background:
                    length === l.value ? "#ede9fe" : "var(--muted)",
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="length"
                    value={l.value}
                    checked={length === l.value}
                    onChange={() => setLength(l.value)}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color:
                        length === l.value
                          ? "#4f46e5"
                          : "var(--foreground)",
                    }}
                  >
                    {l.label}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  }}
                >
                  {l.desc}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Focus */}
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--foreground)",
            }}
          >
            Hướng trọng tâm
          </h3>
          <div className="flex flex-wrap gap-2">
            {FOCUSES.map((f) => (
              <button
                key={f}
                onClick={() => setFocus(f)}
                className="rounded-full px-3 py-1.5 transition-all"
                style={{
                  fontSize: 12,
                  background: focus === f ? "#6366f1" : "var(--muted)",
                  color: focus === f ? "#fff" : "var(--foreground)",
                  border: `1px solid ${
                    focus === f ? "#6366f1" : "var(--border)"
                  }`,
                  fontWeight: focus === f ? 500 : 400,
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Custom prompt */}
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--foreground)",
            }}
          >
            Yêu cầu tùy chỉnh
          </h3>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ví dụ: Tập trung vào các thuật toán đồ thị, giải thích bằng ví dụ thực tế..."
            rows={3}
            className="w-full rounded-xl px-3 py-2.5 resize-none outline-none"
            style={{
              fontSize: 13,
              background: "var(--muted)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={documentsList.length === 0 || loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 transition-all"
          style={{
            background:
              documentsList.length > 0 && !loading
                ? "var(--primary)"
                : "var(--muted)",
            color:
              documentsList.length > 0 && !loading
                ? "#fff"
                : "var(--muted-foreground)",
            fontSize: 14,
            fontWeight: 600,
            cursor:
              documentsList.length > 0 && !loading
                ? "pointer"
                : "not-allowed",
          }}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {loading ? "Đang tóm tắt..." : "Tạo tóm tắt"}
        </button>
      </div>

      {/* Summary output */}
      <div className="flex-1 min-w-0">
        {!summary && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div
              className="flex items-center justify-center rounded-2xl"
              style={{ width: 64, height: 64, background: "#d1fae5" }}
            >
              <AlignLeft size={28} color="#10b981" />
            </div>
            <div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--foreground)",
                  marginBottom: 8,
                }}
              >
                Sẵn sàng tóm tắt
              </h3>
              <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
                Chọn tài liệu và cấu hình bên trái, sau đó nhấn "Tạo tóm tắt"
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div
              className="flex items-center justify-center rounded-2xl"
              style={{ width: 64, height: 64, background: "#ede9fe" }}
            >
              <Loader2
                size={28}
                color="#6366f1"
                className="animate-spin"
              />
            </div>
            <div className="text-center">
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--foreground)",
                  marginBottom: 8,
                }}
              >
                Đang tóm tắt tài liệu...
              </div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                AI đang phân tích và tổng hợp nội dung
              </div>
            </div>
          </div>
        )}

        {summary && !loading && (
          <div className="space-y-4">
            {/* Actions */}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={generate}
                className="flex items-center gap-2 rounded-xl px-3 py-2 transition-colors"
                style={{
                  background: "var(--muted)",
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                <RefreshCw size={13} /> Tạo lại
              </button>
              <button
                onClick={copyAll}
                className="flex items-center gap-2 rounded-xl px-3 py-2 transition-colors"
                style={{
                  background: "var(--muted)",
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                {copied ? (
                  <CheckCheck size={13} color="#10b981" />
                ) : (
                  <Copy size={13} />
                )}
                {copied ? "Đã sao chép" : "Sao chép"}
              </button>
              <button
                className="flex items-center gap-2 rounded-xl px-3 py-2 transition-colors"
                style={{
                  background: "var(--primary)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <Download size={13} /> Tải xuống
              </button>
            </div>

            {/* Summary text */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="flex items-center gap-2 mb-4"
                style={{
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: 12,
                }}
              >
                <BookMarked size={16} color="#6366f1" />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--foreground)",
                  }}
                >
                  Tóm tắt nội dung
                </span>
                <span
                  className="ml-auto rounded-full px-2 py-0.5"
                  style={{
                    fontSize: 11,
                    background: "#ede9fe",
                    color: "#4f46e5",
                  }}
                >
                  {LENGTHS.find((l) => l.value === length)?.label}
                </span>
              </div>
              <pre
                style={{
                  fontSize: 14,
                  lineHeight: 1.8,
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  color: "var(--foreground)",
                  margin: 0,
                }}
              >
                {summary.summary}
              </pre>
            </div>

            {/* Key points */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <List size={16} color="#10b981" />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--foreground)",
                  }}
                >
                  Điểm chính
                </span>
              </div>
              <ul className="space-y-2">
                {summary.key_points.map((p, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div
                      className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
                      style={{
                        width: 20,
                        height: 20,
                        background: "#d1fae5",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#10b981",
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--foreground)",
                        lineHeight: 1.5,
                      }}
                    >
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Citations */}
            {summary.citations && summary.citations.length > 0 && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} color="#f59e0b" />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--foreground)",
                    }}
                  >
                    Nguồn tham chiếu
                  </span>
                </div>
                <div className="space-y-2">
                  {summary.citations.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl px-3 py-2"
                      style={{
                        background: "#fef3c7",
                        border: "1px solid #fde68a",
                      }}
                    >
                      <FileText size={14} color="#f59e0b" />
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--foreground)",
                          }}
                        >
                          {c.filename}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--muted-foreground)",
                          }}
                        >
                          Trang {c.page}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

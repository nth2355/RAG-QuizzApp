import {
  AlignLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  HelpCircle,
  MessageSquare,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { Link } from "react-router";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "../context/AppContext";
import { formatRelativeTime, type ActivityType } from "../services/activityTracker";

// ── Icon + color map for activity types ──────────────────────────────────────
const ACTIVITY_META: Record<
  ActivityType,
  { icon: React.ElementType; color: string; label: string }
> = {
  chat: { icon: MessageSquare, color: "#6366f1", label: "Chat với AI" },
  upload: { icon: Upload, color: "#06b6d4", label: "Upload tài liệu" },
  delete: { icon: Trash2, color: "#ef4444", label: "Xóa tài liệu" },
  quiz_complete: { icon: CheckCircle, color: "#10b981", label: "Hoàn thành quiz" },
  flashcard_session: { icon: CreditCard, color: "#f59e0b", label: "Ôn flashcard" },
  summarize: { icon: AlignLeft, color: "#ec4899", label: "Tóm tắt tài liệu" },
};

const quickActions = [
  { to: "/documents", label: "Upload tài liệu", desc: "Thêm PDF vào kho kiến thức", icon: FileText, color: "#6366f1" },
  { to: "/chat", label: "Chat với AI", desc: "Hỏi đáp về tài liệu", icon: MessageSquare, color: "#06b6d4" },
  { to: "/summarize", label: "Tóm tắt", desc: "Tạo tóm tắt nhanh", icon: AlignLeft, color: "#10b981" },
  { to: "/quiz", label: "Tạo quiz", desc: "Kiểm tra kiến thức", icon: HelpCircle, color: "#f59e0b" },
  { to: "/flashcards", label: "Flashcard", desc: "Ôn tập chủ động", icon: CreditCard, color: "#ec4899" },
];

// ── Stat card data ──────────────────────────────────────────────────────────
function useStatCards(
  docsCount: number,
  totalQuestions: number,
  totalQuizzes: number,
  totalFlashcards: number,
) {
  return [
    {
      label: "Tài liệu đã upload",
      value: docsCount,
      icon: FileText,
      color: "#6366f1",
      bg: "#ede9fe",
    },
    {
      label: "Câu hỏi đã hỏi",
      value: totalQuestions,
      icon: MessageSquare,
      color: "#06b6d4",
      bg: "#cffafe",
    },
    {
      label: "Bài quiz hoàn thành",
      value: totalQuizzes,
      icon: HelpCircle,
      color: "#10b981",
      bg: "#d1fae5",
    },
    {
      label: "Flashcard ôn tập",
      value: totalFlashcards,
      icon: CreditCard,
      color: "#f59e0b",
      bg: "#fef3c7",
    },
  ];
}

export function Dashboard() {
  const { documentsList, stats } = useApp();

  const statCards = useStatCards(
    documentsList.length,
    stats.totalQuestions,
    stats.totalQuizzes,
    stats.totalFlashcards,
  );

  // 5 most recent documents from the backend list
  const recentDocs = documentsList.slice(0, 5);

  // Last 20 activity events for the sidebar
  const recentActivity = stats.recentActivity.slice(0, 8);

  return (
    <div className="p-6 space-y-6">
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 flex items-center justify-between overflow-hidden relative"
        style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)" }}
      >
        <div className="relative z-10">
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 4 }}>
            Chào mừng trở lại 👋
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
            Hôm nay bạn muốn học gì?
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 16 }}>
            {documentsList.length > 0
              ? `Bạn có ${documentsList.length} tài liệu trong kho kiến thức. Hãy bắt đầu học nhé!`
              : "Hãy upload tài liệu đầu tiên để bắt đầu hành trình học tập!"}
          </p>
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 transition-all"
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            <Zap size={15} /> Bắt đầu học <ArrowRight size={14} />
          </Link>
        </div>
        <div
          className="hidden md:flex items-center justify-center"
          style={{ opacity: 0.15, position: "absolute", right: 40, top: "50%", transform: "translateY(-50%)" }}
        >
          <BookOpen size={140} color="#fff" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="rounded-lg flex items-center justify-center"
                style={{ width: 40, height: 40, background: s.bg }}
              >
                <s.icon size={18} color={s.color} />
              </div>
              <BarChart2 size={14} color="var(--muted-foreground)" />
            </div>
            <div
              style={{ fontSize: 28, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}
            >
              {s.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", marginBottom: 12 }}>
          Truy cập nhanh
        </h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          {quickActions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex flex-col items-center gap-2 rounded-xl p-4 text-center transition-all hover:shadow-md group"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div
                className="flex items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                style={{ width: 44, height: 44, background: a.color + "18" }}
              >
                <a.icon size={20} color={a.color} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{a.label}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{a.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Chart + Activity */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px" }}>
        {/* Chart */}
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
              Hoạt động 7 ngày qua
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="rounded-full" style={{ width: 8, height: 8, background: "#6366f1" }} />
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Câu hỏi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="rounded-full" style={{ width: 8, height: 8, background: "#10b981" }} />
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Quiz</span>
              </div>
            </div>
          </div>
          {stats.chartData.every((d) => d.questions === 0 && d.quizzes === 0) ? (
            <div
              className="flex flex-col items-center justify-center"
              style={{ height: 180, color: "var(--muted-foreground)", fontSize: 13 }}
            >
              <BarChart2 size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              Chưa có hoạt động nào trong 7 ngày qua
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={stats.chartData} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gQ" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gQz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="questions" stroke="#6366f1" strokeWidth={2} fill="url(#gQ)" name="Câu hỏi" />
                <Area type="monotone" dataKey="quizzes" stroke="#10b981" strokeWidth={2} fill="url(#gQz)" name="Quiz" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent activity */}
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
              Hoạt động gần đây
            </h3>
            <Clock size={14} color="var(--muted-foreground)" />
          </div>
          {recentActivity.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center"
              style={{ minHeight: 120, color: "var(--muted-foreground)", fontSize: 13, textAlign: "center" }}
            >
              <Clock size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
              Chưa có hoạt động nào.
              <br />
              Hãy bắt đầu học!
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((a) => {
                const meta = ACTIVITY_META[a.type] ?? ACTIVITY_META.chat;
                const Icon = meta.icon;
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div
                      className="flex items-center justify-center rounded-lg shrink-0 mt-0.5"
                      style={{ width: 28, height: 28, background: meta.color + "18" }}
                    >
                      <Icon size={13} color={meta.color} />
                    </div>
                    <div className="min-w-0">
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>
                        {meta.label}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--muted-foreground)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {a.detail}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                        {formatRelativeTime(a.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent docs */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
            Tài liệu gần đây
          </h3>
          <Link
            to="/documents"
            className="flex items-center gap-1 transition-colors"
            style={{ fontSize: 13, color: "var(--primary)", fontWeight: 500 }}
          >
            Xem tất cả <ArrowRight size={14} />
          </Link>
        </div>
        {recentDocs.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-8"
            style={{ color: "var(--muted-foreground)", fontSize: 13, textAlign: "center" }}
          >
            <FileText size={32} style={{ opacity: 0.25, marginBottom: 8 }} />
            Chưa có tài liệu nào.{" "}
            <Link to="/documents" style={{ color: "var(--primary)", fontWeight: 500 }}>
              Upload ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentDocs.map((d, i) => (
              <div
                key={d.document_id ?? i}
                className="flex items-center gap-4 py-2 rounded-lg px-2 -mx-2 transition-colors hover:bg-muted/50"
              >
                <div
                  className="flex items-center justify-center rounded-lg shrink-0"
                  style={{ width: 36, height: 36, background: "#ede9fe" }}
                >
                  <FileText size={16} color="#6366f1" />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--foreground)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.filename}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    {d.size_bytes ? `${(d.size_bytes / 1024).toFixed(0)} KB` : "Đã index"}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "#10b981",
                    background: "#d1fae5",
                    padding: "2px 8px",
                    borderRadius: 20,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  Đã index
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

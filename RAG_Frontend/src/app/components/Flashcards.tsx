import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trophy,
  XCircle
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  FlashcardSet,
  generateFlashcards
} from "../services/api";
import { useApp } from "../context/AppContext";
import { trackFlashcardSession } from "../services/activityTracker";

type Status = "unseen" | "know" | "review";
type Stage = "config" | "study" | "results";

export function Flashcards() {
  const { selectedDoc, setSelectedDoc, documentsList, refreshStats } = useApp();
  const [stage, setStage] = useState<Stage>("config");
  const [numCards, setNumCards] = useState(8);
  const [loading, setLoading] = useState(false);
  const [flashcardSet, setFlashcardSet] = useState<FlashcardSet | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cards = flashcardSet?.cards || [];

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const result = await generateFlashcards({
        document: selectedDoc !== "Tất cả tài liệu" ? selectedDoc : undefined,
        count: numCards,
      });
      setFlashcardSet(result);
      setStatuses(new Array(result.cards.length).fill("unseen"));
      setCurrent(0);
      setFlipped(false);
      setShowHint(false);
      setStage("study");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate flashcards";
      setError(errorMessage);
      console.error("Error generating flashcards:", err);
    } finally {
      setLoading(false);
    }
  };

  const flip = () => {
    setFlipped(!flipped);
    setShowHint(false);
  };

  const markCard = (status: "know" | "review") => {
    const next = [...statuses];
    next[current] = status;
    setStatuses(next);
    if (current < cards.length - 1) {
      setCurrent(current + 1);
      setFlipped(false);
      setShowHint(false);
    } else {
      // Track completed session
      trackFlashcardSession(
        cards.length,
        selectedDoc !== "Tất cả tài liệu" ? selectedDoc : undefined,
      );
      refreshStats();
      setStage("results");
    }
  };

  const shuffle = () => {
    if (!flashcardSet) return;
    const arr = [...flashcardSet.cards];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setFlashcardSet({ ...flashcardSet, cards: arr });
    setStatuses(new Array(arr.length).fill("unseen"));
    setCurrent(0);
    setFlipped(false);
    setShuffled(!shuffled);
  };

  const knowCount = statuses.filter((s) => s === "know").length;
  const reviewCount = statuses.filter((s) => s === "review").length;
  const progress = statuses.filter((s) => s !== "unseen").length;

  const topicColors: Record<string, { bg: string; color: string }> = {
    Thuật: { bg: "#ede9fe", color: "#6366f1" },
    "Cấu trúc": { bg: "#cffafe", color: "#06b6d4" },
    "Machine Learning": { bg: "#d1fae5", color: "#10b981" },
    Python: { bg: "#fef3c7", color: "#f59e0b" },
    "Hệ điều": { bg: "#fee2e2", color: "#ef4444" },
  };

  if (stage === "config") {
    return (
      <div className="p-6 max-w-xl mx-auto pt-12">
        {error && (
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3 mb-6"
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

        <div className="text-center mb-8">
          <div
            className="flex items-center justify-center mx-auto mb-4 rounded-2xl"
            style={{ width: 64, height: 64, background: "#ede9fe" }}
          >
            <CreditCard size={28} color="#6366f1" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", marginBottom: 8 }}>Tạo Flashcard</h2>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>Ôn tập chủ động với flashcard được tạo từ tài liệu</p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 12 }}>Tài liệu nguồn</label>
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

          <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <label style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Số thẻ</label>
              <span className="rounded-full px-3 py-1" style={{ fontSize: 14, fontWeight: 700, color: "#6366f1", background: "#ede9fe" }}>{numCards}</span>
            </div>
            <input type="range" min={5} max={30} value={numCards} onChange={(e) => setNumCards(Number(e.target.value))} className="w-full" style={{ accentColor: "#6366f1" }} />
            <div className="flex justify-between mt-1">
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>5</span>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>30</span>
            </div>
          </div>

          <button
            onClick={generate}
            disabled={documentsList.length === 0 || loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 transition-all"
            style={{ background: documentsList.length > 0 && !loading ? "var(--primary)" : "var(--muted)", color: documentsList.length > 0 && !loading ? "#fff" : "var(--muted-foreground)", fontSize: 15, fontWeight: 600, cursor: documentsList.length > 0 && !loading ? "pointer" : "not-allowed" }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {loading ? "Đang tạo flashcard..." : "Tạo flashcard"}
          </button>
        </div>
      </div>
    );
  }

  if (stage === "study") {
    const card = cards[current];
    const topic = topicColors[card.topic] ?? { bg: "#ede9fe", color: "#6366f1" };

    return (
      <div className="p-6 flex flex-col items-center" style={{ minHeight: "calc(100vh - 60px)" }}>
        {/* Stats bar */}
        <div className="flex items-center gap-6 mb-6 w-full max-w-xl">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={14} color="#10b981" />
            <span style={{ fontSize: 13, color: "#10b981", fontWeight: 600 }}>{knowCount} Đã biết</span>
          </div>
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: "var(--muted)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(progress / cards.length) * 100}%`, background: "var(--primary)" }} />
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle size={14} color="#ef4444" />
            <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>{reviewCount} Cần ôn</span>
          </div>
        </div>

        {/* Card counter */}
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 24 }}>
          Thẻ {current + 1} / {cards.length}
        </div>

        {/* Flashcard */}
        <div
          className="relative cursor-pointer select-none"
          style={{ width: "100%", maxWidth: 480, height: 280, perspective: "1000px" }}
          onClick={flip}
        >
          <motion.div
            style={{ width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d" }}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-8"
              style={{ background: "var(--card)", border: "1px solid var(--border)", backfaceVisibility: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}
            >
              <span className="rounded-full px-3 py-1 mb-4" style={{ fontSize: 11, ...topic, fontWeight: 600 }}>{card.topic}</span>
              <p style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", textAlign: "center", lineHeight: 1.5 }}>{card.front}</p>
              {showHint && (
                <div className="mt-4 rounded-xl px-4 py-2" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
                  <p style={{ fontSize: 13, color: "#92400e" }}>💡 {card.hint}</p>
                </div>
              )}
              {!flipped && (
                <div className="absolute bottom-4 flex items-center gap-1.5" style={{ color: "#94a3b8", fontSize: 12 }}>
                  <RotateCcw size={12} /> Click để lật thẻ
                </div>
              )}
            </div>
            {/* Back */}
            <div
              className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-8"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", backfaceVisibility: "hidden", transform: "rotateY(180deg)", boxShadow: "0 8px 32px rgba(99,102,241,0.3)" }}
            >
              <BookOpen size={20} color="rgba(255,255,255,0.6)" style={{ marginBottom: 16 }} />
              <p style={{ fontSize: 15, color: "#fff", textAlign: "center", lineHeight: 1.7 }}>{card.back}</p>
            </div>
          </motion.div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mt-6">
          <button onClick={() => { if (current > 0) { setCurrent(current - 1); setFlipped(false); setShowHint(false); } }} disabled={current === 0} className="flex items-center justify-center rounded-xl transition-all" style={{ width: 44, height: 44, background: "var(--card)", border: "1px solid var(--border)", cursor: current === 0 ? "not-allowed" : "pointer" }}>
            <ChevronLeft size={18} color={current === 0 ? "var(--muted-foreground)" : "var(--foreground)"} />
          </button>

          {!flipped ? (
            <button onClick={() => setShowHint(!showHint)} className="flex items-center gap-2 rounded-xl px-4 py-2.5 transition-colors" style={{ background: "var(--muted)", fontSize: 13, color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
              <Eye size={14} /> Gợi ý
            </button>
          ) : (
            <>
              <button onClick={() => markCard("review")} className="flex items-center gap-2 rounded-xl px-5 py-2.5 transition-colors" style={{ background: "#fee2e2", color: "#ef4444", fontSize: 14, fontWeight: 500, border: "1px solid #fca5a5" }}>
                <XCircle size={16} /> Cần ôn
              </button>
              <button onClick={() => markCard("know")} className="flex items-center gap-2 rounded-xl px-5 py-2.5 transition-colors" style={{ background: "#d1fae5", color: "#10b981", fontSize: 14, fontWeight: 500, border: "1px solid #6ee7b7" }}>
                <CheckCircle size={16} /> Đã biết
              </button>
            </>
          )}

          <button onClick={shuffle} className="flex items-center justify-center rounded-xl transition-all" style={{ width: 44, height: 44, background: "var(--card)", border: "1px solid var(--border)" }}>
            <Shuffle size={16} color="var(--muted-foreground)" />
          </button>
        </div>

        {/* Dots */}
        <div className="flex gap-1.5 mt-6 flex-wrap justify-center" style={{ maxWidth: 320 }}>
          {cards.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{
                width: 8, height: 8,
                background: statuses[i] === "know" ? "#10b981" : statuses[i] === "review" ? "#ef4444" : i === current ? "#6366f1" : "var(--border)",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Results
  const masteredPct = Math.round((knowCount / cards.length) * 100);
  return (
    <div className="p-6 max-w-xl mx-auto pt-8">
      <div className="rounded-2xl p-8 text-center mb-6" style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}>
        <Trophy size={40} color="#fbbf24" style={{ margin: "0 auto 16px" }} />
        <div style={{ fontSize: 48, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{masteredPct}%</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", marginTop: 8 }}>Đã nắm vững</div>
        <div className="flex justify-center gap-6 mt-6">
          <div className="text-center">
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{knowCount}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Đã biết</div>
          </div>
          <div className="text-center">
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fca5a5" }}>{reviewCount}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Cần ôn thêm</div>
          </div>
        </div>
      </div>

      {reviewCount > 0 && (
        <div className="rounded-xl p-4 mb-4" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>Cần ôn thêm {reviewCount} thẻ</div>
          <p style={{ fontSize: 13, color: "#92400e" }}>Những thẻ này cần được ôn tập thêm để ghi nhớ lâu hơn.</p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => { setStage("config"); }} className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 transition-colors" style={{ background: "var(--muted)", fontSize: 14, fontWeight: 500, color: "var(--foreground)", border: "1px solid var(--border)" }}>
          <RefreshCw size={15} /> Tạo mới
        </button>
        {reviewCount > 0 && (
          <button
            onClick={() => {
              const reviewCards = cards.filter((_, i) => statuses[i] === "review");
              setFlashcardSet(prev => prev ? { ...prev, cards: reviewCards } : null);
              setStatuses(new Array(reviewCards.length).fill("unseen"));
              setCurrent(0);
              setFlipped(false);
              setStage("study");
            }}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 transition-colors"
            style={{ background: "var(--primary)", color: "#fff", fontSize: 14, fontWeight: 500 }}
          >
            <RotateCcw size={15} /> Ôn lại
          </button>
        )}
        <button className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 transition-colors" style={{ background: "var(--muted)", fontSize: 14, color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
          <Download size={15} />
        </button>
      </div>
    </div>
  );
}

import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    BookOpen,
    CheckCircle,
    ChevronDown,
    Download,
    HelpCircle,
    Loader2,
    RefreshCw,
    Sparkles,
    Trophy,
    XCircle
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import {
    generateQuiz,
    QuizSet
} from "../services/api";
import { useApp } from "../context/AppContext";
import { trackQuizComplete } from "../services/activityTracker";


const DIFFICULTIES = [
  { value: "easy", label: "Dễ", color: "#10b981", bg: "#d1fae5" },
  { value: "medium", label: "Trung bình", color: "#f59e0b", bg: "#fef3c7" },
  { value: "hard", label: "Khó", color: "#ef4444", bg: "#fee2e2" },
];

type Stage = "config" | "quiz" | "results";

const QUIZ_STORAGE_KEY = "rag_quiz_session";

interface QuizSession {
  stage: Stage;
  quizSet: QuizSet | null;
  answers: (number | null)[];
  current: number;
  numQuestions: number;
  difficulty: string;
  savedDoc: string;
}

function loadQuizSession(): QuizSession {
  try {
    const raw = sessionStorage.getItem(QUIZ_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as QuizSession;
  } catch { /* ignore */ }
  return { stage: "config", quizSet: null, answers: [], current: 0, numQuestions: 5, difficulty: "medium", savedDoc: "" };
}

export function Quiz() {
  const { selectedDoc, setSelectedDoc, documentsList, refreshStats } = useApp();

  const initial = loadQuizSession();
  const [stage, setStage] = useState<Stage>(initial.stage);
  const [numQuestions, setNumQuestions] = useState(initial.numQuestions);
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [loading, setLoading] = useState(false);
  const [quizSet, setQuizSet] = useState<QuizSet | null>(initial.quizSet);
  const [current, setCurrent] = useState(initial.current);
  const [answers, setAnswers] = useState<(number | null)[]>(initial.answers);
  const [showExplanation, setShowExplanation] = useState(
    initial.answers[initial.current] !== null && initial.answers[initial.current] !== undefined
  );
  const [error, setError] = useState<string | null>(null);

  // Auto-save session to sessionStorage whenever key state changes
  useEffect(() => {
    const session: QuizSession = { stage, quizSet, answers, current, numQuestions, difficulty, savedDoc: selectedDoc };
    sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(session));
  }, [stage, quizSet, answers, current, numQuestions, difficulty, selectedDoc]);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(QUIZ_STORAGE_KEY);
    setStage("config");
    setQuizSet(null);
    setAnswers([]);
    setCurrent(0);
    setShowExplanation(false);
    setError(null);
  }, []);

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const result = await generateQuiz({
        document: selectedDoc !== "Tất cả tài liệu" ? selectedDoc : undefined,
        count: numQuestions,
      });
      setQuizSet(result);
      setAnswers(new Array(result.items.length).fill(null));
      setCurrent(0);
      setShowExplanation(false);
      setStage("quiz");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate quiz";
      setError(errorMessage);
      console.error("Error generating quiz:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (idx: number) => {
    if (answers[current] !== null) return;
    const next = [...answers];
    next[current] = idx;
    setAnswers(next);
    setShowExplanation(true);
  };

  const goNext = () => {
    if (!quizSet) return;
    if (current < quizSet.items.length - 1) {
      setCurrent(current + 1);
      setShowExplanation(answers[current + 1] !== null);
    } else {
      // Calculate score before switching stage
      const finalScore = answers.filter(
        (a, i) => a === quizSet.items[i]?.correct_index
      ).length;
      trackQuizComplete(
        finalScore,
        quizSet.items.length,
        selectedDoc !== "Tất cả tài liệu" ? selectedDoc : undefined,
      );
      refreshStats();
      setStage("results");
    }
  };

  const goPrev = () => {
    if (current > 0) {
      setCurrent(current - 1);
      setShowExplanation(answers[current - 1] !== null);
    }
  };

  const score =
    quizSet && answers.filter((a, i) => a === quizSet.items[i]?.correct_index).length;
  const pct =
    quizSet && quizSet.items.length > 0
      ? Math.round(((score || 0) / quizSet.items.length) * 100)
      : 0;

  const getScoreColor = () => {
    if (pct >= 80) return "#10b981";
    if (pct >= 60) return "#f59e0b";
    return "#ef4444";
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
            style={{
              width: 64,
              height: 64,
              background: "#fef3c7",
            }}
          >
            <HelpCircle size={28} color="#f59e0b" />
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--foreground)",
              marginBottom: 8,
            }}
          >
            Tạo bài kiểm tra
          </h2>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
            Cấu hình và AI sẽ tạo quiz từ tài liệu của bạn
          </p>
        </div>

        {/* Resume session banner */}
        {quizSet && stage === "config" && (
          <div
            className="rounded-2xl p-4 mb-4 flex items-center gap-3"
            style={{ background: "#ede9fe", border: "1px solid #c4b5fd" }}
          >
            <BookOpen size={18} color="#6366f1" />
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 600, color: "#4f46e5" }}>
                Bài quiz chưa hoàn thành
              </div>
              <div style={{ fontSize: 12, color: "#6366f1" }}>
                Câu {current + 1}/{quizSet.items.length} · {answers.filter(a => a !== null).length} đã trả lời
              </div>
            </div>
            <button
              onClick={() => setStage("quiz")}
              className="rounded-xl px-3 py-1.5 shrink-0"
              style={{ background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 500 }}
            >
              Tiếp tục →
            </button>
          </div>
        )}

        <div className="space-y-4">
          {/* Docs */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <label
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--foreground)",
                display: "block",
                marginBottom: 12,
              }}
            >
              Tài liệu nguồn
            </label>
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

          {/* Num questions */}
          <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <label style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Số câu hỏi</label>
              <span className="rounded-full px-3 py-1" style={{ fontSize: 14, fontWeight: 700, color: "#6366f1", background: "#ede9fe" }}>{numQuestions}</span>
            </div>
            <input
              type="range"
              min={3}
              max={20}
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: "#6366f1" }}
            />
            <div className="flex justify-between mt-1">
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>3</span>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>20</span>
            </div>
          </div>

          {/* Difficulty */}
          <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 12 }}>Độ khó</label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  className="rounded-xl py-2.5 transition-all"
                  style={{
                    fontSize: 14,
                    fontWeight: difficulty === d.value ? 600 : 400,
                    background: difficulty === d.value ? d.bg : "var(--muted)",
                    color: difficulty === d.value ? d.color : "var(--foreground)",
                    border: `1.5px solid ${difficulty === d.value ? d.color : "var(--border)"}`,
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {quizSet && (
              <button
                onClick={clearSession}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 transition-all"
                style={{
                  background: "var(--muted)",
                  color: "var(--foreground)",
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                <RefreshCw size={16} /> Tạo mới
              </button>
            )}
            <button
              onClick={generate}
              disabled={documentsList.length === 0 || loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 transition-all"
              style={{
                background: documentsList.length > 0 && !loading ? "var(--primary)" : "var(--muted)",
                color: documentsList.length > 0 && !loading ? "#fff" : "var(--muted-foreground)",
                fontSize: 15,
                fontWeight: 600,
                cursor: documentsList.length > 0 && !loading ? "pointer" : "not-allowed",
              }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {loading ? "Đang tạo quiz..." : "Tạo quiz ngay"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "quiz") {
    if (!quizSet || !quizSet.items[current]) return null;
    const q = quizSet.items[current];
    const userAnswer = answers[current];
    const isCorrect = userAnswer === q.correct_index;

    return (
      <div className="p-6 max-w-2xl mx-auto pt-8">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-6">
          <span
            style={{
              fontSize: 13,
              color: "var(--muted-foreground)",
              fontWeight: 500,
            }}
          >
            Câu {current + 1} / {quizSet.items.length}
          </span>
          <div
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: 6, background: "var(--muted)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((current + 1) / quizSet.items.length) * 100}%`,
                background: "var(--primary)",
              }}
            />
          </div>
          <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            {answers.filter((a) => a !== null).length} đã trả lời
          </span>
        </div>

        {/* Question */}
        <div
          className="rounded-2xl p-6 mb-4"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-start gap-3 mb-6">
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{ width: 32, height: 32, background: "#ede9fe" }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "#6366f1" }}>
                Q{current + 1}
              </span>
            </div>
            <p
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: "var(--foreground)",
                lineHeight: 1.6,
              }}
            >
              {q.question}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {q.options.map((opt, i) => {
              const isSelected = userAnswer === i;
              const isCorrectOpt = i === q.correct_index;
              const showResult = userAnswer !== null;

              let bg = "var(--muted)";
              let border = "var(--border)";
              let textColor = "var(--foreground)";

              if (showResult) {
                if (isCorrectOpt) {
                  bg = "#d1fae5";
                  border = "#10b981";
                  textColor = "#065f46";
                } else if (isSelected && !isCorrect) {
                  bg = "#fee2e2";
                  border = "#ef4444";
                  textColor = "#7f1d1d";
                }
              } else if (isSelected) {
                bg = "#ede9fe";
                border = "#6366f1";
                textColor = "#4f46e5";
              }

              return (
                <button
                  key={i}
                  onClick={() => selectAnswer(i)}
                  disabled={userAnswer !== null}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all"
                  style={{
                    background: bg,
                    border: `1.5px solid ${border}`,
                    cursor: userAnswer !== null ? "default" : "pointer",
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-full shrink-0"
                    style={{
                      width: 28,
                      height: 28,
                      background:
                        showResult && isCorrectOpt
                          ? "#10b981"
                          : showResult && isSelected && !isCorrect
                          ? "#ef4444"
                          : "var(--card)",
                      border: `1.5px solid ${border}`,
                    }}
                  >
                    {showResult && isCorrectOpt ? (
                      <CheckCircle size={14} color="#fff" />
                    ) : showResult && isSelected && !isCorrect ? (
                      <XCircle size={14} color="#fff" />
                    ) : (
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: textColor,
                        }}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      color: textColor,
                      fontWeight:
                        isSelected || (showResult && isCorrectOpt)
                          ? 500
                          : 400,
                    }}
                  >
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Explanation */}
        {showExplanation && (
          <div
            className="rounded-2xl p-5 mb-4"
            style={{
              background: isCorrect ? "#d1fae5" : "#fef3c7",
              border: `1px solid ${isCorrect ? "#6ee7b7" : "#fde68a"}`,
            }}
          >
            <div className="flex items-start gap-3">
              {isCorrect ? (
                <CheckCircle size={18} color="#10b981" />
              ) : (
                <AlertTriangle size={18} color="#f59e0b" />
              )}
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isCorrect ? "#065f46" : "#92400e",
                    marginBottom: 6,
                  }}
                >
                  {isCorrect
                    ? "Chính xác! 🎉"
                    : "Chưa đúng. Đáp án đúng là: " +
                    q.options[q.correct_index]}
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: isCorrect ? "#065f46" : "#92400e",
                    lineHeight: 1.6,
                  }}
                >
                  {q.explanation}
                </p>
                {q.source_markers && q.source_markers.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-3">
                    <BookOpen size={12} color="#6366f1" />
                    <span style={{ fontSize: 11, color: "#6366f1" }}>
                      {q.source_markers[0].filename} · trang{" "}
                      {q.source_markers[0].page}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={goPrev}
            disabled={current === 0}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 transition-colors"
            style={{ background: "var(--muted)", fontSize: 14, color: current === 0 ? "var(--muted-foreground)" : "var(--foreground)", cursor: current === 0 ? "not-allowed" : "pointer", border: "1px solid var(--border)" }}
          >
            <ArrowLeft size={15} /> Trước
          </button>
          <div className="flex-1 flex justify-center gap-1.5">
            {quizSet?.items.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrent(i);
                  setShowExplanation(answers[i] !== null);
                }}
                className="rounded-full transition-all"
                style={{
                  width: i === current ? 24 : 8,
                  height: 8,
                  background:
                    answers[i] !== null
                      ? answers[i] === quizSet?.items[i]?.correct_index
                        ? "#10b981"
                        : "#ef4444"
                      : i === current
                      ? "#6366f1"
                      : "var(--border)",
                }}
              />
            ))}
          </div>
          <button
            onClick={goNext}
            disabled={userAnswer === null}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 transition-colors"
            style={{
              background: userAnswer !== null ? "var(--primary)" : "var(--muted)",
              color:
                userAnswer !== null
                  ? "#fff"
                  : "var(--muted-foreground)",
              fontSize: 14,
              fontWeight: 500,
              cursor: userAnswer !== null ? "pointer" : "not-allowed",
            }}
          >
            {current === (quizSet?.items.length || 0) - 1
              ? "Xem kết quả"
              : "Tiếp"}{" "}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // Results
  return (
    <div className="p-6 max-w-2xl mx-auto pt-8">
      {/* Score card */}
      <div
        className="rounded-2xl p-8 text-center mb-6"
        style={{
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        }}
      >
        <Trophy size={40} color="#fbbf24" style={{ margin: "0 auto 16px" }} />
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1,
          }}
        >
          {pct}%
        </div>
        <div
          style={{
            fontSize: 16,
            color: "rgba(255,255,255,0.8)",
            marginTop: 8,
          }}
        >
          {score}/{quizSet?.items.length} câu đúng
        </div>
        <div
          className="inline-block rounded-full px-4 py-2 mt-4"
          style={{
            background: "rgba(255,255,255,0.2)",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
          }}
        >
          {pct >= 80
            ? "Xuất sắc! 🏆"
            : pct >= 60
            ? "Tốt! Cần ôn thêm 💪"
            : "Cần học thêm 📚"}
        </div>
      </div>

      {/* Review */}
      <div className="space-y-3 mb-6">
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", marginBottom: 12 }}>Xem lại câu trả lời</h3>
        {quizSet?.items.map((q, i) => {
          const correct = answers[i] === q.correct_index;
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: "var(--card)", border: `1.5px solid ${correct ? "#6ee7b7" : "#fca5a5"}` }}>
              <div className="flex items-start gap-3">
                {correct ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", marginBottom: 6 }}>
                    <span style={{ color: "var(--muted-foreground)" }}>Q{i + 1}.</span> {q.question}
                  </p>
                  {!correct && (
                    <div style={{ fontSize: 12, color: "#10b981" }}>
                      Đáp án đúng: {q.options[q.correct_index]}
                    </div>
                  )}
                  {answers[i] !== null && answers[i] !== q.correct_index && (
                    <div style={{ fontSize: 12, color: "#ef4444" }}>
                      Bạn chọn: {q.options[answers[i]!]}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => { setStage("config"); setAnswers([]); setCurrent(0); }}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 transition-colors"
          style={{ background: "var(--muted)", fontSize: 14, fontWeight: 500, color: "var(--foreground)", border: "1px solid var(--border)" }}
        >
          <RefreshCw size={15} /> Tạo quiz mới
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 transition-colors"
          style={{ background: "var(--primary)", color: "#fff", fontSize: 14, fontWeight: 500 }}
        >
          <Download size={15} /> Xuất kết quả
        </button>
      </div>
    </div>
  );
}

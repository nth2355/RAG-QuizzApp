// ============================================================================
// Activity Tracker — persists user activity stats to localStorage
// All writes are synchronous and atomic via JSON serialization
// ============================================================================

export type ActivityType =
  | "chat"
  | "upload"
  | "delete"
  | "quiz_complete"
  | "flashcard_session"
  | "summarize";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  timestamp: string; // ISO string
  detail: string;    // human-readable description
  docName?: string;  // associated document name (optional)
  meta?: Record<string, unknown>; // extra payload (e.g. score, count)
}

export interface DailyCount {
  date: string;  // "YYYY-MM-DD"
  questions: number;
  quizzes: number;
  flashcards: number;
}

interface StoredStats {
  totalQuestions: number;
  totalQuizzes: number;
  totalFlashcards: number;
  recentActivity: ActivityEvent[]; // max 50 entries, newest first
  dailyCounts: DailyCount[];       // max 30 days
}

const STORAGE_KEY = "rag_activity_stats";
const MAX_ACTIVITY = 50;
const MAX_DAYS = 30;

// ── helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function load(): StoredStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredStats;
  } catch {
    // corrupted — fall through to defaults
  }
  return {
    totalQuestions: 0,
    totalQuizzes: 0,
    totalFlashcards: 0,
    recentActivity: [],
    dailyCounts: [],
  };
}

function save(stats: StoredStats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    console.warn("ActivityTracker: localStorage write failed");
  }
}

function upsertDailyCount(
  counts: DailyCount[],
  field: "questions" | "quizzes" | "flashcards",
  delta: number,
): DailyCount[] {
  const d = today();
  const idx = counts.findIndex((c) => c.date === d);
  if (idx >= 0) {
    const updated = [...counts];
    updated[idx] = { ...updated[idx], [field]: updated[idx][field] + delta };
    return updated;
  }
  const newEntry: DailyCount = { date: d, questions: 0, quizzes: 0, flashcards: 0 };
  newEntry[field] = delta;
  return [...counts, newEntry].slice(-MAX_DAYS);
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── public API ────────────────────────────────────────────────────────────────

/** Record a user chat question */
export function trackQuestion(detail: string, docName?: string) {
  const stats = load();
  const event: ActivityEvent = {
    id: makeId(),
    type: "chat",
    timestamp: new Date().toISOString(),
    detail,
    docName,
  };
  stats.totalQuestions += 1;
  stats.dailyCounts = upsertDailyCount(stats.dailyCounts, "questions", 1);
  stats.recentActivity = [event, ...stats.recentActivity].slice(0, MAX_ACTIVITY);
  save(stats);
}

/** Record a completed quiz */
export function trackQuizComplete(
  score: number,
  total: number,
  docName?: string,
) {
  const stats = load();
  const event: ActivityEvent = {
    id: makeId(),
    type: "quiz_complete",
    timestamp: new Date().toISOString(),
    detail: `Hoàn thành quiz — ${score}/${total} câu đúng`,
    docName,
    meta: { score, total },
  };
  stats.totalQuizzes += 1;
  stats.dailyCounts = upsertDailyCount(stats.dailyCounts, "quizzes", 1);
  stats.recentActivity = [event, ...stats.recentActivity].slice(0, MAX_ACTIVITY);
  save(stats);
}

/** Record a flashcard study session */
export function trackFlashcardSession(count: number, docName?: string) {
  const stats = load();
  const event: ActivityEvent = {
    id: makeId(),
    type: "flashcard_session",
    timestamp: new Date().toISOString(),
    detail: `Ôn ${count} flashcard`,
    docName,
    meta: { count },
  };
  stats.totalFlashcards += count;
  stats.dailyCounts = upsertDailyCount(stats.dailyCounts, "flashcards", count);
  stats.recentActivity = [event, ...stats.recentActivity].slice(0, MAX_ACTIVITY);
  save(stats);
}

/** Record a document upload */
export function trackUpload(filename: string) {
  const stats = load();
  const event: ActivityEvent = {
    id: makeId(),
    type: "upload",
    timestamp: new Date().toISOString(),
    detail: `Upload tài liệu: ${filename}`,
    docName: filename,
  };
  stats.recentActivity = [event, ...stats.recentActivity].slice(0, MAX_ACTIVITY);
  save(stats);
}

/** Record a document delete */
export function trackDelete(filename: string) {
  const stats = load();
  const event: ActivityEvent = {
    id: makeId(),
    type: "delete",
    timestamp: new Date().toISOString(),
    detail: `Xóa tài liệu: ${filename}`,
    docName: filename,
  };
  stats.recentActivity = [event, ...stats.recentActivity].slice(0, MAX_ACTIVITY);
  save(stats);
}

/** Record a summarization */
export function trackSummarize(docName?: string) {
  const stats = load();
  const event: ActivityEvent = {
    id: makeId(),
    type: "summarize",
    timestamp: new Date().toISOString(),
    detail: `Tóm tắt tài liệu${docName ? `: ${docName}` : ""}`,
    docName,
  };
  stats.recentActivity = [event, ...stats.recentActivity].slice(0, MAX_ACTIVITY);
  save(stats);
}

/** Read all stats (non-mutating) */
export function getStats(): StoredStats {
  return load();
}

/**
 * Build last-7-days chart data aligned to Vietnamese day labels.
 * Returns array of { day, questions, quizzes, flashcards } for the past 7 days
 * (oldest → newest).
 */
export function getLast7DaysChart(): Array<{
  day: string;
  questions: number;
  quizzes: number;
  flashcards: number;
}> {
  const stats = load();
  const VN_DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = VN_DAYS[d.getDay()];
    const found = stats.dailyCounts.find((c) => c.date === dateStr);
    result.push({
      day: dayLabel,
      questions: found?.questions ?? 0,
      quizzes: found?.quizzes ?? 0,
      flashcards: found?.flashcards ?? 0,
    });
  }
  return result;
}

/** Format a timestamp as human-readable Vietnamese relative time */
export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;
  return `${Math.floor(days / 7)} tuần trước`;
}

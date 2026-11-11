const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export interface Citation {
  document_id?: string | null;
  source_index: number;
  source_marker: string;
  filename: string;
  page: number;
  section?: string | null;
  chunk_id?: string | null;
}

export interface RagAnswer {
  question: string;
  answer: string;
  citations: Citation[];
}

export interface Summary {
  scope: "query" | "document" | "filter" | "corpus";
  target?: string | null;
  summary: string;
  key_points: string[];
  citations: Citation[];
}

export interface QuizItem {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  source_markers: string[];
  difficulty?: string | null;
  topic?: string | null;
}

export interface QuizSet {
  id?: number;
  scope: "query" | "document" | "filter" | "corpus";
  target?: string | null;
  items: QuizItem[];
  citations: Citation[];
}

export interface Flashcard {
  front: string;
  back: string;
  hint?: string | null;
  topic?: string | null;
  source_markers: string[];
}

export interface FlashcardSet {
  id?: number;
  scope: "query" | "document" | "filter" | "corpus";
  target?: string | null;
  cards: Flashcard[];
  citations: Citation[];
}

export interface DocumentInfo {
  status?: "ready" | "indexed" | "processing" | "error" | "deleting";
  created_at?: string | null;
  document_id: string;
  filename: string;
  source?: string | null;
  size_bytes?: number | null;
}

export interface UploadResponse {
  filename: string;
  chunk_indexed: number;
}

export interface UserCreate {
  email: string;
  password: string;
  full_name: string;
  // role is intentionally omitted: the backend always assigns 'student' to new accounts.
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: "student" | "teacher";
  full_name: string;
}

interface FetchOptions extends RequestInit {
  timeout?: number;
  responseType?: "json" | "blob";
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {},
): Promise<{ json: () => Promise<any>; blob: () => Promise<Blob> }> {
  const { timeout = 30000, signal, responseType = "json", ...fetchOptions } = options;
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);
  const headers = new Headers(fetchOptions.headers || {});
  const token = localStorage.getItem("token");
  const isAuthRequest = /\/auth\/(login|register)$/.test(url);
  if (token && !isAuthRequest && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  try {
    const response = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
    if (response.ok && responseType === "blob") {
      const blob = await response.blob();
      return { blob: async () => blob, json: async () => null };
    }
    // Read the complete body before clearing the timer.
    const body = await response.text();
    let data: any = null;
    try { data = body ? JSON.parse(body) : null; } catch {
      if (response.ok) throw new ApiError("Máy chủ trả về dữ liệu JSON không hợp lệ.", response.status);
    }
    if (!response.ok) {
      if (response.status === 401 && token && !isAuthRequest) {
        for (const key of ["token", "role", "full_name"]) localStorage.removeItem(key);
        window.dispatchEvent(new Event("auth-expired"));
      }
      const detail = data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((e: { loc?: string[]; msg?: string }) => `${e.loc?.join(".") || "Dữ liệu"}: ${e.msg || "Không hợp lệ"}`).join("; ")
        : typeof detail === "string" ? detail : `HTTP ${response.status}: ${response.statusText}`;
      throw new ApiError(message, response.status);
    }
    return { json: async () => data, blob: async () => { throw new Error("Không phải phản hồi tệp."); } };
  } catch (error) {
    if (timedOut) throw new Error("Máy chủ xử lý quá lâu. Vui lòng kiểm tra trước khi thử lại.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abort);
  }
}

export async function registerUser(
  data: UserCreate,
): Promise<{ message: string; user_id: number }> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function loginUser(
  credentials: UserLogin,
): Promise<TokenResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  return response.json();
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/documents`, {
    method: "GET",
  });
  return response.json();
}

export async function getDocumentPdf(documentId: string, download = false): Promise<Blob> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/document-ids/${encodeURIComponent(documentId)}/file?download=${download}`,
    { responseType: "blob", timeout: 120000 },
  );
  return response.blob();
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetchWithTimeout(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
    timeout: 600000,
  });
  return response.json();
}

export async function deleteDocument(documentId: string): Promise<{ status: string; message: string }> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/document-ids/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE",
    },
  );
  return response.json();
}

export interface AskRequest {
  question: string;
  k?: number;
  filters?: { filename?: string };
}

export async function askQuestion(request: AskRequest): Promise<RagAnswer> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    timeout: 120000,
  });
  return response.json();
}

export interface SummarizeRequest {
  length?: "short" | "medium" | "long";
  focus?: string;
  instructions?: string;
  document?: string;
  query?: string;
  filters?: { filename?: string };
  k?: number;
}

export async function summarizeDocument(
  request: SummarizeRequest,
): Promise<Summary> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    timeout: 300000,
  });
  return response.json();
}

export interface QuizRequest {
  difficulty?: "easy" | "medium" | "hard";
  document?: string;
  query?: string;
  filters?: { filename?: string };
  count?: number;
  k?: number;
}

export async function generateQuiz(request: QuizRequest): Promise<QuizSet> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    timeout: 300000,
  });
  return response.json();
}

export interface FlashcardsRequest {
  document?: string;
  query?: string;
  filters?: { filename?: string };
  count?: number;
  k?: number;
}

export async function generateFlashcards(
  request: FlashcardsRequest,
): Promise<FlashcardSet> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/flashcards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    timeout: 300000,
  });
  return response.json();
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/health`, {
      method: "GET",
      timeout: 5000,
    });
    const data = await response.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

export interface ActivityEvent {
  id: string;
  type:
    | "chat"
    | "upload"
    | "delete"
    | "quiz_complete"
    | "flashcard_session"
    | "summarize";
  timestamp: string;
  detail: string;
  docName?: string;
  meta?: Record<string, any>;
}

export interface DashboardStats {
  totalQuestions: number;
  totalQuizzes: number;
  totalFlashcards: number;
  recentActivity: ActivityEvent[];
  chartData: Array<{
    day: string;
    questions: number;
    quizzes: number;
    flashcards: number;
  }>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/stats`, {
    method: "GET",
  });
  return response.json();
}

export async function submitQuizScore(
  quizId: number,
  answers: Array<number | null>,
): Promise<{ status: string; score: number }> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/quiz/${quizId}/score`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    },
  );
  return response.json();
}

export async function completeFlashcardSession(setId: number): Promise<{ status: string }> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/flashcards/${setId}/complete`, { method: "POST" });
  return response.json();
}

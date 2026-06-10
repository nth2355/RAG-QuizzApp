// API Service Layer - Centralized fetch calls to FastAPI backend
// Using native fetch with proper error handling, loading states, and type safety

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ============================================================================
// Type Definitions (match RAG_quizz/src/schemas.py)
// ============================================================================

export interface Citation {
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
  scope: "query" | "document" | "filter" | "corpus";
  target?: string | null;
  cards: Flashcard[];
  citations: Citation[];
}

export interface DocumentInfo {
  document_id: string;
  filename: string;
  source?: string | null;
  size_bytes?: number | null;
}

export interface UploadResponse {
  filename: string;
  chunk_indexed: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

interface FetchOptions extends RequestInit {
  timeout?: number;
}

async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout - server took too long to respond");
    }
    throw error;
  }
}

// ============================================================================
// API Functions - Documents Management
// ============================================================================

export async function listDocuments(): Promise<DocumentInfo[]> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/documents`, {
    method: "GET",
  });
  return response.json();
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetchWithTimeout(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
    timeout: 600000, // 10 minutes for large PDFs
  });
  return response.json();
}

export async function deleteDocument(filename: string): Promise<any> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/documents/${encodeURIComponent(filename)}`,
    {
      method: "DELETE",
    },
  );
  return response.json();
}

// ============================================================================
// API Functions - RAG Operations
// ============================================================================

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
    timeout: 120000, // 2 minutes for LLM inference
  });
  return response.json();
}

export interface SummarizeRequest {
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
    timeout: 300000, // 5 minutes for summarization
  });
  return response.json();
}

export interface QuizRequest {
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
    timeout: 300000, // 5 minutes for quiz generation
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
    timeout: 300000, // 5 minutes for flashcard generation
  });
  return response.json();
}

// ============================================================================
// Health Check
// ============================================================================

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

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { DocumentInfo, listDocuments } from "../services/api";
import {
  getStats,
  getLast7DaysChart,
  type ActivityEvent,
  type DailyCount,
} from "../services/activityTracker";

export interface Citation {
  source_marker: string;
  filename: string;
  page: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: string; // ISO string to allow storage serialization
}

export interface DashboardStats {
  totalQuestions: number;
  totalQuizzes: number;
  totalFlashcards: number;
  recentActivity: ActivityEvent[];
  chartData: Array<{ day: string; questions: number; quizzes: number; flashcards: number }>;
}

interface AppContextType {
  selectedDoc: string;
  setSelectedDoc: (doc: string) => void;
  documentsList: DocumentInfo[];
  loadingDocuments: boolean;
  refreshDocuments: () => Promise<void>;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  // Dashboard stats
  stats: DashboardStats;
  refreshStats: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [selectedDoc, setSelectedDocState] = useState<string>(() => {
    return sessionStorage.getItem("rag_selected_doc") || "Tất cả tài liệu";
  });
  const [documentsList, setDocumentsList] = useState<DocumentInfo[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    const stored = sessionStorage.getItem("rag_chat_history");
    return stored ? JSON.parse(stored) : [];
  });
  const [stats, setStats] = useState<DashboardStats>(() => {
    const s = getStats();
    return {
      totalQuestions: s.totalQuestions,
      totalQuizzes: s.totalQuizzes,
      totalFlashcards: s.totalFlashcards,
      recentActivity: s.recentActivity,
      chartData: getLast7DaysChart(),
    };
  });

  const setSelectedDoc = (doc: string) => {
    setSelectedDocState(doc);
    sessionStorage.setItem("rag_selected_doc", doc);
  };

  useEffect(() => {
    sessionStorage.setItem("rag_chat_history", JSON.stringify(chatHistory));
  }, [chatHistory]);

  const refreshDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const docs = await listDocuments();
      setDocumentsList(docs);
    } catch (err) {
      console.error("Error refreshing documents in Context:", err);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const refreshStats = useCallback(() => {
    const s = getStats();
    setStats({
      totalQuestions: s.totalQuestions,
      totalQuizzes: s.totalQuizzes,
      totalFlashcards: s.totalFlashcards,
      recentActivity: s.recentActivity,
      chartData: getLast7DaysChart(),
    });
  }, []);

  useEffect(() => {
    refreshDocuments();
  }, []);

  return (
    <AppContext.Provider
      value={{
        selectedDoc,
        setSelectedDoc,
        documentsList,
        loadingDocuments,
        refreshDocuments,
        chatHistory,
        setChatHistory,
        stats,
        refreshStats,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppContextProvider");
  }
  return context;
}

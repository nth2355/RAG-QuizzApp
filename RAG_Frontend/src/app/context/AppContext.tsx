import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getLast7DaysChart,
  getStats,
  type ActivityEvent
} from "../services/activityTracker";
import { DocumentInfo, listDocuments } from "../services/api";

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
  timestamp: string;
}

export interface DashboardStats {
  totalQuestions: number;
  totalQuizzes: number;
  totalFlashcards: number;
  recentActivity: ActivityEvent[];
  chartData: Array<{ day: string; questions: number; quizzes: number; flashcards: number }>;
}

interface UserState {
  full_name: string;
  role: "student" | "teacher";
}

interface AppContextType {
  selectedDoc: string;
  setSelectedDoc: (doc: string) => void;
  documentsList: DocumentInfo[];
  loadingDocuments: boolean;
  refreshDocuments: () => Promise<void>;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  stats: DashboardStats;
  refreshStats: () => void;

  user: UserState | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, role: "student" | "teacher", name: string) => void;
  logout: () => void;
  authLoading: boolean;
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


  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<UserState | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);


  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role") as "student" | "teacher";
    const storedName = localStorage.getItem("full_name");

    if (storedToken && storedRole && storedName) {
      setToken(storedToken);
      setUser({ full_name: storedName, role: storedRole });
    }
    setAuthLoading(false);
  }, []);


  const login = (jwtToken: string, role: "student" | "teacher", name: string) => {
    localStorage.setItem("token", jwtToken);
    localStorage.setItem("role", role);
    localStorage.setItem("full_name", name);
    setToken(jwtToken);
    setUser({ full_name: name, role: role });
  };

  const logout = () => {
    localStorage.clear();
    sessionStorage.clear();
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  const setSelectedDoc = (doc: string) => {
    setSelectedDocState(doc);
    sessionStorage.setItem("rag_selected_doc", doc);
  };

  useEffect(() => {
    sessionStorage.setItem("rag_chat_history", JSON.stringify(chatHistory));
  }, [chatHistory]);

  const refreshDocuments = async () => {
    if (!localStorage.getItem("token")) return;
    
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
    if (token) {
      refreshDocuments();
    }
  }, [token]);

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
        user,
        token,
        isAuthenticated: !!token,
        login,
        logout,
        authLoading,
      }}
    >
      {!authLoading && children}
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
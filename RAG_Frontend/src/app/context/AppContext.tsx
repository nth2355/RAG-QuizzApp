import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DocumentInfo, listDocuments, getDashboardStats, DashboardStats, ActivityEvent } from "../services/api";

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
  const [stats, setStats] = useState<DashboardStats>({
    totalQuestions: 0,
    totalQuizzes: 0,
    totalFlashcards: 0,
    recentActivity: [],
    chartData: [],
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

  const refreshStats = useCallback(async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const s = await getDashboardStats();
      setStats(s);
    } catch (err) {
      console.error("Error refreshing stats from backend:", err);
    }
  }, []);

  useEffect(() => {
    if (token) {
      refreshDocuments();
      refreshStats();
    }
  }, [token, refreshStats]);

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
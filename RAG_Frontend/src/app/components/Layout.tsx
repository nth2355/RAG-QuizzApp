import {
  AlignLeft,
  Bell,
  Brain,
  ChevronRight,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Search,
  User
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useApp } from "../context/AppContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/documents", label: "Tài liệu", icon: FileText },
  { to: "/chat", label: "Chat AI", icon: MessageSquare },
  { to: "/summarize", label: "Tóm tắt", icon: AlignLeft },
  { to: "/quiz", label: "Kiểm tra", icon: HelpCircle },
  { to: "/flashcards", label: "Flashcard", icon: CreditCard },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/documents": "Quản lý tài liệu",
  "/chat": "Chat với AI",
  "/summarize": "Tóm tắt tài liệu",
  "/quiz": "Bài kiểm tra",
  "/flashcards": "Flashcard",
};

export function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pageTitle = pageTitles[location.pathname] ?? "RAG Quiz";
  const { selectedDoc, setSelectedDoc, documentsList } = useApp();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className="flex flex-col shrink-0 transition-all duration-300"
        style={{
          width: sidebarOpen ? 240 : 72,
          background: "var(--sidebar)",
          borderRight: "1px solid var(--sidebar-border)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 shrink-0" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{ width: 40, height: 40, background: "var(--primary)" }}
          >
            <Brain size={20} color="#fff" />
          </div>
          {sidebarOpen && (
            <div>
              <div className="text-white" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>
                RAG Quiz
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                AI Learning Platform
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 8px 8px", display: sidebarOpen ? "block" : "none" }}>
            Chức năng
          </div>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg mb-1 transition-all duration-150 ${isActive ? "nav-active" : "nav-inactive"}`
              }
              style={({ isActive }) => ({
                padding: sidebarOpen ? "10px 12px" : "10px",
                justifyContent: sidebarOpen ? "flex-start" : "center",
                background: isActive ? "var(--sidebar-primary)" : "transparent",
                color: isActive ? "#fff" : "var(--sidebar-foreground)",
              })}
              title={!sidebarOpen ? label : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} style={{ opacity: isActive ? 1 : 0.75, shrink: 0 }} />
                  {sidebarOpen && (
                    <span style={{ fontSize: 14, fontWeight: isActive ? 500 : 400 }}>{label}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Global Document Selector & Metric */}
        {sidebarOpen && (
          <div className="px-3 pb-4 space-y-2" style={{ borderTop: "1px solid var(--sidebar-border)", paddingTop: "12px" }}>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 4px" }}>
              Phạm vi học tập
            </div>
            <select
              value={selectedDoc}
              onChange={(e) => setSelectedDoc(e.target.value)}
              className="w-full bg-[#1e293b] border border-slate-700 text-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
            >
              <option value="Tất cả tài liệu">📚 Tất cả tài liệu</option>
              {documentsList.map((doc) => (
                <option key={doc.document_id} value={doc.filename}>
                  📄 {doc.filename.replace(".pdf", "")}
                </option>
              ))}
            </select>
            <div className="px-1 flex items-center justify-between text-slate-400" style={{ fontSize: 11 }}>
              <span>Tổng số tài liệu:</span>
              <span style={{ fontWeight: 600, color: "#818cf8" }}>{documentsList.length}</span>
            </div>
          </div>
        )}

        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center py-3 transition-colors"
          style={{ borderTop: "1px solid var(--sidebar-border)", color: "#475569" }}
        >
          <ChevronRight size={16} style={{ transform: sidebarOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }} />
        </button>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="flex items-center gap-4 px-6 shrink-0"
          style={{ height: 60, borderBottom: "1px solid var(--border)", background: "var(--card)" }}
        >
          <div className="flex-1 flex items-center gap-3">
            <h1 style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)" }}>{pageTitle}</h1>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              (Nguồn: <span style={{ fontWeight: 600, color: "var(--primary)" }}>{selectedDoc}</span>)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-text"
              style={{ background: "var(--muted)", width: 200 }}
            >
              <Search size={14} color="var(--muted-foreground)" />
              <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Tìm kiếm...</span>
            </div>
            <button
              className="relative flex items-center justify-center rounded-lg transition-colors"
              style={{ width: 36, height: 36, background: "var(--muted)" }}
            >
              <Bell size={16} color="var(--muted-foreground)" />
              <span
                className="absolute top-1 right-1 rounded-full"
                style={{ width: 6, height: 6, background: "var(--primary)" }}
              />
            </button>
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 cursor-pointer transition-colors"
              style={{ background: "var(--muted)" }}
            >
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 24, height: 24, background: "var(--primary)" }}
              >
                <User size={12} color="#fff" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>Học viên</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: "var(--background)" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}


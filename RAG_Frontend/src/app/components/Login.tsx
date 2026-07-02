import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { loginUser } from "../services/api";

export function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // 1. Gọi API login xuống FastAPI Backend thông qua api.ts
      const data = await loginUser({ email, password });
      
      // 2. Kích hoạt lưu trạng thái đăng nhập toàn cục vào AppContext & localStorage
      login(data.access_token, data.role, data.full_name);
      
      // 3. Phân quyền điều hướng trang dựa theo vai trò (Role) từ Backend trả về
      if (data.role === "teacher") {
        window.location.href = "/dashboard"; // Trang quản trị tài liệu/đề thi của giáo viên
      } else {
        window.location.href = "/quiz";      // Trang làm bài thi/chat trợ lý của học sinh
      }
    } catch (err: any) {
      // Bắt lỗi chi tiết từ Backend (ví dụ: "Email hoặc mật khẩu không chính xác")
      setError(err.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)] px-4">
      <div className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Đăng Nhập</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Hệ thống số hóa đề thi thông minh & RAG
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)] border border-[var(--destructive)]/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-weight-medium">Email trường học</label>
            <input
              type="email"
              required
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="name@university.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-weight-medium">Mật khẩu</label>
            <input
              type="password"
              required
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-[var(--primary)] py-2.5 text-sm font-weight-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {isSubmitting ? "Đang xác thực..." : "Đăng Nhập"}
          </button>
        </form>

        <div className="text-center mt-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            Chưa có tài khoản?{" "}
            <a href="/register" className="text-[var(--foreground)] font-weight-medium hover:underline">
              Đăng ký vai trò mới
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
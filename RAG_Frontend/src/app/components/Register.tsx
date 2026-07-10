import React, { useState } from "react";
import { registerUser } from "../services/api";

export function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      // 1. Gọi API đăng ký xuống FastAPI Backend
      await registerUser({
        email,
        password,
        full_name: fullName,
        role: role,
      });

      setSuccess("Đăng ký tài khoản thành công! Đang chuyển hướng...");

      // 2. Chuyển hướng người dùng sang trang Login sau 2 giây để họ đăng nhập
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)] px-4">
      <div className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Tạo Tài Khoản</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Đăng ký tham gia hệ thống quản lý đề thi & RAG
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)] border border-[var(--destructive)]/20">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-600 border border-green-500/20">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-weight-medium">Họ và tên</label>
            <input
              type="text"
              required
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

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
            <label className="text-sm font-weight-medium">Mật khẩu (Tối thiểu 6 ký tự)</label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-weight-medium">Vai trò của bạn</label>
            <select
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              value={role}
              onChange={(e) => setRole(e.target.value as "student" | "teacher")}
            >
              <option value="student">Học sinh / Sinh viên</option>
              <option value="teacher">Giáo viên / Giảng viên</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-[var(--primary)] py-2.5 text-sm font-weight-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {isSubmitting ? "Đang xử lý..." : "Đăng Ký"}
          </button>
        </form>

        <div className="text-center mt-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            Đã có tài khoản?{" "}
            <a href="/login" className="text-[var(--foreground)] font-weight-medium hover:underline">
              Đăng nhập ngay
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
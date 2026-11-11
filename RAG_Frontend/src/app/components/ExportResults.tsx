import { useState } from "react";
import { Download } from "lucide-react";
import { downloadResult, type ExportResult, type ExportFormat } from "../services/exportResults";

export function ExportResults({ result }: { result: ExportResult }) {
  const [format, setFormat] = useState<ExportFormat>("md");
  const [error, setError] = useState<string | null>(null);
  return <div className="flex flex-wrap items-center gap-2">
    <select aria-label="Định dạng xuất kết quả" value={format} onChange={event => setFormat(event.target.value as ExportFormat)} className="rounded-lg border p-2 text-sm" style={{ background: "var(--card)", color: "var(--foreground)" }}>
      <option value="md">Markdown (.md)</option>
      <option value="json">JSON (.json)</option>
      {result.kind === "flashcards" && <option value="csv">CSV (.csv)</option>}
    </select>
    <button type="button" onClick={() => {
      setError(null);
      try { downloadResult(result, format); }
      catch (err) { setError(err instanceof Error ? err.message : "Không thể xuất kết quả."); }
    }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: "var(--primary)", color: "#fff" }}>
      <Download size={15} /> Xuất kết quả
    </button>
    {error && <span role="alert" className="text-sm text-red-600">{error}</span>}
  </div>;
}

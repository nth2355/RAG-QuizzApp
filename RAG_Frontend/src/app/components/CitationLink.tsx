import { useEffect, useRef, useState } from "react";
import { getDocumentPdf } from "../services/api";
import { useApp } from "../context/AppContext";

export function CitationLink({ citation }: { citation: { document_id?: string | null; filename: string; page: number; source_marker?: string } }) {
  const { documentsList } = useApp();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!url) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setUrl(null); };
    window.addEventListener("keydown", escape);
    return () => { URL.revokeObjectURL(url); window.removeEventListener("keydown", escape); };
  }, [url]);
  const open = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const matches = documentsList.filter(doc => doc.filename === citation.filename);
      const id = citation.document_id || (matches.length === 1 ? matches[0].document_id : null);
      if (!id) throw new Error("Không tìm thấy tài liệu nguồn. Tài liệu có thể đã bị xóa.");
      const blob = await getDocumentPdf(id);
      if (mounted.current) setUrl(URL.createObjectURL(blob));
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Không thể mở nguồn.");
    } finally {
      busy.current = false;
      if (mounted.current) setLoading(false);
    }
  };
  const page = Number.isInteger(citation.page) && citation.page > 0 ? citation.page : 1;
  return <>
    <button type="button" onClick={open} disabled={loading} className="rounded-lg px-2 py-1 text-left text-xs underline" style={{ color: "var(--primary)" }} aria-label={`Mở ${citation.filename}, trang ${page}`}>
      {loading ? "Đang mở nguồn..." : `${citation.source_marker ? `[${citation.source_marker}] ` : ""}${citation.filename} · tr.${page}`}
    </button>
    {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    {url && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setUrl(null)}>
      <div role="dialog" aria-modal="true" aria-label={`Nguồn: ${citation.filename}`} className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl" style={{ background: "var(--card)" }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-3 text-sm">
          <span className="truncate">{citation.filename} · trang {page}</span>
          <div className="flex shrink-0 gap-4">
            <a href={url} download={citation.filename}>Tải xuống</a>
            <button autoFocus onClick={() => setUrl(null)} aria-label="Đóng nguồn PDF">Đóng</button>
          </div>
        </div>
        <iframe title={`Nguồn ${citation.filename}, trang ${page}`} src={`${url}#page=${page}`} className="w-full flex-1 border-0" />
      </div>
    </div>}
  </>;
}

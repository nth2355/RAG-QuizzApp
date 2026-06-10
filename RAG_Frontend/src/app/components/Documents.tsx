import { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  Eye,
  X,
  Plus,
  AlertTriangle,
} from "lucide-react";
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  DocumentInfo,
} from "../services/api";
import { useApp } from "../context/AppContext";
import { trackUpload, trackDelete } from "../services/activityTracker";

interface Document extends DocumentInfo {
  selected: boolean;
  displaySize: string;
  displayPages: number;
  uploadedAt: string;
  status: "ready" | "processing" | "error";
}

const statusIcon = {
  ready: <CheckCircle size={14} color="#10b981" />,
  processing: <Clock size={14} color="#f59e0b" />,
  error: <AlertCircle size={14} color="#ef4444" />,
};

const statusLabel = {
  ready: "Sẵn sàng",
  processing: "Đang xử lý",
  error: "Lỗi",
};

const statusColor = {
  ready: { color: "#10b981", bg: "#d1fae5" },
  processing: { color: "#f59e0b", bg: "#fef3c7" },
  error: { color: "#ef4444", bg: "#fee2e2" },
};

export function Documents() {
  const { refreshDocuments, refreshStats } = useApp();
  const [docs, setDocs] = useState<Document[]>([]);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const apiDocs = await listDocuments();
      const docs: Document[] = apiDocs.map((doc) => ({
        ...doc,
        selected: false,
        displaySize: doc.size_bytes
          ? `${(doc.size_bytes / 1024 / 1024).toFixed(1)} MB`
          : "Unknown",
        displayPages: 0,
        uploadedAt: new Date().toLocaleDateString("vi-VN"),
        status: "ready" as const,
      }));
      setDocs(docs);
      refreshDocuments();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load documents"
      );
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = docs.filter((d) =>
    d.filename.toLowerCase().includes(search.toLowerCase())
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );
    addFiles(files);
  };

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadError(null);

    for (const file of files) {
      try {
        await uploadDocument(file);
        trackUpload(file.name);
        refreshStats();
        // Reload documents after successful upload
        await loadDocuments();
      } catch (err) {
        setUploadError(
          err instanceof Error
            ? err.message
            : "Failed to upload document"
        );
        console.error("Error uploading document:", err);
      }
    }

    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    const docToDelete = docs.find((d) => d.document_id === id);
    if (!docToDelete) return;

    try {
      await deleteDocument(docToDelete.filename);
      trackDelete(docToDelete.filename);
      refreshStats();
      await loadDocuments();
      setDeleteTarget(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete document"
      );
      console.error("Error deleting document:", err);
    }
  };

  const toggleSelect = (id: string) => {
    setDocs((prev) =>
      prev.map((d) =>
        d.document_id === id ? { ...d, selected: !d.selected } : d
      )
    );
  };

  const selectedCount = docs.filter((d) => d.selected).length;

  return (
    <div className="p-6">
      {/* Error alerts */}
      {error && (
        <div
          className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
          style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}
        >
          <AlertTriangle size={18} color="#ef4444" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#7f1d1d" }}>
              Error
            </div>
            <div style={{ fontSize: 12, color: "#991b1b" }}>{error}</div>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto"
            style={{ color: "#7f1d1d" }}
          >
            ×
          </button>
        </div>
      )}

      {uploadError && (
        <div
          className="rounded-2xl px-4 py-3 mb-4 flex items-center gap-3"
          style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}
        >
          <AlertTriangle size={18} color="#ef4444" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#7f1d1d" }}>
              Upload Error
            </div>
            <div style={{ fontSize: 12, color: "#991b1b" }}>{uploadError}</div>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="ml-auto"
            style={{ color: "#7f1d1d" }}
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            {docs.length} tài liệu · {docs.filter((d) => d.status === "ready").length} sẵn sàng
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-xl px-4 py-2 transition-all"
          style={{
            background: uploading ? "var(--muted)" : "var(--primary)",
            color: uploading ? "var(--muted-foreground)" : "#fff",
            fontSize: 14,
            fontWeight: 500,
            cursor: uploading ? "not-allowed" : "pointer",
          }}
        >
          <Plus size={16} /> {uploading ? "Uploading..." : "Upload PDF"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          multiple
          disabled={uploading}
          className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all mb-6"
        style={{
          border: `2px dashed ${dragging ? "#6366f1" : "var(--border)"}`,
          background: dragging ? "#ede9fe" : "var(--card)",
          padding: "36px 24px",
          pointerEvents: uploading ? "none" : "auto",
          opacity: uploading ? 0.6 : 1,
        }}
      >
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{ width: 56, height: 56, background: "#ede9fe" }}
        >
          <Upload size={24} color="#6366f1" />
        </div>
        <div className="text-center">
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
            {dragging ? "Thả file PDF vào đây" : "Kéo & thả file PDF"}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
            hoặc click để chọn file · Hỗ trợ nhiều file · Tối đa 50MB/file
          </div>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <Search size={15} color="var(--muted-foreground)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm tài liệu..."
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 14, color: "var(--foreground)" }}
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X size={14} color="var(--muted-foreground)" />
            </button>
          )}
        </div>
        <button
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            fontSize: 13,
            color: "var(--muted-foreground)",
          }}
        >
          <Filter size={15} /> Lọc
        </button>
      </div>

      {/* Bulk actions */}
      {selectedCount > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4"
          style={{ background: "#ede9fe", border: "1px solid #c4b5fd" }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: "#4f46e5" }}>
            {selectedCount} tài liệu được chọn
          </span>
          <button
            onClick={() => {
              const selectedIds = docs
                .filter((d) => d.selected)
                .map((d) => d.document_id);
              setDocs((prev) =>
                prev.filter((d) => !selectedIds.includes(d.document_id))
              );
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
            style={{ background: "#ef4444", color: "#fff", fontSize: 13 }}
          >
            <Trash2 size={13} /> Xóa đã chọn
          </button>
          <button
            onClick={() => setDocs((prev) => prev.map((d) => ({ ...d, selected: false })))}
            style={{ fontSize: 13, color: "#6366f1", marginLeft: "auto" }}
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error ? (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div style={{ padding: "48px", textAlign: "center", color: "var(--muted-foreground)" }}>
            Loading documents...
          </div>
        </div>
      ) : (
        <>
          {/* Document table */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: "var(--muted)",
                  }}
                >
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      fontWeight: 500,
                    }}
                  >
                    <input
                      type="checkbox"
                      onChange={(e) =>
                        setDocs((prev) =>
                          prev.map((d) => ({ ...d, selected: e.target.checked }))
                        )
                      }
                    />
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      fontWeight: 500,
                    }}
                  >
                    Tên tài liệu
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      fontWeight: 500,
                    }}
                  >
                    Kích thước
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      fontWeight: 500,
                    }}
                  >
                    Ngày upload
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      fontWeight: 500,
                    }}
                  >
                    Trạng thái
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "right",
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      fontWeight: 500,
                    }}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr
                    key={doc.document_id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: doc.selected ? "#f5f3ff" : "transparent",
                      transition: "background 0.15s",
                    }}
                    className="hover:bg-muted/30"
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <input
                        type="checkbox"
                        checked={doc.selected}
                        onChange={() => toggleSelect(doc.document_id)}
                      />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex items-center justify-center rounded-lg shrink-0"
                          style={{ width: 34, height: 34, background: "#ede9fe" }}
                        >
                          <FileText size={16} color="#6366f1" />
                        </div>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--foreground)",
                          }}
                        >
                          {doc.filename}
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: 13,
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {doc.displaySize}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: 13,
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {doc.uploadedAt}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        className="flex items-center gap-1.5 w-fit rounded-full px-2.5 py-1"
                        style={{
                          fontSize: 12,
                          color: doc.status === "ready" ? "#10b981" : "#f59e0b",
                          background:
                            doc.status === "ready" ? "#d1fae5" : "#fef3c7",
                        }}
                      >
                        {doc.status === "ready" ? (
                          <CheckCircle size={14} />
                        ) : (
                          <Clock size={14} />
                        )}
                        {doc.status === "ready" ? "Sẵn sàng" : "Đang xử lý"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 rounded-lg transition-colors hover:bg-muted"
                          title="Xem"
                        >
                          <Eye size={15} color="var(--muted-foreground)" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg transition-colors hover:bg-muted"
                          title="Tải xuống"
                        >
                          <Download size={15} color="var(--muted-foreground)" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(doc.document_id)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                          title="Xóa"
                        >
                          <Trash2 size={15} color="#ef4444" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: "48px",
                        textAlign: "center",
                        color: "var(--muted-foreground)",
                        fontSize: 14,
                      }}
                    >
                      {docs.length === 0
                        ? "No documents yet. Upload one to get started."
                        : "No documents found matching your search."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-center mb-4"
              style={{ width: 48, height: 48, background: "#fee2e2", borderRadius: 12 }}
            >
              <Trash2 size={22} color="#ef4444" />
            </div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--foreground)",
                marginBottom: 8,
              }}
            >
              Xóa tài liệu?
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "var(--muted-foreground)",
                marginBottom: 20,
              }}
            >
              Hành động này không thể hoàn tác. Tài liệu sẽ bị xóa vĩnh viễn khỏi kho kiến thức.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl py-2.5 transition-colors"
                style={{
                  background: "var(--muted)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--foreground)",
                }}
              >
                Hủy
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="flex-1 rounded-xl py-2.5 transition-colors"
                style={{ background: "#ef4444", color: "#fff", fontSize: 14, fontWeight: 500 }}
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

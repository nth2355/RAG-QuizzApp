import type { Citation, Summary, QuizSet, FlashcardSet } from "./api";

export type ExportResult =
  | { kind: "summary"; data: Summary }
  | { kind: "quiz"; data: QuizSet; answers: Array<number | null> }
  | { kind: "flashcards"; data: FlashcardSet; statuses: string[] };
export type ExportFormat = "md" | "json" | "csv";

function sources(citations: Citation[]) {
  return citations.length ? "\n\n## Nguồn tham chiếu\n" + citations.map(c => `- [${c.source_marker}] ${c.filename} — trang ${c.page}`).join("\n") : "";
}

function csvCell(value: string) {
  // Keep spreadsheet applications from interpreting card text as formulas.
  const safe = /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function serializeResult(result: ExportResult, format: ExportFormat): string {
  if (format === "json") {
    const { data, ...details } = result;
    return JSON.stringify({ ...details, ...data }, null, 2) + "\n";
  }
  if (format === "csv") {
    if (result.kind !== "flashcards") throw new Error("CSV chỉ hỗ trợ flashcard.");
    const rows = [["Front", "Back", "Hint", "Topic", "Status", "Sources"], ...result.data.cards.map((c, i) => [
      c.front, c.back, c.hint || "", c.topic || "", result.statuses[i] || "unseen",
      result.data.citations.filter(s => c.source_markers.includes(s.source_marker)).map(s => `${s.filename} (trang ${s.page})`).join("; "),
    ])];
    return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }
  if (result.kind === "summary") {
    return `# Tóm tắt\n\n${result.data.summary}\n\n## Ý chính\n${result.data.key_points.map(p => `- ${p}`).join("\n")}${sources(result.data.citations)}\n`;
  }
  if (result.kind === "quiz") {
    const score = result.data.items.filter((q, i) => result.answers[i] === q.correct_index).length;
    return `# Kết quả quiz\n\nĐiểm: ${score}/${result.data.items.length}\n\n` + result.data.items.map((q, i) => {
      const answer = result.answers[i];
      return `## Câu ${i + 1}: ${q.question}\n\n${q.options.map((o, j) => `${j + 1}. ${o}`).join("\n")}\n\nBạn chọn: ${answer == null ? "Chưa trả lời" : q.options[answer]}\n\nĐáp án đúng: ${q.options[q.correct_index]}\n\nGiải thích: ${q.explanation}\n\nNguồn: ${q.source_markers.join(", ")}`;
    }).join("\n\n") + sources(result.data.citations) + "\n";
  }
  return "# Flashcard\n\n" + result.data.cards.map((c, i) => `## Thẻ ${i + 1}: ${c.front}\n\n${c.back}\n\nGợi ý: ${c.hint || "—"}\n\nChủ đề: ${c.topic || "—"}\n\nTrạng thái: ${{ know: "Đã biết", review: "Cần ôn", unseen: "Chưa học" }[result.statuses[i]] || "Chưa học"}\n\nNguồn: ${c.source_markers.join(", ")}`).join("\n\n") + sources(result.data.citations) + "\n";
}

export function downloadResult(result: ExportResult, format: ExportFormat) {
  const mime = { md: "text/markdown", json: "application/json", csv: "text/csv" }[format];
  const url = URL.createObjectURL(new Blob([serializeResult(result, format)], { type: `${mime};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${result.kind}-${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

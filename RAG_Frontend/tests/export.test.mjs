import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const source = await readFile(new URL("../src/app/services/exportResults.ts", import.meta.url), "utf8");
const { code } = await transformWithEsbuild(source, "exportResults.ts", { loader: "ts", format: "esm" });
const { serializeResult } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const citations = [{ source_marker: "S1", filename: "Bài học.pdf", page: 3 }];

test("summary exports Vietnamese text, key points and sources", () => {
  const result = { kind: "summary", data: { summary: "Nội dung học", key_points: ["Ý chính"], citations } };
  const text = serializeResult(result, "md");
  for (const value of ["Nội dung học", "Ý chính", "Bài học.pdf", "trang 3"]) assert.ok(text.includes(value));
  assert.deepEqual(JSON.parse(serializeResult(result, "json")), { kind: "summary", ...result.data });
});

test("quiz export calculates score and distinguishes unanswered questions", () => {
  const question = { question: "Câu hỏi", options: ["A", "B"], correct_index: 1, explanation: "Giải thích", source_markers: ["S1"] };
  const result = { kind: "quiz", data: { items: [question, question], citations }, answers: [1, null] };
  const text = serializeResult(result, "md");
  for (const value of ["1/2", "Bạn chọn: B", "Chưa trả lời", "Giải thích", "S1"]) assert.ok(text.includes(value));
  assert.deepEqual(JSON.parse(serializeResult(result, "json")).answers, [1, null]);
});

test("flashcard CSV quotes multiline cells, preserves Unicode and neutralizes formulas", () => {
  const result = { kind: "flashcards", data: { cards: [{ front: '=SUM(1,2)', back: 'Tiếng Việt, "đúng"\nxuống dòng', source_markers: ["S1"] }], citations }, statuses: ["review"] };
  const csv = serializeResult(result, "csv");
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"Tiếng Việt, ""đúng""\nxuống dòng"'));
  assert.ok(csv.includes('"review"'));
  assert.ok(csv.includes("Bài học.pdf (trang 3)"));
  assert.ok(serializeResult(result, "md").includes("Cần ôn"));
  assert.throws(() => serializeResult({ kind: "summary", data: {} }, "csv"));
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { beforeEach } from "node:test";
import { transformWithEsbuild } from "vite";

const source = (await readFile(new URL("../src/app/services/api.ts", import.meta.url), "utf8"))
  .replace("import.meta.env.VITE_API_URL", '"http://api.test"');
const { code } = await transformWithEsbuild(source, "api.ts", { loader: "ts", format: "esm" });
const api = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  globalThis.window = new EventTarget();
});

test("login skips stale token; protected requests attach it", async () => {
  localStorage.setItem("token", "saved-token");
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.get("Authorization"), url.endsWith("/auth/login") ? null : "Bearer saved-token");
    return new Response(JSON.stringify(url.endsWith("/auth/login") ? { access_token: "new" } : []));
  };
  await api.loginUser({ email: "user@example.com", password: "password" });
  assert.deepEqual(await api.listDocuments(), []);
});

test("FastAPI validation details retain HTTP status and readable fields", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: [{ loc: ["body", "count"], msg: "Must be at most 50" }] }), { status: 422 });
  await assert.rejects(api.generateQuiz({ count: 99 }), error => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.status, 422);
    assert.match(error.message, /body.count: Must be at most 50/);
    return true;
  });
});

test("expired authentication clears only auth keys and emits an event", async () => {
  localStorage.setItem("token", "expired");
  localStorage.setItem("unrelated", "keep");
  let notified = false;
  window.addEventListener("auth-expired", () => { notified = true; });
  globalThis.fetch = async () => new Response('{"detail":"Expired"}', { status: 401 });
  await assert.rejects(api.listDocuments(), { status: 401 });
  assert.equal(localStorage.getItem("token"), null);
  assert.equal(localStorage.getItem("unrelated"), "keep");
  assert.equal(notified, true);
});

test("timeout remains active while response body is pending", async () => {
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  let expire, cleared = false, bodyStarted;
  const started = new Promise(resolve => { bodyStarted = resolve; });
  globalThis.setTimeout = callback => { expire = callback; return 1; };
  globalThis.clearTimeout = () => { cleared = true; };
  globalThis.fetch = async (_url, { signal }) => ({
    ok: true,
    status: 200,
    text: () => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      bodyStarted();
    }),
  });
  try {
    const pending = api.listDocuments();
    await started;
    assert.equal(cleared, false);
    expire();
    await assert.rejects(pending, /Máy chủ xử lý quá lâu/);
    assert.equal(cleared, true);
  } finally {
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
  }
});

test("quiz submits answers and deletion addresses the document ID", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options });
    return new Response('{"status":"success","score":1}');
  };
  await api.submitQuizScore(12, [0, null]);
  await api.deleteDocument("42");
  assert.deepEqual(JSON.parse(requests[0].body), { answers: [0, null] });
  assert.equal(requests[1].url, "http://api.test/document-ids/42");
});

test("PDF requests authenticate and preserve binary bytes for view and download", async () => {
  localStorage.setItem("token", "pdf-token");
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 0, 255]);
  const urls = [];
  globalThis.fetch = async (url, options) => {
    urls.push(url);
    assert.equal(options.headers.get("Authorization"), "Bearer pdf-token");
    return new Response(bytes, { headers: { "Content-Type": "application/pdf" } });
  };
  for (const download of [false, true]) {
    const blob = await api.getDocumentPdf("42", download);
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
    assert.equal(blob.type, "application/pdf");
  }
  assert.deepEqual(urls, [
    "http://api.test/document-ids/42/file?download=false",
    "http://api.test/document-ids/42/file?download=true",
  ]);
});

test("PDF failures retain API errors and expired-auth handling", async () => {
  globalThis.fetch = async () => new Response('{"detail":"Missing PDF"}', { status: 404 });
  await assert.rejects(api.getDocumentPdf("42"), { status: 404, message: "Missing PDF" });
  localStorage.setItem("token", "expired");
  globalThis.fetch = async () => new Response('{"detail":"Expired"}', { status: 401 });
  await assert.rejects(api.getDocumentPdf("42"), { status: 401 });
  assert.equal(localStorage.getItem("token"), null);
});

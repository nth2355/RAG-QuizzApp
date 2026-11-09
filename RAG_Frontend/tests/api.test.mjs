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

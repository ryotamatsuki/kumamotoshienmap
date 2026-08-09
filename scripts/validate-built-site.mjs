import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerPath = resolve(root, "dist", "server", "index.js");
const worker = (await import(`${pathToFileURL(workerPath).href}?v=${Date.now()}`)).default;
assert.equal(typeof worker?.fetch, "function", "配信ワーカーのfetch関数がありません");

async function request(path, options = {}) {
  return worker.fetch(new Request(`https://example.invalid${path}`, options));
}

const dashboard = await readFile(resolve(root, "dist", "dashboard.html"), "utf8");
const assets = {
  "/volunteer.css": ["text/css", await readFile(resolve(root, "dist", "volunteer.css"), "utf8")],
  "/volunteer-data.js": ["text/javascript", await readFile(resolve(root, "dist", "volunteer-data.js"), "utf8")],
  "/volunteer.js": ["text/javascript", await readFile(resolve(root, "dist", "volunteer.js"), "utf8")],
};

for (const path of ["/", "/dashboard.html"]) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} のGETが失敗しました`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
  assert.equal(await response.text(), dashboard, `${path} の配信HTMLがビルド成果物と一致しません`);

  const head = await request(path, { method: "HEAD" });
  assert.equal(head.status, 200, `${path} のHEADが失敗しました`);
  assert.equal(await head.text(), "");
}

for (const [path, [contentType, expected]] of Object.entries(assets)) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} のGETが失敗しました`);
  assert.match(response.headers.get("content-type") ?? "", new RegExp(`^${contentType}`));
  assert.equal(await response.text(), expected, `${path} の配信内容がビルド成果物と一致しません`);
}

assert.equal((await request("/missing")).status, 404);
assert.equal((await request("/", { method: "POST" })).status, 405);
assert.equal((await request("/volunteer.js", { method: "POST" })).status, 405);
assert.equal((await request("/favicon.ico")).status, 204);

console.log(JSON.stringify({
  routes: ["/", "/dashboard.html", ...Object.keys(assets)],
  get: "ok",
  head: "ok",
  notFound: "ok",
  methodGuard: "ok",
}));

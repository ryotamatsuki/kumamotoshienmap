import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerPath = resolve(root, "dist", "server", "index.js");
const worker = (await import(`${pathToFileURL(workerPath).href}?v=${Date.now()}`)).default;
assert.equal(typeof worker?.fetch, "function", "配信ワーカーのfetch関数がありません");

const pagesIndex = await readFile(resolve(root, "index.html"), "utf8");
assert.ok(
  pagesIndex.includes("./ehime_kumamoto_support_geocoded_shelters_20260802.html"),
  "GitHub Pagesのルート入口がダッシュボード本体を参照していません",
);

async function request(path, options = {}) {
  return worker.fetch(new Request(`https://example.invalid${path}`, options));
}

const dashboard = await readFile(resolve(root, "dist", "dashboard.html"), "utf8");
const currentShelterData = await readFile(resolve(root, "current-shelters.json"), "utf8");
const currentShelterPayload = JSON.parse(currentShelterData);
assert.ok(Array.isArray(currentShelterPayload.shelters), "current-shelters.jsonのsheltersが配列ではありません");
assert.equal(currentShelterPayload.meta.current_count, currentShelterPayload.shelters.length, "current-shelters.jsonのcurrent_countと配列件数が一致しません");
assert.equal(currentShelterPayload.shelters.filter((row) => row.coordinate_status === "conflict").length, 0, "conflict座標を配信成果物へ含めています");
const assets = {
  "/volunteer.css": ["text/css", await readFile(resolve(root, "dist", "volunteer.css"), "utf8")],
  "/volunteer-data.js": ["text/javascript", await readFile(resolve(root, "dist", "volunteer-data.js"), "utf8")],
  "/volunteer.js": ["text/javascript", await readFile(resolve(root, "dist", "volunteer.js"), "utf8")],
  "/current-shelters.json": ["application/json", currentShelterData],
};
assert.equal(await readFile(resolve(root, "dist", "current-shelters.json"), "utf8"), currentShelterData, "current-shelters.jsonのビルド成果物が生成元データと一致しません");

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
  const body = await response.text();
  assert.equal(body, expected, `${path} の配信内容がビルド成果物と一致しません`);
  if (path === "/current-shelters.json") {
    const servedPayload = JSON.parse(body);
    assert.deepEqual(servedPayload, currentShelterPayload, "配信されたcurrent-shelters.jsonが生成元データと一致しません");
  }
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

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [html, publicHtml, producer] = await Promise.all([
  readFile(resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html"), "utf8"),
  readFile(resolve(root, "public/dashboard.html"), "utf8"),
  readFile(resolve(root, "scripts/sync-current-release.mjs"), "utf8"),
]);

assert.equal(publicHtml, html, "公開用HTMLとレビュー元HTMLが一致していません");

const expected = [
  "延481人日",
  "29人（延158人日）",
  "28人（延84人日）",
  "58人（延396人日）",
  "20人（延94人日）",
  "12人（延45人日）",
  "人的支援総計260人・延1,307人日",
  "県大型トイレカーは竜北中学校で9月7日に運用終了",
  "愛媛県 9月7日12時",
];
for (const value of expected) assert.ok(html.includes(value), `愛媛県9月7日現況値がHTMLにありません: ${value}`);

for (const stale of [
  "人的支援総計253人・延1,228人日",
  "県大型トイレカーは竜北中学校で運用中",
  "愛媛県 9月4日12時",
]) assert.ok(!html.includes(stale), `愛媛県の旧現況値がHTMLに残っています: ${stale}`);

assert.ok(producer.includes("https://www.pref.ehime.jp/uploaded/attachment/189556.pdf"), "愛媛県9月7日公式PDFがproducerに設定されていません");
assert.ok(!producer.includes("https://www.pref.ehime.jp/uploaded/attachment/189500.pdf"), "愛媛県9月4日旧PDFがproducerに残っています");

console.log(JSON.stringify({status:"PASS",source:"attachment/189556.pdf",humanSupport:{persons:260,personDays:1307},counterpart:{persons:96,personDays:481},health:{persons:29,personDays:158},dwat:{persons:28,personDays:84},toiletTruck:{endedOn:"2026-09-07"}}));

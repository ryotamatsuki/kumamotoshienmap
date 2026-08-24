import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCurrentPageMetadataSynced } from "./current-page-metadata.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const publicPath = resolve(root, "public", "dashboard.html");
const shelterPath = resolve(root, "current-shelters.json");
const [html, publicHtml, shelterText] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(publicPath, "utf8"),
  readFile(shelterPath, "utf8"),
]);
const shelterData = JSON.parse(shelterText);

function extractJsonConstant(text, name, nextMarker) {
  const marker = `const ${name}=`;
  const start = text.indexOf(marker);
  assert.ok(start >= 0, `${name} が見つかりません`);
  const valueStart = start + marker.length;
  const next = text.indexOf(nextMarker, valueStart);
  assert.ok(next >= 0, `${name} の終端が見つかりません`);
  let depth = 0;
  let inString = false;
  let escaped = false;
  let valueEnd = -1;
  for (let index = valueStart; index < next; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') { inString = true; continue; }
    if (character === "[" || character === "{") depth += 1;
    else if (character === "]" || character === "}") {
      depth -= 1;
      if (depth === 0) { valueEnd = index; break; }
    }
  }
  assert.ok(valueEnd >= valueStart, `${name} のJSON値を抽出できません`);
  return JSON.parse(text.slice(valueStart, valueEnd + 1));
}

assert.equal(publicHtml, html, "公開用HTMLとレビュー元HTMLが一致していません");
const releaseScript=html.match(/<script src="\.\/volunteer-data\.js\?v=([A-Za-z0-9._-]+)"><\/script>/u);
assert.ok(releaseScript,"ボランティアデータのキャッシュバスターがありません");
assert.ok(!html.includes("2026年8月21日13:14"), "現行HTMLに旧時点のページ確認時刻が残っています");
assert.ok(!html.includes("2026/8/21 13:14"), "現行HTMLに旧時点のボランティア確認時刻が残っています");
assert.equal((html.match(/CURRENT_STATE_CLEANUP_20260821_START/g) || []).length, 1, "現行状態補正ブロックが重複しています");
assert.equal((html.match(/CURRENT_STATE_CLEANUP_20260821_END/g) || []).length, 1, "現行状態補正ブロックの終端が不正です");
for (const deadUrl of [
  "https://www.fdma.go.jp/disaster/info/items/20260728kumamotojishin15.pdf",
  "https://www.fdma.go.jp/disaster/info/items/20260728kumamotojishin30.pdf",
  "https://www.bousai.go.jp/updates/r8kumamoto_jishin/pdf/r8kumamoto_jishin_20260801.pdf",
]) assert.ok(!html.includes(deadUrl), `リンク切れ候補が公開HTMLに残っています: ${deadUrl}`);

const records = extractJsonConstant(html, "RECORDS", "const SHELTER_MUNICIPALITIES=");
const timeline = extractJsonConstant(html, "TIMELINE_EVENTS", "const RECORDS=");
const provinceNeeds = extractJsonConstant(html, "PROVINCE_NEEDS", "const NEED_READINESS=");
const municipalities = extractJsonConstant(html, "NEED_MUNICIPALITIES", "const NEED_LESSONS=");
const sources = extractJsonConstant(html, "SOURCES", "const pairSupportRecords20260811=");
const pageMeta = extractJsonConstant(html, "PAGE_RECHECK_META", "const PROVIDER_LABEL=");
assertCurrentPageMetadataSynced(html, pageMeta);
const record = (id) => {
  const value = records.find((item) => item.id === id);
  assert.ok(value, `レコード ${id} がありません`);
  return value;
};
const need = (id) => {
  const value = provinceNeeds.find((item) => item.id === id);
  assert.ok(value, `県ニーズ ${id} がありません`);
  return value;
};
const event = (id) => {
  const value = timeline.find((item) => item.id === id);
  assert.ok(value, `タイムライン ${id} がありません`);
  return value;
};

assert.ok(record("ehime-management").scale.includes("67人"));
assert.ok(record("ehime-management").period.includes("終期未定"));
assert.ok(record("ehime-management").status.includes("現行派遣"));
assert.ok(record("ehime-health").scale.includes("17人"));
assert.ok(record("ehime-health").period.includes("9月30日"));
assert.ok(record("ehime-dmat").scale.includes("4人"));
assert.deepEqual(record("ehime-dmat").hubIds, ["kumamoto-hq"]);
assert.ok(record("ehime-dpat").status.includes("活動終了"));
assert.ok(record("ehime-assessor").status.includes("活動終了"));
for (const id of ["ehime-pair", "pair-hikawa", "pair-kashima"]) {
  assert.ok(record(id).status.includes("要確認"), `${id}を継続中と断定しています`);
  assert.ok(!record(id).status.includes("活動中"), `${id}に期限切れの活動中表示があります`);
}

assert.ok(need("p-shelter").observed.includes("8月24日15時30分更新"));
assert.ok(need("p-waste").observed.includes("10市町村"));
assert.ok(need("p-agri").observed.includes("7,881件、約1,559億円"));
for (const name of ["熊本市", "八代市", "宇土市", "宇城市", "美里町", "御船町", "嘉島町", "益城町", "甲佐町", "氷川町", "芦北町"]) {
  const municipality = municipalities.find((item) => item.name === name);
  assert.ok(Array.isArray(municipality?.currentSupport), `${name}の支援情報配列がありません`);
}

assert.ok(event("t-current-status").tags.includes("熊本県第42報"));
assert.ok(event("t-kumamoto-0816").tags.includes("過去スナップショット"));
assert.ok(event("t-kumamoto-0820").title.includes("差分"));
assert.ok(event("t-kumamoto-0819").summary.includes("971人"));
assert.ok(!event("t-kumamoto-0816").tags.includes("最新確認"));
assert.equal(event("t-current-status").summary, "避難者2,709人、開設避難所65か所、人的被害398人、住家被害38,537棟。");

assert.equal(pageMeta.checkedAt, "2026-08-24T22:38:32+09:00");
assert.equal(pageMeta.volunteerCheckedAt, "2026-08-24T15:45:00+09:00");
assert.ok(pageMeta.rows.some((row)=>row.section==="他自治体等"&&row.current.includes("全件再監査")),"他自治体等の全件再監査がPAGE_RECHECK_METAにありません");
assert.ok(pageMeta.rows.some((row) => row.section === "愛媛県支援"));
for (const row of pageMeta.rows) {
  if (row.status === "差分あり") assert.notEqual(row.current, row.previous, `ページ再確認の現行値と前回値が同じです: ${row.section}`);
}
assert.ok(pageMeta.rows.find((row) => row.section === "支援ダッシュボード").status === "差分あり");

for (const url of [
  "https://www.pref.ehime.jp/uploaded/attachment/188555.pdf",
  "https://www.pref.kumamoto.jp/uploaded/attachment/317153.pdf",
  "https://www.fdma.go.jp/disaster/info/items/20260728kumamotojishin59.pdf",
  "https://www.mod.go.jp/js/pdf/2026/p20260821_01.pdf",
  "https://www.bousai.go.jp/updates/r8kumamoto_jishin/status/pdf/r8kumamoto_jishin_20260801.pdf",
]) assert.ok(sources.some((source) => source.url === url), `最新ソース ${url} がSOURCESにありません`);

const currentDisplay = html.slice(0, html.indexOf('<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js">'));
for (const value of [
  "D+27",
  "行政応援971人",
  "関係機関含む計1,038人",
  "8月24日までの確認済み支援",
  "10市町村",
]) assert.ok(currentDisplay.includes(value), `初期表示に ${value} がありません`);
for (const value of [
  "D+14",
  "計10市町へ行政応援925人（関係機関含む計1,005人）",
  "<div class=\"snap\"><strong>925</strong>",
  "第14回政府現地本部会議（8月15日資料）まで確認",
  "仮置場11市町開設",
]) assert.ok(!currentDisplay.includes(value), `旧い現行表示が残っています: ${value}`);

assert.equal(shelterData.meta.fetched_at, "2026-08-24T15:44:18+09:00");
assert.equal(shelterData.meta.source_last_modified, "2026-08-24T15:30:54+09:00");
assert.equal(shelterData.meta.current_count, 67);
assert.equal(shelterData.shelters.length, 67);
assert.ok(shelterData.shelters.every((row) => row.coordinate_status === "confirmed"));

console.log(JSON.stringify({
  checkedAt: pageMeta.checkedAt,
  records: records.length,
  timelineEvents: timeline.length,
  shelters: shelterData.shelters.length,
  shelterSourceLastModified: shelterData.meta.source_last_modified,
}));

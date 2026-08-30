import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCurrentPageMetadataSynced } from "./current-page-metadata.mjs";

const REFERENCE_AT = "2026-08-30T14:20:00+09:00";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [html, publicHtml, shelterText, municipalText, nationalText] = await Promise.all([
  readFile(resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html"), "utf8"),
  readFile(resolve(root, "public/dashboard.html"), "utf8"),
  readFile(resolve(root, "current-shelters.json"), "utf8"),
  readFile(resolve(root, "municipal-support-audit.json"), "utf8"),
  readFile(resolve(root, "national-support-audit.json"), "utf8"),
]);
const shelterData = JSON.parse(shelterText);
const municipalAudit = JSON.parse(municipalText);
const nationalAudit = JSON.parse(nationalText);

function extractJsonConstant(text, name, nextMarker) {
  const marker = `const ${name}=`;
  const start = text.indexOf(marker);
  assert.ok(start >= 0, `${name} が見つかりません`);
  const valueStart = start + marker.length;
  const next = text.indexOf(nextMarker, valueStart);
  assert.ok(next >= 0, `${name} の終端が見つかりません`);
  let depth = 0, inString = false, escaped = false, valueEnd = -1;
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
assert.equal(municipalAudit.reference_at, REFERENCE_AT);
assert.equal(nationalAudit.reference_at, REFERENCE_AT);
assert.ok(!html.includes("2026年8月21日13:14"), "現行HTMLに旧ページ確認時刻が残っています");
assert.equal((html.match(/CURRENT_STATE_CLEANUP_20260821_START/g) || []).length, 1, "現行状態補正ブロックが重複しています");
assert.equal((html.match(/CURRENT_STATE_CLEANUP_20260821_END/g) || []).length, 1, "現行状態補正ブロックの終端が不正です");

const records = extractJsonConstant(html, "RECORDS", "const SHELTER_MUNICIPALITIES=");
const timeline = extractJsonConstant(html, "TIMELINE_EVENTS", "const RECORDS=");
const provinceNeeds = extractJsonConstant(html, "PROVINCE_NEEDS", "const NEED_READINESS=");
const municipalities = extractJsonConstant(html, "NEED_MUNICIPALITIES", "const NEED_LESSONS=");
const pageMeta = extractJsonConstant(html, "PAGE_RECHECK_META", "const PROVIDER_LABEL=");
assertCurrentPageMetadataSynced(html, pageMeta);
const record = (id) => { const value = records.find((item) => item.id === id); assert.ok(value, `レコード ${id} がありません`); return value; };
const need = (id) => { const value = provinceNeeds.find((item) => item.id === id); assert.ok(value, `県ニーズ ${id} がありません`); return value; };
const event = (id) => { const value = timeline.find((item) => item.id === id); assert.ok(value, `タイムライン ${id} がありません`); return value; };

assert.ok(record("ehime-management").scale.includes("67人"));
assert.ok(record("ehime-management").period.includes("終期未定"));
assert.ok(record("ehime-health").scale.includes("17人"));
assert.ok(record("ehime-dmat").scale.includes("4人"));
assert.ok(record("ehime-dpat").status.includes("活動終了"));
assert.ok(record("ehime-assessor").status.includes("活動終了"));
for (const id of ["ehime-pair", "pair-hikawa", "pair-kashima"]) {
  assert.ok(record(id).status.includes("要確認"), `${id}のraw履歴レコードを現況扱いしています`);
  assert.ok(!record(id).status.includes("活動中"), `${id}のraw履歴レコードに活動中表示があります`);
}

assert.ok(need("p-shelter").observed.includes("熊本県第49報"));
assert.ok(need("p-waste").observed.includes("10市町村"));
assert.ok(need("p-agri").observed.includes("7,881件、約1,559億円"));
for (const name of ["熊本市", "八代市", "宇土市", "宇城市", "美里町", "御船町", "嘉島町", "益城町", "甲佐町", "氷川町", "芦北町"]) assert.ok(Array.isArray(municipalities.find((item) => item.name === name)?.currentSupport), `${name}の支援情報配列がありません`);

assert.ok(event("t-current-status").tags.includes("熊本県第49報"));
assert.ok(event("t-kumamoto-0816").tags.includes("過去スナップショット"));
assert.ok(event("t-kumamoto-0819").summary.includes("971人"));
assert.equal(event("t-current-status").summary, "避難者2,442人、開設避難所61か所、人的被害402人、住家被害43,292棟。");

assert.equal(pageMeta.checkedAt, REFERENCE_AT);
assert.ok(Number.isFinite(Date.parse(pageMeta.volunteerCheckedAt)) && Date.parse(pageMeta.volunteerCheckedAt) >= Date.parse(REFERENCE_AT), "volunteer確認時刻がreference_at以前又は不正です");
assert.ok(pageMeta.rows.some((row) => row.section === "他自治体等" && row.current.includes("全件再監査")), "他自治体等の全件再監査がPAGE_RECHECK_METAにありません");
assert.ok(pageMeta.rows.some((row) => row.section === "愛媛県支援"));

const currentDisplay = html.slice(0, html.indexOf('<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js">'));
for (const value of ["D+33", "行政応援971人", "8月30日14:20までに確認できた一次情報", "8月30日14:20基準で全件再監査"]) assert.ok(currentDisplay.includes(value), `初期表示に ${value} がありません`);
for (const value of ["D+14", "計10市町へ行政応援925人（関係機関含む計1,005人）", "<div class=\"snap\"><strong>925</strong>", "第14回政府現地本部会議（8月15日資料）まで確認", "仮置場11市町開設"]) assert.ok(!currentDisplay.includes(value), `旧い現行表示が残っています: ${value}`);

assert.ok(Number.isFinite(Date.parse(shelterData.meta.fetched_at)), "避難所fetched_atが不正です");
assert.ok(Number.isFinite(Date.parse(shelterData.meta.source_last_modified)), "避難所source_last_modifiedが不正です");
assert.ok(Date.parse(shelterData.meta.source_last_modified) <= Date.parse(shelterData.meta.fetched_at), "避難所公式更新時刻が取得時刻より未来です");
assert.equal(shelterData.meta.current_count, shelterData.shelters.length);
assert.ok(shelterData.shelters.length > 0, "現行避難所一覧が空です");
assert.ok(shelterData.shelters.every((row) => row.coordinate_status === "confirmed"));

console.log(JSON.stringify({status:"PASS",checkedAt:pageMeta.checkedAt,records:records.length,timelineEvents:timeline.length,shelters:shelterData.shelters.length,shelterSourceLastModified:shelterData.meta.source_last_modified,nationalStates:nationalAudit.summary}));

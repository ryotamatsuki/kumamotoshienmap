import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const REFERENCE_AT = "2026-08-26T19:26:53+09:00";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const publicPath = resolve(root, "public", "dashboard.html");
const [html, publicHtml, volunteerCss, currentShelterText, municipalAuditText, nationalAuditText, coverageText] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(publicPath, "utf8"),
  readFile(resolve(root, "volunteer.css"), "utf8"),
  readFile(resolve(root, "current-shelters.json"), "utf8"),
  readFile(resolve(root, "municipal-support-audit.json"), "utf8"),
  readFile(resolve(root, "national-support-audit.json"), "utf8"),
  readFile(resolve(root, "operations/audits/institution-coverage-20260826-1926.json"), "utf8"),
]);

const currentShelterData = JSON.parse(currentShelterText);
const municipalAudit = JSON.parse(municipalAuditText);
const nationalAudit = JSON.parse(nationalAuditText);
const coverage = JSON.parse(coverageText);

assert.equal(publicHtml, html, "公開用HTMLがレビュー元HTMLと一致していません");
assert.equal(municipalAudit.reference_at, REFERENCE_AT, "municipal audit reference_at mismatch");
assert.equal(nationalAudit.reference_at, REFERENCE_AT, "national audit reference_at mismatch");
assert.equal(coverage.reference_at, REFERENCE_AT, "institution coverage reference_at mismatch");
assert.equal(coverage.operation_version, "2.5", "institution coverage must use operation v2.5");

const requiredText = [
  "経過日 D+29（県第45報：8月26日8時）",
  "2,589<span class=\"overview-kpi-unit\">人",
  "64<span class=\"overview-kpi-unit\">か所",
  "402<span class=\"overview-kpi-unit\">人",
  "39,567<span class=\"overview-kpi-unit\">棟",
  "約4,300戸",
  "履歴スナップショット",
  "対口支援・他自治体支援を全件再監査",
  "8月26日19:26に対口支援・他自治体支援を全件再監査",
  "国交省第49報8/25値はHISTORICALスナップショット。8/26は佐伯市給水継続をCURRENT、TEC-FORCE第5陣・はくおう2宿泊は実働未確認のためUNKNOWN",
  "8月25日閣議の災害融資特別措置を保持し、8月26日実働主体を再監査",
  "現在開設避難所総数",
  "地図表示数",
  "座標未確認数",
  "防災情報くまもと 現在開設避難所一覧（公式JSON）",
  `checkedAt\":\"${REFERENCE_AT}`,
  'data-view="overview"',
  'data-view="needs"',
  'data-view="timeline"',
  'data-view="dashboard"',
  'data-view="volunteer"',
  'data-view="map"',
  'id="volunteerLayerToggle"',
  "7,881件、約1,559億円",
  '@media(max-width:760px)',
];
for (const value of requiredText) assert.ok(html.includes(value), `最新時点の必須表示がありません: ${value}`);

const runtimeScriptStart = html.indexOf('<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js">');
assert.ok(runtimeScriptStart > 0, "公開HTMLの初期表示領域を特定できません");
const currentDisplayHtml = html.slice(0, runtimeScriptStart);
for (const value of [
  "2026年8月26日 19:26",
  "8月26日19:26基準で全件再監査",
  "国交省第49報8/25値はHISTORICALスナップショット。8/26は佐伯市給水継続をCURRENT、TEC-FORCE第5陣・はくおう2宿泊は実働未確認のためUNKNOWN",
  "8月19日行政応援971人は履歴スナップショット",
]) assert.ok(currentDisplayHtml.includes(value), `初期表示の最新値がありません: ${value}`);

for (const value of [
  "国交省第39報",
  "国交省第42報",
  "行政応援854人",
  "行政応援925人",
  "関係機関含む計1,005人",
  "給水車131台",
  "TEC-FORCE現在103人・累計3,703人日",
  "給水車129台（国交省第47報・8月21日7時30分・表掲載値）",
  "TEC-FORCE現在105人・累計4,299人日",
  "8月2日公表値・継続要確認",
]) assert.ok(!currentDisplayHtml.includes(value), `旧値を現況表示に残しています: ${value}`);

assert.ok(volunteerCss.includes(".volunteer-view[hidden]"), "ボランティアタブのhidden制御がありません");
assert.ok(volunteerCss.includes("@media(max-width:650px)"), "ボランティア画面のスマートフォン切替がありません");

function parseJsonConstant(name) {
  const match = html.match(new RegExp(`const ${name}=(\\[[^\\n]*\\]);`));
  assert.ok(match, `${name} を抽出できません`);
  return JSON.parse(match[1]);
}

const impacts = parseJsonConstant("IMPACTS");
assert.equal(impacts.length, 11, "開設避難所の市町数が公式集計と一致しません");
assert.equal(impacts.reduce((sum, row) => sum + row.shelters, 0), 65);
assert.equal(impacts.reduce((sum, row) => sum + row.evacuees, 0), 2_709);

const needs = parseJsonConstant("NEED_MUNICIPALITIES");
assert.equal(needs.length, 24, "市町別被害表の収録数が想定外です");
const rawTotals = needs.reduce((totals, row) => {
  totals.shelters += row.raw.shelters;
  totals.evacuees += row.raw.evacuees;
  totals.waterOutage += row.raw.waterOutage;
  totals.housing += row.raw.housingTotal;
  totals.human += row.raw.humanTotal;
  return totals;
}, { shelters: 0, evacuees: 0, waterOutage: 0, housing: 0, human: 0 });
assert.deepEqual(rawTotals, { shelters: 65, evacuees: 2_709, waterOutage: 4_284, housing: 38_498, human: 396 });
assert.ok(html.includes("24市町の人的被害表内合計396人。県第45報の人的被害合計は402人"));
assert.ok(html.includes("住家被害の市町別旧スナップショット38,498棟と県第45報39,567棟は時点が異なるため単純差分を現況差と扱わない"));

const dataStart = html.indexOf("const HUBS=");
const dataEnd = html.indexOf("/* MUNICIPAL_SUPPORT_AUDIT_END */") + "/* MUNICIPAL_SUPPORT_AUDIT_END */".length;
assert.ok(dataStart >= 0 && dataEnd > dataStart, "補正後のダッシュボードデータを抽出できません");
const sandbox = {};
runInNewContext(`${html.slice(dataStart, dataEnd)}\nglobalThis.__result={HUBS,NEED_MUNICIPALITIES,PROVINCE_NEEDS,TIMELINE_EVENTS,RECORDS,CURRENT_SHELTER_META,CURRENT_SHELTER_ROWS,CURRENT_SHELTERS,SUPPORT_BLOCKS};`, sandbox, { timeout: 5_000 });
const runtime = sandbox.__result;

const currentRows = currentShelterData.shelters;
assert.ok(Array.isArray(currentRows), "current-shelters.json shelters must be an array");
assert.equal(runtime.CURRENT_SHELTER_META.currentCount, currentRows.length, "現行公式避難所一覧の件数が一致しません");
assert.equal(JSON.stringify(runtime.CURRENT_SHELTER_ROWS), JSON.stringify(currentRows), "HTML埋込現行避難所データがJSONと一致しません");
assert.equal(runtime.CURRENT_SHELTER_META.sourceAsOf, currentShelterData.meta.source_last_modified || currentShelterData.meta.fetched_at, "現行公式避難所JSON時点が一致しません");
assert.equal(currentRows.filter((row) => row.coordinate_status === "conflict").length, 0, "conflict座標を採用しています");
assert.equal(currentRows.filter((row) => row.coordinate_status === "unresolved").length, 0, "今回の現行避難所に未解決座標があります");
assert.equal(runtime.CURRENT_SHELTERS.filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng)).length, currentRows.length, "地図表示数が現行避難所件数と一致しません");
assert.ok(runtime.CURRENT_SHELTERS.every((row) => row.source === "current-official-list"), "現行地図が履歴座標を現況へ流用しています");
assert.ok(html.includes("historyRecords:PREGEOCODED_SHELTERS.map"), "履歴レイヤーが現行データと分離されていません");
assert.ok(html.includes("filteredShelters().filter(isCurrentShelterMappable)"), "座標確認済みだけを現行地図へ表示していません");

assert.ok(runtime.HUBS.some((hub) => hub.id === "mifune"));
assert.ok(runtime.HUBS.some((hub) => hub.id === "ashikita"));
assert.ok(runtime.PROVINCE_NEEDS.find((item) => item.id === "p-admin").observed.includes("39,567棟"));
assert.equal(runtime.TIMELINE_EVENTS.find((event) => event.id === "t-current-status").date, "2026-08-26", "主要公表値の時点日が不正です");
assert.ok(runtime.TIMELINE_EVENTS.every((event) => Array.isArray(event.tags)), "タイムラインの全イベントにtags配列が必要です");

const auditedKumamoto = runtime.RECORDS.find((record) => record.id === "pair-kumamoto");
assert.equal(auditedKumamoto.auditCheckedAt, municipalAudit.checked_at, "熊本市対口支援の監査確認時刻が不正です");
assert.ok(auditedKumamoto.detail.includes("UNKNOWN"), "未確認派遣元をUNKNOWNとして表示していません");
assert.ok(runtime.SUPPORT_BLOCKS.filter((block) => block.id !== "internal-coordination").every((block) => block.badge.includes("旧割当履歴")), "旧割当名簿をCURRENTのように表示しています");
assert.equal(runtime.RECORDS.find((record) => record.id === "pharmacy").providers.length, 0, "モバイルファーマシーの旧活動主体をCURRENT扱いしています");

for (const record of nationalAudit.records) {
  assert.equal(record.display.status, record.state, `national display/state mismatch: ${record.record_id}`);
  if (record.state === "UNKNOWN") assert.ok(String(record.display.scale).includes("UNKNOWN"), `UNKNOWNを明示していません: ${record.record_id}`);
}
assert.equal(nationalAudit.summary.blocking_unresolved_count, 0, "national blocking unresolved must be zero");
assert.equal(coverage.summary.missing_entities, 0, "institution missing entities must be zero");
assert.equal(coverage.summary.unadjudicated_source_mentions, 0, "unadjudicated source mentions must be zero");
assert.equal(coverage.summary.blocking_unresolved, 0, "institution blocking unresolved must be zero");

console.log(JSON.stringify({
  status: "PASS",
  referenceAt: REFERENCE_AT,
  currentShelters: currentRows.length,
  nationalStates: nationalAudit.summary,
  institutionEntities: coverage.summary.entities,
}));

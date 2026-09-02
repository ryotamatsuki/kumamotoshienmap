import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const REFERENCE_AT = "2026-09-02T16:16:00+09:00";
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
  readFile(resolve(root, "operations/audits/institution-coverage-20260902-1616.json"), "utf8"),
]);

const currentShelterData = JSON.parse(currentShelterText);
const municipalAudit = JSON.parse(municipalAuditText);
const nationalAudit = JSON.parse(nationalAuditText);
const coverage = JSON.parse(coverageText);
const referenceParts = REFERENCE_AT.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u);
assert.ok(referenceParts, "REFERENCE_AT format invalid");
const ledgerReleaseId = `${referenceParts[1]}${referenceParts[2]}${referenceParts[3]}-${referenceParts[4]}${referenceParts[5]}`;
const releaseLedger = JSON.parse(await readFile(resolve(root, `operations/ledgers/refresh-${ledgerReleaseId}.json`), "utf8"));
assert.equal(releaseLedger.reference_at, REFERENCE_AT, "release ledger reference_at mismatch");
const currentDamageReport = Number(releaseLedger.snapshots.damage_report);
const ledgerCurrentShelters = Number(releaseLedger.snapshots.current_shelters);
const damageSource = releaseLedger.sources.find((source) => String(source.source_id || "").startsWith("kumamoto-damage"));
assert.ok(Number.isInteger(currentDamageReport) && currentDamageReport > 0, "release ledger damage report missing");
assert.ok(damageSource?.url, "release ledger damage source missing");

assert.equal(publicHtml, html, "公開用HTMLがレビュー元HTMLと一致していません");
assert.equal(municipalAudit.reference_at, REFERENCE_AT, "municipal audit reference_at mismatch");
assert.equal(nationalAudit.reference_at, REFERENCE_AT, "national audit reference_at mismatch");
assert.equal(coverage.reference_at, REFERENCE_AT, "institution coverage reference_at mismatch");
assert.equal(coverage.operation_version, "2.6", "institution coverage must use operation v2.5");

const requiredText = [
  "経過日 D+36（県第51報：9月2日14時）",
  "2,035<span class=\"overview-kpi-unit\">人",
  "40<span class=\"overview-kpi-unit\">か所",
  "404<span class=\"overview-kpi-unit\">人",
  "61,996<span class=\"overview-kpi-unit\">棟",
  "約4,300戸",
  "履歴スナップショット",
  "対口支援・他自治体支援を全件再監査",
  "9月2日16:16に対口支援・他自治体支援を全件再監査",
  "国交省第51報（8/31 17:00）を最新インフラ履歴として確認。はくおうIIは予約受付終了、9/3宿泊実施はPLANNED",
  "9月1日設置の非常災害復旧復興本部を確認し、9月2日実働主体を再監査",
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
  "2026年9月2日 16:16",
  "9月2日16:16基準で全件再監査",
  "国交省第51報（8/31 17:00）を最新インフラ履歴として確認。はくおうIIは予約受付終了、9/3宿泊実施はPLANNED",
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
assert.ok(html.includes("24市町の人的被害表内合計396人。県第51報の人的被害合計は404人"));
assert.ok(html.includes("住家被害の市町別旧スナップショット38,498棟と県第51報61,996棟は時点が異なるため単純差分を現況差と扱わない"));

const dataStart = html.indexOf("const HUBS=");
const dataEnd = html.indexOf("/* MUNICIPAL_SUPPORT_AUDIT_END */") + "/* MUNICIPAL_SUPPORT_AUDIT_END */".length;
assert.ok(dataStart >= 0 && dataEnd > dataStart, "補正後のダッシュボードデータを抽出できません");
const sandbox = {};
runInNewContext(`${html.slice(dataStart, dataEnd)}\nglobalThis.__result={HUBS,NEED_MUNICIPALITIES,PROVINCE_NEEDS,TIMELINE_EVENTS,RECORDS,CURRENT_SHELTER_META,CURRENT_SHELTER_ROWS,CURRENT_SHELTERS,SUPPORT_BLOCKS,PAGE_RECHECK_META};`, sandbox, { timeout: 5_000 });
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
assert.ok(runtime.PROVINCE_NEEDS.find((item) => item.id === "p-admin").observed.includes("61,996棟"));
const currentEvent = runtime.TIMELINE_EVENTS.find((event) => event.id === "t-current-status");
assert.equal(currentEvent.date, "2026-09-02", "主要公表値の時点日が不正です");
assert.ok(currentEvent.title.includes(`第${currentDamageReport}報`), "タイムライン最新イベントの報番号がledgerと不一致です");
assert.equal(currentEvent.sourceLabel, `熊本県 被害情報 第${currentDamageReport}報`, "タイムライン最新イベントのsourceLabelがledgerと不一致です");
assert.ok(currentEvent.tags.includes(`熊本県第${currentDamageReport}報`), "タイムライン最新イベントのtagがledgerと不一致です");
const currentSummary = currentEvent.summary.match(/避難者([\d,]+)人、開設避難所([\d,]+)か所、人的被害([\d,]+)人、住家被害([\d,]+)棟/u);
assert.ok(currentSummary, "タイムライン最新イベントの4指標を抽出できません");
const parseCount = (value) => Number(String(value).replaceAll(",", ""));
const currentCounts = { evacuees: parseCount(currentSummary[1]), reportedShelters: parseCount(currentSummary[2]), human: parseCount(currentSummary[3]), housing: parseCount(currentSummary[4]) };
const pShelter = runtime.PROVINCE_NEEDS.find((item) => item.id === "p-shelter");
assert.ok(pShelter.observed.includes(`第${currentDamageReport}報`) && pShelter.observed.includes(`避難所${currentCounts.reportedShelters.toLocaleString("ja-JP")}か所`) && pShelter.observed.includes(`避難者${currentCounts.evacuees.toLocaleString("ja-JP")}人`), "Needsの県全体避難値が最新タイムラインと不一致です");
for (const section of ["被害・支援","避難所","支援ニーズ見通し","発災後タイムライン","支援ダッシュボード"]) {
  const row = runtime.PAGE_RECHECK_META.rows.find((item) => item.section === section);
  assert.ok(row, `PAGE_RECHECK_META missing: ${section}`);
  assert.ok(`${row.current} ${row.source} ${row.difference}`.includes(`第${currentDamageReport}報`), `PAGE_RECHECK_META ${section} が最新報と不一致です`);
}
assert.equal(runtime.PAGE_RECHECK_META.rows.find((item) => item.section === "被害・支援").url, damageSource.url, "被害・支援recheckの一次情報URLがledgerと不一致です");
const recheckFunctionStart = html.indexOf("function renderPageRecheck(){");
const recheckFunctionEnd = html.indexOf("const PROVIDER_LABEL", recheckFunctionStart);
assert.ok(recheckFunctionStart >= 0 && recheckFunctionEnd > recheckFunctionStart, "renderPageRecheckを抽出できません");
assert.ok(!/第\d+報/u.test(html.slice(recheckFunctionStart, recheckFunctionEnd)), "renderPageRecheckで報番号をhard-codeしてはいけません");
const timelineUpdateMatch = currentDisplayHtml.match(/<div class="timeline-update">([\s\S]*?)<\/div>/u);
assert.ok(timelineUpdateMatch?.[1].includes(`第${currentDamageReport}報`), "トップの発災後タイムライン再確認表示が最新報と不一致です");
const overviewKpiStart = currentDisplayHtml.indexOf('aria-label="被害・避難状況"');
const overviewKpiEnd = currentDisplayHtml.indexOf('<div class="overview-layout">', overviewKpiStart);
const overviewKpis = currentDisplayHtml.slice(overviewKpiStart, overviewKpiEnd);
assert.ok(overviewKpis.includes(`${currentCounts.evacuees.toLocaleString("ja-JP")}<span class="overview-kpi-unit">人`) && overviewKpis.includes(`${currentCounts.human.toLocaleString("ja-JP")}<span class="overview-kpi-unit">人`) && overviewKpis.includes(`${currentCounts.housing.toLocaleString("ja-JP")}<span class="overview-kpi-unit">棟`), "Overview KPIが最新タイムラインと不一致です");
assert.ok(overviewKpis.includes(`${ledgerCurrentShelters.toLocaleString("ja-JP")}<span class="overview-kpi-unit">か所`) && overviewKpis.includes("公式JSON現在"), "Overviewの現在避難所数がledgerと不一致です");
assert.ok(overviewKpis.includes(`熊本県第${currentDamageReport}報`), "Overview KPIの報番号がledgerと不一致です");
const mapStart = currentDisplayHtml.indexOf('id="mapView"');
const mapSummary = currentDisplayHtml.slice(mapStart);
for (const value of [`熊本県第${currentDamageReport}報`, `避難所${currentCounts.reportedShelters.toLocaleString("ja-JP")}か所`, `避難者${currentCounts.evacuees.toLocaleString("ja-JP")}人`, `<div class="metric-label">県報避難所</div><div class="metric-value">${currentCounts.reportedShelters.toLocaleString("ja-JP")}<span`, `<div class="metric-label">人的被害</div><div class="metric-value">${currentCounts.human.toLocaleString("ja-JP")}<span`, `<div class="metric-label">住家被害</div><div class="metric-value">${currentCounts.housing.toLocaleString("ja-JP")}<span`]) assert.ok(mapSummary.includes(value), `Map current summary mismatch: ${value}`);
assert.ok(currentDisplayHtml.includes(`熊本県第${currentDamageReport}報（9月2日14時）では住家被害${currentCounts.housing.toLocaleString("ja-JP")}棟`), "decision boardの住家被害根拠が最新報と不一致です");
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

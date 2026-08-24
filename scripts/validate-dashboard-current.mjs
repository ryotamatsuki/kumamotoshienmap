import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const publicPath = resolve(root, "public", "dashboard.html");
const currentShelterDataPath = resolve(root, "current-shelters.json");
const [html, publicHtml, volunteerCss, currentShelterDataText] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(publicPath, "utf8"),
  readFile(resolve(root, "volunteer.css"), "utf8"),
  readFile(currentShelterDataPath, "utf8"),
]);
const currentShelterData = JSON.parse(currentShelterDataText);
assert.ok(Array.isArray(currentShelterData.shelters), "current-shelters.jsonのsheltersが配列ではありません");
const currentShelterRows = currentShelterData.shelters;
const currentShelterCount = currentShelterRows.length;
const currentShelterConfirmedCount = currentShelterRows.filter((row) => row?.coordinate_status === "confirmed" && Number.isFinite(row?.lat) && Number.isFinite(row?.lng)).length;
const currentShelterUnresolvedCount = currentShelterRows.filter((row) => row?.coordinate_status === "unresolved").length;
const currentShelterConflictCount = currentShelterRows.filter((row) => row?.coordinate_status === "conflict").length;

assert.equal(publicHtml, html, "公開用HTMLがレビュー元HTMLと一致していません");

const requiredText = [
  "経過日 D+27（主要公表値は8月24日8時）",
  "2,709<span class=\"overview-kpi-unit\">人",
  "65<span class=\"overview-kpi-unit\">か所",
  "398<span class=\"overview-kpi-unit\">人",
  "38,537<span class=\"overview-kpi-unit\">棟",
  "約4,300戸",
  "給水車129台（国交省第47報・8月21日7時30分・表掲載値）",
  "行政応援971人",
  "履歴スナップショット",
  "対口支援・他自治体支援を全件再監査",
  "TEC-FORCE現在105人・累計4,299人日",
  "現在開設避難所総数",
  "地図表示数",
  "座標未確認数",
  "防災情報くまもと 現在開設避難所一覧（公式JSON）",
  'checkedAt":"2026-08-22T15:16:00+09:00"',
  "status:\"8月2日時点で開設\"",
  'data-view="overview"',
  'data-view="needs"',
  'data-view="timeline"',
  'data-view="dashboard"',
  'data-view="volunteer"',
  'data-view="map"',
  'id="volunteerLayerToggle"',
  "7,881件、約1,559億円",
  "8月24日18:06に対口支援・他自治体支援を全件再監査",
  "行政応援971人",
  "8月24日までの確認済み支援",
  '@media(max-width:760px)',
];
for (const value of requiredText) {
  assert.ok(html.includes(value), `最新時点の必須表示がありません: ${value}`);
}

const runtimeScriptStart = html.indexOf('<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js">');
assert.ok(runtimeScriptStart > 0, "公開HTMLの初期表示領域を特定できません");
const currentDisplayHtml = html.slice(0, runtimeScriptStart);
const requiredCurrentDisplay = [
  "2026年8月24日 18:06",
  "国交省第47報",
  "給水車129台（国交省第47報・8月21日7時30分・表掲載値）",
  "8月19日行政応援971人は履歴スナップショット",
  "<div class=\"snap\"><strong>8/19</strong>",
  "<div class=\"snap\"><strong>129</strong>",
];
for (const value of requiredCurrentDisplay) {
  assert.ok(currentDisplayHtml.includes(value), `初期表示の最新値がありません: ${value}`);
}
const forbiddenCurrentDisplay = [
  "国交省第39報",
  "国交省第42報",
  "行政応援854人",
  "行政応援925人",
  "関係機関含む計1,005人",
  "給水車131台",
  "TEC-FORCE現在103人・累計3,703人日",
  "<strong>854</strong>",
  "<strong>173</strong>",
  "2026年8月11日確認",
];
for (const value of forbiddenCurrentDisplay) {
  assert.ok(!currentDisplayHtml.includes(value), `旧値を現況表示に残しています: ${value}`);
}
assert.ok(
  html.includes("8月11日14時資料の当時公表値として給水車173台を掲載。第42報（8月16日6時～7時30分）の表掲載131台とは対象時点・資料定義が異なるため、現況値には流用しない。"),
  "173台の履歴値と第42報131台の定義差分が明示されていません",
);

assert.ok(volunteerCss.includes(".volunteer-view[hidden]"), "ボランティアタブのhidden制御がありません");
assert.ok(volunteerCss.includes("@media(max-width:650px)"), "ボランティア画面のスマートフォン切替がありません");

const forbiddenCurrentClaims = [
  "経過日 D+7",
  "避難者</div><div class=\"overview-kpi-value\">8,556",
  "住家被害</div><div class=\"overview-kpi-value\">4,042",
  "断水</div><div class=\"needs-kpi-value\">約46,700戸",
  "開設避難所</div><div class=\"metric-value\">206",
  "DMAT4チーム活動中",
];
for (const value of forbiddenCurrentClaims) {
  assert.ok(!html.includes(value), `旧値を現況として表示しています: ${value}`);
}

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
const rawTotals = needs.reduce(
  (totals, row) => {
    totals.shelters += row.raw.shelters;
    totals.evacuees += row.raw.evacuees;
    totals.waterOutage += row.raw.waterOutage;
    totals.waterPoints += row.raw.waterPoints;
    totals.housing += row.raw.housingTotal;
    totals.human += row.raw.humanTotal;
    return totals;
  },
  { shelters: 0, evacuees: 0, waterOutage: 0, waterPoints: 0, housing: 0, human: 0 },
);
assert.deepEqual(rawTotals, {
  shelters: 65,
  evacuees: 2_709,
  waterOutage: 4_284,
  waterPoints: 0,
  housing: 38_498,
  human: 396,
});

assert.ok(
  html.includes("24市町の人的被害表内合計396人。県速報の人的被害合計は398人"),
  "市町別人的被害と県合計の差分説明がありません",
);
assert.ok(
  html.includes("住家被害38,498棟と県計38,537棟との差39棟"),
  "市町別住家被害と県合計の差分説明がありません",
);

const dataStart = html.indexOf("const HUBS=");
const dataEnd = html.indexOf("/* MUNICIPAL_SUPPORT_AUDIT_END */") + "/* MUNICIPAL_SUPPORT_AUDIT_END */".length;
assert.ok(dataStart >= 0 && dataEnd > dataStart, "補正後のダッシュボードデータを抽出できません");
const sandbox = {};
runInNewContext(
  `${html.slice(dataStart, dataEnd)}\nglobalThis.__result={HUBS,NEED_MUNICIPALITIES,PROVINCE_NEEDS,TIMELINE_EVENTS,RECORDS,CURRENT_SHELTER_META,CURRENT_SHELTER_ROWS,CURRENT_SHELTERS};`,
  sandbox,
  { timeout: 2_000 },
);
const runtime = sandbox.__result;
assert.equal(runtime.CURRENT_SHELTER_META.currentCount, currentShelterCount, "現行公式避難所一覧の件数がcurrent-shelters.jsonと一致しません");
assert.equal(
  JSON.stringify(runtime.CURRENT_SHELTER_ROWS),
  JSON.stringify(currentShelterRows),
  "HTMLに埋め込んだ現行避難所データがcurrent-shelters.jsonと一致しません",
);
assert.equal(
  runtime.CURRENT_SHELTER_META.sourceAsOf,
  currentShelterData.meta.source_last_modified || currentShelterData.meta.fetched_at,
  "HTMLに埋め込んだ現行公式避難所JSONの最終更新時点がcurrent-shelters.jsonと一致しません",
);
assert.match(runtime.CURRENT_SHELTER_META.currentDefinition, /shelterStartTimestamp.*shelterEndTimestamp/iu, "現行一覧の抽出定義が明示されていません");
assert.equal(runtime.CURRENT_SHELTER_ROWS.length, currentShelterCount, "現行公式避難所一覧を削除・重複しています");
assert.equal(currentShelterConflictCount, 0, "conflict座標を現行地図へ採用しています");
assert.equal(currentShelterConfirmedCount, runtime.CURRENT_SHELTER_ROWS.filter((row) => row.coordinate_status === "confirmed" && Number.isFinite(row.lat) && Number.isFinite(row.lng)).length, "地図表示可能数の算出がcurrent-shelters.jsonと一致しません");
assert.equal(currentShelterUnresolvedCount, runtime.CURRENT_SHELTER_ROWS.filter((row) => row.coordinate_status === "unresolved").length, "座標未確認数がcurrent-shelters.jsonと一致しません");
assert.equal(runtime.CURRENT_SHELTERS.filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng)).length, currentShelterConfirmedCount, "地図表示数が現行座標確認済み件数と一致しません");
assert.equal(currentShelterConfirmedCount + currentShelterUnresolvedCount + currentShelterConflictCount, currentShelterCount, "現行避難所の座標状態が総数を網羅していません");
assert.ok(runtime.CURRENT_SHELTERS.filter((row) => row.coordinateStatus === "unresolved").every((row) => row.lat === null && row.lng === null), "座標未確認施設に推測座標があります");
assert.ok(runtime.CURRENT_SHELTERS.every((row) => row.source === "current-official-list"), "現行地図が8月2日履歴データ由来になっています");
assert.ok(html.includes("historyRecords:PREGEOCODED_SHELTERS.map"), "206点の履歴レイヤーが現行データと分離されていません");
assert.ok(html.includes("filteredShelters().filter(isCurrentShelterMappable)"), "現行地図が座標確認済み施設だけを表示していません");
assert.ok(!html.includes("shelterState={records:PREGEOCODED_SHELTERS"), "206点を現行避難所データとして初期化しています");
assert.equal(new Set(runtime.CURRENT_SHELTER_ROWS.map((row) => `${row.municipality_code}|${row.name}|${row.address}`)).size, currentShelterCount, "現行公式一覧の施設識別子が重複しています");
assert.ok(runtime.HUBS.some((hub) => hub.id === "mifune"), "御船町の既存代表点が支援地図にありません");
assert.ok(runtime.HUBS.some((hub) => hub.id === "ashikita"), "芦北町の既存代表点が支援地図にありません");
assert.ok(runtime.PROVINCE_NEEDS.find((item) => item.id === "p-admin").observed.includes("38,537棟"), "住家被害の最新県計が支援ニーズに反映されていません");
assert.equal(runtime.TIMELINE_EVENTS.find((event) => event.id === "t-current-status").date, "2026-08-24", "現況タイムラインの日付が最新報告と一致しません");
const management = runtime.RECORDS.find((record) => record.id === "ehime-management");
assert.equal(management.scale, "67人（県27・市町40）／延292人日");
assert.ok(!`${management.title}${management.status}${management.period}${management.detail}`.includes("第2班"), "先遣隊に根拠のない班名があります");
const dmat = runtime.RECORDS.find((record) => record.id === "ehime-dmat");
assert.ok(dmat.providers.includes("愛媛大学医学部附属病院"), "DMAT派遣元の正式名称がありません");
const finance = runtime.RECORDS.find((record) => record.id === "national-finance");
assert.equal(finance.status, "交付決定");
const admin = runtime.RECORDS.find((record) => record.id === "kumamoto-internal");
assert.equal(admin.hubIds.length, 7, "行政応援職員の当日派遣先数が一致しません");
assert.equal(runtime.TIMELINE_EVENTS.find((event) => event.id === "t-payment").phase, "recovery", "過去の未確認予定を今後予定に含めています");
assert.ok(runtime.TIMELINE_EVENTS.every((event) => Array.isArray(event.tags)), "タイムラインの全イベントにtags配列が必要です");
const ehimeDmat = runtime.RECORDS.find((record) => record.id === "ehime-dmat");
assert.equal(ehimeDmat.scale, "4人（延18人日）", "愛媛DMATコーディネーションの人数が8月24日公式発表と一致しません");
assert.equal(JSON.stringify(ehimeDmat.hubIds), JSON.stringify(["kumamoto-hq"]), "愛媛DMATコーディネーションの派遣先が8月24日公式発表と一致しません");
for (const id of ["ehime-redcross-medcoord", "ehime-redcross-mental", "ehime-jrat"]) assert.ok(runtime.RECORDS.some((record) => record.id === id), `${id}の愛媛県公式発表レコードがありません`);
assert.equal(runtime.TIMELINE_EVENTS.find((event) => event.id === "t-ehime-aug12").summary, "DMAT調整員1人、保健師等第3班、DWAT、警察部隊、日赤・JRATの後続支援予定を更新。", "愛媛県8月12日更新イベントが最新公式発表と一致しません");

assert.ok(runtime.PROVINCE_NEEDS.find((item) => item.id === "p-agri").observed.includes("7,881件、約1,559億円"), "8月19日商工業被害の最新値が反映されていません");
assert.equal(runtime.TIMELINE_EVENTS.find((event) => event.id === "t-hq18").summary, "8月8日14時時点：避難者6,355人、断水34,780戸、住家被害18,791棟。", "第18回会議イベントに時点の異なる値が混在しています");

const extendedEnd = html.indexOf("/* MUNICIPAL_SUPPORT_AUDIT_END */") + "/* MUNICIPAL_SUPPORT_AUDIT_END */".length;
assert.ok(extendedEnd > dataStart, "追加の支援割当データを検証できません");
const extendedSandbox = {};
runInNewContext(
  `${html.slice(dataStart, extendedEnd)}\nglobalThis.__extended={NEED_MUNICIPALITIES,RECORDS,SUPPORT_BLOCKS};`,
  extendedSandbox,
  { timeout: 5_000 },
);
const extended = extendedSandbox.__extended;
assert.ok(extended.NEED_MUNICIPALITIES.find((item) => item.name === "熊本市").currentSupport.some((value) => value.includes("8月24日18:06再監査")), "熊本市の他自治体支援全件再監査が反映されていません");
assert.ok(extended.NEED_MUNICIPALITIES.find((item) => item.name === "嘉島町").currentSupport.some((value) => value.includes("8月24日18:06再監査")), "嘉島町の他自治体支援全件再監査が反映されていません");
const auditedKumamoto=extended.RECORDS.find((record)=>record.id==="pair-kumamoto");
assert.equal(auditedKumamoto.auditCheckedAt,"2026-08-24T18:06:00+09:00","熊本市対口支援の全件再監査時刻が不正です");
assert.ok(auditedKumamoto.providers.includes("東京都")&&auditedKumamoto.providers.includes("神奈川県"),"熊本市の現在確認済み派遣元が反映されていません");
assert.ok(auditedKumamoto.detail.includes("HISTORICAL")&&auditedKumamoto.detail.includes("UNKNOWN"),"旧割当履歴と未確認状態が分離されていません");
assert.equal(extended.RECORDS.find((record)=>record.id==="pharmacy").providers.length,0,"モバイルファーマシーの旧活動主体をCURRENT扱いしています");
assert.ok(extended.SUPPORT_BLOCKS.filter((block)=>block.id!=="internal-coordination").every((block)=>block.badge.includes("旧割当履歴")),"地域ブロックが旧割当名簿を現行扱いしています");
assert.ok(extended.SUPPORT_BLOCKS.some((block) => block.id === "internal-coordination" && block.destinations.includes("御船町")), "県内調整分ブロックがありません");

console.log(JSON.stringify({
  currentAsOf: "2026-08-24T08:00:00+09:00",
  siteCheckedAt: "2026-08-24T18:06:00+09:00",
  shelters: rawTotals.shelters,
  evacuees: rawTotals.evacuees,
  housingMunicipalRows: rawTotals.housing,
  housingPrefectureTotal: 38_537,
  shelterCoordinateSnapshot: 206,
}));

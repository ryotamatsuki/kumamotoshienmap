import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const publicPath = resolve(root, "public", "dashboard.html");
const [html, publicHtml, volunteerCss] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(publicPath, "utf8"),
  readFile(resolve(root, "volunteer.css"), "utf8"),
]);

assert.equal(publicHtml, html, "公開用HTMLがレビュー元HTMLと一致していません");

const requiredText = [
  "経過日 D+20（主要公表値は8月16日14時）",
  "3,121<span class=\"overview-kpi-unit\">人",
  "71<span class=\"overview-kpi-unit\">か所",
  "394<span class=\"overview-kpi-unit\">人",
  "31,728<span class=\"overview-kpi-unit\">棟",
  "約10,000戸",
  "給水車131台",
  "行政応援925人",
  "TEC-FORCE現在103人・累計3,703人日",
  "最新集計71か所／位置履歴206点",
  "同梱206点は現在開設中の施設一覧として扱わない",
  'checkedAt":"2026-08-17T09:45:00+09:00"',
  "status:\"8月2日時点で開設\"",
  'data-view="overview"',
  'data-view="needs"',
  'data-view="timeline"',
  'data-view="dashboard"',
  'data-view="volunteer"',
  'data-view="map"',
  'id="volunteerLayerToggle"',
  "3,294件、約952億円",
  "7市町への対口支援",
  "計10市町へ行政応援",
  "8月15日までの確定支援",
  '@media(max-width:760px)',
];
for (const value of requiredText) {
  assert.ok(html.includes(value), `最新時点の必須表示がありません: ${value}`);
}

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
assert.equal(impacts.reduce((sum, row) => sum + row.shelters, 0), 71);
assert.equal(impacts.reduce((sum, row) => sum + row.evacuees, 0), 3_121);

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
  shelters: 71,
  evacuees: 3_121,
  waterOutage: 10_035,
  waterPoints: 0,
  housing: 31_723,
  human: 391,
});

assert.ok(
  html.includes("24市町の人的被害表内合計391人。県速報の人的被害合計は394人"),
  "市町別人的被害と県合計の差分説明がありません",
);
assert.ok(
  html.includes("住家被害31,723棟と県計31,728棟との差5棟"),
  "市町別住家被害と県合計の差分説明がありません",
);

const dataStart = html.indexOf("const HUBS=");
const dataEnd = html.indexOf("const SHELTER_EXPECTED_TOTAL=206;");
assert.ok(dataStart >= 0 && dataEnd > dataStart, "補正後のダッシュボードデータを抽出できません");
const sandbox = {};
runInNewContext(
  `${html.slice(dataStart, dataEnd)}\nglobalThis.__result={HUBS,NEED_MUNICIPALITIES,PROVINCE_NEEDS,TIMELINE_EVENTS,RECORDS};`,
  sandbox,
  { timeout: 2_000 },
);
const runtime = sandbox.__result;
assert.ok(runtime.HUBS.some((hub) => hub.id === "mifune"), "御船町の既存代表点が支援地図にありません");
assert.ok(runtime.HUBS.some((hub) => hub.id === "ashikita"), "芦北町の既存代表点が支援地図にありません");
assert.ok(runtime.PROVINCE_NEEDS.find((item) => item.id === "p-admin").observed.includes("31,728棟"), "住家被害の最新県計が支援ニーズに反映されていません");
assert.equal(runtime.TIMELINE_EVENTS.find((event) => event.id === "t-current-status").date, "2026-08-16", "現況タイムラインの日付が最新報告と一致しません");
const management = runtime.RECORDS.find((record) => record.id === "ehime-management");
assert.equal(management.scale, "現行13人（県職員4・市町職員9）／累計41人・162人日");
assert.ok(!`${management.title}${management.status}${management.period}${management.detail}`.includes("第2班"), "先遣隊に根拠のない班名があります");
const dmat = runtime.RECORDS.find((record) => record.id === "ehime-dmat");
assert.ok(dmat.providers.includes("公立学校共済組合四国中央病院"), "DMAT派遣元の正式名称がありません");
const finance = runtime.RECORDS.find((record) => record.id === "national-finance");
assert.equal(finance.status, "繰上げ交付決定・実施確認なし");
const admin = runtime.RECORDS.find((record) => record.id === "kumamoto-internal");
assert.equal(admin.hubIds.length, 10, "行政応援職員の当日派遣先数が一致しません");
assert.equal(runtime.TIMELINE_EVENTS.find((event) => event.id === "t-payment").phase, "recovery", "過去の未確認予定を今後予定に含めています");
assert.ok(runtime.TIMELINE_EVENTS.every((event) => Array.isArray(event.tags)), "タイムラインの全イベントにtags配列が必要です");
const ehimeDmat = runtime.RECORDS.find((record) => record.id === "ehime-dmat");
assert.equal(ehimeDmat.scale, "第2陣1人", "愛媛DMAT第2陣の人数が8月14日公式発表と一致しません");
assert.equal(JSON.stringify(ehimeDmat.hubIds), JSON.stringify(["yatsushiro"]), "愛媛DMAT調整員の派遣先が8月12日公式発表と一致しません");
for (const id of ["ehime-redcross-medcoord", "ehime-redcross-mental", "ehime-jrat"]) assert.ok(runtime.RECORDS.some((record) => record.id === id), `${id}の愛媛県公式発表レコードがありません`);
assert.equal(runtime.TIMELINE_EVENTS.find((event) => event.id === "t-ehime-aug12").summary, "DMAT調整員1人、保健師等第3班、DWAT、警察部隊、日赤・JRATの後続支援予定を更新。", "愛媛県8月12日更新イベントが最新公式発表と一致しません");

assert.ok(runtime.PROVINCE_NEEDS.find((item) => item.id === "p-agri").observed.includes("3,294件、約952億円"), "8月11日商工業被害の最新値が反映されていません");
assert.equal(runtime.TIMELINE_EVENTS.find((event) => event.id === "t-hq18").summary, "8月8日14時時点：避難者6,355人、断水34,780戸、住家被害18,791棟。", "第18回会議イベントに時点の異なる値が混在しています");

const extendedEnd = html.indexOf("const PAGE_RECHECK_META=");
assert.ok(extendedEnd > dataStart, "追加の支援割当データを検証できません");
const extendedSandbox = {};
runInNewContext(
  `${html.slice(dataStart, extendedEnd)}\nglobalThis.__extended={NEED_MUNICIPALITIES,RECORDS,SUPPORT_BLOCKS};`,
  extendedSandbox,
  { timeout: 5_000 },
);
const extended = extendedSandbox.__extended;
assert.ok(extended.NEED_MUNICIPALITIES.find((item) => item.name === "熊本市").currentSupport.includes("対口支援20団体"), "熊本市の対口支援20団体が反映されていません");
assert.ok(extended.NEED_MUNICIPALITIES.find((item) => item.name === "嘉島町").currentSupport.includes("対口支援4団体"), "嘉島町の対口支援が反映されていません");
assert.ok(extended.NEED_MUNICIPALITIES.find((item) => item.name === "御船町").currentSupport.some((value) => value.includes("県内調整分")), "県内調整分の表示がありません");
assert.equal(extended.RECORDS.find((record) => record.id === "pair-kumamoto").scale, "20団体", "熊本市の対口支援団体数が8月11日値ではありません");
assert.equal(extended.RECORDS.find((record) => record.id === "pair-yatsushiro").scale, "9団体", "八代市の対口支援団体数が8月11日値ではありません");
assert.equal(extended.RECORDS.find((record) => record.id === "pair-hikawa").scale, "7団体", "氷川町の対口支援団体数が8月11日値ではありません");
assert.ok(extended.RECORDS.some((record) => record.id === "pair-kashima" && record.scale === "4団体"), "嘉島町の対口支援レコードがありません");
assert.ok(extended.SUPPORT_BLOCKS.some((block) => block.id === "internal-coordination" && block.destinations.includes("御船町")), "県内調整分ブロックがありません");

console.log(JSON.stringify({
  currentAsOf: "2026-08-16T14:00:00+09:00",
  siteCheckedAt: "2026-08-17T09:45:00+09:00",
  shelters: rawTotals.shelters,
  evacuees: rawTotals.evacuees,
  housingMunicipalRows: rawTotals.housing,
  housingPrefectureTotal: 31_728,
  shelterCoordinateSnapshot: 206,
}));

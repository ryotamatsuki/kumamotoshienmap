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
  "経過日 D+12（主要公表値はD+11・8月8日14時）",
  "6,355<span class=\"overview-kpi-unit\">人",
  "118<span class=\"overview-kpi-unit\">か所",
  "208<span class=\"overview-kpi-unit\">人",
  "18,791<span class=\"overview-kpi-unit\">棟",
  "約34,780戸",
  "給水車177台",
  "行政応援808人",
  "TEC-FORCE当日14班・累計626人",
  "最新集計118か所／位置履歴206点",
  "同梱206点は現在開設中の施設一覧として扱わない",
  "checkedAt:'2026-08-09T10:48:16+09:00'",
  "status:\"8月2日時点で開設\"",
  'data-view="overview"',
  'data-view="needs"',
  'data-view="timeline"',
  'data-view="dashboard"',
  'data-view="volunteer"',
  'data-view="map"',
  'id="volunteerLayerToggle"',
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
assert.equal(impacts.length, 12, "開設避難所の市町数が公式集計と一致しません");
assert.equal(impacts.reduce((sum, row) => sum + row.shelters, 0), 118);
assert.equal(impacts.reduce((sum, row) => sum + row.evacuees, 0), 6_355);

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
  shelters: 118,
  evacuees: 6_355,
  waterOutage: 34_780,
  waterPoints: 49,
  housing: 18_788,
  human: 205,
});

assert.ok(
  html.includes("24市町の人的被害合計205人と県計208人との差3人"),
  "市町別人的被害と県合計の差分説明がありません",
);
assert.ok(
  html.includes("住家被害18,788棟と県計18,791棟との差3棟"),
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
const management = runtime.RECORDS.find((record) => record.id === "ehime-management");
assert.equal(management.scale, "先遣隊4人");
assert.ok(!`${management.title}${management.status}${management.period}${management.detail}`.includes("第2班"), "先遣隊に根拠のない班名があります");
const dmat = runtime.RECORDS.find((record) => record.id === "ehime-dmat");
assert.ok(dmat.providers.includes("公立学校共済組合四国中央病院"), "DMAT派遣元の正式名称がありません");
const finance = runtime.RECORDS.find((record) => record.id === "national-finance");
assert.equal(finance.status, "繰上げ交付決定・実施確認なし");
const admin = runtime.RECORDS.find((record) => record.id === "kumamoto-internal");
assert.equal(admin.hubIds.length, 10, "行政応援職員の当日派遣先数が一致しません");
assert.equal(runtime.TIMELINE_EVENTS.find((event) => event.id === "t-payment").phase, "recovery", "過去の未確認予定を今後予定に含めています");

console.log(JSON.stringify({
  currentAsOf: "2026-08-08T14:00:00+09:00",
  siteCheckedAt: "2026-08-09T10:48:16+09:00",
  shelters: rawTotals.shelters,
  evacuees: rawTotals.evacuees,
  housingMunicipalRows: rawTotals.housing,
  housingPrefectureTotal: 18_791,
  shelterCoordinateSnapshot: 206,
}));

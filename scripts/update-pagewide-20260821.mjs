import { readFile, writeFile } from "node:fs/promises";

const file = "ehime_kumamoto_support_geocoded_shelters_20260802.html";
const checkedAt = "2026-08-21T15:00:00+09:00";
const checkedLabel = "2026年8月21日 15:00";
const prefectureReportUrl = "https://www.pref.kumamoto.jp/uploaded/life/277838_875456_misc.pdf";
const prefectureReportPageUrl = "https://www.pref.kumamoto.jp/soshiki/222/276831.html";
const mlitReportUrl = "https://www.mlit.go.jp/common/002017654.pdf";
const ehimeReportUrl = "https://www.pref.ehime.jp/uploaded/attachment/188363.pdf";
const governmentMeetingUrl = "https://www.pref.kumamoto.jp/uploaded/attachment/317153.pdf";
const cabinetOfficeReportUrl = "https://www.bousai.go.jp/updates/r8kumamoto_jishin/status/pdf/r8kumamoto_jishin_20260820.pdf";

function parseJsonConstant(text, name, nextMarker) {
  const marker = `const ${name}=`;
  const valueStart = text.indexOf(marker) + marker.length;
  const next = text.indexOf(nextMarker, valueStart);
  const valueEnd = text.lastIndexOf("];", next);
  if (valueStart < marker.length || next < 0 || valueEnd < valueStart) throw new Error(`${name} not found`);
  return { valueStart, valueEnd, value: JSON.parse(text.slice(valueStart, valueEnd + 1)) };
}

function replaceJsonConstant(text, name, nextMarker, value) {
  const part = parseJsonConstant(text, name, nextMarker);
  return text.slice(0, part.valueStart) + JSON.stringify(value) + text.slice(part.valueEnd + 1);
}

function replaceOnce(text, from, to) {
  if (!text.includes(from)) throw new Error(`Expected text not found: ${from}`);
  return text.replace(from, to);
}

function round(value) { return Math.round(value * 10) / 10; }
function level(value) { return value >= 70 ? "very-high" : value >= 45 ? "high" : value >= 20 ? "medium" : value > 0 ? "watch" : "limited"; }
function humanDetails(values) {
  return { mild: values[0], moderate: values[1], severe: values[2], cardiopulmonaryArrest: values[3], deaths: values[4], unclassified: values[5] };
}
function housingDetails(values) {
  return { destroyed: values[0], largeScaleHalfDestroyed: values[1], halfDestroyed: values[2], partiallyDamaged: values[3], unclassified: values[4] };
}

const latest = {
  "熊本市": { s: 7, e: 201, h: [11, 57, 3, 0, 0, 3], house: [11, 4, 73, 5139, 6260], water: null },
  "宇土市": { s: 1, e: 82, h: [6, 0, 0, 0, 0, 5], house: [8, 14, 58, 1932, 4017], water: null },
  "宇城市": { s: 9, e: 680, h: [4, 25, 1, 0, 3, 0], house: [200, 0, 800, 3600, 0], water: 2579 },
  "美里町": { s: 3, e: 24, h: [11, 0, 9, 0, 0, 0], house: [37, 11, 41, 795, 14], water: null },
  "玉名市": { s: 0, e: 0, h: [1, 0, 1, 0, 0, 0], house: [0, 0, 1, 26, 12], water: null },
  "山鹿市": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0], water: null },
  "菊池市": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0], water: null },
  "合志市": { s: 0, e: 0, h: [1, 0, 0, 0, 0, 0], house: [0, 0, 0, 152, 0], water: null },
  "大津町": { s: 0, e: 0, h: [2, 1, 0, 0, 0, 0], house: [0, 0, 0, 1, 0], water: null },
  "菊陽町": { s: 0, e: 0, h: [2, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0], water: null },
  "西原村": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0], water: null },
  "御船町": { s: 1, e: 21, h: [11, 6, 4, 0, 0, 0], house: [0, 0, 0, 0, 1906], water: null },
  "嘉島町": { s: 2, e: 6, h: [12, 0, 4, 0, 7, 0], house: [0, 0, 0, 0, 316], water: null },
  "益城町": { s: 1, e: 20, h: [0, 7, 4, 0, 0, 0], house: [29, 0, 200, 802, 2072], water: null },
  "甲佐町": { s: 2, e: 6, h: [0, 0, 1, 0, 1, 0], house: [0, 0, 0, 0, 947], water: null },
  "山都町": { s: 0, e: 0, h: [0, 0, 1, 0, 0, 0], house: [0, 0, 0, 38, 36], water: null },
  "八代市": { s: 38, e: 1588, h: [0, 0, 0, 0, 20, 147], house: [874, 0, 0, 745, 881], water: 1021 },
  "氷川町": { s: 4, e: 296, h: [0, 0, 0, 0, 5, 14], house: [387, 107, 377, 1093, 0], water: 684 },
  "水俣市": { s: 0, e: 0, h: [0, 0, 1, 0, 0, 0], house: [0, 0, 11, 61, 0], water: null },
  "芦北町": { s: 1, e: 1, h: [3, 0, 0, 0, 0, 0], house: [9, 2, 66, 486, 132], water: null },
  "津奈木町": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 1, 0], water: null },
  "人吉市": { s: 0, e: 0, h: [1, 0, 0, 0, 0, 1], house: [0, 0, 0, 25, 1], water: null },
  "上天草市": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 78, 0], water: null },
  "天草市": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 102, 50], water: null },
};

const source = await readFile(file, "utf8");
let updated = source;

const needsPart = parseJsonConstant(updated, "NEED_MUNICIPALITIES", "const NEED_LESSONS=");
const needs = needsPart.value;
const max = {
  evacuees: Math.max(...needs.map((row) => latest[row.name].e)),
  shelters: Math.max(...needs.map((row) => latest[row.name].s)),
  outage: Math.max(...needs.map((row) => latest[row.name].water || 0)),
  human: Math.max(...needs.map((row) => latest[row.name].h.reduce((a, b) => a + b, 0))),
  housing: Math.max(...needs.map((row) => latest[row.name].house.reduce((a, b) => a + b, 0))),
};

for (const row of needs) {
  const value = latest[row.name];
  if (!value) throw new Error(`Missing latest municipality: ${row.name}`);
  row.raw.shelters = value.s;
  row.raw.evacuees = value.e;
  row.raw.waterOutage = value.water;
  row.raw.waterPoints = null;
  row.raw.waterSourceUrl = mlitReportUrl;
  row.raw.humanDetails = humanDetails(value.h);
  row.raw.humanTotal = value.h.reduce((a, b) => a + b, 0);
  row.raw.deaths = value.h[4];
  row.raw.housingDetails = housingDetails(value.house);
  row.raw.housingTotal = value.house.reduce((a, b) => a + b, 0);

  const shelterScore = (value.e ? 70 * Math.sqrt(value.e / max.evacuees) : 0) + (value.s ? 30 * Math.sqrt(value.s / max.shelters) : 0);
  const waterScore = value.water ? 100 * Math.sqrt(value.water / max.outage) : 0;
  const humanValue = value.h.reduce((a, b) => a + b, 0);
  const housingValue = value.house.reduce((a, b) => a + b, 0);
  const healthScore = humanValue ? 100 * Math.sqrt(humanValue / max.human) : 0;
  const housingScore = housingValue ? 100 * Math.sqrt(housingValue / max.housing) : 0;
  row.scores.shelter = round(shelterScore);
  row.scores.water = round(waterScore);
  row.scores.health = round(healthScore);
  row.scores.housing = round(housingScore);
  row.scores.administration = round(housingScore * 0.55 + shelterScore * 0.45);
  for (const key of ["shelter", "water", "health", "housing", "administration"]) row.levels[key] = level(row.scores[key]);

  const keptEvidence = (row.evidence || []).filter((value) => !/^(避難者|人的被害：|住家被害|断水)/.test(value));
  const evidence = [
    `避難者${value.e.toLocaleString("ja-JP")}人／避難所${value.s}か所`,
    `人的被害：軽症${value.h[0]}人、中等症${value.h[1]}人、重症${value.h[2]}人、死亡${value.h[4]}人、分類未確定${value.h[5]}人`,
    ...keptEvidence,
    `住家被害${row.raw.housingTotal.toLocaleString("ja-JP")}棟（全壊${value.house[0]}、大規模半壊${value.house[1]}、半壊${value.house[2]}、一部破損${value.house[3].toLocaleString("ja-JP")}、分類未確定${value.house[4].toLocaleString("ja-JP")}）`,
  ];
  if (value.water !== null) evidence.push(`断水${value.water.toLocaleString("ja-JP")}戸（国土交通省第47報・8月21日7時30分）`);
  row.evidence = [...new Set(evidence)];
  row.sourceUrl = prefectureReportUrl;
  row.detailSourceUrl = prefectureReportUrl;
  row.topNeeds = Object.keys(row.scores).filter((key) => row.scores[key] > 0).sort((a, b) => row.scores[b] - row.scores[a]);
  row.overallLevel = row.topNeeds.length ? level(row.scores[row.topNeeds[0]]) : "limited";
}
updated = replaceJsonConstant(updated, "NEED_MUNICIPALITIES", "const NEED_LESSONS=", needs);

const impacts = needs.filter((row) => latest[row.name].s || latest[row.name].e).map((row) => ({
  name: row.name,
  shelters: row.raw.shelters,
  evacuees: row.raw.evacuees,
  lat: row.coords[0],
  lng: row.coords[1],
}));
updated = replaceJsonConstant(updated, "IMPACTS", "const SUPPORT_BLOCKS=", impacts);

const provinceNeeds = parseJsonConstant(updated, "PROVINCE_NEEDS", "const NEED_READINESS=").value;
const provinceObserved = {
  "p-water": "国土交通省第47報（8月21日7時30分）では熊本県内の現在断水は約4,300戸。表掲載は八代市1,021戸、宇城市2,579戸、氷川町684戸の計4,284戸。内閣府8月20日9時の4,892戸とは時点・集計定義が異なる。",
  "p-shelter": "熊本県第36報（8月20日14時）では11市町村69か所の避難所に2,925人。現行公式JSONは8月21日12時35分更新の71施設で、定義と時点が異なる。",
  "p-admin": "熊本県第36報では住家被害35,048棟（推計含む）、分類未確定16,644棟。市町別表の内訳と県計を分けて表示する。",
  "p-housing": "熊本県第36報では全壊1,555棟、大規模半壊138棟、半壊1,627棟、一部破損15,084棟、分類未確定16,644棟。推計を含み今後変動する。",
};
for (const item of provinceNeeds) if (provinceObserved[item.id]) item.observed = provinceObserved[item.id];
updated = replaceJsonConstant(updated, "PROVINCE_NEEDS", "const NEED_READINESS=", provinceNeeds);

const records = parseJsonConstant(updated, "RECORDS", "const SHELTER_MUNICIPALITIES=").value;
const recordById = new Map(records.map((record) => [record.id, record]));
function refreshRecord(id, values) {
  let record = recordById.get(id);
  if (!record) {
    record = { id, provider: id.startsWith("ehime") ? "ehime" : "national", category: "administration", hubIds: [], title: id, providers: [], status: "要確認", scale: null, period: null, detail: null, asOf: null, sourceLabel: null, sourceUrl: null };
    records.push(record);
    recordById.set(id, record);
  }
  Object.assign(record, values);
}
const latestRecordBase = {
  asOf: "愛媛県 8月14日12時",
  sourceLabel: "愛媛県 本県の支援状況",
  sourceUrl: ehimeReportUrl,
};
refreshRecord("ehime-management", {
  ...latestRecordBase,
  status: "活動中（現行派遣）",
  scale: "現行13人（県職員4・市町職員9）／累計41人・162人日",
  period: "8月14日12時時点",
  detail: "氷川町災害対策本部2人、竜北東小学校8人、竜北西小学校3人。現行派遣13人と累計派遣41人・162人日を分けて表示。",
});
refreshRecord("ehime-dmat", {
  ...latestRecordBase,
  hubIds: ["yatsushiro"],
  status: "第2陣活動期間中（実働要確認）",
  scale: "第2陣1人",
  period: "8月13日～17日（八代保健所管内）／第3陣2人は8月21日～25日予定",
  detail: "愛媛DMAT第2陣1人が8月13日～17日に八代保健所管内で活動。第3陣2人は8月21日～25日予定。予定と実働完了を混同しない。",
});
refreshRecord("ehime-health", {
  ...latestRecordBase,
  hubIds: ["hikawa"],
  status: "第3班活動期間中（実働要確認）",
  scale: "第3班3人",
  period: "8月12日～17日（氷川保健所管内）／第6班まで8月31日予定",
  detail: "保健師等第3班3人が8月12日～17日に氷川保健所管内で活動。第6班までの派遣予定は実働・完了と分けて表示。",
});
refreshRecord("ehime-dpat", {
  ...latestRecordBase,
  status: "第2班終了・後続予定（実働要確認）",
  scale: "第2班終了／第3班2人予定",
  period: "第2班8月9日～12日／第3班8月21日～25日予定",
  detail: "DPAT第2班の予定期間は終了。第3班2人は8月21日～25日予定。実働完了は要確認。",
});
refreshRecord("ehime-redcross", {
  ...latestRecordBase,
  hubIds: ["uki"],
  status: "後続班予定（実働要確認）",
  scale: "救護7人／医療調整3人／こころのケア4人",
  period: "救護第2班8月20日～25日／医療調整8月19日～26日／こころのケア8月22日～28日",
  detail: "日本赤十字社愛媛県支部の救護、医療調整、こころのケアの後続派遣予定を別区分で表示。実働は要確認。",
});
refreshRecord("ehime-police", {
  ...latestRecordBase,
  status: "特別犯罪抑止部隊活動期間中（実働要確認）",
  scale: "4人",
  period: "8月11日～19日",
  detail: "愛媛県警の特別犯罪抑止部隊4人の活動期間を更新。活動実績の完了は別途確認。",
});
refreshRecord("ehime-base", {
  ...latestRecordBase,
  status: "実施・提供中（項目別）",
  scale: "提供可能住宅179戸、キッチンカー1,920食、トイレ・水循環設備等",
  period: "8月14日12時時点",
  detail: "大型トイレカー、循環式シャワー・手洗い設備、宇和島市トイレカー2台を提供。キッチンカーは1,920食、提供可能住宅は179戸。",
});
refreshRecord("ehime-shelter-ops", {
  ...latestRecordBase,
  hubIds: ["hikawa"],
  status: "派遣中（終期要確認）",
  scale: "現行支援13人",
  period: "8月14日12時時点",
  detail: "氷川町災害対策本部、竜北東小学校、竜北西小学校の現行支援13人を表示。累計値は愛媛県職員派遣記録と分ける。",
});
refreshRecord("national-water", {
  hubIds: ["kumamoto-hq", "yatsushiro", "uki", "hikawa"],
  status: "活動中",
  scale: "給水車129台",
  period: "国土交通省第47報（8月21日7時30分）",
  detail: "現在断水は熊本県内約4,300戸。表では八代市1,021戸、宇城市2,579戸、氷川町684戸の計4,284戸。給水車129台は断水戸数と定義を分けて表示。",
  asOf: "国土交通省 第47報（8月21日）",
  sourceLabel: "国土交通省（現地対策本部）第47報",
  sourceUrl: mlitReportUrl,
});
refreshRecord("national-tec", {
  hubIds: ["kumamoto-hq", "yatsushiro"],
  status: "活動中",
  scale: "現在105人・累計4,299人日",
  period: "国土交通省第47報（8月21日10時）",
  detail: "TEC-FORCEの現在派遣105人、累計4,299人日（予定含む）。現在人数と累計実績を分け、予定を実績化しない。",
  asOf: "国土交通省 第47報（8月21日）",
  sourceLabel: "国土交通省（現地対策本部）第47報",
  sourceUrl: mlitReportUrl,
});
refreshRecord("kumamoto-internal", {
  hubIds: ["kumamoto-hq", "yatsushiro", "uto", "uki", "misato", "kashima", "hikawa"],
  status: "活動中・最新会議資料まで確認",
  scale: "行政応援925人／関係機関含む計1,005人",
  period: "8月15日14時資料",
  detail: "熊本県・政府合同会議資料で行政応援925人、他機関80人、計1,005人。人員の定義と対象日を分けて表示。",
  asOf: "熊本県・政府合同会議 8月15日14時",
  sourceLabel: "熊本県・政府合同会議資料",
  sourceUrl: governmentMeetingUrl,
});
refreshRecord("national-coordination", {
  status: "8月15日資料まで確認・8月17日会議結果要確認",
  scale: "行政応援925人／関係機関含む計1,005人",
  period: "8月15日14時資料／次回会議8月17日16時予定",
  detail: "8月15日14時の熊本県・政府合同会議資料を最新確認値とし、8月17日16時予定会議の結果は確認できるまで実績化しない。",
  asOf: "熊本県・政府合同会議 8月15日14時",
  sourceLabel: "熊本県・政府合同会議資料",
  sourceUrl: governmentMeetingUrl,
});
refreshRecord("national-medical", {
  status: "活動中・後続班予定",
  scale: "愛媛県保健・医療班は別途13人現行支援",
  period: "8月14日12時時点",
  detail: "熊本県全体の保健医療福祉支援会議と愛媛県派遣班を混同せず、愛媛県分は個別レコードで表示。",
  asOf: "愛媛県 8月14日12時・熊本県資料",
  sourceLabel: "愛媛県 本県の支援状況・熊本県資料",
  sourceUrl: ehimeReportUrl,
});

function ensureRecord(record) {
  if (!recordById.has(record.id)) {
    records.push(record);
    recordById.set(record.id, record);
  }
}
ensureRecord({ id: "ehime-dwat", provider: "ehime", category: "medical", hubIds: ["yatsushiro"], title: "愛媛DWAT", providers: ["愛媛県", "愛媛DWAT"], status: "第2班活動期間中（実働要確認）", scale: "3人", period: "8月15日～17日", detail: "愛媛DWAT第2班3人が八代市内避難所へ派遣予定。", ...latestRecordBase });
ensureRecord({ id: "ehime-redcross-medcoord", provider: "ehime", category: "medical", hubIds: ["hikawa"], title: "日本赤十字社愛媛県支部 医療調整", providers: ["日本赤十字社愛媛県支部"], status: "派遣予定（実働要確認）", scale: "3人", period: "8月19日～26日", detail: "日本赤十字社愛媛県支部の医療調整3人を氷川町支援として予定表示。", ...latestRecordBase });
ensureRecord({ id: "ehime-redcross-mental", provider: "ehime", category: "medical", hubIds: ["yatsushiro"], title: "日本赤十字社愛媛県支部 こころのケア", providers: ["日本赤十字社愛媛県支部"], status: "派遣予定（実働要確認）", scale: "4人", period: "8月22日～28日", detail: "日本赤十字社愛媛県支部のこころのケア4人を八代市支援として予定表示。", ...latestRecordBase });
ensureRecord({ id: "ehime-jrat", provider: "ehime", category: "medical", hubIds: ["yatsushiro"], title: "愛媛JRAT", providers: ["愛媛JRAT"], status: "第1班派遣予定（実働要確認）", scale: "3人", period: "8月17日～20日", detail: "愛媛JRAT第1班3人を8月17日～20日派遣予定。後続班は予定表示。", ...latestRecordBase });
ensureRecord({ id: "ehime-social-welfare", provider: "ehime", category: "administration", hubIds: ["uki"], title: "愛媛県・市町社会福祉協議会職員派遣", providers: ["愛媛県", "愛媛県社会福祉協議会", "県内市町社会福祉協議会"], status: "派遣期間中（完了要確認）", scale: "2人", period: "8月16日～20日", detail: "宇城市災害ボランティアセンターへの職員派遣2人を公表情報として表示。完了は要確認。", ...latestRecordBase });
updated = replaceJsonConstant(updated, "RECORDS", "const SHELTER_MUNICIPALITIES=", records);

const timeline = parseJsonConstant(updated, "TIMELINE_EVENTS", "const RECORDS=").value;
const timelineById = new Map(timeline.map((event) => [event.id, event]));
Object.assign(timelineById.get("t-hq18"), {
  summary: "8月8日14時時点：避難者6,355人、断水34,780戸、住家被害18,791棟。",
  detail: "主要数値は8月8日14時時点。後続の8月16日第30報・国土交通省第42報は別イベントとして表示。",
});
Object.assign(timelineById.get("t-current-status"), {
  date: "2026-08-20",
  dateLabel: "8月20日",
  weekday: "日",
  time: "14:00",
  phase: "recovery",
  title: "熊本県第36報で被害・避難所を更新",
  summary: "避難者2,925人、開設避難所69か所、人的被害398人、住家被害35,048棟。",
  detail: "熊本県第36報（8月20日14時現在）。市町別内訳は県合計と分け、推計を含む住家被害は今後変動し得る。現行公式JSONの71施設は別定義で表示。",
  sourceLabel: "熊本県 第36報",
  sourceUrl: prefectureReportUrl,
  tags: ["熊本県第30報", "避難所", "住家被害"],
});
if (!timelineById.has("t-kumamoto-0820")) timeline.push({
  id: "t-kumamoto-0820",
  date: "2026-08-20",
  dateLabel: "8月20日",
  weekday: "木",
  time: "14:00",
  phase: "recovery",
  actor: "kumamoto",
  title: "熊本県第36報を確認",
  summary: "熊本県は避難所69か所・避難者2,925人・人的被害398人・住家被害35,048棟。",
  detail: "県第36報の県計と市町別表は差分があるため、県計を速報KPI、市町別表を支援ニーズの入力値として分けて表示。",
  place: "熊本県内",
  sourceLabel: "熊本県 第36報",
  sourceUrl: prefectureReportUrl,
  recordIds: ["kumamoto-internal"],
  hubIds: ["kumamoto-hq", "yatsushiro", "uki", "hikawa"],
  tags: ["第36報", "避難所", "住家被害", "最新確認"],
});
if (!timelineById.has("t-kumamoto-0821")) timeline.push({
  id: "t-kumamoto-0821",
  date: "2026-08-21",
  dateLabel: "8月21日",
  weekday: "金",
  time: "07:30",
  phase: "recovery",
  actor: "national",
  title: "国土交通省第47報でインフラ・技術支援を更新",
  summary: "熊本県内の現在断水約4,300戸（表掲載4,284戸）、給水車129台、TEC-FORCE現在105人・累計4,299人日。",
  detail: "国土交通省第47報（8月21日10時報、断水は同日7時30分時点）。内閣府の8月20日値とは時点・集計定義が異なるため、資料ごとに表示。",
  place: "熊本県内",
  sourceLabel: "国土交通省 第47報",
  sourceUrl: mlitReportUrl,
  recordIds: ["national-water", "national-tec"],
  hubIds: ["kumamoto-hq", "yatsushiro", "uki", "hikawa"],
  tags: ["第47報", "断水", "給水", "TEC-FORCE", "最新確認"],
});
if (!timelineById.has("t-kumamoto-0816")) timeline.push({
  id: "t-kumamoto-0816",
  date: "2026-08-16",
  dateLabel: "8月16日",
  weekday: "日",
  time: "14:00",
  phase: "recovery",
  actor: "kumamoto",
  title: "熊本県第30報・国土交通省第42報を確認",
  summary: "熊本県は避難所71か所・避難者3,121人・人的被害394人・住家被害31,728棟。国交省は断水約10,000戸、給水車131台、TEC-FORCE現在103人・累計3,703人日。",
  detail: "県・国で対象範囲と時刻が異なるため、避難・被害・断水・技術支援を資料ごとに分けて表示。",
  place: "熊本県内",
  sourceLabel: "熊本県 第30報・国土交通省 第42報",
  sourceUrl: prefectureReportUrl,
  recordIds: ["national-water", "national-tec", "kumamoto-internal"],
  hubIds: ["kumamoto-hq", "yatsushiro", "uki", "hikawa"],
  tags: ["第30報", "第42報", "最新確認"],
});
updated = replaceJsonConstant(updated, "TIMELINE_EVENTS", "const RECORDS=", timeline);

const sources = parseJsonConstant(updated, "SOURCES", "const pairSupportRecords20260811=").value;
const latestSourceEntries = [
  { group: "熊本県", name: "令和8年熊本地震に係る被害情報 第36報", asOf: "2026年8月20日14時現在", url: prefectureReportUrl },
  { group: "熊本県", name: "令和8年熊本地震に係る被害情報一覧", asOf: "第36報まで掲載・2026年8月20日14時現在", url: prefectureReportPageUrl },
  { group: "国・関係機関", name: "国土交通省（現地対策本部）第47報", asOf: "2026年8月21日7時30分～10時", url: mlitReportUrl },
  { group: "国・関係機関", name: "内閣府 令和8年熊本地震に係る被害状況等について", asOf: "2026年8月20日9時現在（断水値は国交省第47報と定義差あり）", url: cabinetOfficeReportUrl },
  { group: "熊本県", name: "熊本県・政府合同会議資料", asOf: "2026年8月15日14時資料", url: governmentMeetingUrl },
  { group: "愛媛県", name: "本県の支援状況について", asOf: "2026年8月14日12時", url: ehimeReportUrl },
];
for (const entry of latestSourceEntries) {
  const existing = sources.find((source) => source.url === entry.url);
  if (existing) Object.assign(existing, entry);
  else sources.unshift(entry);
}
updated = replaceJsonConstant(updated, "SOURCES", "const pairSupportRecords20260811=", sources);

// The page contains an older runtime correction block. Apply the current
// snapshot after that block so static validation and the browser see one state.
const runtimeSnapshot = `
const currentSnapshot20260821={checkedAt:'${checkedAt}',currentAsOf:'2026-08-20T14:00:00+09:00'};
const currentRecordUpdates20260821={
 'ehime-management':{scale:'現行13人（県職員4・市町職員9）／累計41人・162人日',status:'活動中（現行派遣）',period:'8月14日12時時点',detail:'氷川町災害対策本部2人、竜北東小学校8人、竜北西小学校3人。現行派遣13人と累計派遣41人・162人日を分けて表示。',asOf:'愛媛県 8月14日12時',sourceLabel:'愛媛県 本県の支援状況',sourceUrl:'${ehimeReportUrl}'},
 'ehime-dmat':{hubIds:['yatsushiro'],scale:'第2陣1人',status:'活動期間終了・後続実働要確認',period:'第2陣8月13日～17日／第3陣2人は8月21日～25日予定',detail:'愛媛DMAT第2陣1人の公表期間は終了。第3陣2人は8月21日～25日予定で、実働完了とは分けて表示。',asOf:'愛媛県 8月14日12時',sourceLabel:'愛媛県 本県の支援状況',sourceUrl:'${ehimeReportUrl}'},
 'ehime-health':{hubIds:['hikawa'],scale:'第3班3人',status:'活動期間終了・後続実働要確認',period:'第3班8月12日～17日／第6班まで8月31日予定',detail:'保健師等第3班3人の公表期間は終了。第6班までの派遣予定は実働・完了と分けて表示。',asOf:'愛媛県 8月14日12時',sourceLabel:'愛媛県 本県の支援状況',sourceUrl:'${ehimeReportUrl}'},
 'national-water':{scale:'給水車129台',period:'国土交通省第47報（8月21日7時30分）',detail:'現在断水は熊本県内約4,300戸。表では八代市1,021戸、宇城市2,579戸、氷川町684戸の計4,284戸。給水車129台は断水戸数と定義を分けて表示。',asOf:'国土交通省 第47報（8月21日）',sourceLabel:'国土交通省（現地対策本部）第47報',sourceUrl:'${mlitReportUrl}'},
 'national-tec':{scale:'現在105人・累計4,299人日',period:'国土交通省第47報（8月21日10時）',detail:'TEC-FORCEの現在派遣105人、累計4,299人日（予定含む）。現在人数と累計実績を分け、予定を実績化しない。',asOf:'国土交通省 第47報（8月21日）',sourceLabel:'国土交通省（現地対策本部）第47報',sourceUrl:'${mlitReportUrl}'},
 'kumamoto-internal':{scale:'行政応援925人／関係機関含む計1,005人',status:'活動中・8月15日資料まで確認',period:'8月15日14時資料',detail:'熊本県・政府合同会議資料で行政応援925人、他機関80人、計1,005人。8月15日以後の同資料は未確認のため、数値は対象時点を明示。',asOf:'熊本県・政府合同会議 8月15日14時',sourceLabel:'熊本県・政府合同会議資料',sourceUrl:'${governmentMeetingUrl}'},
 'national-coordination':{status:'8月15日資料まで確認・後続会議結果要確認',scale:'行政応援925人／関係機関含む計1,005人',period:'8月15日14時資料',detail:'8月15日14時資料を確認済み値とし、後続会議の結果は確認できるまで実績化しない。',asOf:'熊本県・政府合同会議 8月15日14時',sourceLabel:'熊本県・政府合同会議資料',sourceUrl:'${governmentMeetingUrl}'},
};
Object.entries(currentRecordUpdates20260821).forEach(([id,values])=>{const record=RECORDS.find(item=>item.id===id);if(record)Object.assign(record,values);});
const currentProvinceNeeds20260821=PROVINCE_NEEDS.find(item=>item.id==='p-admin');
if(currentProvinceNeeds20260821)currentProvinceNeeds20260821.observed='熊本県第36報では住家被害35,048棟（推計含む）、分類未確定16,644棟。市町別表の内訳と県計を分けて表示する。';
const currentWaterNeed20260821=PROVINCE_NEEDS.find(item=>item.id==='p-water');
if(currentWaterNeed20260821)currentWaterNeed20260821.observed='国土交通省第47報（8月21日7時30分）では熊本県内の現在断水は約4,300戸。表掲載は八代市1,021戸、宇城市2,579戸、氷川町684戸の計4,284戸。';
const currentTimeline20260821=TIMELINE_EVENTS.find(event=>event.id==='t-current-status');
if(currentTimeline20260821)Object.assign(currentTimeline20260821,{date:'2026-08-20',dateLabel:'8月20日',weekday:'木',time:'14:00',title:'熊本県第36報で被害・避難所を更新',summary:'避難者2,925人、開設避難所69か所、人的被害398人、住家被害35,048棟。',detail:'熊本県第36報（8月20日14時現在）。市町別内訳は県合計と分け、推計を含む住家被害は今後変動し得る。現行公式JSONの71施設は別定義で表示。',sourceLabel:'熊本県 第36報',sourceUrl:'${prefectureReportUrl}',tags:['熊本県第36報','避難所','住家被害']});
if(!TIMELINE_EVENTS.some(event=>event.id==='t-kumamoto-0820'))TIMELINE_EVENTS.push({id:'t-kumamoto-0820',date:'2026-08-20',dateLabel:'8月20日',weekday:'木',time:'14:00',phase:'recovery',actor:'kumamoto',title:'熊本県第36報を確認',summary:'熊本県は避難所69か所・避難者2,925人・人的被害398人・住家被害35,048棟。',detail:'県第36報の県計と市町別表は差分があるため、県計を速報KPI、市町別表を支援ニーズの入力値として分けて表示。',place:'熊本県内',sourceLabel:'熊本県 第36報',sourceUrl:'${prefectureReportUrl}',recordIds:['kumamoto-internal'],hubIds:['kumamoto-hq','yatsushiro','uki','hikawa'],tags:['第36報','避難所','住家被害','最新確認']});
if(!TIMELINE_EVENTS.some(event=>event.id==='t-kumamoto-0821'))TIMELINE_EVENTS.push({id:'t-kumamoto-0821',date:'2026-08-21',dateLabel:'8月21日',weekday:'金',time:'07:30',phase:'recovery',actor:'national',title:'国土交通省第47報でインフラ・技術支援を更新',summary:'熊本県内の現在断水約4,300戸（表掲載4,284戸）、給水車129台、TEC-FORCE現在105人・累計4,299人日。',detail:'国土交通省第47報（8月21日10時報、断水は同日7時30分時点）。内閣府の8月20日値とは時点・集計定義が異なるため、資料ごとに表示。',place:'熊本県内',sourceLabel:'国土交通省 第47報',sourceUrl:'${mlitReportUrl}',recordIds:['national-water','national-tec'],hubIds:['kumamoto-hq','yatsushiro','uki','hikawa'],tags:['第47報','断水','給水','TEC-FORCE','最新確認']});
const currentHq18=TIMELINE_EVENTS.find(event=>event.id==='t-hq18');
if(currentHq18)Object.assign(currentHq18,{summary:'8月8日14時時点：避難者6,355人、断水34,780戸、住家被害18,791棟。',detail:'主要数値は8月8日14時時点。後続の第36報・国土交通省第47報は別イベントとして表示。'});
`;
const runtimeMarker = "const SHELTER_EXPECTED_TOTAL=206;";
const runtimeStartMarkers = ["const currentSnapshot20260821=", "const currentSnapshot20260817="];
const priorRuntimeStart = runtimeStartMarkers.map((marker) => updated.indexOf(marker)).find((index) => index >= 0) ?? -1;
if (priorRuntimeStart >= 0) {
  const priorRuntimeEnd = updated.indexOf(runtimeMarker, priorRuntimeStart);
  if (priorRuntimeEnd < 0) throw new Error("existing current snapshot block is malformed");
  updated = updated.slice(0, priorRuntimeStart) + updated.slice(priorRuntimeEnd);
}
updated = replaceOnce(updated, runtimeMarker, `${runtimeSnapshot}\n${runtimeMarker}`);

const pageMeta = {
  checkedAt,
  portalObservedAt: null,
  volunteerCheckedAt: checkedAt,
  rows: [
    { section: "被害・支援", status: "差分あり", current: "8月20日14時の熊本県第36報へ更新", previous: "熊本県第30報：8月16日14時", difference: "避難所69か所、避難者2,925人、人的被害398人、住家被害35,048棟。市町別表は人的396人・住家35,040棟で県計と分けて表示。", source: "熊本県 第36報", url: prefectureReportUrl },
    { section: "避難所", status: "差分あり", current: "県第36報69か所／公式JSON現在71施設／位置履歴206点", previous: "第30報71か所／8月2日23時21分の位置履歴206点", difference: "県報は8月20日14時のスナップショット、公式JSONは8月21日12時35分更新の現在開設一覧、206点は8月2日の履歴として定義を分離。", source: "熊本県 第36報・避難所公式JSON", url: prefectureReportUrl },
    { section: "支援ニーズ見通し", status: "差分あり", current: "避難・人的・住家は第36報、断水は国交省第47報で約4,300戸へ更新", previous: "第30報・第42報の8月16日値", difference: "断水は表掲載の八代・宇城・氷川計4,284戸を使用。内閣府8月20日値とは時点・集計定義が異なるため併記しない。", source: "熊本県 第36報・国土交通省第47報", url: mlitReportUrl },
    { section: "発災後タイムライン", status: "差分あり", current: "8月20日第36報・8月21日第47報を追加", previous: "8月16日第30報・第42報", difference: "県の被害・避難スナップショットと国交省の断水・給水・TEC-FORCEを対象時刻ごとに分けて表示。", source: "熊本県 被害情報・国土交通省第47報", url: prefectureReportPageUrl },
    { section: "支援ダッシュボード", status: "差分あり", current: "給水車129台、TEC-FORCE現在105人・累計4,299人日", previous: "給水車131台、TEC-FORCE現在103人・累計3,703人日", difference: "国交省第47報の8月21日値へ更新。行政応援925人・関係機関含む1,005人は8月15日合同会議資料の対象時点値として保持。", source: "国土交通省第47報／熊本県・政府合同会議", url: mlitReportUrl },
    { section: "災害ボランティア", status: "差分あり", current: "8月21日に11市町の公式ページ・県社協情報を再確認", previous: "8月17日確認", difference: "宇土市、宇城市、美里町、御船町、嘉島町、益城町、八代市、氷川町、芦北町などの募集日程・受付方法を更新。未確認は募集なしと判定しない。", source: "市町社会福祉協議会公式ページ", url: "https://www.fukushi-kumamoto.or.jp/kvc/" },
    { section: "地図・境界", status: "変更なし", current: "既存境界・地理院淡色地図・公式座標履歴を保持", previous: "既存の検証済みデータ", difference: "新しい境界や座標を推測せず、206点は位置履歴として扱う。", source: "国土地理院タイル一覧", url: "https://maps.gsi.go.jp/development/ichiran.html" },
  ],
};
const metaStart = updated.indexOf("const PAGE_RECHECK_META=");
const metaEnd = updated.indexOf("function renderPageRecheck", metaStart);
if (metaStart < 0 || metaEnd < 0) throw new Error("PAGE_RECHECK_META not found");
updated = updated.slice(0, metaStart) + `const PAGE_RECHECK_META=${JSON.stringify(pageMeta)};\n` + updated.slice(metaEnd);

const replacements = [
  ["ページ全体の再確認：2026年8月13日 13:14（JST）", `ページ全体の再確認：${checkedLabel}（JST）`],
  ["ページ全体再確認：2026年8月13日13:14", `ページ全体再確認：${checkedLabel.replace(" ", "")}`],
  ["2026年8月13日 13:14（JST）", `${checkedLabel}（JST）`],
  ["経過日 D+16（主要公表値は8月13日8時）", "経過日 D+20（主要公表値は8月16日14時）"],
  ["発災 D+16", "発災 D+20"],
  ["主要数値：8月13日08:00", "主要数値：8月16日14:00"],
  ["主要数値：8月13日8時", "主要数値：8月16日14時"],
  ["8月13日時点で確認できない", "8月16日時点で確認できない"],
  ["3,662<span class=\"overview-kpi-unit\">人", "3,121<span class=\"overview-kpi-unit\">人"],
  ["81<span class=\"overview-kpi-unit\">か所", "71<span class=\"overview-kpi-unit\">か所"],
  ["393<span class=\"overview-kpi-unit\">人", "394<span class=\"overview-kpi-unit\">人"],
  ["27,872<span class=\"overview-kpi-unit\">棟", "31,728<span class=\"overview-kpi-unit\">棟"],
  ["約28,400戸", "約10,000戸"],
  ["給水車140台", "給水車131台"],
  ["TEC-FORCE現在107人・累計3,389人日（予定含む）", "TEC-FORCE現在103人・累計3,703人日"],
  ["3,389人日", "3,703人日"],
  ["行政応援854人", "行政応援925人"],
  ["最新集計81か所／位置履歴206点", "最新集計71か所／位置履歴206点"],
  ["最新集計は8月13日8時の81避難所", "最新集計は8月16日14時の71避難所"],
  ["最新公表集計は2026年8月13日8時の81か所", "最新公表集計は2026年8月16日14時の71か所"],
  ["最新集計8月13日08:00＝81か所", "最新集計8月16日14:00＝71か所"],
  ["8月13日8時の81避難所", "8月16日14時の71避難所"],
  ["<div class=\"overview-resource-value\">140台</div>", "<div class=\"overview-resource-value\">131台</div>"],
  ["<div class=\"overview-resource-sub\">国交省第39報・集計時点（定義別）</div>", "<div class=\"overview-resource-sub\">国交省第42報・8月16日（定義別）</div>"],
  ["<div class=\"overview-resource-sub\">TEC-FORCE現在107人・累計（予定含む）</div>", "<div class=\"overview-resource-sub\">TEC-FORCE現在103人・累計3,703人日</div>"],
  ["<div class=\"overview-resource-value\">854人</div>", "<div class=\"overview-resource-value\">925人</div>"],
  ["<div class=\"overview-resource-sub\">対口711・熊本県等143</div>", "<div class=\"overview-resource-sub\">関係機関含む計1,005人</div>"],
  ["<div class=\"needs-kpi-value\">3,662人</div>", "<div class=\"needs-kpi-value\">3,121人</div>"],
  ["<div class=\"needs-kpi-note\">81避難所・11市町村</div>", "<div class=\"needs-kpi-note\">71避難所・11市町村</div>"],
  ["<div class=\"needs-kpi-value\">27,872棟</div>", "<div class=\"needs-kpi-value\">31,728棟</div>"],
  ["<div class=\"needs-kpi-note\">分類未確定16,084棟・推計含む</div>", "<div class=\"needs-kpi-note\">分類未確定17,620棟・推計含む</div>"],
  ["国交省第39報・3市町（給水所数は同報に記載なし）", "国交省第42報・3市町（表掲載合計10,035戸、給水所数は同報に記載なし）"],
  ["<div class=\"metric-value\">3,662<span class=\"metric-unit\">人", "<div class=\"metric-value\">3,121<span class=\"metric-unit\">人"],
  ["<div class=\"metric-value\">81<span class=\"metric-unit\">か所", "<div class=\"metric-value\">71<span class=\"metric-unit\">か所"],
  ["<div class=\"metric-value\">392<span class=\"metric-unit\">人", "<div class=\"metric-value\">394<span class=\"metric-unit\">人"],
  ["<div class=\"metric-value\">27,872<span class=\"metric-unit\">棟", "<div class=\"metric-value\">31,728<span class=\"metric-unit\">棟"],
  ["<div class=\"snap\"><strong>3,703人日</strong><span>TEC-FORCE<br/>累計（予定含む）</span>", "<div class=\"snap\"><strong>3,703人日</strong><span>TEC-FORCE<br/>累計実績</span>"],
  ["<div class=\"section-head\"><div class=\"section-title\">地域ブロック別の割当て</div><div class=\"section-note\">公表値：8月11日14時</div>", "<div class=\"section-head\"><div class=\"section-title\">地域ブロック別の割当て</div><div class=\"section-note\">公表値：8月15日14時</div>"],
  ["<div class=\"shelter-summary-value\">89</div><div class=\"shelter-summary-note\">8月11日14:00</div>", "<div class=\"shelter-summary-value\">71</div><div class=\"shelter-summary-note\">8月16日14:00</div>"],
  ["最新集計81か所とは区別して表示します。", "最新集計71か所とは区別して表示します。"],
  ["最新の市町別集計は2026年8月11日14時の89か所です。", "最新の市町別集計は2026年8月16日14時の71か所です。"],
  ["最新集計81か所と一致しません。", "最新集計71か所と一致しません。"],
  ["人的被害は速報内訳の分類合計393人相当（県資料の合計欄は要再確認）。市町別24行の人的被害表内合計は390人。住家被害27,872棟のうち市町別24行は27,857棟で、差15棟は収録対象外市町村分を含みます。地図の施設点は8月2日の位置履歴で、最新集計81か所と一致しません。", "人的被害は県資料の合計欄394人。市町別24行の人的被害表内合計は391人。住家被害31,728棟のうち市町別24行は31,723棟で、差5棟は収録対象外市町村分を含みます。地図の施設点は8月2日の位置履歴で、最新集計71か所と一致しません。"],
  ["人的被害は速報内訳の分類合計393人相当（県資料の合計欄は要再確認）。市町別24行の人的被害表内合計は390人。住家被害27,872棟のうち市町別24行は27,857棟で、差15棟は収録対象外市町村分を含みます。地図の施設点は8月2日の位置履歴で、最新集計71か所と一致しません。", "人的被害は県資料の合計欄394人。市町別24行の人的被害表内合計は391人。住家被害31,728棟のうち市町別24行は31,723棟で、差5棟は収録対象外市町村分を含みます。地図の施設点は8月2日の位置履歴で、最新集計71か所と一致しません。"],
  ["最新公表集計は2026年8月11日14時の89か所", "最新公表集計は2026年8月16日14時の71か所"],
  ["最新集計は8月11日14時の89か所", "最新集計は8月16日14時の71か所"],
  ["最新集計は8月11日14:00の89か所", "最新集計は8月16日14:00の71か所"],
  ["位置履歴スナップショット：2026年8月2日23時21分。最新の市町別集計は2026年8月11日14時の89か所。", "位置履歴スナップショット：2026年8月2日23時21分。最新の市町別集計は2026年8月16日14時の71か所。"],
  ["住家被害27,872棟（推計を含む）のうち分類未確定16,084棟。8月8日までに住家被害認定調査を開始又は随時対応する市町村は40、今後開始予定4、未定1。", "住家被害31,728棟（推計を含む）のうち分類未確定17,620棟。市町別表の内訳と県計を分けて表示する。"],
  ["<span class=\"overview-section-tag\">2026年8月11日確認</span>", "<span class=\"overview-section-tag\">2026年8月17日確認</span>"],
  ["国交省第39報では3市町の断水約10,000戸（県速報とは集計範囲が異なる）。", "国交省第42報では3市町の表掲載断水10,035戸（現在断水は約10,000戸、県速報とは集計範囲が異なる）。"],
  ["給水車131台（国交省第39報・集計時点）", "給水車131台（国交省第42報・8月16日6時～7時30分・表掲載値）"],
  ["計10市町へ行政応援（対口711・県等143）", "計10市町へ行政応援925人（関係機関含む計1,005人）"],
  ["<div class=\"snap\"><strong>854</strong><span>行政応援<br/>対口含む</span></div>", "<div class=\"snap\"><strong>925</strong><span>行政応援<br/>関係機関含む計1,005人</span></div>"],
  ["<div class=\"snap\"><strong>173</strong><span>応急給水車<br/>合計</span></div>", "<div class=\"snap\"><strong>131</strong><span>応急給水車<br/>第42報・8月16日</span></div>"],
  ["8月11日までの確定イベントを追加", "8月16日第30報・第42報まで更新"],
  ["給水車173台、行政応援925人、TEC-FORCE累計約3,100人日等を掲載した8月11日資料。", "8月11日14時資料の当時公表値として給水車173台を掲載。第42報（8月16日6時～7時30分）の表掲載131台とは対象時点・資料定義が異なるため、現況値には流用しない。行政応援925人も同資料の当時値。"],
  ["住家被害27,872棟のうち分類未確定16,084棟（約58%）", "住家被害31,728棟のうち分類未確定17,620棟（約55%）"],
  ["24市町の人的被害表内合計390人。県速報の人的被害内訳は393人相当", "24市町の人的被害表内合計391人。県速報の人的被害合計は394人（関連可能性1人・調査中2人を含む）"],
  ["住家被害27,857棟と県計27,872棟との差15棟", "住家被害31,723棟と県計31,728棟との差5棟"],
  ["8月13日8時の市町村別公表値を平方根変換", "8月16日14時の市町村別公表値を平方根変換"],
  ["熊本県公表 2026年8月13日8時時点", "熊本県公表 2026年8月16日14時時点"],
  ["kumamoto_support_official_20260813.csv", "kumamoto_support_official_20260817.csv"],
  ["kumamoto_observed_load_signals_20260813.csv", "kumamoto_observed_load_signals_20260817.csv"],
  ["const SHELTER_SNAPSHOT_META={schemaVersion:1,sourceAsOf:\"2026-08-02T23:21:09+09:00\",sourceLabel:\"熊本県「防災情報くまもと」避難所マスター\",sourceUrl:\"https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json\",statusUrl:\"https://portal.bousai.pref.kumamoto.jp/sp.html?p=evacuation%2Fshelter\",crs:\"EPSG:4326\",coordinateDefinition:\"熊本県公式ポータルの施設代表点\",recordCount:206};", "const SHELTER_SNAPSHOT_META={schemaVersion:1,sourceAsOf:\"2026-08-02T23:21:09+09:00\",sourceLabel:\"熊本県「防災情報くまもと」避難所マスター\",sourceUrl:\"https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json\",statusUrl:\"https://portal.bousai.pref.kumamoto.jp/sp.html?p=evacuation%2Fshelter\",crs:\"EPSG:4326\",coordinateDefinition:\"熊本県公式ポータルの施設代表点\",recordCount:206,latestCount:71,latestAsOf:\"2026-08-16T14:00:00+09:00\"};"],
];
for (const [from, to] of replacements) updated = updated.split(from).join(to);

const currentReplacements = [
  ["ページ全体の再確認：2026年8月17日 09:45", `ページ全体の再確認：${checkedLabel}`],
  ["ページ全体再確認：2026年8月17日09:45", `ページ全体再確認：${checkedLabel.replace(" ", "")}`],
  ["2026年8月17日 09:45（JST）", `${checkedLabel}（JST）`],
  ["2026年8月17日 09:45確認済み", `${checkedLabel}確認済み`],
  ["2026年8月17日確認", "2026年8月21日確認"],
  ["経過日 D+20（主要公表値は8月16日14時）", "経過日 D+24（主要公表値は8月20日14時）"],
  ["発災 D+20", "発災 D+24"],
  ["主要数値：8月16日14:00", "主要数値：8月20日14:00"],
  ["主要数値：8月16日14時", "主要数値：8月20日14時"],
  ["8月16日時点で確認できない", "8月20日時点で確認できない"],
  ["3,121<span class=\"overview-kpi-unit\">人", "2,925<span class=\"overview-kpi-unit\">人"],
  ["8月16日14時時点</div>", "8月20日14時時点</div>"],
  ["71<span class=\"overview-kpi-unit\">か所", "69<span class=\"overview-kpi-unit\">か所"],
  ["394<span class=\"overview-kpi-unit\">人", "398<span class=\"overview-kpi-unit\">人"],
  ["31,728<span class=\"overview-kpi-unit\">棟", "35,048<span class=\"overview-kpi-unit\">棟"],
  ["給水車131台（国交省第42報・8月16日6時～7時30分・表掲載値）", "給水車129台（国交省第47報・8月21日7時30分・表掲載値）"],
  ["TEC-FORCE現在103人・累計3,703人日", "TEC-FORCE現在105人・累計4,299人日"],
  ["給水車131台（国交省第42報・8月16日", "給水車129台（国交省第47報・8月21日"],
  ["国交省第42報・8月16日（定義別）", "国交省第47報・8月21日（定義別）"],
  ["<div class=\"overview-resource-value\">131台</div>", "<div class=\"overview-resource-value\">129台</div>"],
  ["<div class=\"overview-resource-value\">3,703人日</div>", "<div class=\"overview-resource-value\">4,299人日</div>"],
  ["<div class=\"overview-resource-sub\">TEC-FORCE現在103人・累計3,703人日</div>", "<div class=\"overview-resource-sub\">TEC-FORCE現在105人・累計4,299人日</div>"],
  ["<div class=\"needs-kpi-value\">3,121人</div>", "<div class=\"needs-kpi-value\">2,925人</div>"],
  ["<div class=\"needs-kpi-note\">71避難所・11市町村</div>", "<div class=\"needs-kpi-note\">69避難所・11市町村（現行公式JSONは71施設）</div>"],
  ["<div class=\"needs-kpi-value\">約10,000戸</div>", "<div class=\"needs-kpi-value\">約4,300戸</div>"],
  ["国交省第42報・3市町（表掲載合計10,035戸、給水所数は同報に記載なし）", "国交省第47報・3市町（表掲載合計4,284戸、給水車129台）"],
  ["<div class=\"needs-kpi-value\">31,728棟</div>", "<div class=\"needs-kpi-value\">35,048棟</div>"],
  ["分類未確定17,620棟・推計含む", "分類未確定16,644棟・推計含む"],
  ["<div class=\"metric-value\">3,121<span class=\"metric-unit\">人", "<div class=\"metric-value\">2,925<span class=\"metric-unit\">人"],
  ["<div class=\"metric-value\">71<span class=\"metric-unit\">か所", "<div class=\"metric-value\">69<span class=\"metric-unit\">か所"],
  ["<div class=\"metric-value\">392<span class=\"metric-unit\">人", "<div class=\"metric-value\">398<span class=\"metric-unit\">人"],
  ["<div class=\"metric-value\">394<span class=\"metric-unit\">人", "<div class=\"metric-value\">398<span class=\"metric-unit\">人"],
  ["<div class=\"metric-value\">31,728<span class=\"metric-unit\">棟", "<div class=\"metric-value\">35,048<span class=\"metric-unit\">棟"],
  ["<div class=\"snap\"><strong>3,703人日</strong>", "<div class=\"snap\"><strong>4,299人日</strong>"],
  ["<div class=\"snap\"><strong>131</strong><span>応急給水車", "<div class=\"snap\"><strong>129</strong><span>応急給水車"],
  ["第42報・8月16日", "第47報・8月21日"],
  ["8月16日第30報・第42報まで更新", "8月20日第36報・8月21日第47報まで更新"],
  ["8月16日第30報・第42報", "8月20日第36報・8月21日第47報"],
  ["熊本県第30報（2026年8月16日14時）", "熊本県第36報（2026年8月20日14時）"],
  ["熊本県第30報の71か所は2026年8月16日14時の被害・避難状況スナップショットです。", "熊本県第36報の69か所は2026年8月20日14時の被害・避難状況スナップショットです。"],
  ["熊本県第30報の71か所は2026年8月16日14時時点の被害・避難状況スナップショットです。", "熊本県第36報の69か所は2026年8月20日14時時点の被害・避難状況スナップショットです。"],
  ["第30報の避難所71か所・避難者3,121人は2026年8月16日14時の被害・避難状況スナップショットです。", "第36報の避難所69か所・避難者2,925人は2026年8月20日14時の被害・避難状況スナップショットです。"],
  ["人的被害は県資料の合計欄394人。市町別24行の人的被害表内合計は391人。住家被害31,728棟のうち市町別24行は31,723棟で、差5棟は収録対象外市町村分を含みます。", "人的被害は県資料の合計欄398人。市町別24行の人的被害表内合計は396人。住家被害35,048棟のうち市町別24行は35,040棟で、差8棟は収録対象外市町村分を含みます。"],
  ["住家被害31,728棟のうち分類未確定17,620棟", "住家被害35,048棟のうち分類未確定16,644棟"],
  ["24市町の人的被害表内合計391人。県速報の人的被害合計は394人", "24市町の人的被害表内合計396人。県速報の人的被害合計は398人"],
  ["住家被害31,723棟と県計31,728棟との差5棟", "住家被害35,040棟と県計35,048棟との差8棟"],
  ["24市町の人的被害表内合計391人。県速報の人的被害合計は394人（関連可能性1人・調査中2人を含む）", "24市町の人的被害表内合計396人。県速報の人的被害合計は398人（関連可能性1人・調査中1人を含む）"],
  ["国交省第42報では3市町の表掲載断水10,035戸（現在断水は約10,000戸、県速報とは集計範囲が異なる）。", "国交省第47報では3市町の表掲載断水4,284戸（現在断水は約4,300戸、内閣府速報とは時点・集計定義が異なる）。"],
  ["2市で避難者2,897人、県全体の約79%。国交省第42報では3市町の表掲載断水10,035戸（現在断水は約10,000戸、県速報とは集計範囲が異なる）。", "宇城市・八代市で避難者2,268人。国交省第47報では3市町の表掲載断水4,284戸（現在断水は約4,300戸、内閣府速報とは時点・集計定義が異なる）。"],
  ["住家被害31,728棟のうち分類未確定17,620棟（約55%）。", "住家被害35,048棟のうち分類未確定16,644棟（約48%）。"],
  ["2市で避難者2,897人、県全体の約79%。", "宇城市・八代市で避難者2,268人。"],
  ["8月16日14時の市町村別公表値を平方根変換", "8月20日14時の市町村別公表値を平方根変換"],
  ["県速報の人的被害合計は398人（関連可能性1人・調査中2人を含む）", "県速報の人的被害合計は398人（関連可能性1人・調査中1人を含む）"],
  ["市町別24行は人的被害390人。", "市町別24行は人的被害396人。"],
  ["熊本県第30報の71か所は2026年8月16日14時時点", "熊本県第36報の69か所は2026年8月20日14時時点"],
  ["11市町村・8月16日14時", "11市町村・8月20日14時"],
  ["住家被害35,034棟と県計35,048棟との差14棟", "住家被害35,040棟と県計35,048棟との差8棟"],
  ["の避難所71か所です。", "の避難所69か所です。"],
  ["https://www.pref.kumamoto.jp/uploaded/life/276971_869664_misc.pdf", prefectureReportUrl],
  ["currentAsOf: \"2026-08-16T14:00:00+09:00\"", "currentAsOf: \"2026-08-20T14:00:00+09:00\""],
  ["currentStatusRecord)Object.assign(currentStatusRecord,{date:'2026-08-16',dateLabel:'8月16日',time:'14:00',summary:'避難者3,121人、開設避難所71か所、人的被害394人、住家被害31,728棟。',detail:'熊本県第30報（8月16日14時現在）。市町別内訳は県合計と分け、推計を含む住家被害は今後変動し得る。',sourceLabel:'熊本県 第30報',sourceUrl:'https://www.pref.kumamoto.jp/uploaded/life/277285_871961_misc.pdf'}", "currentStatusRecord)Object.assign(currentStatusRecord,{date:'2026-08-20',dateLabel:'8月20日',time:'14:00',summary:'避難者2,925人、開設避難所69か所、人的被害398人、住家被害35,048棟。',detail:'熊本県第36報（8月20日14時現在）。市町別内訳は県合計と分け、推計を含む住家被害は今後変動し得る。現行公式JSONの71施設は別定義で表示。',sourceLabel:'熊本県 第36報',sourceUrl:'https://www.pref.kumamoto.jp/uploaded/life/277838_875456_misc.pdf'}"],
  ["const SHELTER_SNAPSHOT_META={schemaVersion:1,sourceAsOf:\"2026-08-02T23:21:09+09:00\",sourceLabel:\"熊本県「防災情報くまもと」避難所マスター\",sourceUrl:\"https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json\",statusUrl:\"https://portal.bousai.pref.kumamoto.jp/sp.html?p=evacuation%2Fshelter\",crs:\"EPSG:4326\",coordinateDefinition:\"熊本県公式ポータルの施設代表点\",recordCount:206,latestCount:71,latestAsOf:\"2026-08-16T14:00:00+09:00\"};", "const SHELTER_SNAPSHOT_META={schemaVersion:1,sourceAsOf:\"2026-08-02T23:21:09+09:00\",sourceLabel:\"熊本県「防災情報くまもと」避難所マスター\",sourceUrl:\"https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json\",statusUrl:\"https://portal.bousai.pref.kumamoto.jp/sp.html?p=evacuation%2Fshelter\",crs:\"EPSG:4326\",coordinateDefinition:\"熊本県公式ポータルの施設代表点\",recordCount:206,latestCount:71,latestAsOf:\"2026-08-21T12:35:30+09:00\"};"],
  ["SOURCES.unshift({group:'熊本県',name:'防災情報くまもと 避難所マスター',asOf:'位置履歴スナップショット：2026年8月2日23時21分の206施設。熊本県第30報の71か所は2026年8月16日14時の被害・避難状況スナップショットであり、現行公式JSONの施設一覧とは別定義',url:SHELTER_SNAPSHOT_META.sourceUrl});", "SOURCES.unshift({group:'熊本県',name:'防災情報くまもと 避難所マスター',asOf:'位置履歴スナップショット：2026年8月2日23時21分の206施設。熊本県第36報の69か所は2026年8月20日14時の被害・避難状況スナップショットであり、現行公式JSONの71施設とは別定義',url:SHELTER_SNAPSHOT_META.sourceUrl});"],
  ["第30報：2026年8月16日14時の避難所71か所／公式JSON：${currentMeta.currentCount??'取得時点'}施設", "第36報：2026年8月20日14時の避難所69か所／公式JSON：${currentMeta.currentCount??'取得時点'}施設"],
];
for (const [from, to] of currentReplacements) updated = updated.split(from).join(to);
updated = updated.split("住家被害35,048棟のうち分類未確定16,644棟（約55%）。").join("住家被害35,048棟のうち分類未確定16,644棟（約48%）。");

// Update remaining current-only prose without rewriting dated history.
updated = updated.replaceAll("ボランティア個別確認：8月11日確認中", `ボランティア個別確認：${checkedLabel}確認済み`);
updated = updated.replaceAll("8月11日までの確定支援を反映", "8月15日までの確定支援を反映");
updated = updated.replaceAll(/同梱206点は現在開設中の施設一覧として扱わない(?:（8月2日位置履歴）)*/g, "同梱206点は現在開設中の施設一覧として扱わない（8月2日位置履歴）");

await writeFile(file, updated, "utf8");
await import("./cleanup-current-state-20260821.mjs");
const rawTotals = needs.reduce((totals, row) => {
  totals.shelters += row.raw.shelters;
  totals.evacuees += row.raw.evacuees;
  totals.waterOutage += row.raw.waterOutage || 0;
  totals.housing += row.raw.housingTotal;
  totals.human += row.raw.humanTotal;
  return totals;
}, { shelters: 0, evacuees: 0, waterOutage: 0, housing: 0, human: 0 });
console.log(JSON.stringify({ checkedAt, currentAsOf: "2026-08-20T14:00:00+09:00", impacts: impacts.length, ...rawTotals, waterTableTotal: 4284, shelterCoordinateSnapshot: 206 }));

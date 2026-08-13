import { readFile, writeFile } from "node:fs/promises";

const file = "ehime_kumamoto_support_geocoded_shelters_20260802.html";
const checkedAt = "2026-08-13T13:14:31+09:00";
const checkedLabel = "2026年8月13日 13:14";
const damageUrl = "https://www.pref.kumamoto.jp/uploaded/life/276971_869664_misc.pdf";
const source = await readFile(file, "utf8");

const latest = {
  "熊本市": { s: 15, e: 282, h: [11, 57, 3, 0, 0, 3], house: [0, 0, 1, 2676, 6220] },
  "宇土市": { s: 1, e: 87, h: [0, 0, 0, 0, 0, 11], house: [1, 0, 0, 1138, 2932] },
  "宇城市": { s: 11, e: 670, h: [4, 24, 1, 0, 3, 0], house: [200, 0, 800, 3600, 0] },
  "美里町": { s: 3, e: 30, h: [9, 0, 8, 0, 0, 0], house: [23, 7, 16, 759, 14] },
  "玉名市": { s: 0, e: 0, h: [1, 0, 1, 0, 0, 0], house: [0, 0, 0, 0, 0] },
  "山鹿市": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0] },
  "菊池市": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0] },
  "合志市": { s: 0, e: 0, h: [1, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0] },
  "大津町": { s: 0, e: 0, h: [2, 1, 0, 0, 0, 0], house: [0, 0, 0, 0, 0] },
  "菊陽町": { s: 0, e: 0, h: [2, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0] },
  "西原村": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0] },
  "御船町": { s: 1, e: 14, h: [11, 6, 4, 0, 0, 0], house: [0, 0, 0, 0, 1193] },
  "嘉島町": { s: 2, e: 18, h: [12, 0, 4, 0, 7, 0], house: [0, 0, 0, 0, 316] },
  "益城町": { s: 1, e: 18, h: [0, 7, 2, 0, 0, 0], house: [0, 0, 0, 0, 2513] },
  "甲佐町": { s: 4, e: 4, h: [0, 0, 1, 0, 1, 0], house: [0, 0, 0, 0, 947] },
  "山都町": { s: 0, e: 0, h: [0, 0, 1, 0, 0, 0], house: [0, 0, 0, 9, 29] },
  "八代市": { s: 37, e: 2227, h: [0, 0, 0, 0, 20, 147], house: [873, 0, 0, 0, 1627] },
  "氷川町": { s: 4, e: 296, h: [0, 0, 0, 0, 5, 14], house: [163, 0, 195, 903, 0] },
  "水俣市": { s: 0, e: 0, h: [0, 0, 1, 0, 0, 0], house: [0, 0, 0, 6, 14] },
  "芦北町": { s: 2, e: 16, h: [3, 0, 0, 0, 0, 0], house: [4, 1, 20, 267, 293] },
  "津奈木町": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 1, 0] },
  "人吉市": { s: 0, e: 0, h: [1, 0, 0, 0, 0, 1], house: [0, 0, 0, 18, 0] },
  "上天草市": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 78, 0] },
  "天草市": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0] },
};

function parseConstant(text, name, endMarker) {
  const marker = `const ${name}=`;
  const valueStart = text.indexOf(marker) + marker.length;
  const end = text.indexOf(endMarker, valueStart);
  if (valueStart < marker.length || end < 0) throw new Error(`${name} not found`);
  return { valueStart, end, value: JSON.parse(text.slice(valueStart, end + 1)) };
}
function round(value) { return Math.round(value * 10) / 10; }
function level(value) { return value >= 70 ? "very-high" : value >= 45 ? "high" : value >= 20 ? "medium" : value > 0 ? "watch" : "limited"; }
function humanDetails(values) { return { mild: values[0], moderate: values[1], severe: values[2], cardiopulmonaryArrest: values[3], deaths: values[4], unclassified: values[5] }; }
function housingDetails(values) { return { destroyed: values[0], largeScaleHalfDestroyed: values[1], halfDestroyed: values[2], partiallyDamaged: values[3], unclassified: values[4] }; }
function evidenceFor(row, oldEvidence) {
  const kept = (oldEvidence || []).filter((value) => !/^(避難者|人的被害：|住家被害|断水)/.test(value));
  const v = row.raw;
  const h = v.humanDetails;
  const house = v.housingDetails;
  kept.unshift(`避難者${v.evacuees.toLocaleString("ja-JP")}人／避難所${v.shelters}か所`);
  kept.splice(1, 0, `人的被害：軽症${h.mild}人、中等症${h.moderate}人、重症${h.severe}人、死亡${h.deaths}人、分類未確定${h.unclassified}人`);
  kept.push(`住家被害${v.housingTotal.toLocaleString("ja-JP")}棟（全壊${house.destroyed}、大規模半壊${house.largeScaleHalfDestroyed}、半壊${house.halfDestroyed}、一部破損${house.partiallyDamaged.toLocaleString("ja-JP")}、分類未確定${house.unclassified.toLocaleString("ja-JP")}）`);
  if (v.waterOutage || v.waterPoints) kept.push(`断水${v.waterOutage.toLocaleString("ja-JP")}戸／給水所${v.waterPoints}か所（8月11日14時確認。8月13日第25報には記載なし）`);
  return [...new Set(kept)];
}

const needsPart = parseConstant(source, "NEED_MUNICIPALITIES", "];\nconst NEED_LESSONS=");
const rows = needsPart.value;
const max = {
  evacuees: Math.max(...rows.map((row) => latest[row.name].e)),
  shelters: Math.max(...rows.map((row) => latest[row.name].s)),
  outage: Math.max(...rows.map((row) => row.raw.waterOutage || 0)),
  points: Math.max(...rows.map((row) => row.raw.waterPoints || 0)),
  human: Math.max(...rows.map((row) => latest[row.name].h.reduce((a, b) => a + b, 0))),
  housing: Math.max(...rows.map((row) => latest[row.name].house.reduce((a, b) => a + b, 0))),
};
for (const row of rows) {
  const v = latest[row.name];
  if (!v) throw new Error(`missing latest row: ${row.name}`);
  row.raw.shelters = v.s;
  row.raw.evacuees = v.e;
  row.raw.humanDetails = humanDetails(v.h);
  row.raw.humanTotal = v.h.reduce((a, b) => a + b, 0);
  row.raw.deaths = v.h[4];
  row.raw.housingDetails = housingDetails(v.house);
  row.raw.housingTotal = v.house.reduce((a, b) => a + b, 0);
  const shelterScore = (v.e ? 70 * Math.sqrt(v.e / max.evacuees) : 0) + (v.s ? 30 * Math.sqrt(v.s / max.shelters) : 0);
  const waterScore = row.raw.waterOutage && max.outage ? 80 * Math.sqrt(row.raw.waterOutage / max.outage) + (row.raw.waterPoints && max.points ? 20 * Math.sqrt(row.raw.waterPoints / max.points) : 0) : 0;
  const humanValue = v.h.reduce((a, b) => a + b, 0);
  const housingValue = v.house.reduce((a, b) => a + b, 0);
  const healthScore = humanValue ? 100 * Math.sqrt(humanValue / max.human) : 0;
  const housingScore = housingValue ? 100 * Math.sqrt(housingValue / max.housing) : 0;
  row.scores.shelter = round(shelterScore);
  row.scores.water = round(waterScore);
  row.scores.health = round(healthScore);
  row.scores.housing = round(housingScore);
  row.scores.administration = round(housingScore * 0.55 + shelterScore * 0.45);
  for (const key of ["shelter", "water", "health", "housing", "administration"]) row.levels[key] = level(row.scores[key]);
  row.evidence = evidenceFor(row, row.evidence);
  row.sourceUrl = damageUrl;
  row.detailSourceUrl = damageUrl;
  row.topNeeds = Object.keys(row.scores).filter((key) => row.scores[key] > 0).sort((a, b) => row.scores[b] - row.scores[a]);
  row.overallLevel = row.topNeeds.length ? level(row.scores[row.topNeeds[0]]) : "limited";
}

const impactsPart = parseConstant(source, "IMPACTS", "];\n\nconst SUPPORT_BLOCKS=");
const impacts = rows.filter((row) => latest[row.name].s || latest[row.name].e).map((row) => ({
  name: row.name,
  shelters: row.raw.shelters,
  evacuees: row.raw.evacuees,
  lat: row.coords[0],
  lng: row.coords[1],
}));
let updated = source.slice(0, needsPart.valueStart) + JSON.stringify(rows) + source.slice(needsPart.end + 1);
const updatedImpacts = parseConstant(updated, "IMPACTS", "];\n\nconst SUPPORT_BLOCKS=");
updated = updated.slice(0, updatedImpacts.valueStart) + JSON.stringify(impacts) + updated.slice(updatedImpacts.end + 1);

const replacements = [
  ["ページ全体再確認：2026年8月11日 19:20（JST）", `${checkedLabel}（JST）`],
  ["ページ全体再確認：2026年8月11日19:20", `ページ全体再確認：${checkedLabel.replace(" ", "")}`],
  ["2026年8月11日 19:20（JST）", `${checkedLabel}（JST）`],
  ["経過日 D+14（主要公表値は8月11日14時）", "経過日 D+16（主要公表値は8月13日8時）"],
  ["発災 D+14", "発災 D+16"],
  ["主要数値：8月11日14:00", "主要数値：8月13日08:00"],
  ["主要公表値は8月11日14時", "主要公表値は8月13日8時"],
  ["3,714", "3,662"],
  ["23,404", "27,872"],
  ["12,623", "16,084"],
  ["2市で避難者3,005人", "2市で避難者2,897人"],
  ["89避難所・11市町村", "81避難所・11市町村"],
  ["11市町村・8月11日14時", "11市町村・8月13日8時"],
  ["最新集計89か所／位置履歴206点", "最新集計81か所／位置履歴206点"],
  ["最新公表集計は2026年8月11日14時の89か所", "最新公表集計は2026年8月13日8時の81か所"],
  ["最新集計8月11日14:00＝89か所", "最新集計8月13日08:00＝81か所"],
  ["8月11日14時の89避難所", "8月13日8時の81避難所"],
  ["8月11日時点で確認できない", "8月13日時点で確認できない"],
  ["8月11日14時の市町村別公表値を平方根変換", "8月13日8時の市町村別公表値を平方根変換"],
  ["熊本県公表 2026年8月11日14時時点", "熊本県公表 2026年8月13日8時時点"],
  ["住家被害27,872棟のうち分類未確定16,084棟（約54%）", "住家被害27,872棟のうち分類未確定16,084棟（約58%）"],
];
for (const [from, to] of replacements) updated = updated.split(from).join(to);

updated = updated.replace(/const PAGE_RECHECK_META=\{checkedAt:'[^']+',portalObservedAt:null,volunteerCheckedAt:'[^']+',rows:\[[\s\S]*?\n\]\};/, `const PAGE_RECHECK_META={checkedAt:'${checkedAt}',portalObservedAt:null,volunteerCheckedAt:'${checkedAt}',rows:[
 {section:'被害・支援',status:'差分あり',current:'8月13日8時の最新公表値へ更新',previous:'熊本県資料：2026年8月11日14時',difference:'避難所81か所、避難者3,662人、人的被害392人、住家被害27,872棟へ更新。断水33,300戸は8月11日14時確認値を保持し、第25報に記載がないため要再確認。',source:'熊本県 第25報（8月13日8時時点）',url:'${damageUrl}'},
 {section:'避難所',status:'要再確認',current:'最新集計81か所／位置履歴206点',previous:'8月11日14時の集計89か所／8月2日23時21分の位置履歴206点',difference:'施設単位の最新座標一覧を取得できないため、206点は履歴として保持し現在開設中とは表示しない。',source:'熊本県 人的被害等の状況',url:'${damageUrl}'},
 {section:'支援ニーズ見通し',status:'要再確認',current:'避難・人的・住家は8月13日値で再算定、断水は8月11日値を保持',previous:'8月11日値',difference:'道路・学校・農林水産の市町別シグナルは前回値を保持し要再確認。未充足需要の順位ではない。',source:'熊本県 人的被害等の状況',url:'${damageUrl}'},
 {section:'発災後タイムライン',status:'差分あり',current:'8月13日被害報告を追加。会議資料は8月11日まで',previous:'8月11日までの確定イベント',difference:'新しい災害対策本部会議資料は確認できず、予定を実績化しない。第25報の被害数値だけを最新化。',source:'熊本県 災害対策本部会議資料一覧・被害情報',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html'},
 {section:'支援ダッシュボード',status:'要再確認',current:'行政応援・給水・技術支援は8月11日会議資料が最新確認値',previous:'8月11日の行政応援・給水・技術支援',difference:'8月13日時点で後続会議資料を確認できないため、8月11日値を履歴・最新確認値として保持。',source:'熊本県 災害対策本部会議資料一覧',url:'https://www.pref.kumamoto.jp/soshiki/222/274487.html'},
 {section:'災害ボランティア',status:'差分あり',current:'8月13日公式ページ・個別VCを再確認',previous:'2026年8月11日確認',difference:'宇土市第2期募集、宇城市当日受付終了、益城町第2期、芦北町募集終了などを反映。未確認の団体受入れは推定しない。',source:'熊本県・市町社会福祉協議会',url:'https://www.pref.kumamoto.jp/soshiki/27/275523.html'},
 {section:'地図・境界',status:'変更なし',current:'既存境界・地理院淡色地図・公式座標履歴を保持',previous:'既存の検証済みデータ',difference:'新しい境界や座標を推測せず、地理院淡色地図をデフォルトとして維持。',source:'国土地理院タイル一覧',url:'https://maps.gsi.go.jp/development/ichiran.html'}
]};`);

updated = updated.replace('"令和8年熊本地震による人的被害等の状況","asOf":"2026年8月11日14時時点","url":"https://www.pref.kumamoto.jp/uploaded/attachment/316599.pdf"', `"令和8年熊本地震による人的被害等の状況","asOf":"2026年8月13日8時時点","url":"${damageUrl}"`);
updated = updated.replace('最新公表集計は2026年8月11日14時の89か所。', '最新公表集計は2026年8月13日8時の81か所。');

await writeFile(file, updated, "utf8");
console.log(JSON.stringify({file, checkedAt, shelters: impacts.reduce((sum, row) => sum + row.shelters, 0), evacuees: impacts.reduce((sum, row) => sum + row.evacuees, 0), impacts: impacts.length}));

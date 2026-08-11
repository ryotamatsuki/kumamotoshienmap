import { readFile, writeFile } from "node:fs/promises";

const file = "ehime_kumamoto_support_geocoded_shelters_20260802.html";
const source = await readFile(file, "utf8");
const asOf = "2026-08-11T14:00:00+09:00";
const checkedAt = "2026-08-11T19:20:30+09:00";
const damageUrl = "https://www.pref.kumamoto.jp/uploaded/attachment/316599.pdf";
const reportUrl = "https://www.pref.kumamoto.jp/uploaded/attachment/316600.pdf";

const latest = {
  "熊本市": { s: 15, e: 281, h: [11, 57, 3, 0, 0, 3], house: [0, 0, 0, 2083, 5519], outage: 0, points: 0 },
  "宇土市": { s: 8, e: 51, h: [0, 0, 0, 0, 0, 11], house: [1, 0, 0, 1082, 2626], outage: 0, points: 1 },
  "宇城市": { s: 11, e: 690, h: [4, 24, 1, 0, 3, 0], house: [200, 0, 800, 3600, 0], outage: 8190, points: 6 },
  "美里町": { s: 3, e: 29, h: [8, 0, 8, 0, 0, 0], house: [15, 20, 30, 730, 14], outage: 0, points: 0 },
  "玉名市": { s: 0, e: 0, h: [1, 0, 1, 0, 0, 0], house: [0, 0, 0, 0, 0], outage: 0, points: 0 },
  "山鹿市": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0], outage: 0, points: 0 },
  "菊池市": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0], outage: 0, points: 0 },
  "合志市": { s: 0, e: 0, h: [1, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0], outage: 0, points: 0 },
  "大津町": { s: 0, e: 0, h: [2, 1, 0, 0, 0, 0], house: [0, 0, 0, 0, 0], outage: 0, points: 0 },
  "菊陽町": { s: 0, e: 0, h: [2, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0], outage: 0, points: 0 },
  "西原村": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0], outage: 0, points: 1 },
  "御船町": { s: 1, e: 13, h: [11, 6, 4, 0, 0, 0], house: [0, 0, 0, 0, 1139], outage: 0, points: 0 },
  "嘉島町": { s: 2, e: 18, h: [12, 0, 4, 0, 7, 0], house: [0, 0, 0, 0, 254], outage: 0, points: 0 },
  "益城町": { s: 1, e: 17, h: [0, 7, 2, 0, 0, 0], house: [0, 0, 0, 0, 0], outage: 0, points: 0 },
  "甲佐町": { s: 4, e: 10, h: [0, 0, 1, 0, 1, 0], house: [0, 0, 0, 0, 837], outage: 0, points: 0 },
  "山都町": { s: 0, e: 0, h: [0, 0, 1, 0, 0, 0], house: [0, 0, 0, 7, 31], outage: 0, points: 0 },
  "八代市": { s: 38, e: 2315, h: [0, 0, 0, 0, 20, 147], house: [754, 0, 0, 0, 1746], outage: 22980, points: 29 },
  "氷川町": { s: 4, e: 283, h: [0, 0, 0, 0, 5, 14], house: [163, 0, 195, 903, 0], outage: 2130, points: 3 },
  "水俣市": { s: 0, e: 0, h: [0, 0, 1, 0, 0, 0], house: [0, 0, 0, 3, 1], outage: 0, points: 0 },
  "芦北町": { s: 2, e: 7, h: [3, 0, 0, 0, 0, 0], house: [0, 0, 0, 97, 455], outage: 0, points: 2 },
  "津奈木町": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 1, 1], outage: 0, points: 0 },
  "人吉市": { s: 0, e: 0, h: [1, 0, 0, 0, 0, 1], house: [0, 0, 0, 16, 0], outage: 0, points: 0 },
  "上天草市": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 78, 0], outage: 0, points: 1 },
  "天草市": { s: 0, e: 0, h: [0, 0, 0, 0, 0, 0], house: [0, 0, 0, 0, 0], outage: 0, points: 0 },
};

function parseConstant(text, name, endMarker) {
  const marker = `const ${name}=`;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`${name} not found`);
  const valueStart = start + marker.length;
  const end = text.indexOf(endMarker, valueStart);
  if (end < 0) throw new Error(`${name} end not found`);
  return { start, valueStart, end, value: JSON.parse(text.slice(valueStart, end + 1)) };
}

function round(value) { return Math.round(value * 10) / 10; }
function level(value) { return value >= 70 ? "very-high" : value >= 45 ? "high" : value >= 20 ? "medium" : value > 0 ? "watch" : "limited"; }
function humanDetails(values) {
  return { mild: values[0], moderate: values[1], severe: values[2], cardiopulmonaryArrest: values[3], deaths: values[4], unclassified: values[5] };
}
function housingDetails(values) {
  return { destroyed: values[0], largeScaleHalfDestroyed: values[1], halfDestroyed: values[2], partiallyDamaged: values[3], unclassified: values[4] };
}
function evidenceFor(row, oldEvidence) {
  const kept = (oldEvidence || []).filter((value) => !/^(避難者|人的被害：|住家被害|断水|県管理道路の全面通行止めが複数)/.test(value) && !value.includes("住家の一部破損74"));
  const r = row.raw;
  const h = r.humanDetails;
  const hd = r.housingDetails;
  if (r.shelters || r.evacuees) kept.unshift(`避難者${r.evacuees.toLocaleString("ja-JP")}人／避難所${r.shelters}か所`);
  if (r.humanTotal) kept.splice(r.shelters || r.evacuees ? 1 : 0, 0, `人的被害：軽症${h.mild}人、中等症${h.moderate}人、重症${h.severe}人、死亡${h.deaths}人、分類未確定${h.unclassified}人`);
  if (r.housingTotal) kept.push(`住家被害${r.housingTotal.toLocaleString("ja-JP")}棟（全壊${hd.destroyed}、大規模半壊${hd.largeScaleHalfDestroyed}、半壊${hd.halfDestroyed}、一部破損${hd.partiallyDamaged.toLocaleString("ja-JP")}、分類未確定${hd.unclassified.toLocaleString("ja-JP")}）`);
  if (r.waterOutage || r.waterPoints) kept.push(`断水${r.waterOutage.toLocaleString("ja-JP")}戸／給水所${r.waterPoints}か所`);
  return [...new Set(kept)];
}

const need = parseConstant(source, "NEED_MUNICIPALITIES", "];\nconst NEED_LESSONS=");
const rows = need.value;
const max = {
  evacuees: Math.max(...rows.map((row) => latest[row.name].e)),
  shelters: Math.max(...rows.map((row) => latest[row.name].s)),
  outage: Math.max(...rows.map((row) => latest[row.name].outage)),
  points: Math.max(...rows.map((row) => latest[row.name].points)),
  human: Math.max(...rows.map((row) => latest[row.name].h.reduce((a, b) => a + b, 0))),
  housing: Math.max(...rows.map((row) => latest[row.name].house.reduce((a, b) => a + b, 0))),
};
for (const row of rows) {
  const v = latest[row.name];
  if (!v) throw new Error(`missing latest row: ${row.name}`);
  row.raw.shelters = v.s;
  row.raw.evacuees = v.e;
  row.raw.waterOutage = v.outage;
  row.raw.waterPoints = v.points;
  row.raw.humanDetails = humanDetails(v.h);
  row.raw.humanTotal = v.h.reduce((a, b) => a + b, 0);
  row.raw.deaths = v.h[4];
  row.raw.housingDetails = housingDetails(v.house);
  row.raw.housingTotal = v.house.reduce((a, b) => a + b, 0);
  const shelterScore = max.evacuees && max.shelters ? (v.e ? 70 * Math.sqrt(v.e / max.evacuees) : 0) + (v.s ? 30 * Math.sqrt(v.s / max.shelters) : 0) : 0;
  const waterScore = v.outage && max.outage ? 80 * Math.sqrt(v.outage / max.outage) + (v.points && max.points ? 20 * Math.sqrt(v.points / max.points) : 0) : 0;
  const healthScore = v.h.reduce((a, b) => a + b, 0) && max.human ? 100 * Math.sqrt(v.h.reduce((a, b) => a + b, 0) / max.human) : 0;
  const housingScore = v.house.reduce((a, b) => a + b, 0) && max.housing ? 100 * Math.sqrt(v.house.reduce((a, b) => a + b, 0) / max.housing) : 0;
  row.scores.shelter = round(shelterScore);
  row.scores.water = round(waterScore);
  row.scores.health = round(healthScore);
  row.scores.housing = round(housingScore);
  row.scores.administration = round(housingScore * 0.55 + shelterScore * 0.45);
  for (const key of ["shelter", "water", "health", "housing", "administration"]) row.levels[key] = level(row.scores[key]);
  row.evidence = evidenceFor(row, row.evidence);
  row.sourceUrl = damageUrl;
  row.detailSourceUrl = reportUrl;
  const activeCats = Object.keys(row.scores).filter((key) => row.scores[key] > 0);
  row.topNeeds = activeCats.sort((a, b) => row.scores[b] - row.scores[a]);
  row.overallLevel = row.topNeeds.length ? level(row.scores[row.topNeeds[0]]) : "limited";
}

const impacts = parseConstant(source, "IMPACTS", "];\n\nconst SUPPORT_BLOCKS=");
const impactRows = rows.filter((row) => latest[row.name].s || latest[row.name].e).map((row) => ({
  name: row.name,
  shelters: row.raw.shelters,
  evacuees: row.raw.evacuees,
  lat: row.coords[0],
  lng: row.coords[1],
}));
const newImpacts = JSON.stringify(impactRows);

let updated = source;
updated = updated.slice(0, need.valueStart) + JSON.stringify(rows) + updated.slice(need.end + 1);
let impactStart = updated.indexOf("const IMPACTS=");
const impactValueStart = impactStart + "const IMPACTS=".length;
const impactEnd = updated.indexOf("];\n\nconst SUPPORT_BLOCKS=", impactValueStart);
updated = updated.slice(0, impactValueStart) + newImpacts + updated.slice(impactEnd + 1);

const replacements = new Map([
  ["ページ全体再確認：2026年8月9日10:48", "ページ全体再確認：2026年8月11日19:20"],
  ["経過日 D+12（主要公表値はD+11・8月8日14時）", "経過日 D+14（主要公表値は8月11日14時）"],
  ["2026年8月9日 10:48（JST）", "2026年8月11日 19:20（JST）"],
  ["8月8日14:00", "8月11日14:00"],
  ["発災 D+12", "発災 D+14"],
  ["避難者5,408人", "避難者3,005人"],
  ["県全体の約85%", "県全体の約81%"],
  ["断水31,910戸", "断水31,170戸"],
  ["住家被害18,791棟のうち分類未確定9,690棟（約52%）", "住家被害23,404棟のうち分類未確定12,623棟（約54%）"],
  ["第11回政府現地本部会議まで開催", "第14回政府現地本部会議まで開催"],
  ["給水車177台を広域調整", "給水車173台を広域調整"],
  ["TEC-FORCE当日14班・累計626人", "TEC-FORCE 4市2町で約140人活動・累計約3,100人日"],
  ["6市町への対口支援", "7市町への対口支援"],
  ["行政応援808人（対口664・県内144）", "行政応援854人（対口711・県等143）"],
  ["宇城市・八代市でモバイルファーマシー", "宇城市・八代市でモバイルファーマシー（8月12日午前終了予定）"],
  ["177台", "173台"],
  ["国18・水道事業体102・自衛隊57", "国18・水道事業体105・自衛隊50"],
  ["14班", "約3,100人日"],
  ["当日5市町・累計626人", "4市2町・累計約3,100人日"],
  ["808人", "854人"],
  ["対口664・熊本県等144", "対口711・熊本県等143"],
  ["6,355<span class=\"overview-kpi-unit\">人", "3,714<span class=\"overview-kpi-unit\">人"],
  ["118<span class=\"overview-kpi-unit\">か所", "89<span class=\"overview-kpi-unit\">か所"],
  ["208<span class=\"overview-kpi-unit\">人", "392<span class=\"overview-kpi-unit\">人"],
  ["18,791<span class=\"overview-kpi-unit\">棟", "23,404<span class=\"overview-kpi-unit\">棟"],
  ["6,355人", "3,714人"],
  ["118避難所・12市町村", "89避難所・11市町村"],
  ["約34,780戸", "約33,300戸"],
  ["3市町、給水所49か所", "3市町、給水所43か所"],
  ["18,791棟", "23,404棟"],
  ["分類未確定9,690棟・推計含む", "分類未確定12,623棟・推計含む"],
  ["8月8日時点で仮置場開設", "8月11日時点で仮置場11市町開設"],
  ["現在 D+12：今後1～2週間", "現在 D+14：今後1～2週間"],
  ["8月8日の市町村別公表値", "8月11日の市町村別公表値"],
  ["最新集計118か所／位置履歴206点", "最新集計89か所／位置履歴206点"],
  ["8月8日14時の市町別集計は118か所", "8月11日14時の市町別集計は89か所"],
  ["最新公表集計は2026年8月8日14時の118か所", "最新公表集計は2026年8月11日14時の89か所"],
  ["8月8日14時の118避難所", "8月11日14時の89避難所"],
  ["最新集計8月8日14:00＝118か所", "最新集計8月11日14:00＝89か所"],
  ["kumamoto_support_official_20260808.csv", "kumamoto_support_official_20260811.csv"],
  ["kumamoto_observed_load_signals_20260808.csv", "kumamoto_observed_load_signals_20260811.csv"],
  ["D+12の現在フェーズです。8月8日の市町村別公表値", "D+14の現在フェーズです。8月11日の市町村別公表値"],
  ["8月8日の確定イベントを追加", "8月11日までの確定イベントを追加"],
  ["8月8日の行政応援・給水・技術支援へ更新", "8月11日の行政応援・給水・技術支援へ更新"],
  ["8月8日公表の対口支援団体", "8月11日公表の対口支援団体"],
]);
for (const [from, to] of replacements) updated = updated.split(from).join(to);

// Keep the 8/2 facility coordinates as a historical layer while correcting current aggregate labels.
updated = updated.replace(/const PAGE_RECHECK_META=\{checkedAt:'[^']+',portalObservedAt:null,volunteerCheckedAt:'[^']+',rows:\[[\s\S]*?\n\]\};/, `const PAGE_RECHECK_META={checkedAt:'${checkedAt}',portalObservedAt:null,volunteerCheckedAt:'${checkedAt}',rows:[
 {section:'被害・支援',status:'差分あり',current:'8月11日14時の最新公表値へ更新',previous:'熊本県資料：2026年8月8日14時',difference:'避難所89か所、避難者3,714人、人的被害392人、住家被害23,404棟、断水33,300戸、給水所43か所へ更新。人的被害の未分類176人を推測配分しない。',source:'熊本県 第21回災害対策本部会議資料',url:'${reportUrl}'},
 {section:'避難所',status:'要再確認',current:'最新集計89か所／位置履歴206点',previous:'8月8日14時の集計118か所／8月2日23時21分の位置履歴206点',difference:'施設単位の最新座標一覧を取得できないため、206点は履歴として保持し現在開設中とは表示しない。',source:'熊本県 人的被害等の状況',url:'${damageUrl}'},
 {section:'支援ニーズ見通し',status:'要再確認',current:'避難・人的・住家・断水は8月11日値で再算定',previous:'8月8日値',difference:'道路・学校・農林水産の市町別シグナルは前回値を保持し要再確認。未充足需要の順位ではない。',source:'熊本県 人的被害等の状況',url:'${damageUrl}'},
 {section:'発災後タイムライン',status:'差分あり',current:'8月11日までの確定イベントを追加',previous:'8月8日までの確定イベント',difference:'第21回本部会議、松島有料道路解除、E3緊急車両通行、給水車173台、医療・福祉の更新を反映。予定は実績化していない。',source:'熊本県 災害対策本部会議資料一覧',url:'https://www.pref.kumamoto.jp/soshiki/222/274487.html'},
 {section:'支援ダッシュボード',status:'差分あり',current:'8月11日の行政応援・給水・技術支援へ更新',previous:'8月8日の支援記録',difference:'行政応援854人（別枠54人は別系列）、給水車173台、TEC-FORCE累計約3,100人日等へ更新。単位の異なる値を合算しない。',source:'熊本県 第21回災害対策本部会議資料',url:'${reportUrl}'},
 {section:'災害ボランティア',status:'要再確認',current:'8月11日確認。前回値を保持した項目は要再確認表示',previous:'2026年8月9日10時48分確認',difference:'公式ページの現行日程・フォームを再確認後、募集終了・休止・再募集を更新する。未確認は情報未確認のまま表示。',source:'熊本県 市町村災害ボランティアセンター設置状況',url:'https://www.pref.kumamoto.jp/soshiki/27/275523.html'},
 {section:'地図・境界',status:'変更なし',current:'既存境界・地理院淡色地図・公式座標履歴を保持',previous:'既存の検証済みデータ',difference:'新しい境界や座標を推測せず、地理院淡色地図をデフォルトとして維持。',source:'国土地理院タイル一覧',url:'https://maps.gsi.go.jp/development/ichiran.html'}
]};`);

// Update source labels/URLs without removing the latest meeting packet from the source registry.
updated = updated.replace("第18回災害対策本部会議 各部説明資料", "第21回災害対策本部会議 各部説明資料").replace("2026年8月8日14時を中心とする最新公表値", "2026年8月11日14時を中心とする最新公表値").replace("https://www.pref.kumamoto.jp/uploaded/attachment/316443.pdf", reportUrl);
updated = updated.replace("令和8年熊本地震による人的被害等の状況\",asOf:\"2026年8月8日14時時点", "令和8年熊本地震による人的被害等の状況\",asOf:\"2026年8月11日14時時点").replace("https://www.pref.kumamoto.jp/uploaded/attachment/316442.pdf", damageUrl);
updated = updated.replace("国土交通省（現地対策本部）からの報告\",asOf:\"2026年8月8日13時（水道は10時）", "国土交通省（現地対策本部）からの報告\",asOf:\"2026年8月11日13時（水道は10時）").replace("https://www.pref.kumamoto.jp/uploaded/attachment/316440.pdf", "https://www.pref.kumamoto.jp/uploaded/attachment/316598.pdf");
updated = updated.replace("本県の支援状況について\",asOf:\"2026年8月7日12時", "本県の支援状況について\",asOf:\"2026年8月10日12時").replace("https://www.pref.ehime.jp/uploaded/attachment/187726.pdf", "https://www.pref.ehime.jp/uploaded/attachment/187761.pdf");

// Correct current shelter layer labels in the map/status text, preserving the historical point count.
updated = updated.replace(/最新公表集計は2026年8月11日14時の89か所。/g, "最新公表集計は2026年8月11日14時の89か所。");

await writeFile(file, updated, "utf8");
console.log(JSON.stringify({ file, checkedAt, municipalities: rows.length, impacts: impactRows.length, totals: { shelters: impactRows.reduce((a, b) => a + b.shelters, 0), evacuees: impactRows.reduce((a, b) => a + b.evacuees, 0) } }));

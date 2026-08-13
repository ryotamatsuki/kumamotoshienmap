import { readFile, writeFile } from "node:fs/promises";

const file = "ehime_kumamoto_support_geocoded_shelters_20260802.html";
const checkedAt = "2026-08-13T13:14:31+09:00";
const damageUrl = "https://www.pref.kumamoto.jp/uploaded/life/276971_869664_misc.pdf";
const mlitUrl = "https://www.mlit.go.jp/common/002016501.pdf";
let source = await readFile(file, "utf8");

function parseConstant(text, name, endMarker) {
  const marker = `const ${name}=`;
  const valueStart = text.indexOf(marker) + marker.length;
  const end = text.indexOf(endMarker, valueStart);
  if (valueStart < marker.length || end < 0) throw new Error(`${name} not found`);
  return { valueStart, end, value: JSON.parse(text.slice(valueStart, end + 1)) };
}
function round(value) { return Math.round(value * 10) / 10; }
function level(value) { return value >= 70 ? "very-high" : value >= 45 ? "high" : value >= 20 ? "medium" : value > 0 ? "watch" : "limited"; }

const water = {
  "八代市": 22382,
  "宇城市": 4098,
  "氷川町": 1901,
};
const needsPart = parseConstant(source, "NEED_MUNICIPALITIES", "];\nconst NEED_LESSONS=");
const rows = needsPart.value;
const max = {
  evacuees: Math.max(...rows.map((row) => row.raw.evacuees)),
  shelters: Math.max(...rows.map((row) => row.raw.shelters)),
  outage: Math.max(...Object.values(water)),
  human: Math.max(...rows.map((row) => row.raw.humanTotal)),
  housing: Math.max(...rows.map((row) => row.raw.housingTotal)),
};

for (const row of rows) {
  const outage = water[row.name] || 0;
  row.raw.waterOutage = outage;
  row.raw.waterPoints = null;
  row.raw.waterSourceUrl = mlitUrl;
  const shelterScore = row.raw.evacuees
    ? 70 * Math.sqrt(row.raw.evacuees / max.evacuees) + 30 * Math.sqrt(row.raw.shelters / max.shelters)
    : 0;
  const waterScore = outage ? 80 * Math.sqrt(outage / max.outage) : 0;
  const healthScore = row.raw.humanTotal ? 100 * Math.sqrt(row.raw.humanTotal / max.human) : 0;
  const housingScore = row.raw.housingTotal ? 100 * Math.sqrt(row.raw.housingTotal / max.housing) : 0;
  row.scores.shelter = round(shelterScore);
  row.scores.water = round(waterScore);
  row.scores.health = round(healthScore);
  row.scores.housing = round(housingScore);
  row.scores.administration = round(housingScore * 0.55 + shelterScore * 0.45);
  for (const key of ["shelter", "water", "health", "housing", "administration"]) row.levels[key] = level(row.scores[key]);
  const evidence = (row.evidence || []).filter((value) => !/^断水/.test(value));
  if (outage) evidence.push(`断水${outage.toLocaleString("ja-JP")}戸（国土交通省第39報・8月13日7時30分。給水所数は同報に記載なし）`);
  row.evidence = [...new Set(evidence)];
  row.sourceUrl = damageUrl;
  row.detailSourceUrl = damageUrl;
  row.topNeeds = Object.keys(row.scores).filter((key) => row.scores[key] > 0).sort((a, b) => row.scores[b] - row.scores[a]);
  row.overallLevel = row.topNeeds.length ? level(row.scores[row.topNeeds[0]]) : "limited";
}

source = source.slice(0, needsPart.valueStart) + JSON.stringify(rows) + source.slice(needsPart.end + 1);

const impactsPart = parseConstant(source, "IMPACTS", "];\n\nconst SUPPORT_BLOCKS=");
const impacts = rows.filter((row) => row.raw.shelters || row.raw.evacuees).map((row) => ({
  name: row.name,
  shelters: row.raw.shelters,
  evacuees: row.raw.evacuees,
  lat: row.coords[0],
  lng: row.coords[1],
}));
source = source.slice(0, impactsPart.valueStart) + JSON.stringify(impacts) + source.slice(impactsPart.end + 1);

const replacements = [
  ["<div class=\"metric-label\">避難所</div><div class=\"metric-value\">89<span class=\"metric-unit\">か所", "<div class=\"metric-label\">避難所</div><div class=\"metric-value\">81<span class=\"metric-unit\">か所"],
  ["<div class=\"snap\"><strong>約3,100人日</strong><span>TEC-FORCE<br/>累計（人日）</span></div>", "<div class=\"snap\"><strong>3,389人日</strong><span>TEC-FORCE<br/>累計（予定含む）</span></div>"],
  ["<div class=\"overview-kpi-value\">89<span class=\"overview-kpi-unit\">か所", "<div class=\"overview-kpi-value\">81<span class=\"overview-kpi-unit\">か所"],
  ["<div class=\"overview-kpi-note\">8月11日14時時点</div>", "<div class=\"overview-kpi-note\">8月13日8時時点</div>"],
  ["<div class=\"overview-kpi-value\">392<span class=\"overview-kpi-unit\">人", "<div class=\"overview-kpi-value\">393<span class=\"overview-kpi-unit\">人"],
  ["DMAT調整員と保健師等第2班は8月10日公表時点で活動期間中。DPAT第2班は8月9日出発・活動期間中だが、当日の実働は要確認。", "DMAT調整第2陣は8月13日～17日、保健師等第3陣は8月12日～17日の活動期間中。DPAT第2班は8月9日～12日の予定期間を終え、実働完了は要再確認。"],
  ["2市で避難者2,897人、県全体の約81%。断水31,170戸を含み、給水・保健・避難所運営の交代需要を確認。", "2市で避難者2,897人、県全体の約79%。国交省第39報では3市町の断水約28,400戸（県速報とは集計範囲が異なる）。給水・保健・避難所運営の交代需要を確認。"],
  ["給水車173台を広域調整", "給水車140台（国交省第39報・集計時点）を広域調整"],
  ["TEC-FORCE 4市2町で約140人活動・累計約3,100人日", "TEC-FORCE現在107人・累計3,389人日（予定含む）"],
  ["<div class=\"overview-resource-value\">173台</div><div class=\"overview-resource-sub\">国18・水道事業体105・自衛隊50</div>", "<div class=\"overview-resource-value\">140台</div><div class=\"overview-resource-sub\">国交省第39報・集計時点（定義別）</div>"],
  ["<div class=\"overview-resource-value\">約3,100人日</div><div class=\"overview-resource-sub\">4市2町・累計約3,100人日</div>", "<div class=\"overview-resource-value\">3,389人日</div><div class=\"overview-resource-sub\">TEC-FORCE現在107人・累計（予定含む）</div>"],
  ["<div class=\"overview-role-value\">第2班3人</div><div class=\"overview-role-sub\">8月7日公表時点で派遣中・氷川町健康センター</div>", "<div class=\"overview-role-value\">第3班3人</div><div class=\"overview-role-sub\">8月12日～17日・氷川町保健所管内</div>"],
  ["<div class=\"overview-detail-actions\"><a class=\"dashboard-link\" href=\"https://www.pref.kumamoto.jp/uploaded/attachment/316599.pdf\"", `<div class="overview-detail-actions"><a class="dashboard-link" href="${damageUrl}"`],
  ["人的被害392人のうち3人は市町未割当の死亡区分、住家被害27,872棟（推計含む）のうち3棟は市町別24行の表外です。地図の施設点は8月2日の位置履歴で、最新集計89か所と一致しません。", "人的被害は速報内訳の分類合計393人相当（県資料の合計欄は要再確認）。市町別24行の人的被害表内合計は389人。住家被害27,872棟のうち市町別24行は27,867棟で、差5棟は表外3町村分です。地図の施設点は8月2日の位置履歴で、最新集計81か所と一致しません。"],
  ["人的被害は速報内訳の分類合計393人相当（県資料の合計欄は要再確認）。市町別24行の人的被害表内合計は389人。住家被害27,872棟のうち市町別24行は27,867棟で、差5棟は表外3町村分です。地図の施設点は8月2日の位置履歴で、最新集計81か所と一致しません。", "人的被害は速報内訳の分類合計393人相当（県資料の合計欄は要再確認）。市町別24行の人的被害表内合計は390人。住家被害27,872棟のうち市町別24行は27,857棟で、差15棟は収録対象外市町村分を含みます。地図の施設点は8月2日の位置履歴で、最新集計81か所と一致しません。"],
  ["kumamoto_support_official_20260811.csv", "kumamoto_support_official_20260813.csv"],
  ["kumamoto_observed_load_signals_20260811.csv", "kumamoto_observed_load_signals_20260813.csv"],
  ["const PROVINCE_NEEDS=[", "const PROVINCE_NEEDS=["],
  ["3市町で約33,300戸が断水し、給水所43か所を運営。", "国土交通省第39報（8月13日7時30分）では八代市・宇城市・氷川町の断水は約28,400戸。給水所数は同報に記載なし。"],
  ["11市町村89か所の避難所に3,662人。", "11市町村81か所の避難所に3,662人。"],
  ["24市町の人的被害合計389人と県計392人との差3人", "24市町の人的被害表内合計390人。県速報の人的被害内訳は393人相当で、資料の合計欄との不一致は要再確認"],
  ["24市町の人的被害表内合計389人。県速報の人的被害内訳は393人相当で、資料の合計欄との不一致は要再確認", "24市町の人的被害表内合計390人。県速報の人的被害内訳は393人相当で、資料の合計欄との不一致は要再確認"],
  ["住家被害23,401棟と県計23,404棟との差3棟", "住家被害27,857棟と県計27,872棟との差15棟（収録対象外市町村分を含む）"],
  ["住家被害27,867棟と県計27,872棟との差5棟（表外3町村分）", "住家被害27,857棟と県計27,872棟との差15棟（収録対象外市町村分を含む）"],
  ["<div class=\"needs-kpi-value\">約33,300戸</div><div class=\"needs-kpi-note\">3市町、給水所43か所</div>", "<div class=\"needs-kpi-value\">約28,400戸</div><div class=\"needs-kpi-note\">国交省第39報・3市町（給水所数は同報に記載なし）</div>"],
  ["summary:\"避難者3,662人、断水34,780戸、住家被害27,872棟等の直近状況を共有。\"", "summary:\"8月8日14時時点：避難者6,355人、断水34,780戸、住家被害18,791棟等の直近状況を共有。\""],
  ["人的被害内訳は393人相当で、資料の合計欄との不一致は要再確認は、市町未割当の「災害と関連する可能性がある死亡」1人と「災害との関連調査中」2人です。住家被害23,401棟と県計27,872棟との差3棟は表外2町村分です。", "人的被害内訳は393人相当で、資料の合計欄との不一致は要再確認です。市町別24行は人的被害390人、住家被害27,857棟で、県計との差は収録対象外市町村分を含みます（住家15棟）。"],
  ["市町別24行は人的被害390人、住家被害27,857棟で、県計との差は収録対象外市町村分を含みます（住家15棟）。", "市町別24行は人的被害390人。住家被害27,857棟と県計27,872棟との差15棟（収録対象外市町村分を含む）。"],
  ["市町別24行の人的被害表内合計は389人。住家被害27,872棟のうち市町別24行は27,867棟で、差5棟は表外3町村分です。", "市町別24行の人的被害表内合計は390人。住家被害27,872棟のうち市町別24行は27,857棟で、差15棟は収録対象外市町村分を含みます。"],
  ["住家被害27,872棟（推計を含む）のうち分類未確定9,690棟。", "住家被害27,872棟（推計を含む）のうち分類未確定16,084棟。"],
  ["最新集計89か所／位置履歴206点", "最新集計81か所／位置履歴206点"],
  ["8月11日確認中（公式個別ページ）", "8月13日確認済み（公式個別ページ）"],
  ["2026年8月11日14時時点の89か所", "2026年8月13日8時時点の81か所"],
  ["最新集計89か所", "最新集計81か所"],
  ["https://www.pref.kumamoto.jp/uploaded/attachment/316599.pdf", damageUrl],
];
for (const [from, to] of replacements) source = source.split(from).join(to);

source = source.replace(
  /const PAGE_RECHECK_META=\{checkedAt:'[^']+',portalObservedAt:null,volunteerCheckedAt:'[^']+',rows:\[[\s\S]*?\n\]\};/,
  `const PAGE_RECHECK_META={checkedAt:'${checkedAt}',portalObservedAt:null,volunteerCheckedAt:'${checkedAt}',rows:[
 {section:'被害・支援',status:'差分あり',current:'8月13日8時の最新公表値へ更新',previous:'熊本県資料：2026年8月11日14時',difference:'避難所81か所、避難者3,662人、人的被害は速報内訳393人相当、住家被害27,872棟へ更新。人的被害の県資料合計欄は要再確認。',source:'熊本県 第25報（8月13日8時時点）',url:'${damageUrl}'},
 {section:'避難所',status:'要再確認',current:'最新集計81か所／位置履歴206点',previous:'8月11日14時の集計89か所／8月2日23時21分の位置履歴206点',difference:'施設単位の最新座標一覧を取得できないため、206点は履歴として保持し現在開設中とは表示しない。',source:'熊本県 人的被害等の状況',url:'${damageUrl}'},
 {section:'支援ニーズ見通し',status:'差分あり',current:'避難・人的・住家は8月13日値、断水は国交省第39報で再算定',previous:'8月11日値',difference:'3市町の断水約28,400戸は県速報と集計範囲が異なる。道路・学校・農林水産の市町別シグナルは前回値を保持し要再確認。',source:'熊本県 第25報・国土交通省第39報',url:'${mlitUrl}'},
 {section:'発災後タイムライン',status:'差分あり',current:'8月13日被害報告と国交省第39報を追加。会議資料は8月11日まで',previous:'8月11日までの確定イベント',difference:'新しい災害対策本部会議資料は確認できず、予定を実績化しない。第25報の被害数値だけを最新化。',source:'熊本県 災害対策本部会議資料一覧・被害情報',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html'},
 {section:'支援ダッシュボード',status:'要再確認',current:'給水・技術支援は国交省第39報、行政応援等は8月11日会議資料が最新確認値',previous:'8月11日の行政応援・給水・技術支援',difference:'集計定義が異なる給水車・断水値を単純合算せず、各資料の時点と範囲を併記。',source:'国土交通省第39報・熊本県災害対策本部会議資料一覧',url:'${mlitUrl}'},
 {section:'災害ボランティア',status:'差分あり',current:'8月13日公式ページ・個別VCを再確認',previous:'2026年8月11日確認',difference:'宇土市第2期募集、宇城市当日受付終了、益城町第2期、芦北町募集終了などを反映。未確認の団体受入れは推定しない。',source:'熊本県・市町社会福祉協議会',url:'https://www.pref.kumamoto.jp/soshiki/27/275523.html'},
 {section:'地図・境界',status:'変更なし',current:'既存境界・地理院淡色地図・公式座標履歴を保持',previous:'既存の検証済みデータ',difference:'新しい境界や座標を推測せず、地理院淡色地図をデフォルトとして維持。',source:'国土地理院タイル一覧',url:'https://maps.gsi.go.jp/development/ichiran.html'}
]};`,
);

source = source.replace(
  /\nrefreshRecord\("ehime-management"[\s\S]*?\nif\(!TIMELINE_EVENTS\.some\(event=>event\.id==="t-kumamoto-aug11"\)\)/,
  `
refreshRecord("ehime-management",{scale:"先遣隊4人",status:"活動期間終了・継続要確認",detail:"先遣隊4人（県職員）が災害マネジメントと避難所支援を担当。避難所運営等9人（県4・市町5）とは別枠で表示。8月12日版で継続状況は要確認。",asOf:"愛媛県 8月12日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"https://www.pref.ehime.jp/uploaded/attachment/187841.pdf"});
if(!RECORDS.some(item=>item.id==='ehime-shelter-ops'))RECORDS.push({id:'ehime-shelter-ops',provider:'ehime',category:'administration',hubIds:['hikawa'],title:'避難所運営等の人的支援',providers:['愛媛県','愛媛県内市町'],status:'派遣中・終期要確認',scale:'9人（県4、市町5）',period:'8月7日12時公表時点',detail:'竜北東小学校6人、竜北西部小学校3人。終期は公表資料に記載がないため要確認。',asOf:'愛媛県 8月12日12時',sourceLabel:'愛媛県 本県の支援状況',sourceUrl:'https://www.pref.ehime.jp/uploaded/attachment/187841.pdf'});
refreshRecord("ehime-shelter-ops",{status:"8月12日公表時点で派遣中・終期要確認",asOf:"愛媛県 8月12日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"https://www.pref.ehime.jp/uploaded/attachment/187841.pdf"});
refreshRecord("ehime-health",{status:"第3班活動期間中（8月12日公表）",period:"第3班：8月12日～17日（氷川町保健所管内）／第6班まで8月31日予定",detail:"保健師2人・事務1人の第3班が氷川町保健所管内で活動期間中。第6班までの交代を8月31日まで予定。",asOf:"愛媛県 8月12日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"https://www.pref.ehime.jp/uploaded/attachment/187841.pdf"});
refreshRecord("ehime-dmat",{providers:["愛媛大学医学部附属病院","松山赤十字病院","市立宇和島病院","愛媛県立中央病院","市立八幡浜総合病院","公立学校共済組合四国中央病院","松山市民病院"],status:"調整員第2陣活動期間中（8月12日公表）",period:"第2陣：8月13日～17日（八代市保健所管内）",detail:"DMAT調整員第2陣2人が8月13日～17日に八代市保健所管内で活動予定。派遣元は松山市民病院。",asOf:"愛媛県 8月12日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"https://www.pref.ehime.jp/uploaded/attachment/187841.pdf"});
refreshRecord("ehime-dpat",{status:"予定期間終了・実働完了要再確認",period:"8月9日～12日（予定期間）",detail:"DPAT第2班は8月9日～12日の予定期間を終えた。実働完了と実際の派遣先は愛媛県資料だけでは確定しない。",asOf:"愛媛県 8月12日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"https://www.pref.ehime.jp/uploaded/attachment/187841.pdf"});
refreshRecord("ehime-redcross",{status:"第1班活動期間中・第2班予定（実働要確認）",scale:"第1班7人／第2班7人",period:"第1班：8月8日～13日（宇城市）／第2班：8月20日～25日",detail:"日本赤十字社愛媛県支部の第1班7人は宇城市で8月13日まで、第2班7人は8月20日～25日に活動予定。実働完了は要確認。",asOf:"愛媛県 8月12日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"https://www.pref.ehime.jp/uploaded/attachment/187841.pdf"});
refreshRecord("ehime-assessor",{status:"活動期間終了・帰県要確認",period:"8月7日出発／8月8日～10日活動期間",detail:"県職員2人の被災建築物応急危険度判定は8月10日までの活動期間を終えた。帰県は資料上で確認できない。",asOf:"愛媛県 8月12日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"https://www.pref.ehime.jp/uploaded/attachment/187841.pdf"});
refreshRecord("ehime-police",{status:"特別犯罪抑止部隊活動期間中（実働要確認）",scale:"4人",period:"8月11日～19日予定",detail:"愛媛県警の特別犯罪抑止部隊4人は8月11日～19日の活動予定。実働状況は最新の現地確認が必要。",asOf:"愛媛県 8月12日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"https://www.pref.ehime.jp/uploaded/attachment/187841.pdf"});
if(!RECORDS.some(item=>item.id==='ehime-dwat'))RECORDS.push({id:'ehime-dwat',provider:'ehime',category:'health',hubIds:['yatsushiro'],title:'愛媛DWATによる避難所福祉支援',providers:['愛媛県','愛媛県内福祉職'],status:'活動期間中（8月12日公表）',scale:'3人（介護支援専門員1・ソーシャルワーカー2）',period:'8月12日～14日／9月7日まで9陣予定',detail:'八代市の避難所で福祉支援。9月7日まで9陣の交代を予定。個別避難所の実働は現地確認が必要。',asOf:'愛媛県 8月12日12時',sourceLabel:'愛媛県 本県の支援状況',sourceUrl:'https://www.pref.ehime.jp/uploaded/attachment/187841.pdf'});
if(!TIMELINE_EVENTS.some(event=>event.id==="t-kumamoto-aug11"))`,
);

source = source.replace(
  /refreshRecord\("national-water"[\s\S]*?refreshRecord\("national-tec"[\s\S]*?\);/,
  `refreshRecord("national-water",{status:"活動中",scale:"給水車140台（国交省第39報・集計時点）",period:"8月13日7時30分時点",detail:"国土交通省第39報の給水車現在数。旧県資料の173台とは集計時点・定義が異なるため単純比較しない。",asOf:"国土交通省第39報 8月13日7時30分",sourceLabel:"国土交通省（現地対策本部）第39報",sourceUrl:"${mlitUrl}"});
refreshRecord("national-tec",{status:"活動中",scale:"現在107人・累計3,389人日（予定含む）",period:"8月13日7時30分時点",detail:"国土交通省第39報のTEC-FORCE現在人数と累計人日。旧県資料の人数・人日とは単位と集計範囲が異なるため単純比較しない。",asOf:"国土交通省第39報 8月13日7時30分",sourceLabel:"国土交通省（現地対策本部）第39報",sourceUrl:"${mlitUrl}"});`,
);
source = source.replace(
  'const refreshTimeline=(id,values)=>Object.assign(TIMELINE_EVENTS.find(event=>event.id===id),values);',
  'refreshRecord("national-finance",{status:"繰上げ交付決定・実施確認なし"});\nrefreshRecord("kumamoto-internal",{hubIds:["kumamoto-hq","yatsushiro","uto","uki","misato","kashima","mifune","kosa","ashikita","hikawa"]});\nconst refreshTimeline=(id,values)=>Object.assign(TIMELINE_EVENTS.find(event=>event.id===id),values);\nrefreshTimeline("t-payment",{phase:"recovery"});',
);

source = source.replace(
  '"国土交通省（現地対策本部）からの報告","asOf":"2026年8月11日13時（水道は10時）","url":"https://www.pref.kumamoto.jp/uploaded/attachment/316598.pdf"',
  `"国土交通省（現地対策本部）第39報","asOf":"2026年8月13日7時30分","url":"${mlitUrl}"`,
);
source = source.replace(
  '"本県の支援状況について","asOf":"2026年8月10日12時","url":"https://www.pref.ehime.jp/uploaded/attachment/187761.pdf"',
  '"本県の支援状況について","asOf":"2026年8月12日12時","url":"https://www.pref.ehime.jp/uploaded/attachment/187841.pdf"',
);
source = source.replace(/(\{id:["']t-kumamoto-aug11["'][\s\S]*?hubIds:\["kumamoto-hq"\])\}\);/, "$1,tags:[]});");
source = source.replace("...item.tags]", "...(item.tags||[])]");
source = source.replace("const tags=[...item.tags];", "const tags=[...(item.tags||[])];");

source = source.replace(/^refreshRecord\("national-finance"[^\n]*\r?\n/gm, "");
source = source.replace(/^refreshRecord\("kumamoto-internal"[^\n]*\r?\n/gm, "");
source = source.replace(/^refreshTimeline\("t-payment"[^\n]*\r?\n/gm, "");
source = source.replace(/const refreshTimeline=\(id,values\)=>Object\.assign\(TIMELINE_EVENTS\.find\(event=>event\.id===id\),values\);\r?\n/g, "");
source = source.replace("refreshTimeline('t-hq18'", "const refreshTimeline=(id,values)=>Object.assign(TIMELINE_EVENTS.find(event=>event.id===id),values);\nrefreshTimeline('t-hq18'");
source = source.replace(
  "const refreshTimeline=(id,values)=>Object.assign(TIMELINE_EVENTS.find(event=>event.id===id),values);\nrefreshTimeline('t-hq18'",
  "const refreshTimeline=(id,values)=>Object.assign(TIMELINE_EVENTS.find(event=>event.id===id),values);\nrefreshRecord(\"national-finance\",{status:\"繰上げ交付決定・実施確認なし\"});\nrefreshRecord(\"kumamoto-internal\",{hubIds:[\"kumamoto-hq\",\"yatsushiro\",\"uto\",\"uki\",\"misato\",\"kashima\",\"mifune\",\"kosa\",\"ashikita\",\"hikawa\"]});\nrefreshTimeline(\"t-payment\",{phase:\"recovery\"});\nrefreshTimeline('t-hq18'",
);

if (!source.includes("t-mlit-aug13")) {
  const timelinePatch = `refreshTimeline('t-current-status',{date:'2026-08-13',dateLabel:'8月13日',time:'8:00–10:00',summary:'人的被害は速報内訳393人相当（県資料の合計欄は要再確認）、住家被害27,872棟、避難者3,662人。国交省第39報では断水約28,400戸、給水車140台。',detail:'熊本県第25報（8月13日8時）と国土交通省第39報（8月13日7時30分）の現況。断水・給水車は資料ごとに集計範囲が異なるため単純比較しない。',sourceLabel:'熊本県 第25報・国土交通省 第39報',sourceUrl:'${mlitUrl}'});
TIMELINE_EVENTS.push({id:'t-mlit-aug13',date:'2026-08-13',dateLabel:'8月13日',weekday:'木',time:'7:30',phase:'lifeline',actor:'national',title:'国土交通省第39報で断水・技術支援を更新',summary:'八代市・宇城市・氷川町の断水約28,400戸、給水車140台、TEC-FORCE現在107人・累計3,389人日（予定含む）を公表。',detail:'道路は災害通行止め2路線9区間、孤立集落なし。前回資料とは集計時点・定義が異なる。',place:'熊本県内',sourceLabel:'国土交通省 現地対策本部 第39報',sourceUrl:'${mlitUrl}',recordIds:['national-water','national-tec'],hubIds:['kumamoto-hq','yatsushiro','uki','hikawa'],tags:['国交省第39報','断水','TEC-FORCE']});
TIMELINE_EVENTS.push({id:'t-ehime-aug12',date:'2026-08-12',dateLabel:'8月12日',weekday:'水',time:'12:00',phase:'support',actor:'ehime',title:'愛媛県が支援状況を更新',summary:'DMAT調整第2陣、保健師等第3班、DWAT、警察部隊等の活動期間と後続支援を更新。',detail:'愛媛県公表の8月12日12時版。活動期間は予定を含むため、実働完了・継続は現地確認と分けて表示。',place:'熊本県内',sourceLabel:'愛媛県 本県の支援状況（8月12日12時）',sourceUrl:'https://www.pref.ehime.jp/uploaded/attachment/187841.pdf',recordIds:['ehime-dmat','ehime-health','ehime-dwat','ehime-police'],hubIds:['ehime-hq','yatsushiro','hikawa'],tags:['愛媛県','支援更新']});
`;
  source = source.replace("const replaceVisibleText=", `${timelinePatch}const replaceVisibleText=`);
}

source = source.replace(
  'summary:"避難所89か所・避難者3,662人、人的被害392人、住家被害27,872棟等の最新資料を公表。"',
  'summary:"避難所89か所・避難者3,714人、人的被害392人、住家被害23,404棟等の8月11日最新資料を公表。"',
);
source = source.replace(
  'detail:"給水車173台、行政応援854人、TEC-FORCE累計約3,100人日等を更新。"',
  'detail:"給水車173台、行政応援854人、TEC-FORCE累計約3,100人日等を掲載した8月11日資料。"',
);
source = source.replace(
  'const currentSupportOverrides20260811=',
  'const currentSupportOverrides20260811=',
);

await writeFile(file, source, "utf8");
console.log(JSON.stringify({ file, checkedAt, impacts: impacts.length, shelters: impacts.reduce((sum, row) => sum + row.shelters, 0), evacuees: impacts.reduce((sum, row) => sum + row.evacuees, 0), waterOutage: rows.reduce((sum, row) => sum + row.raw.waterOutage, 0) }));

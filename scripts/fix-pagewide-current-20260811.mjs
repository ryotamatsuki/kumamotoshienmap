import { readFile, writeFile } from "node:fs/promises";

const file = "ehime_kumamoto_support_geocoded_shelters_20260802.html";
let html = await readFile(file, "utf8");
const damageUrl = "https://www.pref.kumamoto.jp/uploaded/attachment/316599.pdf";
const reportUrl = "https://www.pref.kumamoto.jp/uploaded/attachment/316600.pdf";
const mlitUrl = "https://www.pref.kumamoto.jp/uploaded/attachment/316598.pdf";
const ehimeUrl = "https://www.pref.ehime.jp/uploaded/attachment/187761.pdf";

const exact = new Map([
  ["<div class=\"overview-kpi-note\">8月8日14時時点</div>", "<div class=\"overview-kpi-note\">8月11日14時時点</div>"],
  ["<div class=\"overview-kpi-note\">12市町村・8月8日14時</div>", "<div class=\"overview-kpi-note\">11市町村・8月11日14時</div>"],
  ["<div class=\"metric\"><div class=\"metric-label\">避難者</div><div class=\"metric-value\">6,355<span class=\"metric-unit\">人</span>", "<div class=\"metric\"><div class=\"metric-label\">避難者</div><div class=\"metric-value\">3,714<span class=\"metric-unit\">人</span>"],
  ["<div class=\"metric\"><div class=\"metric-label\">避難所</div><div class=\"metric-value\">118<span class=\"metric-unit\">か所</span>", "<div class=\"metric\"><div class=\"metric-label\">避難所</div><div class=\"metric-value\">89<span class=\"metric-unit\">か所</span>"],
  ["<div class=\"metric\"><div class=\"metric-label\">人的被害</div><div class=\"metric-value\">208<span class=\"metric-unit\">人</span>", "<div class=\"metric\"><div class=\"metric-label\">人的被害</div><div class=\"metric-value\">392<span class=\"metric-unit\">人</span>"],
  ["<div class=\"metric\"><div class=\"metric-label\">住家被害</div><div class=\"metric-value\">18,791<span class=\"metric-unit\">棟</span>", "<div class=\"metric\"><div class=\"metric-label\">住家被害</div><div class=\"metric-value\">23,404<span class=\"metric-unit\">棟</span>"],
  ["<div class=\"support-snapshot\">\n<div class=\"snap\"><strong>6</strong>", "<div class=\"support-snapshot\">\n<div class=\"snap\"><strong>7</strong>"],
  ["latest aggregate placeholder", "latest aggregate placeholder"],
  ["最新集計118か所／位置履歴206点", "最新集計89か所／位置履歴206点"],
  ["最新集計8月8日14:00＝118か所", "最新集計8月11日14:00＝89か所"],
  ["最新公表集計は2026年8月8日14時の118か所", "最新公表集計は2026年8月11日14時の89か所"],
  ["状態・座標：最新の市町別集計は2026年8月8日14時の118か所です。", "状態・座標：最新の市町別集計は2026年8月11日14時の89か所です。"],
  ["最新公表集計は2026年8月11日14時の89か所。", "最新公表集計は2026年8月11日14時の89か所。"],
  ["8月8日14時の118避難所", "8月11日14時の89避難所"],
  ["8月8日14時の市町別集計は118か所", "8月11日14時の市町別集計は89か所"],
  ["8月8日までの確定イベントを追加", "8月11日までの確定イベントを追加"],
  ["<span class=\"overview-section-tag\">2026年8月9日確認</span>", "<span class=\"overview-section-tag\">2026年8月11日確認</span>"],
  ["<span>ボランティア個別確認：8月9日10:48</span>", "<span>ボランティア個別確認：8月11日確認中</span>"],
  ["8月8日14時の市町村別公表値を平方根変換", "8月11日14時の市町村別公表値を平方根変換"],
  ["24市町の人的被害合計205人と県計208人との差3人", "24市町の人的被害合計389人と県計392人との差3人"],
  ["住家被害18,788棟と県計23,404棟との差3棟", "住家被害23,401棟と県計23,404棟との差3棟"],
  ["8月8日確認値を保持し", "8月8日以前の確認値を保持し"],
  ["<a href=\"https://www.pref.kumamoto.jp/uploaded/attachment/316442.pdf\" target=\"_blank\" rel=\"noopener\">熊本県公式資料</a>", `<a href=\"${damageUrl}\" target=\"_blank\" rel=\"noopener\">熊本県公式資料</a>`],
  ["熊本県公表 2026年8月8日14時時点", "熊本県公表 2026年8月11日14時時点"],
  ["人的被害208人のうち3人は市町未割当の死亡区分、住家被害23,404棟（推計含む）のうち3棟は市町別24行の表外です。地図の施設点は8月2日の位置履歴で、最新集計118か所と一致しません。", "人的被害392人のうち3人は市町未割当の死亡区分、住家被害23,404棟（推計含む）のうち3棟は市町別24行の表外です。地図の施設点は8月2日の位置履歴で、最新集計89か所と一致しません。"],
]);
for (const [from, to] of exact) html = html.split(from).join(to);

// Source registry and current source links. Historical records remain in RECORDS, while current cards use these URLs.
html = html.replace(/const BLOCK_SOURCE_URL='[^']+';/, `const BLOCK_SOURCE_URL='${reportUrl}';`);
html = html.replace(/(const SOURCES=\[\{"group":"熊本県","name":"第21回災害対策本部会議 各部説明資料","asOf":"2026年8月11日14時を中心とする最新公表値","url":")[^"]+/, `$1${reportUrl}`);
html = html.replace(/(\{"group":"熊本県","name":"令和8年熊本地震による人的被害等の状況","asOf":")[^"]+/, '$1' + "2026年8月11日14時時点");
html = html.replace(/(\{"group":"熊本県","name":"令和8年熊本地震による人的被害等の状況","asOf":"2026年8月11日14時時点","url":")[^"]+/, `$1${damageUrl}`);
html = html.replace(/(\{"group":"国・関係機関","name":"国土交通省（現地対策本部）からの報告","asOf":")[^"]+/, '$1' + "2026年8月11日13時（水道は10時）");
html = html.replace(/(\{"group":"国・関係機関","name":"国土交通省（現地対策本部）からの報告","asOf":"2026年8月11日13時（水道は10時）","url":")[^"]+/, `$1${mlitUrl}`);
html = html.replace(/(\{"group":"愛媛県","name":"本県の支援状況について","asOf":")[^"]+/, '$1' + "2026年8月10日12時");
html = html.replace(/(\{"group":"愛媛県","name":"本県の支援状況について","asOf":"2026年8月10日12時","url":")[^"]+/, `$1${ehimeUrl}`);
html = html.replace(/最新の市町別集計は2026年8月8日14時の118か所/g, "最新の市町別集計は2026年8月11日14時の89か所");

// Runtime overrides keep current support records and timeline cards consistent with the latest source packet.
const marker = 'const SHELTER_EXPECTED_TOTAL=206;';
const insertAt = html.indexOf(marker);
if (insertAt < 0) throw new Error('runtime insertion point not found');
const overrides = `refreshRecord("kumamoto-internal",{hubIds:["kumamoto-hq","yatsushiro","uto","uki","misato","mifune","kashima","kosa","hikawa","ashikita"],title:"行政応援職員（対口支援を含む）",providers:["対口支援団体","熊本県","熊本県内市町村"],status:"活動中（8月11日公表）",scale:"当日854人（対口711、熊本県・県内市町村143）／累計6,941人日",period:"8月11日14時時点",detail:"LO・技術職を除く当日合計854人。対口支援711人と熊本県・県内市町村143人を分けて表示。別系列のその他関係団体54人はこの人数に合算しない。",asOf:"熊本県資料 8月11日14時",sourceLabel:"熊本県 第21回災害対策本部会議 各部報告資料",sourceUrl:"${reportUrl}"});
refreshRecord("national-coordination",{title:"政府非常災害現地対策本部・省庁連絡調整",scale:"第21回県本部・第14回政府現地本部会議まで開催",period:"8月11日16時時点",asOf:"熊本県 8月11日16時",sourceLabel:"熊本県 災害対策本部会議資料一覧",sourceUrl:"https://www.pref.kumamoto.jp/soshiki/222/274487.html"});
refreshRecord("national-water",{status:"活動中",scale:"給水車173台（国18・水道事業体105・自衛隊50）",period:"8月11日13時時点",asOf:"国土交通省資料 8月11日13時",sourceLabel:"国土交通省（現地対策本部）報告",sourceUrl:"${mlitUrl}"});
refreshRecord("national-tec",{status:"活動中",scale:"4市2町で約140人活動・累計約3,100人日",period:"8月11日13時時点",detail:"道路・河川・港湾等の被災状況調査と技術支援。旧資料の班数・人数と、新資料の人日単位は合算せず分けて表示。",asOf:"国土交通省資料 8月11日13時",sourceLabel:"国土交通省（現地対策本部）報告",sourceUrl:"${mlitUrl}"});
refreshRecord("national-medical",{status:"活動中",scale:"保健医療福祉支援会議を毎日開催／福祉避難所7施設62人",period:"8月11日14時時点",detail:"福祉避難所は4市町7施設62人（熊本市6、八代市12、御船町4、氷川町40）。",asOf:"熊本県資料 8月11日14時",sourceLabel:"熊本県 第21回災害対策本部会議資料",sourceUrl:"${reportUrl}"});
refreshRecord("national-bath",{status:"活動中",scale:"14市町で入浴支援",period:"8月11日14時時点",asOf:"熊本県資料 8月11日14時",sourceLabel:"熊本県 第21回災害対策本部会議資料",sourceUrl:"${reportUrl}"});
refreshRecord("national-toilets",{period:"8月11日14時時点",asOf:"熊本県資料 8月11日14時",sourceLabel:"熊本県 第21回災害対策本部会議資料",sourceUrl:"${reportUrl}"});
refreshRecord("national-purifier",{asOf:"熊本県資料 8月11日14時",sourceLabel:"熊本県 第21回災害対策本部会議資料",sourceUrl:"${reportUrl}"});
refreshRecord("national-scrivener",{scale:"宇土市・宇城市各2人、八代市2人",period:"8月4日から派遣（8月10日から八代市を追加）",detail:"宇土市・宇城市へ各2人、八代市へ2人を派遣し、被災者の行政手続・申請を支援。",asOf:"熊本県資料 8月11日14時",sourceLabel:"熊本県 第21回災害対策本部会議資料",sourceUrl:"${reportUrl}"});
refreshRecord("national-cert",{status:"支援中・市町別進捗要確認",detail:"住家被害認定調査・罹災証明書交付業務の立上げを支援。8月11日14時資料の市町別調査開始状況を基に、未開始・将来日・未定を混同せず確認する。",asOf:"熊本県資料 8月11日14時",sourceLabel:"熊本県 第21回災害対策本部会議資料",sourceUrl:"${reportUrl}"});
refreshRecord("national-push",{period:"8月11日14時時点",asOf:"熊本県資料 8月11日14時",sourceLabel:"熊本県 第21回災害対策本部会議資料",sourceUrl:"${reportUrl}"});
refreshRecord("ehime-management",{asOf:"愛媛県 8月10日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"${ehimeUrl}"});
refreshRecord("ehime-shelter-ops",{status:"8月10日公表時点で派遣中・終期要確認",asOf:"愛媛県 8月10日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"${ehimeUrl}"});
refreshRecord("ehime-health",{status:"8月7日～12日活動期間・8月11日実働要確認",period:"第2班：8月7日～12日（氷川町健康センター）",asOf:"愛媛県 8月10日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"${ehimeUrl}"});
refreshRecord("ehime-dmat",{status:"調整員1人は8月11日までの活動期間・継続要確認",period:"調整員：8月7日～11日／次班：8月13日～17日予定",asOf:"愛媛県 8月10日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"${ehimeUrl}"});
refreshRecord("ehime-dpat",{status:"8月9日出発・活動期間中（実働要確認）",period:"8月9日～12日（8月10日公表時点の予定）",asOf:"愛媛県 8月10日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"${ehimeUrl}"});
refreshRecord("ehime-redcross",{status:"8月8日～13日の活動期間中・実働要確認",asOf:"愛媛県 8月10日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"${ehimeUrl}"});
refreshRecord("ehime-assessor",{status:"活動期間8月10日まで・帰県要確認",period:"8月7日出発／8月8日～10日活動期間",detail:"県職員2人が被災建築物応急危険度判定に従事する活動期間を公表。8月10日以降の帰県・継続は確認できない。",asOf:"愛媛県 8月10日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"${ehimeUrl}"});
refreshRecord("ehime-police",{asOf:"愛媛県 8月10日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"${ehimeUrl}"});
refreshRecord("ehime-base",{asOf:"愛媛県 8月10日12時",sourceLabel:"愛媛県 本県の支援状況",sourceUrl:"${ehimeUrl}"});
refreshTimeline("t-current-status",{date:"2026-08-11",dateLabel:"8月11日",time:"14:00–16:00",summary:"人的被害392人、住家被害23,404棟、避難者3,714人。断水33,300戸、給水所43か所、行政応援854人等を確認。",detail:"第21回熊本県災害対策本部会議・第14回政府非常災害現地対策本部会議の資料に基づく。市町別表の合計と県計の差は注記のとおり。",sourceLabel:"熊本県 第21回災害対策本部会議資料",sourceUrl:"${reportUrl}"});
refreshTimeline("t-ehime-latest",{date:"2026-08-10",dateLabel:"8月10日",time:"12:00",title:"愛媛県が支援状況を更新",summary:"氷川町の避難所運営・保健支援、物的支援、後続の医療・警察等の予定を公表。8月11日当日の実働は未確認。",sourceUrl:"${ehimeUrl}"});
if(!TIMELINE_EVENTS.some(event=>event.id==="t-kumamoto-aug11"))TIMELINE_EVENTS.push({id:"t-kumamoto-aug11",date:"2026-08-11",dateLabel:"8月11日",weekday:"火",time:"16:00",phase:"recovery",actor:"kumamoto",title:"第21回熊本県災害対策本部・第14回政府現地本部会議",summary:"避難所89か所・避難者3,714人、人的被害392人、住家被害23,404棟等の最新資料を公表。",detail:"給水車173台、行政応援854人、TEC-FORCE累計約3,100人日等を更新。",place:"熊本県庁",sourceLabel:"熊本県 第21回災害対策本部会議資料",sourceUrl:"${reportUrl}",recordIds:["national-coordination","national-water","national-tec","kumamoto-internal"],hubIds:["kumamoto-hq"]});
`;
html = html.slice(0, insertAt) + overrides + html.slice(insertAt);

await writeFile(file, html, "utf8");
console.log(JSON.stringify({ file, bytes: Buffer.byteLength(html) }));

import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../ehime_kumamoto_support_geocoded_shelters_20260802.html", import.meta.url);
const checkedAt = "2026-08-21T15:00:00+09:00";
const ehimeReportUrl = "https://www.pref.ehime.jp/uploaded/attachment/188363.pdf";
const ehimeReportLabel = "愛媛県 本県の支援状況（2026年8月20日12時）";
const kumamotoMeetingUrl = "https://www.pref.kumamoto.jp/uploaded/attachment/316600.pdf";
const kumamotoSupportReportUrl = "https://www.pref.kumamoto.jp/uploaded/attachment/317153.pdf";
const fireReport59Url = "https://www.fdma.go.jp/disaster/info/items/20260728kumamotojishin59.pdf";
const defenseReportUrl = "https://www.mod.go.jp/js/pdf/2026/p20260821_01.pdf";
const fdmaArchiveUrl = "https://www.fdma.go.jp/disaster/info/";
const cabinetStatusPdfUrl = "https://www.bousai.go.jp/updates/r8kumamoto_jishin/status/pdf/r8kumamoto_jishin_20260801.pdf";

function parseJsonConstant(text, name, nextMarker) {
  const marker = `const ${name}=`;
  const valueStart = text.indexOf(marker) + marker.length;
  const next = text.indexOf(nextMarker, valueStart);
  const valueEnd = text.lastIndexOf("];", next);
  if (valueStart < marker.length || next < 0 || valueEnd < valueStart) throw new Error(`${name} not found`);
  return { valueStart, valueEnd, value: JSON.parse(text.slice(valueStart, valueEnd + 1)) };
}

function parseJsonObjectConstant(text, name, nextMarker) {
  const marker = `const ${name}=`;
  const valueStart = text.indexOf(marker) + marker.length;
  const next = text.indexOf(nextMarker, valueStart);
  if (valueStart < marker.length || next < 0) throw new Error(`${name} not found`);
  let depth = 0;
  let inString = false;
  let escaped = false;
  let valueEnd = -1;
  for (let index = valueStart; index < next; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') { inString = true; continue; }
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) { valueEnd = index; break; }
    }
  }
  if (valueEnd < valueStart) throw new Error(`${name} object not found`);
  return { valueStart, valueEnd, value: JSON.parse(text.slice(valueStart, valueEnd + 1)) };
}

function replaceJsonConstant(text, name, nextMarker, value) {
  const part = parseJsonConstant(text, name, nextMarker);
  return text.slice(0, part.valueStart) + JSON.stringify(value) + text.slice(part.valueEnd + 1);
}

function replaceJsonObjectConstant(text, name, nextMarker, value) {
  const part = parseJsonObjectConstant(text, name, nextMarker);
  return text.slice(0, part.valueStart) + JSON.stringify(value) + text.slice(part.valueEnd + 1);
}

function replaceAll(text, replacements) {
  for (const [from, to] of replacements) text = text.replaceAll(from, to);
  return text;
}

let html = await readFile(file, "utf8");

const records = parseJsonConstant(html, "RECORDS", "const SHELTER_MUNICIPALITIES=").value;
const recordById = new Map(records.map((record) => [record.id, record]));
function updateRecord(id, values) {
  const record = recordById.get(id);
  if (!record) throw new Error(`Record not found: ${id}`);
  Object.assign(record, values);
}

const ehimeBase = {
  asOf: "愛媛県 8月20日12時",
  sourceLabel: ehimeReportLabel,
  sourceUrl: ehimeReportUrl,
};

const provinceNeeds = parseJsonConstant(html, "PROVINCE_NEEDS", "const NEED_READINESS=").value;
const provinceNeedById = new Map(provinceNeeds.map((item) => [item.id, item]));
Object.assign(provinceNeedById.get("p-shelter"), {
  observed: "熊本県第36報（8月20日14時）では11市町村69か所の避難所に2,925人。現行公式JSONは8月21日14時25分更新の71施設で、定義と時点が異なる。",
});
Object.assign(provinceNeedById.get("p-waste"), {
  observed: "8月19日資料では10市町村が仮置場を開設。西原村は8月7日、上天草市は8月16日に終了したため、現行値と終了履歴を分けて表示する。",
});
Object.assign(provinceNeedById.get("p-agri"), {
  observed: "農林水産関係の被害調査と復旧を継続。8月19日資料の商工業被害は7,881件、約1,559億円。",
});
html = replaceJsonConstant(html, "PROVINCE_NEEDS", "const NEED_READINESS=", provinceNeeds);

const municipalities = parseJsonConstant(html, "NEED_MUNICIPALITIES", "const NEED_LESSONS=").value;
const latestSupportByMunicipality = {
  "熊本市": ["8月19日資料：対口支援・県内調整（避難所、罹災証明、住家被害認定）"],
  "八代市": ["8月19日資料：対口支援・県内調整（避難所、罹災証明、住家被害認定・ごみ処理）"],
  "宇土市": ["8月19日資料：対口支援・県内調整（避難所、罹災証明、住家被害認定）"],
  "宇城市": ["8月19日資料：対口支援・県内調整（避難所、罹災証明、住家被害認定・災害廃棄物）"],
  "美里町": ["8月19日資料：長崎県等の対口支援・県内調整"],
  "御船町": ["8月19日資料：宮城・山形・福島・新潟等の対口支援・県内調整"],
  "嘉島町": ["8月19日資料：北海道・青森・岩手・秋田の対口支援"],
  "益城町": ["8月19日資料：熊本県等の県内調整"],
  "甲佐町": ["8月19日資料：熊本県・南小国村・山都町等の県内調整"],
  "氷川町": ["8月19日資料：鳥取・島根・広島・愛媛・高知・佐賀・浜松市等の対口支援・県内調整"],
  "芦北町": ["8月19日資料：県内調整・災害廃棄物対応"],
};
for (const municipality of municipalities) {
  if (latestSupportByMunicipality[municipality.name]) municipality.currentSupport = latestSupportByMunicipality[municipality.name];
}
html = replaceJsonConstant(html, "NEED_MUNICIPALITIES", "const NEED_LESSONS=", municipalities);

updateRecord("ehime-pair", {
  providers: ["鳥取県", "島根県", "広島県", "愛媛県", "高知県", "佐賀県", "浜松市"],
  status: "8月11日資料の対口支援・最新継続状況要確認",
  scale: "6県・1指定都市（計7団体）",
  period: "8月11日14時資料",
  detail: "8月11日熊本県資料で、愛媛県を含む6県・1指定都市（7団体）を氷川町支援として確認。8月20日時点の団体別継続状況は未確認。災害ボランティア団体受入とは別制度。",
  asOf: "熊本県資料 8月11日14時",
  sourceLabel: "熊本県 第21回災害対策本部会議 各部説明資料",
  sourceUrl: kumamotoMeetingUrl,
});
updateRecord("ehime-management", {
  ...ehimeBase,
  status: "現行派遣・終期未定（実働要確認）",
  scale: "54人（県23・市町31）／延240人日",
  period: "8月1日～終期未定",
  detail: "先遣隊4人は8月1日～8月8日に活動終了。災害応急対策職員（現地対策本部連絡員を含む）は第1～3陣、氷川町災害対策本部・竜北東小・竜北西小等、8月1日～終期未定。実働54人（県23・市町31）、延240人日。施設別人数は最新資料に記載なし。",
});
updateRecord("ehime-shelter-ops", {
  title: "避難所運営等の人的支援（旧公表値）",
  providers: ["愛媛県", "愛媛県内市町"],
  hubIds: ["hikawa"],
  status: "旧公表値（8月14日）・現行は54人へ更新",
  scale: "旧値13人（現行報告は54人）",
  period: "8月14日12時資料",
  detail: "8月14日資料の旧値13人は履歴として保持。8月20日資料では、災害応急対策職員等を54人（県23・市町31）、8月1日～終期未定として更新。施設別人数は未公表。",
  asOf: "愛媛県 8月14日12時",
  sourceLabel: "愛媛県 本県の支援状況（旧資料）",
  sourceUrl: "https://www.pref.ehime.jp/uploaded/attachment/187993.pdf",
});
updateRecord("ehime-health", {
  ...ehimeBase,
  hubIds: ["hikawa"],
  status: "第1～6班派遣予定（8月31日まで・実働要確認）",
  scale: "13人（延70人日）",
  period: "8月2日～8月31日予定",
  detail: "保健師等第1～6班は氷川町健康センターを拠点に8月2日～8月31日予定、13人・延70人日。第3班8月12日～17日は履歴として表示し、当日実働・完了は要確認。",
});
updateRecord("ehime-dmat", {
  ...ehimeBase,
  hubIds: ["kumamoto-hq"],
  status: "DMAT調整本部チーム派遣予定（8月25日まで・実働要確認）",
  scale: "2人（延10人日）",
  period: "8月7日～8月25日予定",
  detail: "初期愛媛DMAT第1～2陣35人は7月31日～8月5日に活動終了。愛媛DMATコーディネーション第1～2陣2人は熊本県保健医療福祉調整本部で8月7日～8月25日予定。実働・完了は要確認。",
});
updateRecord("ehime-dpat", {
  ...ehimeBase,
  hubIds: ["kumamoto-hq"],
  status: "第1～2陣活動終了（8月12日）・後続要確認",
  scale: "8人（延32人日）",
  period: "8月2日～8月12日",
  detail: "愛媛DPAT第1～2陣は熊本県DPAT調整本部で8月2日～8月12日に活動終了、8人・延32人日。第3班2人は8月20日版に記載なし。",
});
updateRecord("ehime-dwat", {
  ...ehimeBase,
  hubIds: ["yatsushiro"],
  status: "第1～2班派遣予定（8月21日まで・実働要確認）",
  scale: "9人（延27人日）",
  period: "8月12日～8月21日予定",
  detail: "DWAT第1～2班は八代市内避難所等で8月12日～8月21日予定、9人・延27人日。終了日当日の実働・延長は要確認。",
});
updateRecord("ehime-police", {
  ...ehimeBase,
  hubIds: ["kumamoto-hq"],
  status: "特別自動車警ら部隊第1～2陣派遣予定（8月26日まで・実働要確認）",
  scale: "12人（延72人日）",
  period: "8月2日～8月26日予定",
  detail: "特別犯罪抑止部隊4人は8月11日～8月18日に活動終了。別枠の特別自動車警ら部隊第1～2陣12人は8月2日～8月26日予定。実働・帰県は要確認。",
});
updateRecord("ehime-assessor", {
  ...ehimeBase,
  status: "活動終了（8月10日）・帰県要確認",
  scale: "2人（延6人日）",
  period: "8月8日～8月10日",
  detail: "被災建築物応急危険度判定第1班は熊本市で8月8日～8月10日に活動終了、2人・延6人日。帰県状況は資料未記載。",
});
updateRecord("ehime-redcross", {
  ...ehimeBase,
  hubIds: ["uki"],
  status: "救護班派遣予定（8月24日まで・実働要確認）",
  scale: "7人（延42人日）",
  period: "8月8日～8月24日予定",
  detail: "日本赤十字社愛媛県支部の救護班第1～2班は宇城市で8月8日～8月24日予定、7人・延42人日。各班の人数内訳は8月20日版で分離記載なし。実働要確認。",
});
updateRecord("ehime-redcross-medcoord", {
  ...ehimeBase,
  hubIds: ["hikawa"],
  status: "災害医療コーディネートチーム派遣予定（実働要確認）",
  scale: "3人（延3人日）",
  period: "8月20日～8月25日予定",
  detail: "災害医療コーディネートチーム3人は氷川町で8月20日～8月25日予定、延3人日。実働要確認。",
});
updateRecord("ehime-redcross-mental", {
  ...ehimeBase,
  hubIds: ["yatsushiro"],
  status: "こころのケア班派遣予定（人数・実働要確認）",
  scale: "人数未公表",
  period: "8月23日～8月27日予定",
  detail: "こころのケア班は八代市内避難所等で8月23日～8月27日予定。8月20日版では人数・延人数の記載なし。実働・人数要確認。",
});
updateRecord("ehime-jrat", {
  ...ehimeBase,
  hubIds: ["uki", "yatsushiro"],
  status: "第1～3班派遣予定（実働要確認）",
  scale: "3人（延12人日）",
  period: "8月17日～9月1日予定",
  detail: "JRAT第1～3班は宇城市・八代市を中心とする被災地域で8月17日～9月1日予定、3人・延12人日。班別実働・地域は要確認。",
});
updateRecord("ehime-social-welfare", {
  ...ehimeBase,
  hubIds: ["uki"],
  status: "第1班～派遣予定（実働・完了要確認）",
  scale: "3人（延11人日）",
  period: "8月16日～10月15日予定",
  detail: "社会福祉協議会職員第1班～は宇城市災害ボランティアセンターで8月16日～10月15日予定、3人・延11人日。実働・完了要確認。",
});
updateRecord("ehime-base", {
  ...ehimeBase,
  status: "項目別提供状況（8月20日資料）",
  scale: "提供可能住宅177戸、設備運用中、キッチンカー1,920食（提供済み）",
  period: "8月20日12時資料",
  detail: "大型トイレカー、水循環式シャワー・手洗機、宇和島市トイレカー2台は設置・運用中。キッチンカーは8月6～7日に延1,920食を提供済み。提供可能住宅は177戸。",
});
updateRecord("ehime-kosa", {
  status: "7月31日資料で派遣公表・最新実働要確認",
  scale: "甲佐町派遣（人数未公表）",
  period: "中長期派遣（7月31日資料）",
  detail: "愛媛県7月31日資料で甲佐町への農業土木職員派遣を確認。8月20日最新資料では継続・終了・人数の更新記載なし。現在の活動中とは断定しない。",
});
for (const id of ["pair-kumamoto", "pair-yatsushiro", "pair-uto", "pair-uki", "pair-misato"]) updateRecord(id, {
  status: "8月11日資料の対口支援・最新継続状況要確認",
  period: "8月11日14時資料",
  asOf: "熊本県資料 8月11日14時",
  sourceLabel: "熊本県 第21回災害対策本部会議 各部説明資料",
  sourceUrl: kumamotoMeetingUrl,
});
updateRecord("pair-kumamoto", {
  scale: "20団体",
  detail: "熊本市へ都県・指定都市等20団体が対口支援。8月11日資料の配置履歴であり、8月19日資料の現行継続状況とは分けて表示する。",
});
updateRecord("pair-yatsushiro", {
  scale: "10団体",
  detail: "八代市へ8府県・2指定都市が対口支援。県・県内市町村職員も別途支援。8月11日資料の配置履歴であり、8月19日資料の現行継続状況とは分けて表示する。",
});
updateRecord("pair-hikawa", {
  providers: ["鳥取県", "島根県", "広島県", "愛媛県", "高知県", "佐賀県", "浜松市"],
  status: "8月11日資料の配置履歴・最新継続状況要確認",
  scale: "6県・1指定都市（計7団体）",
  period: "8月11日14時資料",
  detail: "8月11日熊本県資料上の配置履歴。愛媛県を含む6県・1指定都市（7団体）が氷川町を支援。8月20日時点の継続・終了は団体別未確認。",
  asOf: "熊本県資料 8月11日14時",
  sourceLabel: "熊本県 第21回災害対策本部会議 各部説明資料",
  sourceUrl: kumamotoMeetingUrl,
});
updateRecord("pharmacy", {
  status: "8月8日資料の活動実績・最新状況要確認",
  period: "8月8日資料",
  detail: "宇城市・八代市でモバイルファーマシーの活動を確認した8月8日資料の実績。氷川町での継続を含む現行状況は最新資料で要確認。",
});
updateRecord("kumamoto-internal", {
  status: "8月19日資料の確認値・最新状況要確認",
  scale: "行政応援971人／関係機関含む計1,038人",
  period: "8月19日14時資料",
  detail: "熊本県・政府合同会議資料で行政応援971人（対口767人・県／県内市町204人）、その他関係機関67人、計1,038人を確認。市町別の配置は8月19日資料を現行値とし、当日実働は要確認。",
  asOf: "熊本県・政府合同会議 8月19日14時",
  sourceLabel: "第18回政府非常災害現地対策本部会議・第25回熊本県災害対策本部会議資料",
  sourceUrl: kumamotoSupportReportUrl,
});
updateRecord("national-coordination", {
  status: "8月19日資料まで確認・後続会議結果要確認",
  scale: "行政応援971人／関係機関含む計1,038人",
  period: "8月19日14時資料",
  detail: "第18回政府非常災害現地対策本部会議・第25回熊本県災害対策本部会議の8月19日14時資料を最新確認値とする。行政応援971人（対口767人・県／県内市町204人）、その他関係機関67人、計1,038人。",
  asOf: "熊本県・政府合同会議 8月19日14時",
  sourceLabel: "第18回政府非常災害現地対策本部会議・第25回熊本県災害対策本部会議資料",
  sourceUrl: kumamotoSupportReportUrl,
});
updateRecord("national-medical", {
  status: "個別レコードで終了・予定・実働未確認を分離",
  scale: "愛媛県分は保健13人・DMAT調整2人・DWAT9人等を個別表示",
  period: "愛媛県 8月20日12時資料",
  detail: "愛媛県分は個別レコード参照。8月20日資料上、保健師等13人（8/2～8/31予定）、DMAT調整2人（8/7～8/25予定）、DWAT9人（8/12～8/21予定）等を、活動終了・予定・実働未確認に分けて表示。",
  asOf: "愛媛県 8月20日12時",
  sourceLabel: ehimeReportLabel,
  sourceUrl: ehimeReportUrl,
});
updateRecord("national-rescue", {
  status: "8月2日資料の支援実績・消防庁第59報で対応状況を確認",
  period: "8月2日12時時点（第30報）／第59報で後続確認",
  detail: "救急部隊5県約100人・航空部隊3県4機は8月2日時点の救助・救急支援実績として履歴表示。消防庁第59報（8月21日）で後続の消防応援・救助対応状況を確認し、8月2日の人数を現行派遣数とは扱わない。",
  asOf: "消防庁 第59報（2026年8月21日）",
  sourceLabel: "消防庁 被害及び消防機関等の対応状況（第59報）",
  sourceUrl: fireReport59Url,
});
updateRecord("national-purifier", { status: "8月4日資料で稼働確認・最新状況要確認" });
updateRecord("national-push", { status: "8月2日資料の受入・配送実績・最新状況要確認" });
updateRecord("national-cert", {
  status: "8月19日資料で進捗確認・最新状況要確認",
  scale: "申請50,932件／調査27,818件／証明書12,496件",
  period: "8月18日累計",
  detail: "罹災証明書の申請50,932件、調査27,818件、証明書交付12,496件（8月18日現在）。自治体別の進捗・交付継続は最新資料で確認する。",
  asOf: "熊本県・政府合同会議 8月19日資料（8月18日現在）",
  sourceLabel: "第18回政府非常災害現地対策本部会議・第25回熊本県災害対策本部会議資料",
  sourceUrl: kumamotoSupportReportUrl,
});
updateRecord("national-scrivener", { status: "7月31日資料の支援実績・最新状況要確認" });
updateRecord("national-bath", {
  status: "8月19日資料・防衛省8月21日資料で実施確認",
  scale: "県資料14市町／自衛隊5市町7か所",
  period: "8月19日資料／8月21日10時資料",
  detail: "熊本県資料では県の入浴支援を14市町で実施。防衛省8月21日資料では自衛隊の入浴支援を5市町7か所で実施。集計範囲と時点が異なるため、合算せず別表示する。",
  asOf: "熊本県・政府合同会議 8月19日資料／防衛省 8月21日",
  sourceLabel: "熊本県・政府合同会議資料／防衛省 熊本地震に係る災害派遣",
  sourceUrl: defenseReportUrl,
});
updateRecord("national-toilets", {
  status: "8月19日資料で設置確認・最新状況要確認",
  period: "8月19日14時資料",
  detail: "トイレカー26台、仮設トイレ120基等、計296設備を8月19日資料で確認。市町・施設別の稼働状況は最新資料で確認する。",
  asOf: "熊本県・政府合同会議 8月19日資料",
  sourceLabel: "第18回政府非常災害現地対策本部会議・第25回熊本県災害対策本部会議資料",
  sourceUrl: kumamotoSupportReportUrl,
});

if (!recordById.has("pair-kashima")) {
  const pairKashima = {
    id: "pair-kashima", provider: "municipal", category: "administration", hubIds: ["kashima"],
    title: "嘉島町への対口支援", providers: ["北海道", "青森県", "岩手県", "秋田県"],
    status: "8月11日資料の対口支援・最新継続状況要確認", scale: "4団体", period: "8月11日14時資料",
    detail: "嘉島町へ北海道・青森県・岩手県・秋田県の4団体が対口支援。8月20日時点の継続・終了は団体別未確認。",
    asOf: "熊本県資料 8月11日14時", sourceLabel: "熊本県 第21回災害対策本部会議 各部説明資料", sourceUrl: kumamotoMeetingUrl,
  };
  records.push(pairKashima);
  recordById.set(pairKashima.id, pairKashima);
}
if (recordById.has("pair-kashima")) Object.assign(recordById.get("pair-kashima"), {
  asOf: "熊本県資料 8月11日14時",
  sourceLabel: "熊本県 第21回災害対策本部会議 各部説明資料",
  sourceUrl: kumamotoMeetingUrl,
});

html = replaceJsonConstant(html, "RECORDS", "const SHELTER_MUNICIPALITIES=", records);

const timeline = parseJsonConstant(html, "TIMELINE_EVENTS", "const RECORDS=").value;
const timelineById = new Map(timeline.map((event) => [event.id, event]));
if (timelineById.has("t-current-status")) timelineById.get("t-current-status").tags = ["熊本県第36報", "避難所", "住家被害"];
if (timelineById.has("t-kumamoto-0816")) timelineById.get("t-kumamoto-0816").tags = ["第30報", "第42報", "過去スナップショット"];
if (timelineById.has("t-kumamoto-0820")) Object.assign(timelineById.get("t-kumamoto-0820"), {
  title: "熊本県第36報の県計と市町別表の差分を確認",
  summary: "県計は人的被害398人・住家被害35,048棟、市町別24行は396人・35,040棟として分けて表示。",
  detail: "第36報の県計と市町別表は対象範囲・集計の差があるため、速報KPIと支援ニーズの入力値を混同しない。",
  tags: ["第36報", "県計・市町別表", "差分"],
});
if (timelineById.has("t-ehime-latest")) {
  Object.assign(timelineById.get("t-ehime-latest"), {
    title: "愛媛県支援状況（8月7日資料・履歴）",
    summary: "8月7日時点の氷川町避難所運営・保健支援、物的支援、後続支援予定を記録。",
    tags: ["愛媛県", "過去資料", "支援履歴"],
  });
}
if (timelineById.has("t-ehime-aug12")) {
  Object.assign(timelineById.get("t-ehime-aug12"), {
    title: "愛媛県支援状況（8月12日資料・履歴）",
    tags: ["愛媛県", "過去資料", "支援履歴"],
  });
}
if (!timelineById.has("t-ehime-0820")) timeline.push({
  id: "t-ehime-0820", date: "2026-08-20", dateLabel: "8月20日", weekday: "木", time: "12:00",
  phase: "support", actor: "ehime", title: "愛媛県支援状況を更新（8月20日12時）",
  summary: "災害応急対策職員等54人、保健師等13人、DWAT9人、警察12人等の現行・予定支援を更新。",
  detail: "愛媛県8月20日12時資料。先遣隊は活動終了、応急対策職員は終期未定、DMAT調整・保健師・DWAT・警察・日赤・JRAT・社協は終了・予定・実働要確認に分けて表示。",
  place: "熊本県内", sourceLabel: ehimeReportLabel, sourceUrl: ehimeReportUrl,
  recordIds: ["ehime-management", "ehime-dmat", "ehime-health", "ehime-dpat", "ehime-dwat", "ehime-police", "ehime-redcross", "ehime-redcross-medcoord", "ehime-redcross-mental", "ehime-jrat", "ehime-social-welfare"],
  hubIds: ["kumamoto-hq", "yatsushiro", "uki", "hikawa"], tags: ["愛媛県", "支援更新", "現行・予定"],
});
if (!timelineById.has("t-kumamoto-0819")) timeline.push({
  id: "t-kumamoto-0819", date: "2026-08-19", dateLabel: "8月19日", weekday: "水", time: "14:00",
  phase: "support", actor: "national", title: "第18回政府・第25回県本部会議で支援体制を更新",
  summary: "行政応援971人（対口767人・県／県内市町204人）、その他関係機関67人、計1,038人を確認。",
  detail: "8月19日14時資料の現行スナップショット。市町別の対口支援・県内調整、罹災証明、仮置場等の状況を更新し、8月11日資料は履歴として保持。",
  place: "熊本県内", sourceLabel: "第18回政府非常災害現地対策本部会議・第25回熊本県災害対策本部会議資料", sourceUrl: kumamotoSupportReportUrl,
  recordIds: ["kumamoto-internal", "national-coordination", "national-cert", "national-bath", "national-toilets"],
  hubIds: ["kumamoto-hq", "yatsushiro", "uto", "uki", "misato", "kashima", "hikawa"], tags: ["熊本県", "行政応援", "現行確認"],
});
html = replaceJsonConstant(html, "TIMELINE_EVENTS", "const RECORDS=", timeline);

const sources = parseJsonConstant(html, "SOURCES", "const pairSupportRecords20260811=").value;
const sourceEntry = { group: "愛媛県", name: "本県の支援状況について（8月20日12時版）", asOf: "2026年8月20日12時", url: ehimeReportUrl };
const existingEhimeLatest = sources.find((source) => source.url === ehimeReportUrl);
if (existingEhimeLatest) Object.assign(existingEhimeLatest, sourceEntry);
else sources.unshift(sourceEntry);
const currentSourceEntries = [
  { group: "熊本県", name: "第18回政府非常災害現地対策本部会議・第25回熊本県災害対策本部会議資料", asOf: "2026年8月19日14時", url: kumamotoSupportReportUrl },
  { group: "消防庁", name: "被害及び消防機関等の対応状況（第59報）", asOf: "2026年8月21日10時", url: fireReport59Url },
  { group: "防衛省", name: "熊本地震に係る災害派遣（8月21日）", asOf: "2026年8月21日", url: defenseReportUrl },
];
for (const entry of currentSourceEntries) {
  const existing = sources.find((source) => source.url === entry.url);
  if (existing) Object.assign(existing, entry);
  else sources.unshift(entry);
}
html = replaceJsonConstant(html, "SOURCES", "const pairSupportRecords20260811=", sources);

const pageMeta = parseJsonObjectConstant(html, "PAGE_RECHECK_META", "const PROVIDER_LABEL=").value;
pageMeta.checkedAt = checkedAt;
pageMeta.volunteerCheckedAt = checkedAt;
const timelineMeta = pageMeta.rows.find((row) => row.section === "発災後タイムライン");
if (timelineMeta) timelineMeta.previous = "8月16日第30報・第42報";
const shelterMeta = pageMeta.rows.find((row) => row.section === "避難所");
if (shelterMeta) shelterMeta.difference = "県報は8月20日14時のスナップショット、公式JSONは8月21日14時25分更新の現在開設一覧、206点は8月2日の履歴として定義を分離。";
const dashboardMeta = pageMeta.rows.find((row) => row.section === "支援ダッシュボード");
if (dashboardMeta) {
  dashboardMeta.difference = "国交省第47報の8月21日値へ更新。行政応援971人・関係機関含む計1,038人は8月19日合同会議資料の対象時点値として保持。";
  dashboardMeta.source = "国土交通省第47報／第18回政府・第25回熊本県災害対策本部会議";
  dashboardMeta.url = kumamotoSupportReportUrl;
}
if (!pageMeta.rows.some((row) => row.section === "愛媛県支援")) pageMeta.rows.splice(1, 0, {
  section: "愛媛県支援", status: "差分あり", current: "8月20日12時資料へ更新", previous: "8月14日12時資料",
  difference: "応急対策職員54人、保健師等13人、DMAT調整2人、DWAT9人、警察12人等を現行・終了・予定・実働要確認に分離。",
  source: ehimeReportLabel, url: ehimeReportUrl,
});
html = replaceJsonObjectConstant(html, "PAGE_RECHECK_META", "const PROVIDER_LABEL=", pageMeta);

html = replaceAll(html, [
  ["DMAT調整第2陣1人は8月13日～17日、保健師等第3陣3人は8月12日～17日の活動期間中。DPAT第2班は8月9日～12日の予定期間を終え、実働完了は要再確認。日赤・JRATの後続班は予定表示。", "DMATコーディネーション第1～2陣2人は8月7日～8月25日予定、保健師等第1～6班13人は8月2日～8月31日予定、DPAT第1～2陣は8月2日～8月12日活動終了。予定と実働を分けて確認。"],
  ["氷川町の避難所運営等9人（8月12日公表）", "災害応急対策職員54人（県23・市町31、8月1日～終期未定）"],
  ["DMAT調整員1人・保健師第3班3人を派遣期間中", "DMAT調整2人（8月7日～25日予定）・保健師等13人（8月2日～31日予定）"],
  ["DWAT3人、日赤・JRATの後続班を予定", "DWAT9人（8月12日～21日予定）、日赤・JRAT・社協職員を予定表示"],
  ["DMAT1人", "DMAT調整本部2人"],
  ["8月13日～17日・日赤/JRATは後続予定", "8月7日～25日予定・日赤/JRAT等は予定"],
  ["第3班3人", "保健師等13人"],
  ["8月12日～17日・氷川町保健所管内", "8月2日～31日予定・氷川町健康センター"],
  ["避難所運営9人", "災害応急対策54人"],
  ["マネジメント4人と分けて表示", "先遣隊8/1～8/8終了、施設別内訳は未公表"],
  ["特別犯罪抑止4人", "特別自動車警ら12人"],
  ["8月11日～19日予定・実働要確認", "8月2日～26日予定・犯罪抑止部隊4人は8月18日終了"],
  ["愛媛を含む6県", "愛媛県を含む6県・1指定都市（7団体）"],
  ["住宅176戸", "住宅177戸"],
  ["<span class=\"overview-timeline-title\">被災建築物応急危険度判定</span><span class=\"overview-timeline-sub\">県職員2人は8月7日出発済み・8月10日まで活動期間、帰県要確認</span>", "<span class=\"overview-timeline-title\">被災建築物応急危険度判定</span><span class=\"overview-timeline-sub\">2人は8月8日～10日活動終了、帰県状況は資料未記載</span>"],
  ["愛媛DPAT第2班", "愛媛DPAT第1～2陣"],
  ["予定期間終了。実働完了・派遣先は要再確認", "8月2日～12日活動終了。第3班は8月20日資料に記載なし"],
  ["愛媛県保健師等第3班", "愛媛県保健師等第1～6班"],
  ["保健師2人・事務1人、氷川町健康センター", "13人、氷川町健康センター。第3班8/12～17は履歴"],
  ["愛媛県警の特別犯罪抑止部隊", "愛媛県警の特別自動車警ら部隊"],
  ["4人は8月11日～19日予定。実働は要確認", "特別犯罪抑止部隊4人は8月11日～18日活動終了"],
  ["愛媛DMAT調整員第2陣", "愛媛DMATコーディネーション第1～2陣"],
  ["1人、八代保健所管内・松山市民病院", "2人、熊本県保健医療福祉調整本部、8月7日～25日予定"],
  ["現在 D+14：今後1～2週間", "現在 D+24：今後1～2週間"],
  ["D+14の現在フェーズです。8月11日の市町村別公表値", "D+24の現在フェーズです。8月20日の市町村別公表値"],
  ["愛媛県は氷川町の対口支援団体として活動中。", "8月11日熊本県資料上、愛媛県は氷川町の対口支援団体。8月20日時点の団体別継続状況は未確認。"],
  ["愛媛県の支援あり", "愛媛県関連の公表記録あり（活動状況は詳細）"],
  ["第14回政府現地本部会議まで開催", "第18回政府非常災害現地対策本部会議・第25回熊本県災害対策本部会議（8月19日資料）まで確認"],
  ["第14回政府現地本部会議（8月15日資料）まで確認", "第18回政府非常災害現地対策本部会議・第25回熊本県災害対策本部会議（8月19日資料）まで確認"],
  ["モバイルファーマシー（8月12日午前終了予定）", "モバイルファーマシー（8月8日資料の活動実績・最新状況要確認）"],
  ["8月7日出発・8月10日まで活動期間、帰県要確認", "8月8日～10日活動終了、帰県状況は資料未記載"],
  ["<span class=\"overview-date\">8/9–12</span>", "<span class=\"overview-date\">8/2–12</span>"],
  ["<span class=\"overview-date\">8/12–17</span>", "<span class=\"overview-date\">8/2–31</span>"],
  ["<span class=\"overview-date\">8/11–19</span>", "<span class=\"overview-date\">8/2–26</span>"],
  ["<span class=\"overview-date\">8/13–17</span>", "<span class=\"overview-date\">8/7–25</span>"],
  ["<li>7市町への対口支援</li>", "<li>8月19日資料で被災市町村への人的支援を更新</li>"],
  ["7市町への対口支援、熊本県内応援、モバイルファーマシー等。", "8月19日資料の対口支援・県内調整、モバイルファーマシー等。"],
  ["計10市町へ行政応援925人（関係機関含む計1,005人）", "8月19日資料：行政応援971人（関係機関含む計1,038人）"],
  ["<div class=\"overview-resource-value\">925人</div>", "<div class=\"overview-resource-value\">971人</div>"],
  ["<div class=\"overview-resource-sub\">関係機関含む計1,005人</div>", "<div class=\"overview-resource-sub\">関係機関含む計1,038人</div>"],
  ["<div class=\"snap\"><strong>925</strong><span>行政応援<br/>関係機関含む計1,005人</span></div>", "<div class=\"snap\"><strong>971</strong><span>行政応援<br/>関係機関含む計1,038人</span></div>"],
  ["<div class=\"needs-kpi-value\">11市町村</div>", "<div class=\"needs-kpi-value\">10市町村</div>"],
  ["8月11日時点で仮置場11市町開設", "8月19日時点で仮置場10市町開設（西原村・上天草市は終了）"],
  ["2,823件、約727億円。", "7,881件、約1,559億円。"],
  ["3,294件、約952億円。", "7,881件、約1,559億円。"],
  ["8月15日までの確定支援を反映", "8月19日までの確定支援を反映"],
  ["2026年8月21日 13:14", "2026年8月21日 15:00"],
  ["2026年8月21日13:14", "2026年8月21日15:00"],
  ["2026-08-21T13:14:00+09:00", checkedAt],
  ["8月21日12時35分更新", "8月21日14時25分更新"],
  ["latestAsOf:\"2026-08-21T12:35:30+09:00\"", "latestAsOf:\"2026-08-21T14:25:44+09:00\""],
  ["\"latestAsOf\":\"2026-08-21T12:35:30+09:00\"", "\"latestAsOf\":\"2026-08-21T14:25:44+09:00\""],
  ["kumamoto_support_official_20260817.csv", "kumamoto_support_official_20260819.csv"],
  ["kumamoto_observed_load_signals_20260817.csv", "kumamoto_observed_load_signals_20260819.csv"],
  ["https://www.fdma.go.jp/disaster/info/items/20260728kumamotojishin15.pdf", fdmaArchiveUrl],
  ["https://www.fdma.go.jp/disaster/info/items/20260728kumamotojishin30.pdf", fdmaArchiveUrl],
  ["https://www.bousai.go.jp/updates/r8kumamoto_jishin/pdf/r8kumamoto_jishin_20260801.pdf", cabinetStatusPdfUrl],
  ["消防庁「令和8年熊本地震による被害及び消防機関等の対応状況（第15報）」", "消防庁 災害情報一覧（第15報の履歴）"],
  ["消防庁 第15報", "消防庁 災害情報一覧（第15報の履歴）"],
  ["消防庁 第30報", "消防庁 災害情報一覧（第30報の履歴）"],
  ["消防庁 被害及び消防機関等の対応状況（第30報）", "消防庁 災害情報一覧（第30報の履歴）"],
]);

const markerStart = "/* CURRENT_STATE_CLEANUP_20260821_START */";
const markerEnd = "/* CURRENT_STATE_CLEANUP_20260821_END */";
const escapedStart = markerStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapedEnd = markerEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
html = html.replace(new RegExp(`\\n${escapedStart}[\\s\\S]*?${escapedEnd}\\n`, "g"), "\n");

const runtimeUpdates = Object.fromEntries(records.map((record) => [record.id, {
  status: record.status, scale: record.scale, period: record.period, detail: record.detail,
  asOf: record.asOf, sourceLabel: record.sourceLabel, sourceUrl: record.sourceUrl,
  ...(record.hubIds ? { hubIds: record.hubIds } : {}), ...(record.title ? { title: record.title } : {}),
  ...(record.providers ? { providers: record.providers } : {}),
}]));
const runtimeBlock = `
${markerStart}
const currentStateCleanupRecordUpdates20260821=${JSON.stringify(runtimeUpdates)};
Object.entries(currentStateCleanupRecordUpdates20260821).forEach(([id, values])=>{const record=RECORDS.find(item=>item.id===id);if(record)Object.assign(record,values);});
const currentStateCleanupPairKashima20260821=RECORDS.find(item=>item.id==='pair-kashima');
if(currentStateCleanupPairKashima20260821)currentStateCleanupPairKashima20260821.status='8月11日資料の対口支援・最新継続状況要確認';
const currentStateCleanupTimeline20260821=TIMELINE_EVENTS.find(event=>event.id==='t-current-status');
if(currentStateCleanupTimeline20260821)currentStateCleanupTimeline20260821.tags=['熊本県第36報','避難所','住家被害'];
const currentStateCleanupHistoricalTimeline20260821=TIMELINE_EVENTS.find(event=>event.id==='t-kumamoto-0816');
if(currentStateCleanupHistoricalTimeline20260821)currentStateCleanupHistoricalTimeline20260821.tags=['第30報','第42報','過去スナップショット'];
const currentStateCleanupSnapshotTimeline20260821=TIMELINE_EVENTS.find(event=>event.id==='t-kumamoto-0820');
if(currentStateCleanupSnapshotTimeline20260821)Object.assign(currentStateCleanupSnapshotTimeline20260821,{title:'熊本県第36報の県計と市町別表の差分を確認',summary:'県計は人的被害398人・住家被害35,048棟、市町別24行は396人・35,040棟として分けて表示。',detail:'第36報の県計と市町別表は対象範囲・集計の差があるため、速報KPIと支援ニーズの入力値を混同しない。',tags:['第36報','県計・市町別表','差分']});
if(typeof currentSnapshot20260821!=='undefined')Object.assign(currentSnapshot20260821,{checkedAt:'${checkedAt}',currentAsOf:'2026-08-20T14:00:00+09:00'});
const currentStateCleanupProvinceNeeds20260821=${JSON.stringify(Object.fromEntries(provinceNeedById))};
Object.entries(currentStateCleanupProvinceNeeds20260821).forEach(([id,values])=>{const item=PROVINCE_NEEDS.find(value=>value.id===id);if(item)Object.assign(item,values);});
const currentStateCleanupMunicipalitySupport20260821=${JSON.stringify(latestSupportByMunicipality)};
Object.entries(currentStateCleanupMunicipalitySupport20260821).forEach(([name,support])=>{const item=NEED_MUNICIPALITIES.find(value=>value.name===name);if(item)item.currentSupport=support;});
const currentStateCleanupEhimeBlock20260821=SUPPORT_BLOCKS.find(item=>item.id==='chugoku-shikoku');
if(currentStateCleanupEhimeBlock20260821)currentStateCleanupEhimeBlock20260821.ehime='8月11日熊本県資料上、愛媛県は氷川町の対口支援団体。8月20日時点の団体別継続状況は未確認。';
const currentStateCleanupTimelineMeta20260821=PAGE_RECHECK_META.rows.find(row=>row.section==='発災後タイムライン');
if(currentStateCleanupTimelineMeta20260821)currentStateCleanupTimelineMeta20260821.previous='8月16日第30報・第42報';
const currentStateCleanupDashboardMeta20260821=PAGE_RECHECK_META.rows.find(row=>row.section==='支援ダッシュボード');
if(currentStateCleanupDashboardMeta20260821)Object.assign(currentStateCleanupDashboardMeta20260821,{difference:'国交省第47報の8月21日値へ更新。行政応援971人・関係機関含む計1,038人は8月19日合同会議資料の対象時点値として保持。',source:'国土交通省第47報／第18回政府・第25回熊本県災害対策本部会議',url:'${kumamotoSupportReportUrl}'});
if(typeof PAGE_RECHECK_META!=='undefined'&&!PAGE_RECHECK_META.rows.some(row=>row.section==='愛媛県支援'))PAGE_RECHECK_META.rows.splice(1,0,{section:'愛媛県支援',status:'差分あり',current:'8月20日12時資料へ更新',previous:'8月14日12時資料',difference:'応急対策職員54人、保健師等13人、DMAT調整2人、DWAT9人、警察12人等を現行・終了・予定・実働要確認に分離。',source:'愛媛県 本県の支援状況（8月20日12時）',url:'${ehimeReportUrl}'});
${markerEnd}
`;
html = html.replace("function renderPageRecheck(){", runtimeBlock + "\nfunction renderPageRecheck(){");

await writeFile(file, html, "utf8");
console.log(JSON.stringify({ checkedAt, ehimeReportUrl, records: records.length, timelineEvents: timeline.length }));

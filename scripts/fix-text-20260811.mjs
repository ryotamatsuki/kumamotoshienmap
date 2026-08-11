import { readFile, writeFile } from "node:fs/promises";
const file = "ehime_kumamoto_support_geocoded_shelters_20260802.html";
let html = await readFile(file, "utf8");
const replacements = [
  ["12市町村118か所の避難所に3,714人", "11市町村89か所の避難所に3,714人"],
  ["9市町村49か所の給水所を運営", "給水所43か所を運営"],
  ["住家被害23,404棟（推計を含む）のうち分類未確定9,690棟。認定調査は18市町村で開始。", "住家被害23,404棟（推計を含む）のうち分類未確定12,623棟。市町別の認定調査開始状況は、8月11日資料の対象日・将来日・未定を分けて確認する。"],
  ["8月8日時点で11市町村が仮置場を開設。西原村は8月7日に終了し、八代市は8月10日に追加開設予定。", "8月11日時点で11市町村が仮置場を開設。西原村は8月7日に終了し、八代市の追加開設予定は実績化せず最新資料で確認する。"],
  ["全壊699棟、大規模半壊20棟、半壊1,025棟、分類未確定9,690棟。被害認定が進行中。", "全壊1,133棟、大規模半壊20棟、半壊1,025棟、一部破損8,603棟、分類未確定12,623棟。推計を含み今後変動する。"],
  ["8月8日公表の対口支援団体を表示。", "8月11日公表の対口支援団体を表示。"],
  ["6市町で対口支援団体が活動", "7市町で対口支援団体が活動"],
  ["6市町に県職員各3～4人を派遣し、県内市町村と合わせて91人が活動。", "10市町に対口支援・県等の応援職員854人を派遣。"],
  ["熊本県 第18回災害対策本部会議資料", "熊本県 第21回災害対策本部会議資料"],
  ["https://www.pref.kumamoto.jp/uploaded/attachment/316442.pdf\" target=\"_blank\" rel=\"noopener\">市町村別被害表", "https://www.pref.kumamoto.jp/uploaded/attachment/316599.pdf\" target=\"_blank\" rel=\"noopener\">市町村別被害表"],
  ["https://www.pref.kumamoto.jp/uploaded/attachment/316443.pdf\" target=\"_blank\" rel=\"noopener\">熊本県本部資料", "https://www.pref.kumamoto.jp/uploaded/attachment/316600.pdf\" target=\"_blank\" rel=\"noopener\">熊本県本部資料"],
  ["https://www.pref.kumamoto.jp/uploaded/attachment/316442.pdf\" target=\"_blank\" rel=\"noopener\">熊本県公式資料", "https://www.pref.kumamoto.jp/uploaded/attachment/316599.pdf\" target=\"_blank\" rel=\"noopener\">熊本県公式資料"],
  ["<span class=\"overview-timeline-sub\">4人を熊本県調整本部へ派遣予定</span>", "<span class=\"overview-timeline-sub\">8月10日公表時点の活動期間中。実働・派遣先は要確認</span>"],
  ["<span class=\"overview-timeline-sub\">4人を派遣予定</span>", "<span class=\"overview-timeline-sub\">4人は8月10日～19日予定。実働は要確認</span>"],
];
for (const [from, to] of replacements) html = html.split(from).join(to);
await writeFile(file, html, "utf8");
console.log(JSON.stringify({file, replacements: replacements.length}));

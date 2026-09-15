import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const publicPath = resolve(root, "public", "dashboard.html");
const auditDir = resolve(root, "operations", "audits");

const [sourceHtml, publicHtml, shelterText, municipalText, nationalText, auditFiles] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(publicPath, "utf8"),
  readFile(resolve(root, "current-shelters.json"), "utf8"),
  readFile(resolve(root, "municipal-support-audit.json"), "utf8"),
  readFile(resolve(root, "national-support-audit.json"), "utf8"),
  readdir(auditDir),
]);
if (sourceHtml !== publicHtml) throw new Error("source/public parity required before executive summary sync");

const shelters = JSON.parse(shelterText);
const municipal = JSON.parse(municipalText);
const national = JSON.parse(nationalText);
const needsAuditName = auditFiles.filter((name) => /^needs-kpi-source-recheck-\d{8}-\d{4}\.json$/u.test(name)).sort().at(-1);
const ehimeAuditName = auditFiles.filter((name) => /^ehime-source-recheck-\d{8}-\d{4}\.json$/u.test(name)).sort().at(-1);
if (!needsAuditName || !ehimeAuditName) throw new Error("latest needs/ehime audit file missing");
const needsAudit = JSON.parse(await readFile(resolve(auditDir, needsAuditName), "utf8"));
const ehimeAudit = JSON.parse(await readFile(resolve(auditDir, ehimeAuditName), "utf8"));
const damage = needsAudit.prefectural_snapshot;
const prefSource = needsAudit.sources.find((source) => source.source_id === damage.source_id);
if (!damage || !prefSource) throw new Error("prefectural snapshot/source missing");

function mdhm(value) {
  const m = String(value || "").match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u);
  return m ? `${Number(m[1])}月${Number(m[2])}日${m[3]}:${m[4]}` : String(value || "時点不明");
}
function ymd(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/u);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : String(value || "日付不明");
}
function jst(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/u);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : String(value || "時点不明");
}
function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function replaceOnce(html, pattern, replacement, label) {
  const matches = [...html.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`${label} target count=${matches.length}`);
  return html.replace(pattern, replacement);
}
function replaceJsonConst(html, name, mutator) {
  const pattern = new RegExp(`const\\s+${name}\\s*=\\s*(\\{[^\\n]*\\});`, "u");
  const match = html.match(pattern);
  if (!match) throw new Error(`${name} missing`);
  const value = JSON.parse(match[1]);
  mutator(value);
  return html.replace(match[0], `const ${name}=${JSON.stringify(value)};`);
}

const currentProviders = [];
for (const record of municipal.records || []) {
  for (const item of [...(record.provider_statuses || []), ...(record.additional_statuses || [])]) {
    if (item.state === "CURRENT") currentProviders.push(`${item.name}${record.destination ? `→${record.destination}` : ""}`);
  }
}
const confirmedProviders = [...new Set(currentProviders)];
const ehimeTotal = ehimeAudit.human_support?.total;
const ehimeCounterpart = ehimeAudit.human_support?.counterpart_support;
const ehimeHealth = ehimeAudit.human_support?.public_health;
const ehimeDwat = ehimeAudit.human_support?.dwat;
const toiletTruck = ehimeAudit.material_support?.prefectural_large_toilet_truck;
if (!ehimeTotal || !ehimeCounterpart || !ehimeHealth || !ehimeDwat || !toiletTruck) throw new Error("Ehime executive summary data missing");

const pageCheckedAt = national.reference_at;
const majorAsOf = damage.as_of;
const shelterAsOf = shelters.meta?.source_last_modified || shelters.meta?.fetched_at;
const currentCount = Number(shelters.meta?.current_count);
const nationalCount = national.inventory?.audit_record_count ?? national.records?.length ?? 0;
const nationalCurrent = national.summary?.CURRENT ?? 0;
const nationalPlanned = national.summary?.PLANNED ?? 0;
const nationalHistorical = national.summary?.HISTORICAL ?? 0;
const nationalUnknown = national.summary?.UNKNOWN ?? 0;

const rows = [
  {
    section: "被害・支援", status: "差分あり",
    current: `${mdhm(needsAudit.reference_at)}再確認：熊本県の最新公表県計は${mdhm(majorAsOf)}の復旧・復興本部参考資料`,
    previous: "9月10日14:00・熊本県第56報",
    difference: `避難者${damage.evacuees.toLocaleString("ja-JP")}人、避難所${damage.shelters}か所、人的被害${damage.human_damage}人、住家被害${damage.housing_damage.toLocaleString("ja-JP")}棟へ更新。`,
    source: "熊本県 第3回復旧・復興本部 参考資料", url: prefSource.url,
  },
  {
    section: "愛媛県支援", status: "差分あり",
    current: `9月11日12時版：対口支援${ehimeCounterpart.persons}人・延${Number(ehimeCounterpart.person_days).toLocaleString("ja-JP")}人日、人的支援総計${ehimeTotal.persons}人・延${Number(ehimeTotal.person_days).toLocaleString("ja-JP")}人日`,
    previous: "9月7日12時版",
    difference: `保健師等${ehimeHealth.persons}人・DWAT${ehimeDwat.persons}人を9月11日資料で確認。県大型トイレカーは${toiletTruck.location}で9月7日に運用終了。`,
    source: "愛媛県 本県の支援状況", url: ehimeAudit.source_url,
  },
  {
    section: "避難所", status: "差分あり",
    current: `熊本県${mdhm(majorAsOf)}資料：${damage.shelters}か所・避難者${damage.evacuees.toLocaleString("ja-JP")}人／公式JSON現在${currentCount}施設（最終更新${jst(shelterAsOf)}）`,
    previous: "熊本県第56報・公式JSON前回取得",
    difference: "県公表の避難所数と公式JSONの現在開設施設数は、時点・定義を分離して表示。",
    source: "熊本県復旧・復興本部／公式避難所JSON", url: prefSource.url,
  },
  {
    section: "支援ニーズ見通し", status: "差分あり",
    current: `県全体は${mdhm(majorAsOf)}の熊本県参考資料へ更新。上水道断水は解消確認、災害廃棄物は9月11日時点の処理継続を表示。`,
    previous: "8月時点の静的KPI",
    difference: "旧避難者・断水戸数・住家被害・仮置場数を現況表示から撤去し、一次情報リンクを付与。",
    source: "熊本県復旧・復興本部／環境省", url: prefSource.url,
  },
  {
    section: "発災後タイムライン", status: "差分あり",
    current: `熊本県${mdhm(majorAsOf)}、愛媛県9月11日12時、国・関係機関${mdhm(national.reference_at)}再監査まで反映`,
    previous: "熊本県第52報等",
    difference: "県全体被害・避難、愛媛県支援、国関係の最新確認時点へ同期。",
    source: "熊本県・愛媛県・国関係一次情報", url: prefSource.url,
  },
  {
    section: "支援ダッシュボード", status: "差分あり",
    current: `熊本県${mdhm(majorAsOf)}／愛媛県9月11日12時／国・他自治体${mdhm(pageCheckedAt)}再監査`,
    previous: "複数の旧時点表示が混在",
    difference: "知事・幹部向けサマリーを含め、現況と履歴を分離。",
    source: "一次情報・監査データ", url: prefSource.url,
  },
  {
    section: "災害ボランティア", status: "再確認",
    current: `${mdhm(pageCheckedAt)}基準で県社協・市町社協の募集状況を再確認。現在形を直接確認できたものだけ現行表示。`,
    previous: "9月7日以前の確認表示",
    difference: "未確認の予定・過去募集をCURRENTとして推定しない。",
    source: "熊本県社会福祉協議会・各市町社会福祉協議会", url: "https://www.fukushi-kumamoto.or.jp/kvc/",
  },
  {
    section: "地図・境界", status: "再確認",
    current: `公式JSON現在${currentCount}施設・全件座標confirmed（最終更新${jst(shelterAsOf)}）`,
    previous: "前回JSON",
    difference: "ライブJSONと位置履歴スナップショットを分離。",
    source: "熊本県公式避難所JSON", url: shelters.meta?.source_url || "https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json",
  },
  {
    section: "他自治体等", status: "全件再監査",
    current: `${mdhm(municipal.reference_at)}基準で対口支援・他自治体支援を全件再監査。CURRENT直接確認：${confirmedProviders.length ? confirmedProviders.join("、") : "なし"}`,
    previous: "8月24日等の旧再監査表示",
    difference: "旧割当名簿は履歴として保持し、派遣元一次情報でCURRENT／PLANNED／HISTORICAL／UNKNOWNを分離。",
    source: "派遣元自治体公式情報・熊本県旧割当資料", url: "https://github.com/ryotamatsuki/kumamotoshienmap/blob/main/municipal-support-audit.json",
  },
  {
    section: "国・関係機関", status: "全件再監査",
    current: `${mdhm(national.reference_at)}基準で${nationalCount}件を再監査`,
    previous: "8月23日以前の複数時点値が混在",
    difference: `CURRENT ${nationalCurrent}／PLANNED ${nationalPlanned}／HISTORICAL ${nationalHistorical}／UNKNOWN ${nationalUnknown}。予定期間到来をCURRENTと推定しない。`,
    source: "国・自治体・全国組織の一次情報", url: "https://github.com/ryotamatsuki/kumamotoshienmap/blob/main/national-support-audit.json",
  },
];

let html = sourceHtml;
html = replaceOnce(
  html,
  /<div class="overview-phase">[\s\S]*?<\/div>/u,
  `<div class="overview-phase"><span>復旧・生活再建段階（熊本県最新被害等：${mdhm(majorAsOf)}）</span>避難生活の長期化に対応しながら、被害認定・罹災証明、住まい、廃棄物、インフラ本復旧へ重点を移す段階。基準時点で一次情報により確認できない施設単位情報や当日実働は推測せず、履歴又はUNKNOWNとして分離しています。</div>`,
  "overview phase",
);
html = replaceOnce(
  html,
  /(<div class="overview-update"><strong>ページ全体の再確認<\/strong><br\/>[^<]+<br\/>)[^<]+(<br\/>確認できない値は推測せず保持<\/div>)/u,
  `$1主要数値：${mdhm(majorAsOf)}（${mdhm(needsAudit.reference_at)}再確認）$2`,
  "overview major-as-of",
);
html = replaceOnce(html, /(<section aria-labelledby="pageRecheckTitle"[\s\S]*?<span class="overview-section-tag">)[^<]+(<\/span>)/u, `$1${ymd(pageCheckedAt)}確認$2`, "page recheck tag");
html = replaceOnce(html, /(<div class="page-recheck-meta"><span>サイト確認：[^<]+<\/span><span>主要数値：)[^<]+(<\/span>)/u, `$1${mdhm(majorAsOf)}$2`, "page recheck major-as-of");

const municipalActor = `<button class="overview-actor" data-overview-provider="municipal" type="button"><div class="overview-actor-head"><i class="dot municipal"></i>他自治体等</div><ul><li>${mdhm(municipal.reference_at)}基準で対口支援・他自治体支援を全件再監査</li><li>CURRENT直接確認：${esc(confirmedProviders.length ? confirmedProviders.join("、") : "なし")}</li><li>8月19日行政応援971人などの旧集計は履歴スナップショットとして分離</li></ul><span class="overview-more">支援全体を確認 →</span></button>`;
html = replaceOnce(html, /<button class="overview-actor" data-overview-provider="municipal" type="button">[\s\S]*?<\/button>/u, municipalActor, "municipal actor");

const ehimeActor = `<button class="overview-actor" data-overview-provider="ehime" type="button"><div class="overview-actor-head"><i class="dot ehime"></i>愛媛県</div><ul><li>対口支援${ehimeCounterpart.persons}人、延${Number(ehimeCounterpart.person_days).toLocaleString("ja-JP")}人日。9月11日12時資料で継続確認</li><li>保健師等${ehimeHealth.persons}人・DWAT${ehimeDwat.persons}人を9月11日12時資料で確認。終了予定日は同資料で特定せず</li><li>県大型トイレカーは${esc(toiletTruck.location)}で9月7日に運用終了。人的支援総計${ehimeTotal.persons}人・延${Number(ehimeTotal.person_days).toLocaleString("ja-JP")}人日</li></ul><span class="overview-more">支援全体を確認 →</span></button>`;
html = replaceOnce(html, /<button class="overview-actor" data-overview-provider="ehime" type="button">[\s\S]*?<\/button>/u, ehimeActor, "Ehime actor");

html = replaceJsonConst(html, "PAGE_RECHECK_META", (meta) => {
  meta.checkedAt = pageCheckedAt;
  meta.volunteerCheckedAt = meta.volunteerCheckedAt || pageCheckedAt;
  meta.rows = rows;
});
if (/const\s+MUNICIPAL_SUPPORT_PAGE_META\s*=\s*\{/u.test(html)) {
  html = replaceJsonConst(html, "MUNICIPAL_SUPPORT_PAGE_META", (meta) => {
    meta.checkedAt = pageCheckedAt;
    meta.volunteerCheckedAt = meta.volunteerCheckedAt || pageCheckedAt;
    meta.rows = rows.filter((row) => row.section !== "国・関係機関");
  });
}

await writeFile(sourcePath, html, "utf8");
await writeFile(publicPath, html, "utf8");
console.log(JSON.stringify({
  status: "PASS",
  page_checked_at: pageCheckedAt,
  major_as_of: majorAsOf,
  needs_rechecked_at: needsAudit.reference_at,
  current_shelters: currentCount,
  shelter_source_as_of: shelterAsOf,
  municipal_current_providers: confirmedProviders,
  national_records: nationalCount,
}));

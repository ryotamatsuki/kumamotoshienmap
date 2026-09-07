import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const publicPath = resolve(root, "public", "dashboard.html");
const shelterPath = resolve(root, "current-shelters.json");
const nationalPath = resolve(root, "national-support-audit.json");
const auditDir = resolve(root, "operations", "audits");

const [sourceHtml, publicHtml, shelterText, nationalText, auditFiles] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(publicPath, "utf8"),
  readFile(shelterPath, "utf8"),
  readFile(nationalPath, "utf8"),
  readdir(auditDir),
]);
if (sourceHtml !== publicHtml) throw new Error("source/public parity required before overview synchronization");

const shelters = JSON.parse(shelterText);
const national = JSON.parse(nationalText);
const currentCount = Number(shelters?.meta?.current_count);
if (!Number.isInteger(currentCount) || currentCount < 0) throw new Error("current shelter count is invalid");

function displayJst(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/u);
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}` : String(value || "確認時点不明");
}

function displayReference(value) {
  const match = String(value || "").match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u);
  return match ? `${Number(match[1])}月${Number(match[2])}日${match[3]}:${match[4]}` : null;
}

function displayMonthDay(value) {
  const match = String(value || "").match(/^\d{4}-(\d{2})-(\d{2})/u);
  return match ? `${Number(match[1])}月${Number(match[2])}日` : String(value || "日付要確認");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

let html = sourceHtml;
const shelterCardPattern = /(<button class="overview-kpi" data-overview-impact="shelters" type="button">[\s\S]*?<div class="overview-kpi-value">)\d+(<span class="overview-kpi-unit">か所<\/span><\/div><div class="overview-kpi-note">)[^<]*(<\/div><\/button>)/u;
if (!shelterCardPattern.test(html)) throw new Error("overview shelter KPI card not found");
const shelterAsOf = displayJst(shelters?.meta?.source_last_modified || shelters?.meta?.fetched_at);
html = html.replace(shelterCardPattern, `$1${currentCount}$2公式JSON現在・最終更新${shelterAsOf}$3`);

// Report 52 is the 2026-09-03 14:00 prefectural snapshot. Keep the static note aligned with its canonical timestamp.
html = html.replaceAll("9月2日14時・熊本県第52報", "9月3日14時・熊本県第52報");

// Keep the visible dashboard reference label tied to the structured audit reference rather than a prior release's cleanup overlay.
const referenceLabel = displayReference(national.reference_at);
if (referenceLabel) {
  html = html.replace(/\d{1,2}月\d{1,2}日\d{2}:\d{2}までに確認できた一次情報を反映/gu, `${referenceLabel}までに確認できた一次情報を反映`);
}

// The national overview is a static summary surface. Derive the Hakuo II line from the structured national audit instead of retaining a prior release's prose.
const hakuo = national.records?.find((record) => record.record_id === "national-accommodation-hakuo2");
if (hakuo) {
  const nationalActorPattern = /(<button class="overview-actor" data-overview-provider="national" type="button">[\s\S]*?<ul>[\s\S]*?<li>[\s\S]*?<\/li>[\s\S]*?<li>[\s\S]*?<\/li>[\s\S]*?<li>)[\s\S]*?(<\/li>[\s\S]*?<\/ul>)/u;
  if (!nationalActorPattern.test(html)) throw new Error("national overview actor card not found");
  const line = `はくおうⅡ宿泊支援：${hakuo.display?.status || hakuo.state}／${hakuo.display?.period || "期間要確認"}`;
  html = html.replace(nationalActorPattern, `$1${escapeHtml(line)}$2`);
}

// Keep the Ehime overview tied to the latest committed official-source recheck, rather than stale prose embedded in the base HTML.
const ehimeAuditName = auditFiles
  .filter((name) => /^ehime-source-recheck-\d{8}-\d{4}\.json$/u.test(name))
  .sort()
  .at(-1);
let ehimeAudit = null;
if (ehimeAuditName) {
  ehimeAudit = JSON.parse(await readFile(resolve(auditDir, ehimeAuditName), "utf8"));
  const total = ehimeAudit?.human_support?.total;
  const counterpart = ehimeAudit?.human_support?.counterpart_support;
  const health = ehimeAudit?.human_support?.public_health;
  const dwat = ehimeAudit?.human_support?.dwat;
  const truck = ehimeAudit?.material_support?.prefectural_large_toilet_truck;
  for (const [label, value] of Object.entries({ total, counterpart, health, dwat, truck })) {
    if (!value) throw new Error(`Ehime overview audit is missing ${label}`);
  }
  const ehimeActorPattern = /<button class="overview-actor" data-overview-provider="ehime" type="button">[\s\S]*?<\/button>/u;
  if (!ehimeActorPattern.test(html)) throw new Error("Ehime overview actor card not found");
  const line1 = `対口支援${counterpart.persons}人（県${counterpart.prefecture_persons}・市町${counterpart.municipal_persons}）、延${Number(counterpart.person_days).toLocaleString("ja-JP")}人日。災害応急対策職員は終期未定`;
  const line2 = `保健師等${health.persons}人・DWAT${dwat.persons}人は${displayMonthDay(health.planned_through)}まで予定`;
  const line3 = `県大型トイレカーは${escapeHtml(truck.location)}で${displayMonthDay(truck.ended_on)}に運用終了。人的支援総計${total.persons}人・延${Number(total.person_days).toLocaleString("ja-JP")}人日`;
  const replacement = `<button class="overview-actor" data-overview-provider="ehime" type="button"><div class="overview-actor-head"><i class="dot ehime"></i>愛媛県</div><ul><li>${escapeHtml(line1)}</li><li>${escapeHtml(line2)}</li><li>${line3}</li></ul><span class="overview-more">支援全体を確認 →</span></button>`;
  html = html.replace(ehimeActorPattern, replacement);
}

await writeFile(sourcePath, html, "utf8");
await writeFile(publicPath, html, "utf8");
console.log(JSON.stringify({
  status: "PASS",
  referenceAt: national.reference_at || null,
  currentShelters: currentCount,
  shelterSourceAsOf: shelters?.meta?.source_last_modified || shelters?.meta?.fetched_at || null,
  hakuoState: hakuo?.state || null,
  ehimeAudit: ehimeAuditName || null,
  ehimeSourceAsOf: ehimeAudit?.source_as_of || null,
}));

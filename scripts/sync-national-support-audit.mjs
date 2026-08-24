import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIT_PATH = resolve(ROOT, "national-support-audit.json");
const SOURCE_PATH = resolve(ROOT, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const PUBLIC_PATH = resolve(ROOT, "public", "dashboard.html");
const START = "/* NATIONAL_SUPPORT_AUDIT_START */";
const END = "/* NATIONAL_SUPPORT_AUDIT_END */";
const FALLBACK_ANCHOR = "/* CURRENT_STATE_REFRESH_20260824_END */";
const MUNICIPAL_END = "/* MUNICIPAL_SUPPORT_AUDIT_END */";

const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
let source = readFileSync(SOURCE_PATH, "utf8");
const published = readFileSync(PUBLIC_PATH, "utf8");
if (source !== published) throw new Error("national sync requires source/public parity before generation");

function stripGenerated(html) {
  const start = html.indexOf(START);
  if (start < 0) return html;
  const end = html.indexOf(END, start);
  if (end < 0) throw new Error("NATIONAL_SUPPORT_AUDIT_END marker missing");
  return `${html.slice(0, start)}${html.slice(end + END.length)}`;
}

function replaceOverviewResource(html, recordId, label, value, sub) {
  const pattern = new RegExp(`<button class="overview-resource" data-overview-records="${recordId}" type="button">[\\s\\S]*?<\\/button>`, "u");
  if (!pattern.test(html)) throw new Error(`overview resource missing: ${recordId}`);
  return html.replace(pattern, `<button class="overview-resource" data-overview-records="${recordId}" type="button"><div class="overview-resource-label">${label}</div><div class="overview-resource-value">${value}</div><div class="overview-resource-sub">${sub}</div></button>`);
}

source = stripGenerated(source);
source = source.replace(/volunteer-data\.js\?v=[A-Za-z0-9._-]+/gu, `volunteer-data.js?v=${audit.release_id}`);
source = source.replace(/(const\s+PAGE_RECHECK_META\s*=\s*\{[^\n]*?"checkedAt"\s*:\s*)"[^"]+"/u, `$1"${audit.reference_at}"`);

const nationalActorPattern = /<button class="overview-actor" data-overview-provider="national" type="button">[\s\S]*?<\/button>/u;
if (!nationalActorPattern.test(source)) throw new Error("national overview actor card missing");
source = source.replace(nationalActorPattern, `<button class="overview-actor" data-overview-provider="national" type="button"><div class="overview-actor-head"><i class="dot national"></i>国・関係機関</div><ul><li>8月24日22:38に既存12レコードを全件再監査（監査レコード計13件）</li><li>国交省第48報：給水車119台、TEC-FORCE現時点98人・累計4,507人日</li><li>消防・医療等の同一定義現況を確定できない項目はUNKNOWN、8月26日TEC-FORCE第5陣はPLANNED</li></ul><span class="overview-more">支援全体を確認 →</span></button>`);
source = replaceOverviewResource(source, "national-water", "応急給水", "119台", "国交省第48報・8月23日7時30分時点");
source = replaceOverviewResource(source, "national-tec", "TEC-FORCE", "98人", "現時点98人／累計4,507人日・第48報");
source = replaceOverviewResource(source, "national-rescue", "救急・航空支援", "UNKNOWN", "8/2 約100人・4機はHISTORICAL");

const summary = audit.summary;
const sourceDigest = audit.sources.map((item) => ({
  source_id: item.source_id,
  publisher: item.publisher,
  source_as_of: item.source_as_of,
  checked_at: item.checked_at,
  url: item.url,
}));
const recordUpdates = Object.fromEntries(audit.records.map((record) => [record.record_id, {
  ...record.display,
  auditState: record.state,
  auditReferenceAt: audit.reference_at,
  auditSourceIds: record.source_ids,
}]));
const generatedRecords = audit.records
  .filter((record) => audit.inventory.generated_record_ids.includes(record.record_id))
  .map((record) => ({
    id: record.record_id,
    provider: "national",
    category: record.category,
    hubIds: ["kumamoto-hq"],
    title: record.record_id === "national-tec-next-wave" ? "TEC-FORCE第5陣（追加派遣予定）" : record.record_id,
    providers: [record.provider],
    ...record.display,
    auditState: record.state,
    auditReferenceAt: audit.reference_at,
    auditSourceIds: record.source_ids,
  }));

const pageRow = {
  section: "国・関係機関",
  status: "全件再監査",
  current: `既存12件＋追加予定1件を${audit.reference_at.slice(0, 16).replace("T", " ")} JSTに裁定`,
  previous: "国交省第47報、消防8月2日値、政府8月19日資料等が混在",
  difference: `CURRENT ${summary.CURRENT} / PLANNED ${summary.PLANNED} / UNKNOWN ${summary.UNKNOWN} / CONFLICT ${summary.CONFLICT}。旧人数は履歴へ分離。`,
  source: "内閣府8/23・消防庁第60報・国交省第48報・防衛省8/23ほか",
  url: "https://www.bousai.go.jp/updates/r8kumamoto_jishin/status/index.html",
};

const overlay = `${START}\nconst NATIONAL_SUPPORT_AUDIT_META=${JSON.stringify({
  schemaVersion: audit.schema_version,
  referenceAt: audit.reference_at,
  releaseId: audit.release_id,
  existingRecordCount: audit.inventory.existing_record_count,
  auditRecordCount: audit.inventory.audit_record_count,
  summary,
})};\nconst NATIONAL_SUPPORT_AUDIT_SOURCES=${JSON.stringify(sourceDigest)};\nconst nationalSupportRecordUpdates=${JSON.stringify(recordUpdates)};\nObject.entries(nationalSupportRecordUpdates).forEach(([id,values])=>{const record=RECORDS.find(item=>item.id===id);if(record)Object.assign(record,values);});\nconst nationalSupportGeneratedRecords=${JSON.stringify(generatedRecords)};\nnationalSupportGeneratedRecords.forEach(record=>{if(!RECORDS.some(item=>item.id===record.id))RECORDS.push(record);});\nif(typeof PAGE_RECHECK_META!=="undefined"){PAGE_RECHECK_META.checkedAt=NATIONAL_SUPPORT_AUDIT_META.referenceAt;const rows=Array.isArray(PAGE_RECHECK_META.rows)?PAGE_RECHECK_META.rows:[];const nextRows=rows.filter(row=>row.section!=="国・関係機関");nextRows.push(${JSON.stringify(pageRow)});PAGE_RECHECK_META.rows.splice(0,PAGE_RECHECK_META.rows.length,...nextRows);}\n${END}`;

let insertAt = source.indexOf(MUNICIPAL_END);
if (insertAt >= 0) insertAt += MUNICIPAL_END.length;
else {
  insertAt = source.indexOf(FALLBACK_ANCHOR);
  if (insertAt < 0) throw new Error("national sync insertion anchor missing");
  insertAt += FALLBACK_ANCHOR.length;
}
source = `${source.slice(0, insertAt)}\n${overlay}${source.slice(insertAt)}`;

// Explicitly eliminate stale-current wording while preserving dated history in the audit JSON.
source = source.replaceAll("8月2日公表値・継続要確認", "8/2実績はHISTORICAL・現況UNKNOWN");

writeFileSync(SOURCE_PATH, source);
writeFileSync(PUBLIC_PATH, source);
console.log(JSON.stringify({
  status: "PASS",
  reference_at: audit.reference_at,
  release_id: audit.release_id,
  records: audit.records.length,
  summary: audit.summary,
  source_public_parity: true,
}));

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIT_PATH = resolve(ROOT, "national-support-audit.json");
const SOURCE_PATH = resolve(ROOT, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const PUBLIC_PATH = resolve(ROOT, "public", "dashboard.html");
const VALID_STATES = new Set(["CURRENT", "HISTORICAL", "PLANNED", "UNKNOWN", "CONFLICT"]);
const REQUIRED_AGENCY_PATTERNS = ["内閣府", "消防庁", "国土交通省", "厚生労働省", "防衛省", "警察庁"];
const START = "/* NATIONAL_SUPPORT_AUDIT_START */";
const END = "/* NATIONAL_SUPPORT_AUDIT_END */";

function fail(message) { throw new Error(`[NATIONAL SUPPORT AUDIT FAIL] ${message}`); }
function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { fail(`JSONを読み込めません: ${error.message}`); }
}
function parseInitialRecords(html) {
  const match = html.match(/const\s+RECORDS\s*=\s*(\[[^\n]*\]);/u);
  if (!match) fail("初期RECORDS配列を解析できません。");
  try { return vm.runInNewContext(`(${match[1]})`, Object.create(null), { timeout: 1500 }); }
  catch (error) { fail(`初期RECORDS配列の評価に失敗しました: ${error.message}`); }
}
function parsePageMeta(html) {
  const match = html.match(/const\s+PAGE_RECHECK_META\s*=\s*(\{[^\n]*\});/u);
  if (!match) fail("PAGE_RECHECK_METAが見つかりません。");
  try { return vm.runInNewContext(`(${match[1]})`, Object.create(null), { timeout: 1000 }); }
  catch (error) { fail(`PAGE_RECHECK_METAを解析できません: ${error.message}`); }
}
function assertSetEqual(expected, actual, label) {
  const e = new Set(expected); const a = new Set(actual);
  const missing = [...e].filter((id) => !a.has(id));
  const unexpected = [...a].filter((id) => !e.has(id));
  if (missing.length || unexpected.length) fail(`${label}不一致 missing=${JSON.stringify(missing)} unexpected=${JSON.stringify(unexpected)}`);
}

const audit = readJson(AUDIT_PATH);
const source = readFileSync(SOURCE_PATH, "utf8");
const published = readFileSync(PUBLIC_PATH, "utf8");
if (source !== published) fail("source/public parityが崩れています。");
if (audit.schema_version !== 1) fail("schema_versionは1で必要です。");
if (audit.repository !== "ryotamatsuki/kumamotoshienmap") fail("repositoryが一致しません。");
if (Number.isNaN(Date.parse(audit.reference_at)) || Number.isNaN(Date.parse(audit.checked_at))) fail("reference_at/checked_atが不正です。");
if (!/^\d{8}-\d{4}$/u.test(String(audit.release_id ?? ""))) fail("release_idがYYYYMMDD-HHMM形式ではありません。");
if (audit.reference_at !== audit.checked_at) fail("今回の全件監査ではchecked_atをreference_atへ固定してください。");

const pageMeta = parsePageMeta(source);
if (pageMeta.checkedAt !== audit.reference_at) fail(`reference_atとPAGE_RECHECK_META.checkedAtが不一致です。 expected=${audit.reference_at} actual=${pageMeta.checkedAt}`);
const releaseIds = [...source.matchAll(/volunteer-data\.js\?v=([A-Za-z0-9._-]+)/gu)].map((m) => m[1]);
if (!releaseIds.length || releaseIds.some((id) => id !== audit.release_id)) fail(`HTML release_idがnational auditと一致しません: ${JSON.stringify([...new Set(releaseIds)])}`);
if (!source.includes(START) || !source.includes(END) || !source.includes("NATIONAL_SUPPORT_AUDIT_META")) fail("national support生成overlayがありません。");
if (source.indexOf(START) > source.indexOf(END)) fail("national support生成overlay marker順が不正です。");

const initialRecords = parseInitialRecords(source);
const nationalIds = initialRecords.filter((item) => item?.provider === "national").map((item) => item.id).sort();
if (!Array.isArray(audit.inventory?.existing_record_ids)) fail("inventory.existing_record_idsが必要です。");
assertSetEqual(nationalIds, audit.inventory.existing_record_ids, "現行provider:nationalレコードと監査対象");
if (audit.inventory.existing_record_count !== nationalIds.length) fail("existing_record_countが実レコード件数と一致しません。");
if (!Array.isArray(audit.records) || !audit.records.length) fail("recordsが空です。");
if (audit.inventory.audit_record_count !== audit.records.length) fail("audit_record_countがrecords件数と一致しません。");
const recordIds = audit.records.map((record) => record.record_id);
if (new Set(recordIds).size !== recordIds.length) fail("record_idが重複しています。");
for (const id of audit.inventory.existing_record_ids) if (!recordIds.includes(id)) fail(`既存nationalレコードが未裁定です: ${id}`);
for (const id of audit.inventory.generated_record_ids ?? []) if (!recordIds.includes(id)) fail(`generated_record_idがrecordsにありません: ${id}`);

const sourceById = new Map();
for (const [index, item] of (audit.sources ?? []).entries()) {
  if (!item?.source_id || !/^https?:\/\//u.test(String(item.url ?? ""))) fail(`sources[${index}]にsource_id/urlが必要です。`);
  if (sourceById.has(item.source_id)) fail(`source_id重複: ${item.source_id}`);
  if (item.primary !== true) fail(`national auditの裁定用sourceはprimary=trueで登録してください: ${item.source_id}`);
  if (item.checked_at !== audit.reference_at) fail(`source.checked_atがreference_atと不一致: ${item.source_id}`);
  sourceById.set(item.source_id, item);
}

const stateCounts = Object.fromEntries([...VALID_STATES].map((state) => [state, 0]));
for (const record of audit.records) {
  if (!VALID_STATES.has(record.state)) fail(`${record.record_id}: stateが不正です: ${record.state}`);
  stateCounts[record.state] += 1;
  if (!Array.isArray(record.source_ids) || record.source_ids.length === 0) fail(`${record.record_id}: source_idsが必要です。`);
  for (const sourceId of record.source_ids) if (!sourceById.has(sourceId)) fail(`${record.record_id}: 未登録source_id ${sourceId}`);
  if (!Array.isArray(record.adjudications) || record.adjudications.length === 0) fail(`${record.record_id}: adjudicationsが必要です。`);
  for (const adjudication of record.adjudications) {
    if (!VALID_STATES.has(adjudication.state)) fail(`${record.record_id}: adjudication state不正 ${adjudication.state}`);
    if (!Array.isArray(adjudication.source_ids) || adjudication.source_ids.length === 0) fail(`${record.record_id}: adjudication source_idsが必要です。`);
    for (const sourceId of adjudication.source_ids) if (!sourceById.has(sourceId)) fail(`${record.record_id}: adjudicationに未登録source_id ${sourceId}`);
  }
  if (!record.display || typeof record.display !== "object") fail(`${record.record_id}: displayが必要です。`);
  if (record.display.status !== record.state) fail(`${record.record_id}: stateとdisplay.statusが不一致です。`);
  if (record.state === "CURRENT") {
    const primaryCurrent = record.adjudications.some((item) => item.state === "CURRENT" && item.source_ids.some((id) => sourceById.get(id)?.primary === true));
    if (!primaryCurrent) fail(`${record.record_id}: CURRENTに一次情報根拠がありません。`);
  }
  if (record.state === "UNKNOWN") {
    const scale = String(record.display.scale ?? "");
    if (!scale.includes("UNKNOWN")) fail(`${record.record_id}: UNKNOWNなのにdisplay.scaleがUNKNOWNを明示していません。`);
    const previous = String(record.previous_snapshot?.value ?? "").trim();
    if (previous && scale === previous) fail(`${record.record_id}: UNKNOWNなのに旧スナップショットをcurrent scaleとして表示しています。`);
  }
  if (record.state === "HISTORICAL" && /活動中|CURRENT/u.test(`${record.display.status} ${record.display.scale} ${record.display.period}`)) fail(`${record.record_id}: HISTORICALを現況として表示しています。`);
  if (record.state === "PLANNED") {
    if (!/予定|出発前/u.test(`${record.display.period} ${record.display.detail}`)) fail(`${record.record_id}: PLANNEDの予定性が表示されていません。`);
    if (/活動中|実働中/u.test(`${record.display.scale} ${record.display.period}`)) fail(`${record.record_id}: PLANNEDを実績値として表示しています。`);
  }
}

for (const [state, count] of Object.entries(stateCounts)) {
  if (audit.summary?.[state] !== count) fail(`summary.${state}=${audit.summary?.[state]} actual=${count}`);
}
if (audit.summary?.records_total !== audit.records.length) fail("summary.records_total不一致です。");
if (audit.summary?.existing_records_audited !== nationalIds.length) fail("summary.existing_records_audited不一致です。");
if (audit.summary?.blocking_unresolved_count !== 0) fail("blocking_unresolved_countは0で必要です。");

const coverageText = (audit.agency_coverage ?? []).map((item) => item.agency).join("\n");
for (const pattern of REQUIRED_AGENCY_PATTERNS) if (!coverageText.includes(pattern)) fail(`agency_coverageに必須機関がありません: ${pattern}`);
for (const item of audit.agency_coverage ?? []) {
  if (!Array.isArray(item.source_ids) || !item.source_ids.length) fail(`agency_coverage source_ids不足: ${item.agency}`);
  for (const sourceId of item.source_ids) if (!sourceById.has(sourceId)) fail(`agency_coverageに未登録source_id: ${item.agency}/${sourceId}`);
}

const actorMatch = source.match(/<button class=\"overview-actor\" data-overview-provider=\"national\" type=\"button\">[\s\S]*?<\/button>/u);
if (!actorMatch) fail("国・関係機関overview actorが見つかりません。");
const actor = actorMatch[0];
for (const stale of ["8月19日資料）まで確認", "給水車129台", "現在105人", "4,299人日"]) if (actor.includes(stale)) fail(`国・関係機関actorに旧current表現が残っています: ${stale}`);
if (!actor.includes("全件再監査")) fail("国・関係機関actorに全件再監査時点が表示されていません。");

const resourceRegionMatch = source.match(/<div class=\"overview-resource-grid\">[\s\S]*?<\/div>\s*<\/section>/u);
if (!resourceRegionMatch) fail("主要な投入資源regionが見つかりません。");
const resourceRegion = resourceRegionMatch[0];
for (const stale of ["129台", "4,299人日", "現在105人", "約100人・4機", "継続要確認"]) if (resourceRegion.includes(stale)) fail(`主要投入資源に旧current表現が残っています: ${stale}`);
if (!resourceRegion.includes("119台") || !resourceRegion.includes("4,507人日") || !resourceRegion.includes("UNKNOWN")) fail("主要投入資源がnational auditの裁定表示へ更新されていません。");

console.log(JSON.stringify({
  status: "PASS",
  reference_at: audit.reference_at,
  release_id: audit.release_id,
  existing_national_records: nationalIds.length,
  audit_records: audit.records.length,
  states: stateCounts,
  source_public_parity: true,
  generated_overlay: true,
  dangerous_current_wording_checked: true
}));

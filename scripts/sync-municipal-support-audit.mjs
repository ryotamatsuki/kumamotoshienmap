import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const auditPath = resolve(root, "municipal-support-audit.json");
const sourcePath = resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const publicPath = resolve(root, "public", "dashboard.html");
const startMarker = "/* MUNICIPAL_SUPPORT_AUDIT_START */";
const endMarker = "/* MUNICIPAL_SUPPORT_AUDIT_END */";
const refreshEndMarker = "/* CURRENT_STATE_REFRESH_20260824_END */";
const audit = JSON.parse(await readFile(auditPath, "utf8"));
const auditTimeMatch=audit.reference_at.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u);
if(!auditTimeMatch)throw new Error("municipal audit reference_at format is invalid");
const auditCheckedLabel=`${Number(auditTimeMatch[1])}月${Number(auditTimeMatch[2])}日${auditTimeMatch[3]}:${auditTimeMatch[4]}`;
const auditCheckedSourceLabel=`${audit.reference_at.slice(0,4)}年${Number(auditTimeMatch[1])}月${Number(auditTimeMatch[2])}日${auditTimeMatch[3]}時${auditTimeMatch[4]}分再確認`;

function stateCounts(record) {
  const all = [...record.provider_statuses, ...(record.additional_statuses || [])];
  return Object.fromEntries(["CURRENT","PLANNED","HISTORICAL","UNKNOWN"].map((state) => [state, all.filter((x) => x.state === state).length]));
}
function activeProviderNames(record) {
  const all = [...record.provider_statuses, ...(record.additional_statuses || [])];
  return [...new Set(all.filter((item) => item.state === "CURRENT" || item.state === "PLANNED").map((item) => item.name))];
}
function targetPageMeta(html) {
  const match = html.match(/const\s+PAGE_RECHECK_META\s*=\s*(\{[^\n]*\});/u);
  if (!match) throw new Error("PAGE_RECHECK_METAが見つかりません。");
  const meta = JSON.parse(match[1]);
  meta.checkedAt = audit.reference_at;
  meta.volunteerCheckedAt ||= audit.reference_at;
  const municipalRow = {
    section: "他自治体等", status: "差分あり",
    current: "9月3日14:57に対口支援・他自治体支援を全件再監査",
    previous: "8月8～19日資料を混在して現行表示",
    difference: "旧割当名簿をHISTORICALとして保持し、派遣元公式情報でCURRENT／PLANNED／HISTORICAL／UNKNOWNを全構成団体ごとに裁定。中央集計971人は8月19日履歴へ変更。",
    source: "派遣元自治体公式情報・熊本県旧割当資料",
    url: "https://github.com/ryotamatsuki/kumamotoshienmap/blob/main/municipal-support-audit.json",
  };
  meta.rows = (meta.rows || []).filter((row) => row.section !== "他自治体等");
  meta.rows.push(municipalRow);
  const dashboard = meta.rows.find((row) => row.section === "支援ダッシュボード");
  if (dashboard) {
    const auditSuffix = `他自治体支援は${auditCheckedLabel}に全件再監査`;
    if (!dashboard.current.includes(auditSuffix)) dashboard.current = `${dashboard.current}／${auditSuffix}`;
    if (!dashboard.difference.includes('他自治体支援')) dashboard.difference = `${dashboard.difference} 他自治体支援は派遣元公式情報でCURRENT／PLANNED／HISTORICAL／UNKNOWNを全件再裁定。`;
  }
  return { match, meta };
}

function buildOverlay(pageMeta) {
  const recordUpdates = Object.fromEntries(audit.records.map((record) => {
    const counts = stateCounts(record);
    const stateSummary = `CURRENT ${counts.CURRENT}／PLANNED ${counts.PLANNED}／HISTORICAL ${counts.HISTORICAL}／UNKNOWN ${counts.UNKNOWN}`;
    return [record.id, {
      ...record.display,
      providers: activeProviderNames(record),
      detail: `${record.display.detail} 【監査状態】${stateSummary}。旧割当名簿は履歴であり、CURRENTを意味しない。`,
      sourceUrl: "https://github.com/ryotamatsuki/kumamotoshienmap/blob/main/municipal-support-audit.json",
      auditState: record.record_state,
      auditCheckedAt: audit.checked_at,
      historicalRoster: record.historical_roster,
      providerStatuses: record.provider_statuses,
      additionalStatuses: record.additional_statuses || [],
    }];
  }));
  const supportByDestination = Object.fromEntries(audit.records
    .filter((record) => record.destination && !record.destination.includes("・") && record.id.startsWith("pair-"))
    .map((record) => [record.destination, `${record.display.period}：${record.display.status}。${record.display.scale}`]));
  const sourceRows = audit.sources.filter((source) => source.role !== "secondary_discovery_only").map((source) => ({
    group: ["historical_roster","historical_aggregate","historical_activity"].includes(source.role) ? "他自治体支援・履歴" : "他自治体支援・派遣元公式",
    name: source.name || source.source_id,
    asOf: source.as_of || "2026年8月24日18時06分再確認",
    url: source.url,
  }));
  return [
    startMarker,
    `const MUNICIPAL_SUPPORT_AUDIT_META=${JSON.stringify({referenceAt:audit.reference_at,checkedAt:audit.checked_at,releaseId:audit.release_id})};`,
    `const MUNICIPAL_SUPPORT_RECORD_UPDATES=${JSON.stringify(recordUpdates)};`,
    `const MUNICIPAL_SUPPORT_BY_DESTINATION=${JSON.stringify(supportByDestination)};`,
    `const MUNICIPAL_SUPPORT_AUDIT_SOURCES=${JSON.stringify(sourceRows)};`,
    `const MUNICIPAL_SUPPORT_PAGE_META=${JSON.stringify(pageMeta)};`,
    `Object.entries(MUNICIPAL_SUPPORT_RECORD_UPDATES).forEach(([id,values])=>{const record=RECORDS.find((item)=>item.id===id);if(record)Object.assign(record,values);});`,
    `Object.entries(MUNICIPAL_SUPPORT_BY_DESTINATION).forEach(([name,text])=>{const municipality=NEED_MUNICIPALITIES.find((item)=>item.name===name);if(municipality){municipality.currentSupport=(municipality.currentSupport||[]).filter((value)=>!String(value).includes('8月19日資料')&&!String(value).includes('8月11日資料'));municipality.currentSupport.unshift(text);}});`,
    `SUPPORT_BLOCKS.forEach((block)=>{if(block.id!=='internal-coordination'){block.badge='旧割当履歴＋9月3日14:57個別再監査';block.note='割当名簿は履歴表示。現在の活動は派遣元公式情報を個別再監査し、CURRENT／PLANNED／HISTORICAL／UNKNOWNを分離。';}});`,
    `MUNICIPAL_SUPPORT_AUDIT_SOURCES.forEach((source)=>{if(!SOURCES.some((item)=>item.url===source.url))SOURCES.push(source);});`,
    `PAGE_RECHECK_META.checkedAt=MUNICIPAL_SUPPORT_PAGE_META.checkedAt;PAGE_RECHECK_META.volunteerCheckedAt=MUNICIPAL_SUPPORT_PAGE_META.volunteerCheckedAt;PAGE_RECHECK_META.rows.splice(0,PAGE_RECHECK_META.rows.length,...MUNICIPAL_SUPPORT_PAGE_META.rows);`,
    endMarker,
  ].join("\n");
}

function upsertBlock(html, block) {
  const start = html.indexOf(startMarker), end = html.indexOf(endMarker);
  if (start >= 0 && end > start) html = `${html.slice(0,start)}${html.slice(end + endMarker.length + (html[end + endMarker.length] === "\n" ? 1 : 0))}`;
  const anchorIndex = html.indexOf(refreshEndMarker);
  if (anchorIndex < 0) throw new Error("CURRENT_STATE_REFRESH_20260824_ENDが見つかりません。");
  const insertAt = anchorIndex + refreshEndMarker.length;
  return `${html.slice(0,insertAt)}\n${block}${html.slice(insertAt)}`;
}
function patchStatic(html) {
  let next = html;
  next = next.replace("<div class=\"provider-card\"><b><i class=\"dot municipal\"></i>他自治体等</b><p>8月19日資料の対口支援・県内調整、モバイルファーマシー等。</p></div>","<div class=\"provider-card\"><b><i class=\"dot municipal\"></i>他自治体等</b><p>9月3日14:57に対口支援・他自治体支援を全件再監査。継続・終了・予定・UNKNOWNを分離。</p></div>");
  next = next.replace("<div class=\"section-note\">公表値：8月15日14時</div>","<div class=\"section-note\">旧割当履歴＋9月3日14:57個別再監査</div>");
  next = next.replace("<div class=\"snap\"><strong>971</strong><span>行政応援<br/>関係機関含む計1,038人</span></div>","<div class=\"snap\"><strong>8/19</strong><span>行政応援971人<br/>履歴スナップショット</span></div>");
  next = next.replace("<li>8月24日資料で愛媛県の人的支援を更新</li><li>8月19日資料：行政応援971人（関係機関含む計1,038人）</li><li>宇城市・八代市でモバイルファーマシー（8月8日資料の活動実績・最新状況要確認）</li>","<li>9月3日14:57に対口支援・他自治体支援を全件再監査</li><li>8月19日行政応援971人は履歴スナップショット（同一定義の基準日時点総数はUNKNOWN）</li><li>モバイルファーマシーは8月8日の活動履歴を保持し、8月24日の継続・終了は一次情報不足のためUNKNOWN</li>");
  next = next.replaceAll(/volunteer-data\.js\?v=[A-Za-z0-9._-]+/gu,`volunteer-data.js?v=${audit.release_id}`);
  return next;
}

const sourceBefore = await readFile(sourcePath,"utf8"), publicBefore = await readFile(publicPath,"utf8");
if (sourceBefore !== publicBefore) throw new Error("生成前のsource/public HTMLが一致していません。");
let next = sourceBefore;
// Remove previous generated block before deriving and patching the canonical PAGE_RECHECK_META constant.
const prevStart=next.indexOf(startMarker), prevEnd=next.indexOf(endMarker);
if(prevStart>=0&&prevEnd>prevStart) next=`${next.slice(0,prevStart)}${next.slice(prevEnd+endMarker.length+(next[prevEnd+endMarker.length]==="\n"?1:0))}`;
const {match,meta}=targetPageMeta(next);
next=next.replace(match[0],`const PAGE_RECHECK_META=${JSON.stringify(meta)};`);
next=patchStatic(next);
next=upsertBlock(next,buildOverlay(meta));
next=next.replaceAll("9月3日14:57",auditCheckedLabel).replaceAll("2026年8月24日18時06分再確認",auditCheckedSourceLabel);
await writeFile(sourcePath,next,"utf8");
await writeFile(publicPath,next,"utf8");
console.log(JSON.stringify({records:audit.records.length,sources:audit.sources.length,referenceAt:audit.reference_at,releaseId:audit.release_id}));

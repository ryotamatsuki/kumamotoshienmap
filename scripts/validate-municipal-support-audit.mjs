import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { extractPageRecheckMeta } from "./current-page-metadata.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const audit = JSON.parse(await readFile(resolve(root,"municipal-support-audit.json"),"utf8"));
const html = await readFile(resolve(root,"ehime_kumamoto_support_geocoded_shelters_20260802.html"),"utf8");
const publicHtml = await readFile(resolve(root,"public","dashboard.html"),"utf8");
const allowedStates = new Set(["CURRENT","HISTORICAL","PLANNED","UNKNOWN"]);
const requiredIds = ["pair-kumamoto","pair-yatsushiro","pair-uto","pair-uki","pair-misato","pair-hikawa","pair-kashima","pharmacy","kumamoto-internal"];

assert.equal(audit.schema_version,1,"municipal-support-audit schema_versionは1で必要です");
assert.equal(audit.repository,"ryotamatsuki/kumamotoshienmap","repositoryが不一致です");
assert.ok(!Number.isNaN(Date.parse(audit.reference_at)),"reference_atが日時ではありません");
assert.ok(!Number.isNaN(Date.parse(audit.checked_at)),"checked_atが日時ではありません");
assert.match(audit.release_id,/^\d{8}-\d{4}$/u,"release_id形式が不正です");
assert.deepEqual(audit.records.map((item)=>item.id).sort(),[...requiredIds].sort(),"全件監査対象レコードが不足・過剰です");
const sourceIds = new Set();
for (const source of audit.sources) {
  assert.ok(source.source_id && !sourceIds.has(source.source_id),`source_id重複/欠落: ${source.source_id}`);
  sourceIds.add(source.source_id);
  assert.match(String(source.url||""),/^https?:\/\//u,`source URL不正: ${source.source_id}`);
}
let totalHistorical=0,totalCurrent=0,totalPlanned=0,totalUnknown=0;
for (const record of audit.records) {
  assert.ok(Array.isArray(record.historical_roster),`${record.id}: historical_rosterがありません`);
  assert.ok(Array.isArray(record.provider_statuses),`${record.id}: provider_statusesがありません`);
  assert.equal(new Set(record.historical_roster).size,record.historical_roster.length,`${record.id}: historical_roster重複`);
  assert.deepEqual(record.provider_statuses.map((x)=>x.name).sort(),[...record.historical_roster].sort(),`${record.id}: 旧名簿全構成団体の裁定がありません`);
  const additional=record.additional_statuses||[];
  const names=[...record.provider_statuses,...additional].map((x)=>x.name);
  assert.equal(new Set(names).size,names.length,`${record.id}: provider名が重複しています`);
  for (const item of [...record.provider_statuses,...additional]) {
    assert.ok(allowedStates.has(item.state),`${record.id}/${item.name}: state不正 ${item.state}`);
    assert.ok(Array.isArray(item.source_ids) && item.source_ids.length>0,`${record.id}/${item.name}: source_idsがありません`);
    for (const id of item.source_ids) assert.ok(sourceIds.has(id),`${record.id}/${item.name}: 未登録source_id ${id}`);
    assert.ok(String(item.note||"").trim(),`${record.id}/${item.name}: noteがありません`);
    if(item.state==="CURRENT") totalCurrent++;
    else if(item.state==="PLANNED") totalPlanned++;
    else if(item.state==="HISTORICAL") totalHistorical++;
    else totalUnknown++;
  }
  for (const field of ["status","scale","period","detail","asOf","sourceLabel"]) assert.ok(String(record.display?.[field]||"").trim(),`${record.id}: display.${field}がありません`);
  assert.ok(Array.isArray(record.recheck_queries)&&record.recheck_queries.length>0,`${record.id}: recheck_queriesがありません`);
}
assert.equal(html,publicHtml,"source/public HTMLが一致していません");
assert.equal((html.match(/MUNICIPAL_SUPPORT_AUDIT_START/gu)||[]).length,1,"municipal audit blockが1件ではありません");
assert.equal((html.match(/MUNICIPAL_SUPPORT_AUDIT_END/gu)||[]).length,1,"municipal audit block終端が1件ではありません");
const markerStart=html.indexOf("/* MUNICIPAL_SUPPORT_AUDIT_START */");
const cleanupEnd=html.indexOf("/* CURRENT_STATE_REFRESH_20260824_END */");
const pageMetaStart=html.indexOf("const PAGE_RECHECK_META=");
assert.ok(markerStart>cleanupEnd && markerStart>pageMetaStart,"municipal audit overlayの適用順が不正です");
const pageMeta=extractPageRecheckMeta(html);
assert.equal(pageMeta.checkedAt,audit.reference_at,"時点修正時に他自治体支援の全件再監査が更新されていません");
assert.ok(pageMeta.rows.some((row)=>row.section==="他自治体等" && row.current.includes("全件再監査")),"PAGE_RECHECK_METAに他自治体等の全件再監査記録がありません");
const metaMatch=html.match(/const MUNICIPAL_SUPPORT_AUDIT_META=(\{[^\n]*\});/u);
assert.ok(metaMatch,"MUNICIPAL_SUPPORT_AUDIT_METAがありません");
const generatedMeta=JSON.parse(metaMatch[1]);
assert.equal(generatedMeta.referenceAt,audit.reference_at,"生成audit referenceAt不一致");
assert.equal(generatedMeta.releaseId,audit.release_id,"生成audit releaseId不一致");
const releaseIds=[...html.matchAll(/volunteer-data\.js\?v=([A-Za-z0-9._-]+)/gu)].map((m)=>m[1]);
assert.ok(releaseIds.length>0 && releaseIds.every((id)=>id===audit.release_id),"HTMLのrelease_idがmunicipal auditと一致しません");
assert.ok(html.includes('旧割当履歴＋') && html.includes('個別再監査'),"地域ブロックが旧名簿を現行表示している可能性があります");
assert.ok(html.includes('同一定義の基準日時点総数はUNKNOWN') || html.includes('同一定義の8月25日総数はUNKNOWN'),"8月19日行政応援総数が現況値として残っています");

// Execute the data/overlay region to ensure the final RECORDS are actually overwritten by the audit.
const dataStart=html.indexOf("const HUBS=");
const auditEnd=html.indexOf("/* MUNICIPAL_SUPPORT_AUDIT_END */")+"/* MUNICIPAL_SUPPORT_AUDIT_END */".length;
const sandbox={};
vm.runInNewContext(`${html.slice(dataStart,auditEnd)}\nglobalThis.__audit={RECORDS,SUPPORT_BLOCKS,NEED_MUNICIPALITIES};`,sandbox,{timeout:5000});
for (const recordAudit of audit.records) {
  const runtime=sandbox.__audit.RECORDS.find((item)=>item.id===recordAudit.id);
  assert.ok(runtime,`runtime recordなし: ${recordAudit.id}`);
  assert.equal(runtime.auditCheckedAt,audit.checked_at,`runtime audit timestamp不一致: ${recordAudit.id}`);
  assert.ok(String(runtime.detail).includes("旧割当名簿は履歴"),`runtime detailが履歴/現況を分離していません: ${recordAudit.id}`);
}
console.log(JSON.stringify({records:audit.records.length,sources:audit.sources.length,current:totalCurrent,planned:totalPlanned,historical:totalHistorical,unknown:totalUnknown,referenceAt:audit.reference_at}));

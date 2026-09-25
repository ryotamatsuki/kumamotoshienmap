import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const sourcePath=resolve(root,'ehime_kumamoto_support_geocoded_shelters_20260802.html');
const publicPath=resolve(root,'public/dashboard.html');
const auditDir=resolve(root,'operations','audits');
const auditNames=(await readdir(auditDir)).filter(name=>/^needs-kpi-source-recheck-\d{8}-\d{4}\.json$/u.test(name)).sort();
const latest=auditNames.at(-1);
if(!latest)throw new Error('latest needs KPI audit missing');
const [sourceHtml,publicHtml,auditText]=await Promise.all([
  readFile(sourcePath,'utf8'),readFile(publicPath,'utf8'),readFile(resolve(auditDir,latest),'utf8')
]);
if(sourceHtml!==publicHtml)throw new Error('needs KPI source/public parity failed');
const audit=JSON.parse(auditText),snapshot=audit.prefectural_snapshot;
const byId=new Map((audit.sources||[]).map(s=>[s.source_id,s]));
const expected={
  evacuees:{value:Number(snapshot.evacuees).toLocaleString('ja-JP')+'人',source:byId.get(snapshot.source_id)},
  water:{value:audit.water.display_value,source:byId.get(audit.water.source_id)},
  housing:{value:Number(snapshot.housing_damage).toLocaleString('ja-JP')+'棟',source:byId.get(snapshot.source_id)},
  waste:{value:audit.waste.display_value,source:byId.get(audit.waste.source_id)}
};
for(const [id,x] of Object.entries(expected)){
  if(!x.source)throw new Error(`needs source missing: ${id}`);
  if(!/^https:\/\//u.test(x.source.url))throw new Error(`needs source URL invalid: ${id}`);
}
const start=sourceHtml.indexOf('<div class="needs-kpis">'),end=sourceHtml.indexOf('<div class="needs-phasebar"',start);
if(start<0||end<0)throw new Error('needs KPI block missing');
const block=sourceHtml.slice(start,end);
for(const [id,x] of Object.entries(expected)){
  const tag=[...block.matchAll(new RegExp('<a class="needs-kpi"[^>]*data-needs-kpi="'+id+'"[^>]*href="([^"]+)"[^>]*>[\\s\\S]*?<div class="needs-kpi-source">([^<]+)<\\/div>','gu'))].at(0);
  if(!tag)throw new Error(`needs KPI link missing: ${id}`);
  if(tag[1]!==x.source.url)throw new Error(`needs KPI href mismatch: ${id}`);
  if(!tag[2].includes(x.source.publisher))throw new Error(`needs KPI publisher missing: ${id}/${x.source.publisher}`);
  if(!tag[2].includes('を開く ↗'))throw new Error(`needs KPI link label incomplete: ${id}`);
  if(!block.includes(x.value))throw new Error(`needs KPI value missing: ${id}/${x.value}`);
}
for(const stale of audit.water.historical_values_not_current||[]){
  if(block.includes(`<div class="needs-kpi-value">${stale}</div>`))throw new Error(`historical water value remains current: ${stale}`);
}
const n=v=>Number(v).toLocaleString('ja-JP');
for(const current of [
  `${n(snapshot.evacuees)}<span class="overview-kpi-unit">人</span>`,
  `${n(snapshot.human_damage)}<span class="overview-kpi-unit">人</span>`,
  `${n(snapshot.housing_damage)}<span class="overview-kpi-unit">棟</span>`
])if(!sourceHtml.includes(current))throw new Error(`overview current value missing: ${current}`);
if(!sourceHtml.includes(audit.water.display_note))throw new Error('water current evidence not synchronized');
if(!sourceHtml.includes(audit.waste.display_note))throw new Error('waste current evidence not synchronized');
if(audit.well_recovery&&!sourceHtml.includes(audit.well_recovery.display_note))throw new Error('well recovery evidence not synchronized');
if(audit.material_support&&!sourceHtml.includes(audit.material_support.detail))throw new Error('material receipt closure not synchronized');
for(const row of audit.local_shelter_updates||[])if(!sourceHtml.includes(row.note))throw new Error('local shelter update not synchronized: '+row.municipality);
if(!sourceHtml.includes("sourceUrl:SRC.prefecture.url"))throw new Error('province current source binding missing');

console.log(JSON.stringify({
  status:'PASS',audit:latest,source_as_of:snapshot.as_of,
  evacuees:snapshot.evacuees,human_damage:snapshot.human_damage,
  housing_damage:snapshot.housing_damage,kpi_links:Object.keys(expected).length
}));

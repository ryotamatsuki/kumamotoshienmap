import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const audit=JSON.parse(readFileSync(resolve(root,'national-support-audit.json'),'utf8'));
const html=readFileSync(resolve(root,'ehime_kumamoto_support_geocoded_shelters_20260802.html'),'utf8');
const publicHtml=readFileSync(resolve(root,'public/dashboard.html'),'utf8');
const fail=(message)=>{throw new Error('[NATIONAL SUPPORT AUDIT FAIL] '+message);};

if(html!==publicHtml)fail('source/public parity');
if(audit.reference_at!=='2026-09-02T16:16:00+09:00')fail('reference_at');
if(audit.inventory.audit_record_count!==audit.records.length)fail('record count');
const expectedRecordIds=[...new Set([...(audit.inventory.existing_record_ids||[]),...(audit.inventory.generated_record_ids||[])])];
const actualRecordIds=audit.records.map((record)=>record.record_id);
if(new Set(actualRecordIds).size!==actualRecordIds.length)fail('監査対象national record_id重複');
const missingRecordIds=expectedRecordIds.filter((id)=>!actualRecordIds.includes(id));
const unexpectedRecordIds=actualRecordIds.filter((id)=>!expectedRecordIds.includes(id));
if(missingRecordIds.length||unexpectedRecordIds.length)fail(`未裁定の監査対象national recordがあります missing=${missingRecordIds.join(',')} unexpected=${unexpectedRecordIds.join(',')}`);
if(audit.inventory.audit_record_count!==expectedRecordIds.length)fail('監査対象national inventory count');
const sourceIds=new Set(audit.sources.map((source)=>source.source_id));
const auditUpper=Date.parse(audit.rechecked_at||audit.checked_at);
for(const source of audit.sources){
  if(!source.primary)fail('non-primary '+source.source_id);
  const checked=Date.parse(source.rechecked_at||source.checked_at);
  if(!Number.isFinite(checked)||checked<Date.parse(audit.reference_at)||checked>auditUpper)fail('checked/rechecked_at '+source.source_id);
}
for(const record of audit.records){
  if(record.display.status!==record.state)fail('display state '+record.record_id);
  for(const sourceId of record.source_ids)if(!sourceIds.has(sourceId))fail('source '+sourceId);
  if(record.state==='CURRENT'&&!record.adjudications.some((item)=>item.state==='CURRENT'&&item.source_ids.some((sourceId)=>sourceIds.has(sourceId))))fail('CURRENT evidence '+record.record_id);
  if(record.state==='UNKNOWN'&&!String(record.display.scale).includes('UNKNOWN'))fail('UNKNOWN wording '+record.record_id);
  if(record.state==='PLANNED'&&!record.adjudications.some((item)=>item.state==='PLANNED'))fail('PLANNED evidence '+record.record_id);
}
for(const state of ['CURRENT','HISTORICAL','PLANNED','UNKNOWN','CONFLICT'])if(audit.summary[state]!==audit.records.filter((record)=>record.state===state).length)fail('summary '+state);
if(audit.summary.blocking_unresolved_count!==0)fail('blocking unresolved');
for(const agency of ['内閣府','消防庁','国土交通省','厚生労働省','防衛省','警察庁','財務省','経済産業省'])if(!(audit.agency_coverage||[]).some((item)=>item.agency.includes(agency)))fail('agency '+agency);
if(!html.includes('9月2日16:16基準で全件再監査'))fail('actor not updated');
if(!html.includes('national-sme-loan'))fail('new policy record not generated');
if(!html.includes('national-accommodation-hakuo2'))fail('planned accommodation record not generated');
console.log(JSON.stringify({status:'PASS',reference_at:audit.reference_at,rechecked_at:audit.rechecked_at,records:audit.records.length,summary:audit.summary}));

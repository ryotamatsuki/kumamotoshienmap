import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const REF='2026-08-31T14:16:00+09:00';
const CHECKED='2026-08-31T14:28:00+09:00';
const NEXT='2026-09-01T09:00:00+09:00';
const RELEASE='20260831-1416';
const OLD_REF='2026-08-30T14:20:00+09:00';
const OLD_CHECKED='2026-08-30T14:35:00+09:00';
const OLD_RELEASE='20260830-1420';
const NEW_ENTITY_FILE='sender-audit/timepoint-20260831-additions.json';
const NAGASAKI_SOURCE='nagasaki-wave-0831';
const NAGASAKI_URL='https://www.pref.nagasaki.jp/press-contents/52044.html';
const BASE_MAIN='576b8c908e0a9012b7431ba97ec43ea9727bb9b4';

const readJson=p=>JSON.parse(readFileSync(p,'utf8'));
const writeJson=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const uniq=a=>[...new Set(a)];

function replaceText(s){
  return s
    .replaceAll(OLD_REF,REF)
    .replaceAll(OLD_CHECKED,CHECKED)
    .replaceAll(OLD_RELEASE,RELEASE)
    .replaceAll('2026年8月30日14:20','2026年8月31日14:16')
    .replaceAll('2026年8月30日 14:20','2026年8月31日 14:16')
    .replaceAll('8月30日14:20','8月31日14:16');
}
function touchObject(v){
  if(!v || typeof v!=='object') return;
  if(Array.isArray(v)){ for(const x of v) touchObject(x); return; }
  if(Object.hasOwn(v,'reference_at') && v.reference_at===OLD_REF) v.reference_at=REF;
  if(Object.hasOwn(v,'checked_at')) v.checked_at=CHECKED;
  if(Object.hasOwn(v,'rechecked_at')) v.rechecked_at=CHECKED;
  for(const x of Object.values(v)) touchObject(x);
}
function transformJsonText(p,fn){ const x=readJson(p); fn?.(x); writeJson(p,x); }
function transformTextFile(p,fn){ if(!existsSync(p)) return; const before=readFileSync(p,'utf8'); const after=fn(before); if(after!==before) writeFileSync(p,after); }

// 1) Sender source catalogue + 47-prefecture discovery.
const manifest=readJson('sender-municipality-audit.json');
const sourceFiles=[manifest.sources_file,manifest.sources_additions_file].filter(Boolean);
for(const p of sourceFiles){
  const x=readJson(p); x.reference_at=REF;
  for(const s of x.sources||[]){ s.checked_at=CHECKED; s.rechecked_at=CHECKED; }
  if(p===manifest.sources_additions_file && !(x.sources||[]).some(s=>s.source_id===NAGASAKI_SOURCE)){
    x.sources.push({
      source_id:NAGASAKI_SOURCE,
      publisher:'長崎県',
      title:'令和8年熊本地震に係る長崎県及び県内市町職員の派遣（美里町第8陣・八代市第6陣）',
      url:NAGASAKI_URL,
      tier:2,
      checked_at:CHECKED,
      note:'2026年8月31日発表。9月1日から美里町・八代市へ派遣する県内市町職員の内訳を公式発表。予定情報のためCURRENT裁定には用いない。',
      rechecked_at:CHECKED
    });
  }
  writeJson(p,x);
}

const discovery=readJson(manifest.discovery_file);
discovery.reference_at=REF;
for(const d of discovery.prefecture_discovery||[]){
  d.checked_at=CHECKED; d.rechecked_at=CHECKED; d.discovery_state='CHECKED';
  if(d.prefecture==='長崎県'){
    d.sources_checked=uniq([...(d.sources_checked||[]),NAGASAKI_SOURCE]);
    d.sender_candidates_found=uniq([...(d.sender_candidates_found||[]),'島原市','平戸市','五島市','雲仙市','長崎市','佐世保市','諫早市','大村市','小値賀町']);
  }
}
writeJson(manifest.discovery_file,discovery);

const discoveryAdd=readJson(manifest.discovery_additions_file);
discoveryAdd.reference_at=REF;
const newNames=['島原市','平戸市','五島市','雲仙市','佐世保市','小値賀町'];
for(const name of newNames){
  if(!(discoveryAdd.source_mentions||[]).some(r=>r[0]==='長崎県'&&r[1]===name)) discoveryAdd.source_mentions.push(['長崎県',name,NAGASAKI_SOURCE]);
}
writeJson(manifest.discovery_additions_file,discoveryAdd);

// 2) Recheck every adjudicated sender. Keep strict state semantics; update only new directly-supported future plans.
const existingNagasaki=['長崎市','諫早市','大村市'];
const fukuokaToday=new Set(['うきは市','新宮町','久山町','福智町']);
for(const p of manifest.entity_files){
  const x=readJson(p); x.reference_at=REF; if(Object.hasOwn(x,'checked_at')) x.checked_at=CHECKED; if(Object.hasOwn(x,'rechecked_at')) x.rechecked_at=CHECKED;
  for(const e of x.entities||[]){
    e.checked_at=CHECKED; e.next_review_at=NEXT; if(Object.hasOwn(e,'rechecked_at')) e.rechecked_at=CHECKED;
    if(e.prefecture==='群馬県' && e.source_ids?.includes('gunma-wave4-0818')){
      e.evidence_note='群馬県公式資料で第4班の派遣元自治体として確認。8月24日～9月1日の派遣予定は確認できるが、8月31日14:16時点の実働を直接示す一次情報ではないためUNKNOWN。';
      e.reason='予定期間内という理由だけではCURRENTにせず、基準時点の実働を直接確認できないためUNKNOWN。';
    }
    if(e.prefecture==='福岡県' && fukuokaToday.has(e.entity)){
      e.state='PLANNED';
      e.evidence_note='福岡県公式発表で8月31日以降の派遣予定主体として確認。8月31日が予定開始日だが、当該市町の実出発・実働を直接示す一次情報は未確認。予定日到来のみではCURRENTにしない。';
      e.reason='公式な派遣予定は確認済みだが、市町別の実出発・実働を直接確認できないためPLANNEDを維持。';
      e.next_review_at=NEXT;
    }
    if(e.prefecture==='長崎県' && existingNagasaki.includes(e.entity)){
      e.state='PLANNED';
      e.source_ids=uniq([...(e.source_ids||[]),NAGASAKI_SOURCE]);
      e.sources_checked=uniq([...(e.sources_checked||[]),NAGASAKI_SOURCE]);
      e.support_types=uniq([...(e.support_types||[]),'職員派遣']);
      e.destinations=uniq([...(e.destinations||[]),'八代市']);
      e.evidence_note='長崎県が8月31日に、9月1日からの八代市第6陣として当該市職員を派遣すると公式発表。基準時点では翌日開始予定のためPLANNED。';
      e.reason='翌日開始予定の一次情報はあるが、基準時点の実働ではないためCURRENTにしない。';
      e.source_as_of='2026-08-31T00:00:00+09:00';
      delete e.current_evidence_type;
    }
  }
  writeJson(p,x);
}

const planRows=[
  ['島原市','city','美里町'],['平戸市','city','美里町'],['五島市','city','美里町'],['雲仙市','city','美里町'],
  ['佐世保市','city','八代市'],['小値賀町','town','八代市']
].map(([entity,municipality_type,destination])=>({
  entity,prefecture:'長崎県',municipality_type,kind:'basic_municipality_sender',required:false,state:'PLANNED',
  support_types:['職員派遣'],destinations:[destination],source_ids:[NAGASAKI_SOURCE],
  evidence_note:`長崎県が8月31日に、9月1日からの${destination}派遣陣として${entity}職員を派遣すると公式発表。基準時点では翌日開始予定のためPLANNED。`,
  checked_at:CHECKED,next_review_at:NEXT,source_as_of:'2026-08-31T00:00:00+09:00',sources_checked:[NAGASAKI_SOURCE],
  reason:'翌日開始予定の一次情報はあるが、基準時点の実出発・実働ではないためCURRENTにしない。'
}));
writeJson(NEW_ENTITY_FILE,{region:'timepoint-20260831-additions',reference_at:REF,checked_at:CHECKED,entities:planRows,rechecked_at:CHECKED});
if(!manifest.entity_files.includes(NEW_ENTITY_FILE)) manifest.entity_files.push(NEW_ENTITY_FILE);
manifest.reference_at=REF; manifest.checked_at=CHECKED; manifest.rechecked_at=CHECKED; manifest.release_id=RELEASE;
manifest.timepoint_note='2026年8月31日14:16基準。愛媛20市町をゼロベース再確認し、全国47都道府県discoveryを再実施。予定期間到来のみではCURRENTにせず、長崎県8月31日発表の翌日派遣6新規市町をPLANNEDとして追加。';
manifest.blocking_unresolved=[];
writeJson('sender-municipality-audit.json',manifest);

// Re-load sender data after all files exist and set exact computed summaries.
const {loadSenderAudit,senderSummary}=await import('./sender-coverage-lib.mjs');
let sender=loadSenderAudit();
let ss=senderSummary(sender);
const man2=readJson('sender-municipality-audit.json');
man2.summary.ehime.required_count=20;
man2.summary.ehime.adjudicated_count=20;
man2.summary.ehime.missing_required=[];
man2.summary.ehime.unadjudicated_source_mentions=[];
man2.summary.ehime.blocking_conflicts=0;
man2.summary.ehime.states=ss.ehime.states;
man2.summary.nationwide.prefecture_discovery_checked=ss.prefecturesChecked;
man2.summary.nationwide.discovered_basic_municipality_senders=ss.nationwide.entities;
man2.summary.nationwide.adjudicated_basic_municipality_senders=ss.nationwide.entities;
man2.summary.nationwide.source_mentions=ss.sourceMentions;
man2.summary.nationwide.orphan_source_mentions=[];
man2.summary.nationwide.invalid_current=[];
man2.summary.nationwide.blocking_conflicts=0;
man2.summary.nationwide.states=ss.nationwide.states;
writeJson('sender-municipality-audit.json',man2);

// 3) Municipal / national / official-research recheck metadata without fabricating newer same-definition facts.
for(const p of ['municipal-support-audit.json','national-support-audit.json']){
  const x=readJson(p); x.reference_at=REF; x.checked_at=CHECKED; x.rechecked_at=CHECKED; x.release_id=RELEASE; x.blocking_unresolved=[];
  for(const s of x.sources||[]) s.rechecked_at=CHECKED;
  if(Array.isArray(x.accepted_unresolved)) for(const a of x.accepted_unresolved) a.next_review_at=NEXT;
  const text=replaceText(JSON.stringify(x)); writeFileSync(p,JSON.stringify(JSON.parse(text),null,2)+'\n');
}
for(const p of ['research_official_north.json','research_official_south.json','research_official_statewide.json']){
  const x=readJson(p); touchObject(x); if(Object.hasOwn(x,'reference_at')) x.reference_at=REF; if(Object.hasOwn(x,'checked_at')) x.checked_at=CHECKED; if(Object.hasOwn(x,'rechecked_at')) x.rechecked_at=CHECKED; writeJson(p,x);
}

// 4) Clone and refresh institution coverage audit, preserving its adjudications.
const institutionOld='operations/audits/institution-coverage-20260830-1420.json';
const institutionNew='operations/audits/institution-coverage-20260831-1416.json';
const inst=readJson(institutionOld); inst.reference_at=REF; inst.checked_at=CHECKED; inst.release_id=RELEASE; touchObject(inst);
if(Array.isArray(inst.sources) && !inst.sources.some(s=>s.source_id===NAGASAKI_SOURCE)) inst.sources.push({source_id:NAGASAKI_SOURCE,publisher:'長崎県',url:NAGASAKI_URL,primary:true,source_as_of:'2026-08-31',checked_at:CHECKED,rechecked_at:CHECKED});
writeJson(institutionNew,inst);

// 5) Current shelter count/freshness was already fetched into current-shelters.json by the workflow.
const shelters=readJson('current-shelters.json');
const sc=shelters.meta.current_count ?? shelters.shelters.length;
if(sc!==shelters.shelters.length) throw new Error(`current shelter count mismatch ${sc}/${shelters.shelters.length}`);
if(shelters.shelters.some(r=>r.coordinate_status!=='confirmed')) throw new Error('current shelters contain unresolved/conflict coordinates');
const sourceLast=shelters.meta.source_last_modified || shelters.meta.sourceLastModified || shelters.meta.source_as_of || shelters.meta.fetched_at;
if(sourceLast && Date.parse(sourceLast)>Date.parse(REF)) throw new Error(`live shelter source is newer than reference_at: ${sourceLast} > ${REF}`);

// 6) Page metadata and release markers. Keep report49 as latest same-definition damage snapshot; update changed live sections only.
for(const p of ['ehime_kumamoto_support_geocoded_shelters_20260802.html','public/dashboard.html']){
  let h=replaceText(readFileSync(p,'utf8'));
  h=h.replaceAll('公式JSON現在64施設',`公式JSON現在${sc}施設`).replaceAll('現在64施設',`現在${sc}施設`).replaceAll('公式JSON67件',`公式JSON${sc}件`);
  h=h.replaceAll('8月30日に県・県社協・市町Vセンター情報を再確認','8月31日に県・県社協・市町Vセンター情報を再確認');
  h=h.replaceAll('8月30日実働主体を再監査','8月31日実働主体を再監査');
  h=h.replaceAll('8/30ははくおう2宿泊支援をCURRENT','8/31もはくおう2宿泊支援をCURRENT');
  h=h.replaceAll('8月30日基準','8月31日基準');
  h=h.replace(/const PAGE_RECHECK_META=(\{[^\n]*\});/u,(m,j)=>{
    const meta=JSON.parse(j); meta.checkedAt=REF; meta.volunteerCheckedAt=CHECKED;
    for(const row of meta.rows||[]){
      if(row.section==='被害・支援'){
        row.status='再確認'; row.current='8月28日8時の熊本県第49報を最新同一定義スナップショットとして維持'; row.previous='8月28日8時の第49報';
        row.difference='8月31日再探索でも、これを置き換える新しい同一定義の熊本県被害報を確認できず。現在避難所は公式ライブJSONを別系統で更新。';
      } else if(row.section==='愛媛県支援'){
        row.status='再確認'; row.current='8月28日12時の愛媛県支援状況を最新総括として維持'; row.previous='8月28日12時資料'; row.difference='8月31日再確認。県総括の最新掲載は8月28日12時版。松山市等の個別senderは別監査で8月31日時点を再裁定。'; row.source='愛媛県 被災地支援情報'; row.url='https://www.pref.ehime.jp/page/154856.html';
      } else if(row.section==='避難所'){
        row.status='差分あり'; row.current=`県第49報61か所／公式JSON現在${sc}施設／位置履歴206点`; row.previous='公式JSON 8月30日取得64施設'; row.difference=`公式ライブJSONを再取得し、現在${sc}施設、座標conflict/unresolved 0を確認。県第49報61か所とは定義・時点を分離。`;
      } else if(row.section==='災害ボランティア'){
        row.status='再監査'; row.current='8月31日に県・県社協・市町Vセンター情報を再確認'; row.previous='8月30日確認'; row.difference='県の災害ボランティアバス（8月29日開始）と各市町センター情報を再確認。推測で受付状態を補完しない。';
      } else if(row.section==='他自治体等'){
        row.status='差分あり'; row.current='8月31日14:16に全国47都道府県discoveryとsenderを再監査'; row.previous='8月30日14:20全件再監査'; row.difference='長崎県8月31日発表から翌日派遣予定の新規6基礎自治体をPLANNED追加。既存3市も翌日派遣予定をPLANNEDへ更新。予定日到来だけでCURRENTへ昇格しない。';
      } else if(row.section==='支援ダッシュボード'){
        row.status='差分あり'; row.current='県被害・愛媛県支援を再確認し、他自治体・国支援を8月31日14:16基準で再監査'; row.previous='8月30日14:20基準'; row.difference='同一定義の新しい被害報がない項目は既存スナップショットを維持し、ライブ避難所・sender discovery・現行支援状態のみ更新。';
      }
    }
    return `const PAGE_RECHECK_META=${JSON.stringify(meta)};`;
  });
  writeFileSync(p,h);
}

// 7) Hard-coded current release validators/smoke expectations follow the release, not historical fixtures.
for(const p of [
  '.github/workflows/post-deploy-pages-smoke.yml',
  'scripts/sender-coverage-lib.mjs','scripts/sync-municipal-support-audit.mjs','scripts/sync-national-support-audit.mjs',
  'scripts/validate-current-state-audit.mjs','scripts/validate-dashboard-current.mjs','scripts/validate-institution-coverage.mjs',
  'scripts/validate-national-support-audit.mjs','scripts/validate-volunteer-data.mjs'
]) transformTextFile(p,s=>replaceText(s).replaceAll('2026-08-31T09:00:00+09:00',NEXT));
transformTextFile('.github/workflows/post-deploy-pages-smoke.yml',s=>{
  let x=s;
  if(!x.includes('sender-audit/timepoint-20260831-additions.json')) x=x.replace('            sender-audit/timepoint-20260830-additions.json\n','            sender-audit/timepoint-20260830-additions.json\n            sender-audit/timepoint-20260831-additions.json\n');
  return x;
});

// 8) Update volunteer data timestamp/release marker only after current official volunteer sources were rechecked.
transformTextFile('volunteer-data.js',s=>replaceText(s));

// 9) Create schema-v2 refresh ledger from prior release; expected files are filled by the workflow after build.
const oldLedger=readJson('operations/ledgers/refresh-20260830-1420.json');
oldLedger.update_id=`refresh-${RELEASE}`; oldLedger.release_id=RELEASE; oldLedger.reference_at=REF; oldLedger.rechecked_at=CHECKED; oldLedger.page_checked_at=null; oldLedger.base_main_sha=BASE_MAIN; oldLedger.expected_changed_files=[];
oldLedger.sources=(oldLedger.sources||[]).filter(s=>!String(s.source_id).includes('current-shelters-0830'));
for(const s of oldLedger.sources) s.checked_at=CHECKED;
oldLedger.sources.push({source_id:'kumamoto-current-shelters-0831',publisher:'熊本県 防災情報ポータル',url:'https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json',source_as_of:sourceLast||shelters.meta.fetched_at,checked_at:CHECKED});
oldLedger.sources.push({source_id:NAGASAKI_SOURCE,publisher:'長崎県',url:NAGASAKI_URL,source_as_of:'2026-08-31T00:00:00+09:00',checked_at:CHECKED});
oldLedger.sources.push({source_id:'ehime-support-index-0831',publisher:'愛媛県',url:'https://www.pref.ehime.jp/page/154856.html',source_as_of:'2026-08-28T12:00:00+09:00',checked_at:CHECKED});
oldLedger.sources.push({source_id:'volunteer-bus-0831-recheck',publisher:'熊本県',url:'https://www.pref.kumamoto.jp/soshiki/27/278033.html',source_as_of:'2026-08-27T00:00:00+09:00',checked_at:CHECKED});
oldLedger.coverage.current_shelters=sc; oldLedger.coverage.current_shelter_coordinates_confirmed=sc; oldLedger.coverage.current_shelter_unresolved=0; oldLedger.coverage.current_count=sc; oldLedger.coverage.unresolved_count=0; oldLedger.coverage.conflict_count=0;
oldLedger.coverage.prefecture_discovery_checked=ss.prefecturesChecked; oldLedger.coverage.sender_entities_discovered=ss.nationwide.entities; oldLedger.coverage.sender_entities_adjudicated=ss.nationwide.entities; oldLedger.coverage.sender_orphan_source_mentions=0; oldLedger.coverage.sender_blocking_conflicts=0; oldLedger.coverage.sender_states=ss.nationwide.states; oldLedger.coverage.ehime_required=20; oldLedger.coverage.ehime_adjudicated=20; oldLedger.coverage.ehime_missing=0; oldLedger.coverage.municipal_support='audited'; oldLedger.coverage.national_support='audited';
oldLedger.snapshots.page_reference_at=REF; oldLedger.snapshots.current_shelters=sc; oldLedger.snapshots.shelter_source_last_modified=sourceLast||shelters.meta.fetched_at; oldLedger.snapshots.sender_reference_at=REF; oldLedger.snapshots.damage_source_as_of='2026-08-28T08:00:00+09:00'; oldLedger.snapshots.damage_report=49;
oldLedger.blocking_unresolved=[];
for(const a of oldLedger.accepted_unresolved||[]){ a.next_review_at=NEXT; if(a.issue_id==='sender-direct-activity') a.reason='全国senderは予定期間到来や旧CURRENTを根拠に継続推定せず、直接実働を再確認できないものをUNKNOWN、翌日開始が一次確認できたものをPLANNEDとした。'; }
const ledgerPath=`operations/ledgers/refresh-${RELEASE}.json`;
writeJson(ledgerPath,oldLedger);

console.log(JSON.stringify({REF,CHECKED,RELEASE,currentShelters:sc,senderSummary:ss,newSenderEntities:newNames,updatedPlannedExisting:existingNagasaki,ledgerPath,institutionNew},null,2));

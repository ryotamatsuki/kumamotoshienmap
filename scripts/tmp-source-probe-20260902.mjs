import { readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const REF='2026-09-02T16:16:00+09:00';
const CHECK='2026-09-02T16:35:00+09:00';
const NEXT='2026-09-03T09:00:00+09:00';
const RID='20260902-1616';
const BASE='62e4c9c805ba0c2333d44b10706b0cf30d59041e';
const LEDGER='operations/ledgers/refresh-20260902-1616.json';
const COVERAGE='operations/audits/institution-coverage-20260902-1616.json';
const OLD_COVERAGE='operations/audits/institution-coverage-20260901-1504.json';
const TMP=['scripts/tmp-source-probe-20260902.mjs','.github/workflows/tmp-refresh-probe-20260902.yml'];
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const save=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n','utf8');
const uniq=a=>[...new Set(a)];

function stamp(value){
  if(Array.isArray(value)){value.forEach(stamp);return value;}
  if(!value||typeof value!=='object')return value;
  for(const [k,v] of Object.entries(value)){
    if(k==='reference_at') value[k]=REF;
    else if(['checked_at','rechecked_at','latest_checked_at','portal_coverage_checked_at'].includes(k)) value[k]=CHECK;
    else if(k==='next_review_at' && typeof v==='string') value[k]=NEXT;
    else stamp(v);
  }
  return value;
}
function replaceAuditText(value){
  if(Array.isArray(value)) return value.map(replaceAuditText);
  if(value&&typeof value==='object'){for(const k of Object.keys(value)) value[k]=replaceAuditText(value[k]); return value;}
  if(typeof value!=='string') return value;
  return value
    .replaceAll('9月1日15:04','9月2日16:16')
    .replaceAll('2026年9月1日15:04','2026年9月2日16:16')
    .replaceAll('2026年9月1日15:12','2026年9月2日16:35')
    .replaceAll('9月1日15:12','9月2日16:35');
}
function upsertSource(a,s){const i=a.sources.findIndex(x=>x.source_id===s.source_id);if(i>=0)a.sources[i]={...a.sources[i],...s};else a.sources.push(s);}
function record(a,id){const r=a.records.find(x=>x.record_id===id);if(!r)throw new Error('missing national record '+id);return r;}
function stateSummary(a){for(const s of ['CURRENT','HISTORICAL','PLANNED','UNKNOWN','CONFLICT'])a.summary[s]=a.records.filter(r=>r.state===s).length;a.summary.accepted_unresolved_count=a.accepted_unresolved.length;a.summary.blocking_unresolved_count=a.blocking_unresolved.length;}

// 1) Recipient/municipal support: complete recheck at the new reference time, no unsupported state promotion.
{
  const a=replaceAuditText(stamp(await json('municipal-support-audit.json')));
  a.reference_at=REF;a.checked_at=CHECK;a.rechecked_at=CHECK;a.release_id=RID;
  for(const s of a.sources||[]){s.checked_at=CHECK;s.rechecked_at=CHECK;}
  await save('municipal-support-audit.json',a);
}

// 2) National/institution support: incorporate semantic changes confirmed by primary sources.
{
  const a=replaceAuditText(stamp(await json('national-support-audit.json')));
  a.reference_at=REF;a.checked_at=CHECK;a.rechecked_at=CHECK;a.release_id=RID;
  upsertSource(a,{source_id:'kumamoto-damage51-0902',publisher:'熊本県',name:'令和8年熊本地震に係る被害情報 第51報',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html',primary:true,source_as_of:'2026-09-02T14:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK,notes:'第51報：人的被害404人、住家被害61,996棟、避難所38か所、避難者2,035人。'});
  upsertSource(a,{source_id:'jwa-purifier-complete-0828',publisher:'独立行政法人水資源機構',name:'令和8年熊本地震被災地への給水支援活動',url:'https://www.water.go.jp/honsya/honsya/bousai/r807kumamotojishin/index.html',primary:true,source_as_of:'2026-08-28T00:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK,notes:'氷川町の可搬式浄水装置による給水支援は8月28日に完了。'});
  upsertSource(a,{source_id:'saiki-water-ended-0901',publisher:'佐伯市',name:'令和8年熊本地震に伴う給水車派遣について',url:'https://www.city.saiki.oita.jp/kiji00311824/index.html',primary:true,source_as_of:'2026-09-01T23:59:00+09:00',checked_at:CHECK,rechecked_at:CHECK,notes:'第11班（8/29～9/1）をもって一次派遣終了。'});

  const water=record(a,'national-water');
  for(const ad of water.adjudications||[]){if((ad.source_ids||[]).includes('saiki-water-0825')&&ad.state==='CURRENT'){ad.state='HISTORICAL';ad.notes='佐伯市は第11班（8月29日～9月1日）をもって給水車の一次派遣を終了。基準時点CURRENT根拠には用いない。';ad.source_ids=uniq([...(ad.source_ids||[]),'saiki-water-ended-0901']);}}
  water.adjudications.push({state:'HISTORICAL',scope:'佐伯市給水車派遣',source_as_of:'2026-09-01T23:59:00+09:00',source_ids:['saiki-water-ended-0901'],notes:'佐伯市公式が9月1日で一次派遣終了を明示。'});
  water.source_ids=uniq([...water.source_ids,'saiki-water-ended-0901']);
  water.display.detail='国土交通省は8月31日17時現在の第51報を最新インフラ履歴として公開。佐伯市の給水車派遣は9月1日で一次派遣終了を確認。基準時点の同一定義全国応急給水体制は直接確定できないためUNKNOWNを維持。';
  water.display.asOf='一次情報を2026年9月2日16:35再確認';

  const purifier=record(a,'national-purifier');
  for(const ad of purifier.adjudications||[]){if(ad.state==='CURRENT'){ad.state='HISTORICAL';ad.source_ids=uniq([...(ad.source_ids||[]),'jwa-purifier-complete-0828']);ad.notes='水資源機構公式で8月22日稼働停止、8月28日氷川町内の給水支援完了を確認。';}}
  purifier.adjudications.push({state:'HISTORICAL',scope:'氷川町竜翔センター可搬式浄水装置',source_as_of:'2026-08-28T00:00:00+09:00',source_ids:['jwa-purifier-complete-0828'],notes:'8月28日に氷川町内での給水支援を完了し、装置を久留米市内へ移動。'});
  purifier.state='HISTORICAL';purifier.source_ids=uniq([...purifier.source_ids,'jwa-purifier-complete-0828']);
  purifier.display={status:'HISTORICAL',scale:'可搬式浄水装置：8月28日支援完了',period:'8月4日～8月28日',detail:'水資源機構は8月22日に装置稼働を停止し、8月28日に氷川町内での給水支援を完了。現在支援としては表示しない。',asOf:'2026年9月2日16:35再確認',sourceLabel:'水資源機構 令和8年熊本地震被災地への給水支援活動',sourceUrl:'https://www.water.go.jp/honsya/honsya/bousai/r807kumamotojishin/index.html'};

  const h=record(a,'national-accommodation-hakuo2');
  for(const ad of h.adjudications||[]){if(ad.state==='CURRENT'){ad.state='HISTORICAL';ad.notes=(ad.notes||ad.note||'')+' 9月2日16:16基準では当該実施・予約期間は終了済み。';delete ad.note;}}
  if(!(h.adjudications||[]).some(ad=>ad.scope==='9月3日宿泊支援'))h.adjudications.push({state:'PLANNED',scope:'9月3日宿泊支援',source_as_of:'2026-09-01T09:00:00+09:00',source_ids:['mod-hakuo2-0901-reservation','kumamoto-hakuo2-0831'],notes:'予約受付は9月2日12時で終了。宿泊は9月3日13時開始予定のため、基準時点ではPLANNED。'});
  h.state='PLANNED';
  h.display={status:'PLANNED',scale:'9/3宿泊支援（開始前）',period:'予約 9月1日09:00～9月2日12:00（終了）／宿泊 9月3日13:00～9月5日10:00',detail:'予約受付は9月2日正午で終了。基準時点では宿泊開始前のためPLANNEDとして表示し、予定時刻経過だけでCURRENTにしない。',asOf:'2026年9月2日16:16基準',sourceLabel:'熊本県・防衛省',sourceUrl:'https://www.pref.kumamoto.jp/soshiki/219/276703.html'};

  for(const r of a.records){
    if(r.state==='UNKNOWN'){
      r.display.status='UNKNOWN';
      r.display.scale=String(r.display.scale).replace(/UNKNOWN（[^）]*基準の/u,'UNKNOWN（9月2日16:16基準の');
      r.display.period='2026年9月2日16:16基準';
      if(String(r.display.asOf||'').includes('再確認'))r.display.asOf='一次情報を2026年9月2日16:35再確認';
    }
  }
  for(const issue of a.accepted_unresolved||[]){issue.next_review_at=NEXT;if(issue.issue_id==='national-accommodation-hakuo2-start'){issue.state='PLANNED';issue.reason='9月3日13時の宿泊開始前。予約受付は9月2日12時で終了済みで、予定時刻到来前はPLANNED。';issue.source_ids=['mod-hakuo2-0901-reservation','kumamoto-hakuo2-0831'];issue.next_review_at='2026-09-03T14:00:00+09:00';}}
  stateSummary(a);
  await save('national-support-audit.json',a);
}

// 3) Volunteer research: recheck all existing primary URLs and add the 9/2 official activity snapshot.
for(const p of ['research_official_north.json','research_official_south.json','research_official_statewide.json']){
  const a=stamp(await json(p));
  if(a.reference_at)a.reference_at=REF;if(a.checked_at)a.checked_at=CHECK;if(a.rechecked_at)a.rechecked_at=CHECK;
  if(p.endsWith('statewide.json')){
    const u='https://www.fukushi-kumamoto.or.jp/files/libs/8662/202609021133091423.pdf';
    if(!a.sources.some(s=>s.url===u))a.sources.push({publisher:'熊本県社会福祉協議会',title:'令和8年熊本地震 災害ボランティアセンター活動実績一覧（R8.9月）',url:u,published_at:'2026-09-02',updated_at:'2026-09-02',checked_at:CHECK,rechecked_at:CHECK,facts_used:'9月2日速報：11市町VC合計で参加108人、新規依頼60件、活動24件、完了24件。'});
    a.statewide_facts.activity_snapshot={source_as_of:'2026-09-02',participants:108,new_requests:60,activities:24,completed:24,municipal_centers:11,source_url:u};
    a.additional_official_observations.push({subject:'9月2日活動実績',state:'CURRENT',observation:'熊本県社会福祉協議会の9月2日速報で、11市町の災害VC合計として参加108人、新規依頼60件、活動24件、完了24件を確認。募集可否とは別の活動実績として扱う。',url:u,checked_at:CHECK});
  }
  await save(p,a);
}

// 4) Sender audit: full 47-prefecture / all discovered-sender recheck. No schedule-only promotions.
{
  const names=(await readdir('sender-audit')).filter(n=>n.endsWith('.json'));
  for(const n of names){const p='sender-audit/'+n;const a=stamp(await json(p));if(a.reference_at)a.reference_at=REF;if(a.checked_at)a.checked_at=CHECK;if(a.rechecked_at)a.rechecked_at=CHECK;await save(p,a);}
  const m=stamp(await json('sender-municipality-audit.json'));m.reference_at=REF;m.checked_at=CHECK;m.base_main_sha=BASE;await save('sender-municipality-audit.json',m);
}

// 5) Institution coverage: preserve the closed universe, but record a new audit artifact and timestamps.
{
  const a=stamp(await json(OLD_COVERAGE));a.reference_at=REF;a.checked_at=CHECK;a.release_id=RID;a.operation_version='2.6';
  await save(COVERAGE,a);
}

// 6) Update build/sync validators and display generators for the new reference/report.
async function patch(p,fn){let t=await readFile(p,'utf8');const n=fn(t);if(n===t)console.log('WARN no textual change',p);await writeFile(p,n,'utf8');}
const common=t=>t.replaceAll('2026-09-01T15:04:00+09:00',REF).replaceAll('2026-09-01T15:12:00+09:00',CHECK).replaceAll('9月1日15:04','9月2日16:16').replaceAll('9月1日15:12','9月2日16:35');
await patch('scripts/sender-coverage-lib.mjs',t=>t.replace('const NEXT_REVIEW_AT = "2026-09-02T09:00:00+09:00";','const NEXT_REVIEW_AT = "2026-09-03T09:00:00+09:00";'));
await patch('scripts/validate-volunteer-data.mjs',t=>t.replace('data.meta.reference_at.startsWith("2026-09-01")','data.meta.reference_at.startsWith("2026-09-02")').replace('ボランティア情報の基準日が2026-09-01ではありません','ボランティア情報の基準日が2026-09-02ではありません'));
await patch('scripts/validate-institution-coverage.mjs',t=>t.replace('institution-coverage-20260901-1504.json','institution-coverage-20260902-1616.json'));
await patch('scripts/validate-national-support-audit.mjs',t=>common(t).replace("if(!html.includes('9月2日16:16基準で全件再監査'))fail('actor not updated');","if(!html.includes('9月2日16:16基準で全件再監査'))fail('actor not updated');"));
await patch('scripts/validate-current-state-audit.mjs',t=>common(t)
  .replaceAll('熊本県第49報','熊本県第51報')
  .replace('避難者2,442人、開設避難所61か所、人的被害402人、住家被害43,292棟。','避難者2,035人、開設避難所38か所、人的被害404人、住家被害61,996棟。')
  .replace('for (const value of ["D+33",','for (const value of ["D+36",'));
await patch('scripts/validate-dashboard-current.mjs',t=>common(t)
  .replace('operations/audits/institution-coverage-20260901-1504.json','operations/audits/institution-coverage-20260902-1616.json')
  .replace('"2.5"','"2.6"')
  .replace('経過日 D+33（県第49報：8月28日8時）','経過日 D+36（県第51報：9月2日14時）')
  .replace('2,442<span class=\\"overview-kpi-unit\\">人','2,035<span class=\\"overview-kpi-unit\\">人')
  .replace('64<span class=\\"overview-kpi-unit\\">か所','40<span class=\\"overview-kpi-unit\\">か所')
  .replace('402<span class=\\"overview-kpi-unit\\">人','404<span class=\\"overview-kpi-unit\\">人')
  .replace('43,292<span class=\\"overview-kpi-unit\\">棟','61,996<span class=\\"overview-kpi-unit\\">棟')
  .replace('国交省第51報（8/31 17:00）を最新インフラ履歴として確認。はくおうIIは9/3宿泊分の予約受付をCURRENT、宿泊実施はPLANNED','国交省第51報（8/31 17:00）を最新インフラ履歴として確認。はくおうIIは予約受付終了、9/3宿泊実施はPLANNED')
  .replace('24市町の人的被害表内合計396人。県第49報の人的被害合計は402人','24市町の人的被害表内合計396人。県第51報の人的被害合計は404人')
  .replace('住家被害の市町別旧スナップショット38,498棟と県第49報43,292棟','住家被害の市町別旧スナップショット38,498棟と県第51報61,996棟')
  .replace('includes("43,292棟")','includes("61,996棟")')
  .replace('"2026-08-28", "主要公表値','"2026-09-02", "主要公表値'));

await patch('scripts/sync-national-support-audit.mjs',t=>common(t)
  .replace('9月1日15:04基準で全件再監査（15件を全件再監査）','9月2日16:16基準で全件再監査（15件を全件再監査）')
  .replace('国交省第51報（8/31 17:00）を最新インフラ履歴として確認。はくおうIIは9/3宿泊分の予約受付をCURRENT、宿泊実施はPLANNED','国交省第51報（8/31 17:00）を最新インフラ履歴として確認。はくおうIIは予約受付終了、9/3宿泊実施はPLANNED')
  .replace('9月1日閣議の非常災害復旧復興本部設置を確認し、9月1日実働主体を再監査','9月1日設置の非常災害復旧復興本部を確認し、9月2日実働主体を再監査')
  .replace('2026-08-28","dateLabel":"8月28日","weekday":"金","time":"08:00"','2026-09-02","dateLabel":"9月2日","weekday":"水","time":"14:00"')
  .replaceAll('熊本県第49報','熊本県第51報')
  .replace('避難者2,442人、開設避難所61か所、人的被害402人、住家被害43,292棟。','避難者2,035人、開設避難所38か所、人的被害404人、住家被害61,996棟。')
  .replaceAll('43,292棟','61,996棟')
  .replaceAll('8月28日8時','9月2日14時')
  .replaceAll('currentStateOverlay:\'2026-08-26-report45\'','currentStateOverlay:\'2026-09-02-report51\''));
await patch('scripts/sync-municipal-support-audit.mjs',t=>common(t));

// Static initial render: update the user-visible current snapshot; historical raw tables remain labelled as history.
for(const p of ['ehime_kumamoto_support_geocoded_shelters_20260802.html','public/dashboard.html']){
  await patch(p,t=>common(t)
    .replace('経過日 D+33（県第49報：8月28日8時）','経過日 D+36（県第51報：9月2日14時）')
    .replace('<strong>D+25</strong>','<strong>D+36</strong>')
    .replace('主要数値：8月24日8:00','主要数値：9月2日14:00')
    .replace('2,442<span class="overview-kpi-unit">人','2,035<span class="overview-kpi-unit">人')
    .replace('64<span class="overview-kpi-unit">か所','40<span class="overview-kpi-unit">か所')
    .replace('402<span class="overview-kpi-unit">人','404<span class="overview-kpi-unit">人')
    .replace('43,292<span class="overview-kpi-unit">棟','61,996<span class="overview-kpi-unit">棟')
    .replaceAll('県第49報43,292棟','県第51報61,996棟')
    .replaceAll('県第49報の人的被害合計は402人','県第51報の人的被害合計は404人'));
}

// Post-deploy gate assertions for the new release.
await patch('.github/workflows/post-deploy-pages-smoke.yml',t=>common(t)
  .replace('国交省第51報（8/31 17:00）を最新インフラ履歴として確認。はくおうIIは9/3宿泊分の予約受付をCURRENT、宿泊実施はPLANNED','国交省第51報（8/31 17:00）を最新インフラ履歴として確認。はくおうIIは予約受付終了、9/3宿泊実施はPLANNED')
  .replace('9月1日閣議の非常災害復旧復興本部設置を確認し、9月1日実働主体を再監査','9月1日設置の非常災害復旧復興本部を確認し、9月2日実働主体を再監査')
  .replace("grep -F '9/3宿泊分 予約受付中' /tmp/deployed-dashboard.html","grep -F '9/3宿泊支援（開始前）' /tmp/deployed-dashboard.html")
  .replace('2026-09-01T14:56:29+09:00','2026-09-02T15:42:44+09:00'));

// 7) Build a v2 pre-merge ledger from the actual net diff, excluding temporary files and including this ledger itself.
const old=await json('operations/ledgers/refresh-20260901-1504.json');
let changed=execFileSync('git',['-c','core.quotePath=false','diff','--name-only',BASE],{encoding:'utf8'}).trim().split(/\r?\n/u).filter(Boolean).filter(p=>!TMP.includes(p));
changed=uniq([...changed,LEDGER]).sort();
const ledger={...old,gate_phase:'pre_merge',update_id:'refresh-'+RID,release_id:RID,reference_at:REF,rechecked_at:CHECK,page_checked_at:null,base_main_sha:BASE,expected_changed_files:changed};
ledger.sources=[
  {source_id:'kumamoto-damage51-0902',publisher:'熊本県',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html',source_as_of:'2026-09-02T14:00:00+09:00',checked_at:CHECK},
  {source_id:'kumamoto-current-shelters-0902',publisher:'熊本県 防災情報ポータル',url:'https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json',source_as_of:'2026-09-02T15:42:44+09:00',checked_at:CHECK},
  {source_id:'kumamoto-volunteer-activity-0902',publisher:'熊本県社会福祉協議会',url:'https://www.fukushi-kumamoto.or.jp/files/libs/8662/202609021133091423.pdf',source_as_of:'2026-09-02',checked_at:CHECK},
  {source_id:'jwa-purifier-complete-0828',publisher:'水資源機構',url:'https://www.water.go.jp/honsya/honsya/bousai/r807kumamotojishin/index.html',source_as_of:'2026-08-28',checked_at:CHECK},
  {source_id:'saiki-water-ended-0901',publisher:'佐伯市',url:'https://www.city.saiki.oita.jp/kiji00311824/index.html',source_as_of:'2026-09-01',checked_at:CHECK},
  {source_id:'mlit-report51-0831',publisher:'国土交通省',url:'https://www.mlit.go.jp/saigai/saigai_260728.html',source_as_of:'2026-08-31T17:00:00+09:00',checked_at:CHECK},
  {source_id:'mod-hakuo2-0901-reservation',publisher:'防衛省・自衛隊',url:'https://www.mod.go.jp/j/approach/defense/saigai/index.html',source_as_of:'2026-09-01T09:00:00+09:00',checked_at:CHECK},
  {source_id:'nagasaki-wave-0831',publisher:'長崎県',url:'https://www.pref.nagasaki.jp/press-contents/52044.html',source_as_of:'2026-08-31',checked_at:CHECK},
  {source_id:'takeo-volunteer-0831',publisher:'武雄市',url:'https://www.city.takeo.lg.jp/information/2026/08/015981.html',source_as_of:'2026-08-31',checked_at:CHECK},
  {source_id:'wakayama-shingu-0828',publisher:'新宮市',url:'https://www.city.shingu.lg.jp/info/3055',source_as_of:'2026-08-28',checked_at:CHECK}
];
ledger.coverage={...old.coverage,recipient_municipalities:45,institution_missing:0,institution_orphan_source_mentions:0,current_shelters:40,current_shelter_coordinates_confirmed:40,current_shelter_unresolved:0,ehime_required:20,ehime_adjudicated:20,ehime_missing:0,prefecture_discovery_checked:47,sender_entities_discovered:316,sender_entities_adjudicated:316,sender_orphan_source_mentions:0,sender_blocking_conflicts:0,sender_states:{CURRENT:12,PLANNED:15,HISTORICAL:17,UNKNOWN:272,NO_EVIDENCE:0,CONFLICT:0},municipal_support:'audited',national_support:'audited',current_count:40,unresolved_count:0,conflict_count:0};
ledger.snapshots={page_reference_at:REF,damage_source_as_of:'2026-09-02T14:00:00+09:00',damage_report:51,current_shelters:40,shelter_source_last_modified:'2026-09-02T15:42:44+09:00',sender_reference_at:REF,volunteer_activity_0902:{participants:108,new_requests:60,activities:24,completed:24}};
ledger.blocking_unresolved=[];
ledger.accepted_unresolved=[
 {issue_id:'national-same-definition-continuity',state:'UNKNOWN',reason:'国・関係機関の一部は9月2日16:16基準の同一定義実働を直接確認できず、過去値をCURRENTへ流用しない。',owner:'timepoint-audit',source_ids:['mlit-report51-0831'],next_review_at:NEXT},
 {issue_id:'sender-direct-activity',state:'PLANNED',reason:'予定期間到来や募集開始だけでは実派遣・実活動をCURRENTと推定せず、直接実働を確認できないsenderはPLANNEDとして保持する。',owner:'sender-audit',source_ids:['nagasaki-wave-0831','takeo-volunteer-0831'],next_review_at:NEXT}
];
await save(LEDGER,ledger);
console.log(JSON.stringify({status:'APPLIED',reference_at:REF,checked_at:CHECK,ledger:LEDGER,changed_files:changed.length}));

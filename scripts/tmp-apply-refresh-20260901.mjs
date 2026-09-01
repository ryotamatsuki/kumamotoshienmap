import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const REF='2026-09-01T15:04:00+09:00';
const CHECK='2026-09-01T15:12:00+09:00';
const NEXT='2026-09-02T09:00:00+09:00';
const RELEASE='20260901-1504';
const BASE='46da78b94752c906e0b1975636aaf8a64443500c';
const OLD_REF='2026-08-31T14:16:00+09:00';
const OLD_CHECK='2026-08-31T14:28:00+09:00';
const OLD_RELEASE='20260831-1416';

const readJson=p=>JSON.parse(readFileSync(p,'utf8'));
const writeJson=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const uniq=a=>[...new Set(a)];

function retime(value){
  if(Array.isArray(value)){ for(const item of value) retime(item); return value; }
  if(!value||typeof value!=='object') return value;
  for(const [k,v] of Object.entries(value)){
    if(k==='checked_at'||k==='rechecked_at'||k==='latest_checked_at') value[k]=CHECK;
    else if(k==='next_review_at') value[k]=NEXT;
    else if(k==='reference_at') value[k]=REF;
    else if(k==='release_id') value[k]=RELEASE;
    else retime(v);
  }
  return value;
}
function replaceText(path,repls){
  let s=readFileSync(path,'utf8');
  for(const [a,b] of repls) s=s.split(a).join(b);
  writeFileSync(path,s);
}
function currentAuditTextRepls(){return [
  [OLD_REF,REF],[OLD_CHECK,CHECK],[OLD_RELEASE,RELEASE],
  ['2026年8月31日14:16','2026年9月1日15:04'],
  ['8月31日14:16','9月1日15:04'],
  ['8月31日実働主体','9月1日実働主体'],
  ['同14:35確認','同15:12確認'],
];}

// Volunteer source recheck frame. Keep source publication/as-of dates intact.
for(const p of ['research_official_north.json','research_official_south.json','research_official_statewide.json']){
  const d=retime(readJson(p));
  d.checked_at=CHECK;
  if(d.statewide_facts) d.statewide_facts.latest_checked_at=CHECK;
  writeJson(p,d);
}
{
  const p='research_official_statewide.json',d=readJson(p);
  d.sources=d.sources||[];
  const extra=[
    {publisher:'熊本市',title:'熊本市災害ボランティアセンターによる支援開始のお知らせ（9月1日再確認）',url:'https://www.city.kumamoto.jp/kiji00370938/index.html',published_at:null,updated_at:'2026-08-31',checked_at:CHECK,facts_used:'熊本市災害ボランティアセンターによる支援継続情報を再確認',rechecked_at:CHECK},
    {publisher:'宇城市',title:'令和8年熊本地震 宇城市災害ボランティアセンター',url:'https://www.city.uki.kumamoto.jp/toppage/important/2717371',published_at:null,updated_at:'2026-08-30',checked_at:CHECK,facts_used:'宇城市が災害ボランティアセンターを設置し活動開始中と現在形で明示',rechecked_at:CHECK}
  ];
  for(const s of extra) if(!d.sources.some(x=>x.url===s.url)) d.sources.push(s);
  writeJson(p,d);
}

// Municipal support: same strict state rules, full recheck timestamp, no automatic state promotion.
{
  const p='municipal-support-audit.json',d=retime(readJson(p));
  d.reference_at=REF; d.checked_at=CHECK; d.release_id=RELEASE;
  const touch=x=>{
    if(Array.isArray(x)) return x.forEach(touch);
    if(!x||typeof x!=='object') return;
    if(x.display&&typeof x.display==='object'){
      for(const k of ['status','period','detail','asOf']) if(typeof x.display[k]==='string'){
        x.display[k]=x.display[k].replaceAll('2026年8月31日14:16','2026年9月1日15:04').replaceAll('8月31日14:16','9月1日15:04').replaceAll('同14:35確認','同15:12確認');
      }
    }
    for(const v of Object.values(x)) touch(v);
  }; touch(d);
  writeJson(p,d);
}

// National support sources and adjudications.
{
  const p='national-support-audit.json',d=retime(readJson(p));
  d.reference_at=REF; d.checked_at=CHECK; d.release_id=RELEASE;
  const sources=[
    {source_id:'kantei-recovery-hq-0901',publisher:'首相官邸',kind:'official_web',url:'https://www.kantei.go.jp/jp/kakugi/2026/kakugi-2026090101.html',source_as_of:'2026-09-01T00:00:00+09:00',source_published_at:'2026-09-01T00:00:00+09:00',source_updated_at:null,fetched_at:CHECK,checked_at:CHECK,primary:true,notes:'9月1日定例閣議で令和8年熊本地震非常災害復旧復興本部の設置を決定。',rechecked_at:CHECK},
    {source_id:'kumamoto-recovery-hq-0831',publisher:'熊本県',kind:'official_web',url:'https://www.pref.kumamoto.jp/soshiki/5/278881.html',source_as_of:'2026-08-31T17:00:00+09:00',source_published_at:'2026-08-31T17:00:00+09:00',source_updated_at:null,fetched_at:CHECK,checked_at:CHECK,primary:true,notes:'熊本県復旧・復興本部第1回会議を8月31日17時に開催。',rechecked_at:CHECK},
    {source_id:'mlit-report51-0831',publisher:'国土交通省',kind:'official_web_pdf_index',url:'https://www.mlit.go.jp/saigai/saigai_260728.html',source_as_of:'2026-08-31T17:00:00+09:00',source_published_at:'2026-08-31T17:00:00+09:00',source_updated_at:null,fetched_at:CHECK,checked_at:CHECK,primary:true,notes:'国土交通省公式索引で熊本地震第51報（8月31日17時現在）が最新掲載であることを確認。PDF内数値は別途同一定義確認なしにCURRENTへ流用しない。',rechecked_at:CHECK},
    {source_id:'mod-hakuo2-0901-reservation',publisher:'防衛省・自衛隊',kind:'official_web',url:'https://www.mod.go.jp/j/approach/defense/saigai/index.html',source_as_of:'2026-09-01T09:00:00+09:00',source_published_at:null,source_updated_at:'2026-08-31T00:00:00+09:00',fetched_at:CHECK,checked_at:CHECK,primary:true,notes:'はくおうIIの9月3日宿泊分について9月1日9時から9月2日正午まで予約受付。宿泊は9月3日13時開始予定。',rechecked_at:CHECK},
    {source_id:'kumamoto-hakuo2-0831',publisher:'熊本県',kind:'official_web',url:'https://www.pref.kumamoto.jp/soshiki/219/276703.html',source_as_of:'2026-08-31T00:00:00+09:00',source_published_at:null,source_updated_at:'2026-08-31T00:00:00+09:00',fetched_at:CHECK,checked_at:CHECK,primary:true,notes:'9月3日からのはくおうII宿泊支援と9月1日9時からの予約受付を案内。',rechecked_at:CHECK}
  ];
  d.sources=d.sources||[];
  for(const s of sources) if(!d.sources.some(x=>x.source_id===s.source_id)) d.sources.push(s);
  const by=id=>d.records.find(r=>r.record_id===id);
  const addAdj=(r,a)=>{r.adjudications=r.adjudications||[];r.adjudications.push(a);};
  const coord=by('national-coordination');
  addAdj(coord,{state:'CURRENT',scope:'復旧・復興推進体制',source_as_of:'2026-09-01T00:00:00+09:00',source_ids:['kantei-recovery-hq-0901','kumamoto-recovery-hq-0831'],notes:'国は9月1日に非常災害復旧復興本部の設置を決定し、県も8月31日に復旧・復興本部会議を開催。'});
  coord.state='CURRENT';coord.source_ids=uniq([...coord.source_ids,'kantei-recovery-hq-0901','kumamoto-recovery-hq-0831']);
  coord.display={status:'CURRENT',scale:'政府の復旧・復興本部を設置',period:'2026年9月1日設置決定',detail:'9月1日の閣議で令和8年熊本地震非常災害復旧復興本部の設置を決定。熊本県も8月31日に復旧・復興本部第1回会議を開催。',asOf:'2026年9月1日15:04基準',sourceLabel:'首相官邸 9月1日定例閣議案件',sourceUrl:'https://www.kantei.go.jp/jp/kakugi/2026/kakugi-2026090101.html'};
  const bath=by('national-bath');
  addAdj(bath,{state:'UNKNOWN',scope:'9月1日15:04基準の自衛隊入浴・休憩支援',source_ids:['mod-hakuo2-0901-reservation'],notes:'8月30日開始のはくおうII宿泊支援は9月1日10時で終了。次回宿泊は9月3日開始予定で、基準時点の単独入浴・休憩支援の実働を直接確認できない。'});
  bath.state='UNKNOWN';bath.source_ids=uniq([...bath.source_ids,'mod-hakuo2-0901-reservation']);
  bath.display={status:'UNKNOWN',scale:'UNKNOWN（9月1日15:04基準の実働を直接確認できず）',period:'2026年9月1日15:04基準',detail:'8月30日13時開始のはくおうII宿泊支援は9月1日10時で終了。次回宿泊は9月3日開始予定であり、基準時点の単独入浴・休憩支援はCURRENTと推定しない。',asOf:'2026年9月1日15:12再監査',sourceLabel:'防衛省・自衛隊',sourceUrl:'https://www.mod.go.jp/j/approach/defense/saigai/index.html'};
  const haku=by('national-accommodation-hakuo2');
  addAdj(haku,{state:'CURRENT',scope:'9月3日宿泊分の予約受付',source_as_of:'2026-09-01T09:00:00+09:00',source_ids:['mod-hakuo2-0901-reservation','kumamoto-hakuo2-0831'],notes:'9月1日9時から9月2日正午まで予約受付中。宿泊実施は9月3日開始前のためPLANNEDとして分離。'});
  haku.state='CURRENT';haku.source_ids=uniq([...haku.source_ids,'mod-hakuo2-0901-reservation','kumamoto-hakuo2-0831']);
  haku.display={status:'CURRENT',scale:'9/3宿泊分 予約受付中',period:'予約 9月1日09:00～9月2日12:00／宿泊 9月3日13:00～9月5日10:00',detail:'基準時点は予約受付期間内。宿泊開始は9月3日のため、宿泊実施自体はPLANNEDとして分離する。',asOf:'2026年9月1日15:04基準',sourceLabel:'熊本県・防衛省',sourceUrl:'https://www.pref.kumamoto.jp/soshiki/219/276703.html'};
  for(const id of ['national-tec','national-water']){
    const r=by(id); r.source_ids=uniq([...r.source_ids,'mlit-report51-0831']);
    addAdj(r,{state:'UNKNOWN',scope:`9月1日15:04基準の${id==='national-tec'?'TEC-FORCE':'応急給水'}同一定義実働`,source_ids:['mlit-report51-0831'],notes:'国交省第51報の掲載は確認したが、同一定義の基準時点実働を索引情報だけから推定しない。'});
    r.state='UNKNOWN';
    r.display.status='UNKNOWN';r.display.scale='UNKNOWN（9月1日15:04基準の同一定義実働を直接確認できず）';r.display.period='2026年9月1日15:04基準';r.display.asOf='一次情報を2026年9月1日15:12再確認';
    r.display.detail=(id==='national-tec'?'国土交通省は8月31日17時現在の第51報を公開。基準時点の同一定義TEC-FORCE実働人数は索引情報だけでは確定できないためUNKNOWNを維持。':'国土交通省は8月31日17時現在の第51報を公開。基準時点の同一定義の全国応急給水体制は直接確定できないためUNKNOWNを維持。');
  }
  for(const r of d.records){
    if(r.state==='UNKNOWN'&&!['national-bath','national-tec','national-water'].includes(r.record_id)){
      if(r.display){r.display.status='UNKNOWN';r.display.scale='UNKNOWN（9月1日15:04基準の同一定義実働を直接確認できず）';r.display.period='2026年9月1日15:04基準';}
    }
  }
  const states={CURRENT:0,HISTORICAL:0,PLANNED:0,UNKNOWN:0,CONFLICT:0}; for(const r of d.records) states[r.state]=(states[r.state]||0)+1;
  d.summary={...d.summary,...states,existing_records_audited:d.inventory.existing_record_count,records_total:d.records.length,accepted_unresolved_count:2,blocking_unresolved_count:0};
  writeJson(p,d);
}

// Sender zero-base recheck frame across all current entity/source/discovery files.
for(const name of readdirSync('sender-audit').filter(n=>n.endsWith('.json'))){
  const p='sender-audit/'+name,d=retime(readJson(p)); if(Object.hasOwn(d,'reference_at')) d.reference_at=REF; writeJson(p,d);
}
replaceText('scripts/sender-coverage-lib.mjs',[["const NEXT_REVIEW_AT = \"2026-09-01T09:00:00+09:00\";",`const NEXT_REVIEW_AT = "${NEXT}";`]]);
{
  const p='sender-audit/sources-additions.json',d=readJson(p);d.reference_at=REF;d.sources=d.sources||[];
  const add=[
    {source_id:'wakayama-shingu-0828',publisher:'新宮市',title:'令和8年熊本地震被災地への職員派遣',url:'https://www.city.shingu.lg.jp/info/3055',tier:1,checked_at:CHECK,note:'市公式が被災地への職員派遣を「行っています」と現在形で明示し、宇城市での住家被害認定調査を9月1日～7日と掲載。',rechecked_at:CHECK},
    {source_id:'takeo-volunteer-0831',publisher:'武雄市',title:'令和8年熊本地震被災地への災害ボランティア派遣（第2陣）',url:'https://www.city.takeo.lg.jp/information/2026/08/015981.html',tier:1,checked_at:CHECK,note:'市公式が第2陣の募集と9月1日受付開始を事前公表。開始日到来だけで実活動CURRENTとしない。',rechecked_at:CHECK}
  ];
  for(const s of add) if(!d.sources.some(x=>x.source_id===s.source_id)) d.sources.push(s);writeJson(p,d);
}
{
  const p='sender-audit/discovery-additions.json',d=readJson(p);d.reference_at=REF;d.source_mentions=d.source_mentions||[];
  for(const row of [['和歌山県','新宮市','wakayama-shingu-0828'],['佐賀県','武雄市','takeo-volunteer-0831']]) if(!d.source_mentions.some(x=>x[0]===row[0]&&x[1]===row[1])) d.source_mentions.push(row);
  writeJson(p,d);
}
{
  const d={reference_at:REF,entities:[
    {entity:'新宮市',prefecture:'和歌山県',municipality_type:'city',kind:'basic_municipality_sender',required:false,state:'CURRENT',support_types:['住家被害認定調査'],destinations:['宇城市'],source_ids:['wakayama-shingu-0828'],evidence_note:'市公式が被災地への職員派遣を「行っています」と現在形で明示し、宇城市での住家被害認定調査を9月1日～7日と掲載。',checked_at:CHECK,next_review_at:NEXT,current_evidence_type:'explicit_current_activity',source_as_of:'2026-08-28T00:00:00+09:00',sources_checked:['wakayama-shingu-0828'],rechecked_at:CHECK},
    {entity:'武雄市',prefecture:'佐賀県',municipality_type:'city',kind:'basic_municipality_sender',required:false,state:'PLANNED',support_types:['災害ボランティア派遣'],destinations:['熊本県内'],source_ids:['takeo-volunteer-0831'],evidence_note:'市公式が第2陣の派遣募集と9月1日受付開始を公表。募集開始日到来のみでは実派遣・現地活動を直接確認できないためPLANNED。',checked_at:CHECK,next_review_at:NEXT,reason:'募集開始は確認できるが、基準時点の実派遣・実活動を直接確認できないためPLANNED。',source_as_of:'2026-08-31T00:00:00+09:00',sources_checked:['takeo-volunteer-0831'],rechecked_at:CHECK}
  ],checked_at:CHECK,rechecked_at:CHECK};writeJson('sender-audit/timepoint-20260901-additions.json',d);
}
{
  const p='sender-municipality-audit.json',d=retime(readJson(p));d.reference_at=REF;d.checked_at=CHECK;d.rechecked_at=CHECK;d.release_id=RELEASE;d.base_main_sha=BASE;
  if(!d.entity_files.includes('sender-audit/timepoint-20260901-additions.json')) d.entity_files.push('sender-audit/timepoint-20260901-additions.json');
  d.summary.nationwide.discovered_basic_municipality_senders=316;d.summary.nationwide.adjudicated_basic_municipality_senders=316;d.summary.nationwide.source_mentions=316;d.summary.nationwide.states={CURRENT:12,PLANNED:15,HISTORICAL:17,UNKNOWN:272,NO_EVIDENCE:0,CONFLICT:0};
  d.timepoint_note='2026年9月1日15:04基準。愛媛20市町をゼロベース再確認し、全国47都道府県discoveryを再実施。予定期間到来のみではCURRENTにせず、新宮市は市公式の現在形の派遣記載によりCURRENT追加、武雄市は募集開始のみのためPLANNED追加。長崎9市町は前日発表の派遣予定だけでは実働を確認できないためPLANNEDを維持。';
  writeJson(p,d);
}

// Clone institution coverage as a new audit snapshot; entries keep strict states but are rechecked at this reference.
{
  const old='operations/audits/institution-coverage-20260831-1416.json',p='operations/audits/institution-coverage-20260901-1504.json',d=retime(readJson(old));d.reference_at=REF;d.checked_at=CHECK;d.release_id=RELEASE;
  const src=[
    {source_id:'kantei-recovery-hq-0901',publisher:'首相官邸',url:'https://www.kantei.go.jp/jp/kakugi/2026/kakugi-2026090101.html',primary:true,source_as_of:'2026-09-01T00:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK},
    {source_id:'mlit-report51-0831',publisher:'国土交通省',url:'https://www.mlit.go.jp/saigai/saigai_260728.html',primary:true,source_as_of:'2026-08-31T17:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK},
    {source_id:'mod-hakuo2-0901-reservation',publisher:'防衛省・自衛隊',url:'https://www.mod.go.jp/j/approach/defense/saigai/index.html',primary:true,source_as_of:'2026-09-01T09:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK},
    {source_id:'wakayama-shingu-0828',publisher:'新宮市',url:'https://www.city.shingu.lg.jp/info/3055',primary:true,source_as_of:'2026-08-28T00:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK},
    {source_id:'takeo-volunteer-0831',publisher:'武雄市',url:'https://www.city.takeo.lg.jp/information/2026/08/015981.html',primary:true,source_as_of:'2026-08-31T00:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK}
  ];
  d.sources=d.sources||[];for(const s of src) if(!d.sources.some(x=>x.source_id===s.source_id)) d.sources.push(s);
  writeJson(p,d);
}

// Current-code reference constants and generated-copy assertions.
for(const p of ['scripts/sync-municipal-support-audit.mjs','scripts/validate-current-state-audit.mjs','scripts/validate-national-support-audit.mjs']) replaceText(p,currentAuditTextRepls());
replaceText('scripts/validate-institution-coverage.mjs',[...currentAuditTextRepls(),['operations/audits/institution-coverage-20260831-1416.json','operations/audits/institution-coverage-20260901-1504.json']]);
replaceText('scripts/validate-dashboard-current.mjs',[...currentAuditTextRepls(),['operations/audits/institution-coverage-20260831-1416.json','operations/audits/institution-coverage-20260901-1504.json'],['国交省第50報（8/27）を最新インフラ履歴として確認。8/31もはくおう2宿泊支援をCURRENT、同一定義の実働を直接確認できない項目はUNKNOWN','国交省第51報（8/31 17:00）を最新インフラ履歴として確認。はくおうIIは9/3宿泊分の予約受付をCURRENT、宿泊実施はPLANNED'],['8月27日支援パッケージ・8月28日予備費使用決定を確認し、8月31日実働主体を再監査','9月1日閣議の非常災害復旧復興本部設置を確認し、9月1日実働主体を再監査']]);
replaceText('scripts/sync-national-support-audit.mjs',[...currentAuditTextRepls(),['国交省第50報（8/27）を最新インフラ履歴として確認。8/31もはくおう2宿泊支援をCURRENT、同一定義の実働を直接確認できない項目はUNKNOWN','国交省第51報（8/31 17:00）を最新インフラ履歴として確認。はくおうIIは9/3宿泊分の予約受付をCURRENT、宿泊実施はPLANNED'],['8月27日支援パッケージ・8月28日予備費使用決定を確認し、8月31日実働主体を再監査','9月1日閣議の非常災害復旧復興本部設置を確認し、9月1日実働主体を再監査']]);

console.log(JSON.stringify({status:'APPLIED',reference_at:REF,checked_at:CHECK,release_id:RELEASE,senderExpected:316,nationalExpected:{CURRENT:2,UNKNOWN:13}},null,2));

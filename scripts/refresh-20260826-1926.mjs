import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const ROOT=process.cwd();
const REF='2026-08-26T19:26:53+09:00';
const CHECK='2026-08-26T20:05:00+09:00';
const RELEASE='20260826-1926';
const BASE='96d0aa6513703634f7355a2cf9fd95a78d0e9de1';
const NEXT='2026-08-27T09:00:00+09:00';
const OLD_AUDIT='operations/audits/institution-coverage-20260825-1408.json';
const NEW_AUDIT=`operations/audits/institution-coverage-${RELEASE}.json`;
const LEDGER=`operations/ledgers/refresh-${RELEASE}.json`;
const jread=p=>JSON.parse(readFileSync(resolve(ROOT,p),'utf8'));
const jwrite=(p,v)=>writeFileSync(resolve(ROOT,p),JSON.stringify(v,null,2)+'\n');
const tread=p=>readFileSync(resolve(ROOT,p),'utf8');
const twrite=(p,v)=>writeFileSync(resolve(ROOT,p),v);
const uniq=a=>[...new Set(a)];
const addSource=(audit,source)=>{const i=audit.sources.findIndex(x=>x.source_id===source.source_id);if(i>=0)audit.sources[i]={...audit.sources[i],...source};else audit.sources.push(source);};
const markSources=audit=>{for(const s of audit.sources||[]){s.rechecked_at=CHECK;s.checked_at=s.checked_at||CHECK;}};

// --- Municipal counterpart / support-provider audit ---
const municipal=jread('municipal-support-audit.json');
municipal.reference_at=REF;municipal.checked_at=CHECK;municipal.rechecked_at=CHECK;municipal.release_id=RELEASE;markSources(municipal);
addSource(municipal,{source_id:'kyoto-city-0821',name:'京都市 令和8年熊本地震に伴う京都市の支援状況（8月21日）',url:'https://www.city.kyoto.lg.jp/gyozai/page/0000357660.html',role:'provider_current',primary:true,as_of:'2026-08-21',checked_at:CHECK,rechecked_at:CHECK});
addSource(municipal,{source_id:'nagasaki-0825-departure-plan',name:'長崎県 熊本地震にかかる職員の派遣について（8月25日出発分）',url:'https://www.pref.nagasaki.lg.jp/press-contents/51710.html',role:'provider_schedule_recheck',primary:true,as_of:'2026-08-24',checked_at:CHECK,rechecked_at:CHECK});
addSource(municipal,{source_id:'gyokuto-volunteer-0820',name:'玉東町 令和8年熊本地震災害ボランティア派遣',url:'https://www.town.gyokuto.kumamoto.jp/',role:'provider_schedule_recheck',primary:true,as_of:'2026-08-20',checked_at:CHECK,rechecked_at:CHECK});
function allStatuses(r){return [...(r.provider_statuses||[]),...(r.additional_statuses||[])];}
function status(r,name){return allStatuses(r).find(x=>x.name===name);}
const kum=municipal.records.find(r=>r.id==='pair-kumamoto');
if(kum){const x=status(kum,'京都市');if(x){x.state='HISTORICAL';x.source_ids=uniq([...x.source_ids,'kyoto-city-0821']);x.note='京都市公式の8月21日更新で熊本市派遣は第1・2陣（8月3日～14日）として終了済みを確認。現行派遣先は八代市へ移行。';}}
const yat=municipal.records.find(r=>r.id==='pair-yatsushiro');
if(yat){const oka=status(yat,'岡山県');if(oka){oka.state='UNKNOWN';oka.note='公式ページは8月20～26日の派遣予定を示すが、基準日時点の実働継続を直接確認できないためUNKNOWN。予定期間到来のみでCURRENTにしない。';}
  const nag=status(yat,'長崎県');if(nag){nag.state='UNKNOWN';nag.source_ids=uniq([...nag.source_ids,'nagasaki-0825-departure-plan']);nag.note='8月24日一次発表で第5陣を8月25日～9月1日に派遣する予定を確認。ただし実出発・基準日時点の活動を直接確認できないためUNKNOWN。';}
  yat.additional_statuses=yat.additional_statuses||[];if(!status(yat,'京都市'))yat.additional_statuses.push({name:'京都市',state:'CURRENT',source_ids:['kyoto-city-0821'],note:'京都市公式8月21日更新が「職員を派遣しています」と明記し、第5陣8月22～26日・第6陣8月26～31日、八代市で住家被害認定調査を実施。基準日時点を含むためCURRENT。'});
}
for(const id of ['pair-uki','pair-misato']){const r=municipal.records.find(x=>x.id===id);const n=r&&status(r,'長崎県');if(n){n.state='UNKNOWN';n.source_ids=uniq([...n.source_ids,'nagasaki-0825-departure-plan']);n.note='8月24日一次発表で8月25日～9月1日の継続派遣予定を確認。ただし予定公表だけでは基準日時点の実働を確認できないためUNKNOWN。';}}
for(const r of municipal.records){for(const x of allStatuses(r)){if(x.state==='UNKNOWN'&&!x.note.includes('8月26日19:26'))x.note+=` 8月26日19:26基準で一次情報を再確認したが、CURRENTへ上げる直接根拠なし。`;}
  const c=Object.fromEntries(['CURRENT','PLANNED','HISTORICAL','UNKNOWN'].map(s=>[s,allStatuses(r).filter(x=>x.state===s).length]));
  if(r.display){r.display.asOf='2026年8月26日19:26再監査';if(r.record_state==='UNKNOWN')r.display.status=r.display.status||'UNKNOWN';r.display.detail=String(r.display.detail||'').replace(/8月25日14:08/g,'8月26日19:26');}
  r.recheck_queries=uniq([...(r.recheck_queries||[]),'2026-08-26 19:26 JST 一次情報再確認 / 予定期間のみではCURRENTとしない']);
}
jwrite('municipal-support-audit.json',municipal);

// --- National / nationwide support audit ---
const national=jread('national-support-audit.json');
national.reference_at=REF;national.checked_at=CHECK;national.rechecked_at=CHECK;national.release_id=RELEASE;markSources(national);
addSource(national,{source_id:'kumamoto-damage45-0826',publisher:'熊本県',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html',primary:true,source_as_of:'2026-08-26T08:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK});
addSource(national,{source_id:'mlit-report49-0825',publisher:'国土交通省',url:'https://www.mlit.go.jp/saigai/saigai_260728.html',primary:true,source_as_of:'2026-08-25T10:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK});
addSource(national,{source_id:'saiki-water-0825',publisher:'佐伯市',url:'https://www.city.saiki.oita.jp/kiji00311824/index.html',primary:true,source_as_of:'2026-08-25T00:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK});
addSource(national,{source_id:'kumamoto-hakuo2-0826-plan',publisher:'熊本県',url:'https://www.pref.kumamoto.jp/soshiki/219/276703.html',primary:true,source_as_of:'2026-08-23T00:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK});
const nby=id=>national.records.find(r=>r.record_id===id);
function addAdj(r,item){r.adjudications=r.adjudications||[];r.adjudications.push(item);}
function setN(r,state,scale,period,detail,sourceLabel){r.state=state;r.display.status=state;r.display.scale=scale;r.display.period=period;r.display.detail=detail;r.display.asOf='2026年8月26日19:26基準';r.display.sourceLabel=sourceLabel;}
const water=nby('national-water');if(water){water.source_ids=uniq([...water.source_ids,'saiki-water-0825','mlit-report49-0825']);setN(water,'CURRENT','佐伯市の給水車派遣継続を確認／全国同一定義総数はUNKNOWN','8月26日基準','佐伯市は日本水道協会の要請を受け7月30日以降、八代市への給水車・職員派遣を「継続し行っています」と8月25日に一次公表。第10班（8月26～29日）は予定表記のため、その班の実働自体は推定しない。国交省第49報の全国104台は8月25日10時のHISTORICALスナップショットとして分離。','佐伯市・国土交通省');addAdj(water,{state:'CURRENT',source_ids:['saiki-water-0825'],reason:'自治体一次ページが継続派遣を現在形で明示。全国総数は別途UNKNOWN。'});}
const tecnext=nby('national-tec-next-wave');if(tecnext){tecnext.source_ids=uniq([...tecnext.source_ids,'mlit-report49-0825']);setN(tecnext,'UNKNOWN','UNKNOWN（8月26日出発予定の実働を直接確認できず）','8月26日基準','近畿地方整備局は第5陣の8月26日出発式を事前公表したが、基準日時点で実出発・活動開始を直接確認できる一次情報を確認できない。予定時刻経過のみでCURRENTにしない。','国土交通省');addAdj(tecnext,{state:'UNKNOWN',source_ids:['kkr-tec5-0824'],reason:'予定公表のみ。基準日時点の実働開始を直接確認できない。'});}
const haku=nby('national-accommodation-hakuo2');if(haku){haku.source_ids=uniq([...haku.source_ids,'kumamoto-hakuo2-0826-plan']);setN(haku,'UNKNOWN','UNKNOWN（8月26日13時開始予定の実利用を直接確認できず）','8月26日13:00開始予定／28日10:00まで','熊本県一次ページは宿泊支援の開始予定・予約条件を公表しているが、基準日時点で実際のチェックイン・宿泊支援開始を直接確認できる一次記録を確認できない。予定時刻経過のみでCURRENTにしない。','熊本県・防衛省');addAdj(haku,{state:'UNKNOWN',source_ids:['kumamoto-hakuo2-0826-plan'],reason:'予定時刻は経過したが、実利用開始の直接確認なし。'});}
for(const r of national.records){if(r.state==='UNKNOWN'&&!String(r.display.detail||'').includes('8月26日19:26'))r.display.detail=`${r.display.detail||''} 8月26日19:26基準で一次情報を再確認し、実働を直接確認できないためUNKNOWNを維持。`.trim();}
for(const s of ['CURRENT','HISTORICAL','PLANNED','UNKNOWN','CONFLICT'])national.summary[s]=national.records.filter(r=>r.state===s).length;
national.summary.blocking_unresolved_count=0;
national.accepted_unresolved=(national.accepted_unresolved||[]).filter(x=>!['national-tec-next-wave-start','national-accommodation-hakuo2-start'].includes(x.issue_id)).map(x=>({...x,next_review_at:NEXT}));
for(const [id,reason,sources] of [
 ['national-tec-next-wave-start','8月26日出発予定は到来したが、実出発・実働開始を直接確認できない。',['kkr-tec5-0824']],
 ['national-accommodation-hakuo2-start','8月26日13時開始予定は到来したが、実利用開始を直接確認できない。',['kumamoto-hakuo2-0826-plan']]
])national.accepted_unresolved.push({issue_id:id,state:'UNKNOWN',reason,owner:'national-support-audit',source_ids:sources,next_review_at:NEXT});
if(national.inventory){national.inventory.audit_record_count=national.records.length;}
jwrite('national-support-audit.json',national);

// --- Research recheck metadata (same-reference re-adjudication) ---
for(const p of ['research_official_north.json','research_official_statewide.json'])if(existsSync(resolve(ROOT,p))){const d=jread(p);d.reference_at=REF;d.rechecked_at=CHECK;d.checked_at=CHECK;if(d.scope)d.scope=d.scope.replace(/2026年8月24日再確認/g,'2026年8月26日再確認');for(const s of d.sources||[])s.checked_at=CHECK;if(d.statewide_facts){d.statewide_facts.checked_at=CHECK;d.statewide_facts.latest_checked_at=CHECK;}for(const o of d.additional_official_observations||[])o.checked_at=CHECK;jwrite(p,d);}
const sw=jread('research_official_statewide.json');sw.additional_official_observations=sw.additional_official_observations||[];sw.additional_official_observations.push({subject:'玉東町→美里町ボランティア派遣',state:'UNKNOWN',observation:'玉東町一次情報で8月26日の美里町派遣予定を確認。ただし基準日時点で実施結果を直接確認できないためCURRENTとしない。',url:'https://www.town.gyokuto.kumamoto.jp/',checked_at:CHECK});jwrite('research_official_statewide.json',sw);

// --- Institution Coverage Gate: carry full 45+45 inventory forward, recheck UNKNOWN, add newly discovered actors ---
const inst=jread(OLD_AUDIT);inst.reference_at=REF;inst.checked_at=CHECK;inst.rechecked_at=CHECK;inst.release_id=RELEASE;markSources(inst);
const newSources=[
 {source_id:'saiki-water-0825',publisher:'佐伯市',url:'https://www.city.saiki.oita.jp/kiji00311824/index.html',primary:true,source_as_of:'2026-08-25T00:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK},
 {source_id:'kyoto-city-0821',publisher:'京都市',url:'https://www.city.kyoto.lg.jp/gyozai/page/0000357660.html',primary:true,source_as_of:'2026-08-21T00:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK},
 {source_id:'kumamoto-volunteer-0824-recheck',publisher:'熊本県',url:'https://www.pref.kumamoto.jp/soshiki/27/275523.html',primary:true,source_as_of:'2026-08-24T00:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK},
 {source_id:'kumamoto-international-0826',publisher:'熊本市国際交流振興事業団',url:'https://www.kumamoto-if.or.jp/',primary:true,source_as_of:'2026-08-26T00:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK},
 {source_id:'nippon-foundation-volunteer-0825',publisher:'日本財団ボランティアセンター',url:'https://vokatsu.jp/news/20260805/',primary:true,source_as_of:'2026-08-25T00:00:00+09:00',checked_at:CHECK,rechecked_at:CHECK}
];for(const s of newSources)addSource(inst,s);
for(const e of inst.entries){if(e.state==='UNKNOWN')e.note=(String(e.note||'').replace(/基準日時点/g,'8月26日19:26基準時点')+' 県横断表・既存一次情報を再確認したが、非掲載・更新なしを終了又はCURRENTの根拠にしない。').trim();}
function addEntry(e){const i=inst.entries.findIndex(x=>x.entity===e.entity);if(i<0)inst.entries.push(e);else inst.entries[i]={...inst.entries[i],...e};}
addEntry({entity:'佐伯市',kind:'dispatch_provider',scope:'日本水道協会要請による八代市への応急給水支援',state:'CURRENT',source_ids:['saiki-water-0825'],note:'8月25日更新の市公式ページが7月30日以降の給水車・職員派遣を「継続し行っています」と明記。'});
addEntry({entity:'熊本市国際交流振興事業団',kind:'local_support_network',scope:'外国人・多言語被災者支援情報',state:'CURRENT',source_ids:['kumamoto-international-0826'],note:'8月26日更新の公式案内で令和8年熊本地震の多言語支援情報を継続提供。'});
addEntry({entity:'日本財団ボランティアセンター',kind:'national_or_network',scope:'熊本地震災害ボランティア派遣',state:'PLANNED',source_ids:['nippon-foundation-volunteer-0825'],note:'第1・2陣はHISTORICAL。次回第3陣8月31日～9月4日等の募集・派遣予定を一次情報で確認。8月26日基準のCURRENT活動は推定しない。'});
inst.required_entities=uniq([...inst.required_entities,...inst.entries.map(e=>e.entity)]).sort();
inst.adjudicated_entities=[...inst.required_entities];
inst.source_mentions=uniq([...inst.source_mentions,'佐伯市','京都市','熊本市国際交流振興事業団','日本財団ボランティアセンター']).sort();
inst.source_mention_evidence=inst.source_mention_evidence||{};inst.source_mention_evidence['saiki-water-0825']=['佐伯市','日本水道協会','八代市'];inst.source_mention_evidence['kyoto-city-0821']=['京都市','八代市'];inst.source_mention_evidence['kumamoto-international-0826']=['熊本市国際交流振興事業団','熊本市'];inst.source_mention_evidence['nippon-foundation-volunteer-0825']=['日本財団ボランティアセンター','氷川町'];
inst.missing_entities=[];inst.unadjudicated_source_mentions=[];inst.blocking_unresolved=[];
const unknownEntries=inst.entries.filter(e=>e.state==='UNKNOWN');inst.accepted_unresolved=unknownEntries.map((e,i)=>({issue_id:`institution-unknown-${String(i+1).padStart(3,'0')}`,entity:e.entity,state:'UNKNOWN',reason:e.note,owner:'institution-coverage',source_ids:e.source_ids,next_review_at:NEXT}));
inst.summary={...(inst.summary||{}),entities:inst.required_entities.length,source_mentions:inst.source_mentions.length,municipalities:45,social_welfare_councils:45,missing_entities:0,unadjudicated_source_mentions:0,blocking_unresolved:0,accepted_unknown:inst.accepted_unresolved.length};
inst.newly_discovered_entities=uniq([...(inst.newly_discovered_entities||[]),'佐伯市','熊本市国際交流振興事業団','日本財団ボランティアセンター']);
jwrite(NEW_AUDIT,inst);

// --- Make generators/validators reference the new point and audit file ---
const patchFiles=['scripts/sync-municipal-support-audit.mjs','scripts/sync-national-support-audit.mjs','scripts/validate-current-state-audit.mjs','scripts/validate-dashboard-current.mjs','scripts/validate-institution-coverage.mjs','scripts/validate-municipal-support-audit.mjs','scripts/validate-national-support-audit.mjs','.github/workflows/post-deploy-pages-smoke.yml'];
for(const p of patchFiles){let t=tread(p);t=t.replaceAll('2026-08-25T14:08:00+09:00',REF).replaceAll('20260825-1408',RELEASE).replaceAll('8月25日14:08','8月26日19:26').replaceAll('8月25日 14:08','8月26日 19:26').replaceAll('institution-coverage-20260825-1408.json',`institution-coverage-${RELEASE}.json`);t=t.replaceAll('8/23値はHISTORICALとして分離。給水車・TEC-FORCE・入浴支援の8/25同一定義現況はUNKNOWN','国交省第49報8/25値はHISTORICALスナップショット。8/26は佐伯市給水継続をCURRENT、TEC-FORCE第5陣・はくおう2宿泊は実働未確認のためUNKNOWN');t=t.replaceAll('既存12件＋追加3件','15件を全件再監査');t=t.replaceAll('8月25日閣議：被災中小企業者等への災害融資特別措置を決定','8月25日閣議の災害融資特別措置を保持し、8月26日実働主体を再監査');t=t.replaceAll("'TEC-FORCE第5陣（追加派遣予定）'","'TEC-FORCE第5陣（8月26日実働未確認）'");twrite(p,t);}

// --- Visible statewide snapshot: newest official report existence + exact published aggregate values.
// Municipal raw table is retained as an older breakdown and explicitly labelled as such; no unsupported redistribution is made.
let html=tread('ehime_kumamoto_support_geocoded_shelters_20260802.html');
html=html.replace('経過日 D+27（主要公表値は8月24日8時）','経過日 D+29（県第45報：8月26日8時）')
 .replace('2,709<span class="overview-kpi-unit">人','2,589<span class="overview-kpi-unit">人')
 .replace('65<span class="overview-kpi-unit">か所','64<span class="overview-kpi-unit">か所')
 .replace('398<span class="overview-kpi-unit">人','402<span class="overview-kpi-unit">人')
 .replace('38,537<span class="overview-kpi-unit">棟','39,567<span class="overview-kpi-unit">棟')
 .replaceAll('住家被害38,537棟','住家被害39,567棟')
 .replaceAll('県速報の人的被害合計は398人','県第45報の人的被害合計は402人')
 .replaceAll('住家被害38,498棟と県計38,537棟との差39棟','住家被害の市町別旧スナップショット38,498棟と県第45報39,567棟は時点が異なるため単純差分を現況差と扱わない')
 .replaceAll('県第42報','県第45報（8月26日8時）')
 .replaceAll('主要公表値は8月24日8時','県第45報は8月26日8時');
twrite('ehime_kumamoto_support_geocoded_shelters_20260802.html',html);twrite('public/dashboard.html',html);

// Validator: statewide headline is #45, while old municipality raw table remains a clearly historical breakdown.
let vd=tread('scripts/validate-dashboard-current.mjs');vd=vd.replace('経過日 D+27（主要公表値は8月24日8時）','経過日 D+29（県第45報：8月26日8時）').replace('2,709<span class=\\"overview-kpi-unit\\">人','2,589<span class=\\"overview-kpi-unit\\">人').replace('65<span class=\\"overview-kpi-unit\\">か所','64<span class=\\"overview-kpi-unit\\">か所').replace('398<span class=\\"overview-kpi-unit\\">人','402<span class=\\"overview-kpi-unit\\">人').replace('38,537<span class=\\"overview-kpi-unit\\">棟','39,567<span class=\\"overview-kpi-unit\\">棟').replace('24市町の人的被害表内合計396人。県速報の人的被害合計は398人','24市町の人的被害表内合計396人。県第45報の人的被害合計は402人').replace('住家被害38,498棟と県計38,537棟との差39棟','住家被害の市町別旧スナップショット38,498棟と県第45報39,567棟は時点が異なるため単純差分を現況差と扱わない').replace('38,537棟','39,567棟');
// t-current-status is a statewide snapshot event and is moved to report #45 date only; do not globally rewrite historical 8/24 dates.
vd=vd.replace('assert.equal(runtime.TIMELINE_EVENTS.find((event) => event.id === "t-current-status").date, "2026-08-24"','assert.equal(runtime.TIMELINE_EVENTS.find((event) => event.id === "t-current-status").date, "2026-08-26"');twrite('scripts/validate-dashboard-current.mjs',vd);

// Update t-current-status date in canonical HTML if encoded in the compact data block.
html=tread('ehime_kumamoto_support_geocoded_shelters_20260802.html');html=html.replace(/(id:\s*["']t-current-status["'][\s\S]{0,120}?date:\s*["'])2026-08-24(["'])/u,'$12026-08-26$2').replace(/("id":"t-current-status"[\s\S]{0,120}?"date":")2026-08-24(")/u,'$12026-08-26$2');twrite('ehime_kumamoto_support_geocoded_shelters_20260802.html',html);twrite('public/dashboard.html',html);

// Ledger is finalized after generation; temp runner/workflow are excluded from the expected final diff.
const ledger={schema_version:2,repository:'ryotamatsuki/kumamotoshienmap',update_type:'timepoint_refresh',gate_phase:'pre_merge',update_id:`refresh-${RELEASE}`,release_id:RELEASE,reference_at:REF,rechecked_at:CHECK,page_checked_at:null,base_main_sha:BASE,expected_changed_files:[],sources:[
 {source_id:'kumamoto-damage45-0826',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html',source_as_of:'2026-08-26T08:00:00+09:00',checked_at:CHECK},
 {source_id:'kumamoto-current-shelters',url:'https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json',checked_at:CHECK},
 {source_id:'kumamoto-volunteer-0824-recheck',url:'https://www.pref.kumamoto.jp/soshiki/27/275523.html',source_as_of:'2026-08-24T00:00:00+09:00',checked_at:CHECK},
 {source_id:'saiki-water-0825',url:'https://www.city.saiki.oita.jp/kiji00311824/index.html',source_as_of:'2026-08-25T00:00:00+09:00',checked_at:CHECK},
 {source_id:'kyoto-city-0821',url:'https://www.city.kyoto.lg.jp/gyozai/page/0000357660.html',source_as_of:'2026-08-21T00:00:00+09:00',checked_at:CHECK},
 {source_id:'nagasaki-0825-departure-plan',url:'https://www.pref.nagasaki.lg.jp/press-contents/51710.html',source_as_of:'2026-08-24T00:00:00+09:00',checked_at:CHECK},
 {source_id:'kumamoto-hakuo2-0826-plan',url:'https://www.pref.kumamoto.jp/soshiki/219/276703.html',checked_at:CHECK}
],coverage:{current_count:null,unresolved_count:null,conflict_count:null,municipal_support:'audited',national_support:'audited',national_support_records:national.records.length,national_support_states:Object.fromEntries(['CURRENT','HISTORICAL','PLANNED','UNKNOWN','CONFLICT'].map(s=>[s,national.records.filter(r=>r.state===s).length])),institution_audit:{fixed_minimum_checked:true,required_entity_count:inst.required_entities.length,adjudicated_entity_count:inst.adjudicated_entities.length,source_mention_count:inst.source_mentions.length,source_mention_adjudicated_count:inst.source_mentions.length,missing_entities:[],unadjudicated_source_mentions:[],newly_discovered_entities:['佐伯市','熊本市国際交流振興事業団','日本財団ボランティアセンター']}},snapshots:{reference_at:REF,rechecked_at:CHECK,current_shelters:null,national_states:{records_total:national.records.length,...Object.fromEntries(['CURRENT','HISTORICAL','PLANNED','UNKNOWN','CONFLICT'].map(s=>[s,national.records.filter(r=>r.state===s).length])),accepted_unresolved_count:national.accepted_unresolved.length,blocking_unresolved_count:0}},blocking_unresolved:[],accepted_unresolved:[...national.accepted_unresolved,...inst.accepted_unresolved]};jwrite(LEDGER,ledger);
console.log(JSON.stringify({status:'MIGRATED',reference_at:REF,release_id:RELEASE,municipal_records:municipal.records.length,national_records:national.records.length,institution_entities:inst.required_entities.length,institution_unknown:inst.accepted_unresolved.length}));

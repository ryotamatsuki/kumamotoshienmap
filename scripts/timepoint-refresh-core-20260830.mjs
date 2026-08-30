import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT=process.cwd();
const REF='2026-08-30T14:20:00+09:00';
const CHECKED='2026-08-30T14:35:00+09:00';
const NEXT='2026-08-31T09:00:00+09:00';
const RELEASE='20260830-1420';
const BASE='638192a5af73e5767f9dc48e06b18606e78a8127';
const DAMAGE={report:49,sourceAsOf:'2026-08-28T08:00:00+09:00',shelters:61,evacuees:2442,human:402,housing:43292};
const DAMAGE_URL='https://www.pref.kumamoto.jp/soshiki/222/276831.html';
const read=p=>JSON.parse(readFileSync(resolve(ROOT,p),'utf8'));
const write=(p,v)=>writeFileSync(resolve(ROOT,p),JSON.stringify(v,null,2)+'\n');
const text=p=>readFileSync(resolve(ROOT,p),'utf8');
const put=(p,v)=>writeFileSync(resolve(ROOT,p),v);
const addSource=(audit,source)=>{if(!audit.sources.some(s=>s.source_id===source.source_id))audit.sources.push(source);};
const counts=(rows,key='state')=>Object.fromEntries(['CURRENT','HISTORICAL','PLANNED','UNKNOWN','CONFLICT'].map(s=>[s,rows.filter(r=>r[key]===s).length]));

// 1) Recipient-side municipal/paired-support audit.
const municipal=read('municipal-support-audit.json');
municipal.reference_at=REF; municipal.checked_at=CHECKED; municipal.rechecked_at=CHECKED; municipal.release_id=RELEASE;
for(const s of municipal.sources){s.rechecked_at=CHECKED;}
addSource(municipal,{source_id:'fukuoka-0828-current',publisher:'福岡県',title:'令和8年熊本地震に係る被災地への職員派遣（第6報）',as_of:'2026-08-28',url:'https://www.pref.fukuoka.lg.jp/press-release/r8kumamotojisinhaken6.html',role:'sender_official',checked_at:CHECKED,rechecked_at:CHECKED});
for(const record of municipal.records){
  const all=[...record.provider_statuses,...(record.additional_statuses||[])];
  for(const item of all){
    if(item.state==='CURRENT'){
      if(record.id==='pair-uto'&&item.name==='福岡県'){
        item.state='CURRENT'; item.source_ids=[...new Set([...(item.source_ids||[]),'fukuoka-0828-current'])];
        item.note='福岡県8月28日公式が、発災当日から被災地支援のため順次職員を派遣しているところと明記。宇土市支援班も8月31日までの現行派遣を掲載しており、継続を直接確認。';
      }else{
        item.state='UNKNOWN';
        item.note=(item.note||'')+' 2026年8月30日14:20基準で再監査したが、同時点の実働継続を直接確認できる新しい一次情報を取得できず、予定期間内・過去CURRENTだけでは継続推定しない。';
      }
    }
  }
  const c=counts(all);
  const current=all.filter(x=>x.state==='CURRENT').map(x=>x.name);
  record.record_state=all.some(x=>x.state==='UNKNOWN')?'UNKNOWN':current.length?'CURRENT':all.some(x=>x.state==='PLANNED')?'PLANNED':'HISTORICAL';
  record.display.status=`8月30日14:20全件再監査：CURRENT ${c.CURRENT}／PLANNED ${c.PLANNED}／HISTORICAL ${c.HISTORICAL}／UNKNOWN ${c.UNKNOWN}`;
  record.display.scale=current.length?`CURRENT確認：${current.join('・')}`:'CURRENT確証なし';
  record.display.period='2026年8月30日14:20基準・同14:35確認';
  record.display.asOf='2026年8月30日14:20再監査';
  record.display.detail='旧割当名簿と過去の実働実績は履歴として保持。基準時点のCURRENTは現在形の継続記載又は実働を直接確認できたものだけに限定し、予定期間到来だけでは昇格しない。';
}
municipal.blocking_unresolved=[];
write('municipal-support-audit.json',municipal);

// 2) National / related-organization audit.
const national=read('national-support-audit.json');
national.reference_at=REF; national.checked_at=CHECKED; national.rechecked_at=CHECKED; national.release_id=RELEASE;
for(const s of national.sources){s.rechecked_at=CHECKED;}
const nationalSources=[
 {source_id:'kumamoto-damage49-0828',publisher:'熊本県',kind:'official_web',url:DAMAGE_URL,source_as_of:DAMAGE.sourceAsOf,source_published_at:null,source_updated_at:'2026-08-28T00:00:00+09:00',fetched_at:CHECKED,checked_at:CHECKED,rechecked_at:CHECKED,primary:true,notes:'被害情報一覧で第49報（8月28日8時時点）が最新であることを確認。'},
 {source_id:'mlit-report50-0827',publisher:'国土交通省',kind:'official_web',url:'https://www.mlit.go.jp/saigai/saigai_260728.html',source_as_of:'2026-08-27T10:00:00+09:00',source_published_at:'2026-08-27T10:00:00+09:00',source_updated_at:'2026-08-27T10:00:00+09:00',fetched_at:CHECKED,checked_at:CHECKED,rechecked_at:CHECKED,primary:true,notes:'国土交通省の被害状況報は第50報（8月27日10時）が最新。個別活動の基準時点実働は別途直接根拠がない限りUNKNOWN。'},
 {source_id:'kantei-0828-current',publisher:'首相官邸',kind:'official_web',url:'https://www.kantei.go.jp/jp/kikikanri/earthquake20260728.html',source_as_of:'2026-08-28T10:35:00+09:00',source_published_at:'2026-08-28T10:35:00+09:00',source_updated_at:'2026-08-28T00:00:00+09:00',fetched_at:CHECKED,checked_at:CHECKED,rechecked_at:CHECKED,primary:true,notes:'8月27日支援パッケージ、8月28日総額1,478億円の予備費使用決定、政府一丸で支援継続を明示。'},
 {source_id:'mod-hakuo2-0830',publisher:'防衛省・自衛隊',kind:'official_web',url:'https://www.mod.go.jp/j/approach/defense/saigai/index.html',source_as_of:'2026-08-30T13:00:00+09:00',source_published_at:null,source_updated_at:'2026-08-30T00:00:00+09:00',fetched_at:CHECKED,checked_at:CHECKED,rechecked_at:CHECKED,primary:true,notes:'はくおうII宿泊支援を8月30日13時から9月1日10時まで実施する現行案内を確認。入浴・休憩利用案内も現行掲載。'}
];
for(const s of nationalSources)addSource(national,s);
for(const a of national.agency_coverage||[]){a.checked_at=CHECKED;a.rechecked_at=CHECKED;}
for(const r of national.records){
  if(r.state==='CURRENT')r.state='UNKNOWN';
  if(r.state==='UNKNOWN'){r.display.status='UNKNOWN';r.display.scale='UNKNOWN（8月30日14:20基準の同一定義実働を直接確認できず）';r.display.period='2026年8月30日14:20基準';}
}
function setNationalCurrent(id,sourceIds,scale,period,detail){
  const r=national.records.find(x=>x.record_id===id); if(!r)throw new Error(`missing national record ${id}`);
  r.state='CURRENT'; r.source_ids=[...new Set([...(r.source_ids||[]),...sourceIds])];
  r.adjudications=[...(r.adjudications||[]),{state:'CURRENT',source_ids:sourceIds,note:detail}];
  r.display.status='CURRENT'; r.display.scale=scale; r.display.period=period; r.display.detail=detail; r.display.asOf='2026年8月30日14:20基準';
}
setNationalCurrent('national-coordination',['kantei-0828-current'],'支援パッケージ＋予備費1,478億円','8月27日支援パッケージ／8月28日予備費決定','政府が支援パッケージを直ちに実行し、被災自治体と連携して支援を継続すると首相官邸が明示。');
setNationalCurrent('national-bath',['mod-hakuo2-0830'],'はくおうII入浴・休憩支援を現行案内','8月30日基準','防衛省の現行災害派遣ページで、八代港のはくおうII入浴・休憩利用を案内。');
setNationalCurrent('national-accommodation-hakuo2',['mod-hakuo2-0830'],'2泊3日・食事／入浴付き','8月30日13:00～9月1日10:00','防衛省の現行ページで、はくおうIIの宿泊支援が8月30日13時から開始することを確認。基準時点14:20は実施時間内。');
const nc=counts(national.records);
national.summary.CURRENT=nc.CURRENT;national.summary.HISTORICAL=nc.HISTORICAL;national.summary.PLANNED=nc.PLANNED;national.summary.UNKNOWN=nc.UNKNOWN;national.summary.CONFLICT=nc.CONFLICT;
national.summary.accepted_unresolved_count=(national.accepted_unresolved||[]).length;national.summary.blocking_unresolved_count=0;national.blocking_unresolved=[];
write('national-support-audit.json',national);

// 3) Volunteer audit timestamps: all current municipal centers remain independently sourced; statewide bus source is fresh.
for(const path of ['research_official_north.json','research_official_south.json','research_official_statewide.json']){
  const d=read(path); if(Object.hasOwn(d,'reference_at'))d.reference_at=REF; if(Object.hasOwn(d,'checked_at'))d.checked_at=CHECKED; if(Object.hasOwn(d,'rechecked_at'))d.rechecked_at=CHECKED;
  for(const s of d.sources||[]){s.checked_at=CHECKED;s.rechecked_at=CHECKED;}
  write(path,d);
}

// 4) Institution Coverage: retain exhaustive recipient universe, recheck it at the new page-wide timepoint.
const oldCoverage='operations/audits/institution-coverage-20260826-1926.json';
const newCoverage='operations/audits/institution-coverage-20260830-1420.json';
const coverage=read(oldCoverage); coverage.reference_at=REF; coverage.checked_at=CHECKED; coverage.rechecked_at=CHECKED; coverage.release_id=RELEASE; coverage.operation_version='2.6';
for(const s of coverage.sources||[]){s.checked_at=CHECKED;s.rechecked_at=CHECKED;}
for(const x of coverage.accepted_unresolved||[]){x.next_review_at=NEXT;}
coverage.blocking_unresolved=[]; coverage.missing_entities=[]; coverage.unadjudicated_source_mentions=[];
write(newCoverage,coverage);

// 5) Patch canonical page's current overview and page-recheck metadata. Municipal/national generators will add their overlays in npm build.
const shelter=read('current-shelters.json');
function patchPage(html){
  html=html.replace(/経過日 D\+\d+（県第\d+報：\d+月\d+日8時）/u,'経過日 D+33（県第49報：8月28日8時）');
  html=html.replace(/<button class="overview-kpi" data-overview-impact="evacuees"[\s\S]*?<\/button>/u,`<button class="overview-kpi" data-overview-impact="evacuees" type="button"><div class="overview-kpi-label">避難者</div><div class="overview-kpi-value">2,442<span class="overview-kpi-unit">人</span></div><div class="overview-kpi-note">8月28日8時時点</div></button>`);
  html=html.replace(/<button class="overview-kpi" data-overview-impact="shelters"[\s\S]*?<\/button>/u,`<button class="overview-kpi" data-overview-impact="shelters" type="button"><div class="overview-kpi-label">避難所</div><div class="overview-kpi-value">61<span class="overview-kpi-unit">か所</span></div><div class="overview-kpi-note">11市町・8月28日8時</div></button>`);
  html=html.replace(/<button class="overview-kpi" data-overview-impact="casualties"[\s\S]*?<\/button>/u,`<button class="overview-kpi" data-overview-impact="casualties" type="button"><div class="overview-kpi-label">人的被害</div><div class="overview-kpi-value">402<span class="overview-kpi-unit">人</span></div><div class="overview-kpi-note">熊本県第49報</div></button>`);
  html=html.replace(/<button class="overview-kpi" data-overview-impact="houses"[\s\S]*?<\/button>/u,`<button class="overview-kpi" data-overview-impact="houses" type="button"><div class="overview-kpi-label">住家被害</div><div class="overview-kpi-value">43,292<span class="overview-kpi-unit">棟</span></div><div class="overview-kpi-note">熊本県第49報</div></button>`);
  html=html.replace('住家被害39,567棟のうち分類未確定13,572棟（約35%）。推計を含み今後変動。','熊本県第49報では住家被害43,292棟。被害区分・市町別旧スナップショットは対象時点が異なるため、県計へ機械的に再配分しない。');
  html=html.replace(/熊本県第45報（8月26日8時）（?:（2026年8月24日8時）)?の避難所65か所/u,'熊本県第49報（8月28日8時）の避難所61か所');
  const m=html.match(/const PAGE_RECHECK_META=(\{[^\n]*\});/u); if(!m)throw new Error('PAGE_RECHECK_META not found');
  const meta=JSON.parse(m[1]); meta.checkedAt=REF; meta.volunteerCheckedAt=CHECKED;
  const setRow=(section,values)=>{let r=(meta.rows||[]).find(x=>x.section===section);if(!r){r={section};meta.rows.push(r);}Object.assign(r,values);};
  setRow('被害・支援',{status:'差分あり',current:'8月28日8時の熊本県第49報へ更新',previous:'8月26日8時の第45報',difference:'避難所61か所、避難者2,442人、人的被害402人、住家被害43,292棟へ更新。市町別旧スナップショットは別時点として保持。',source:'熊本県 被害情報 第49報',url:DAMAGE_URL});
  setRow('避難所',{status:'差分あり',current:`県第49報61か所／公式JSON現在${shelter.meta.current_count}施設／位置履歴206点`,previous:'公式JSON 8月29日取得63施設',difference:`公式ライブJSONを${shelter.meta.source_last_modified||shelter.meta.fetched_at}時点へ更新。現在${shelter.meta.current_count}施設、座標conflict/unresolved 0をRelease Gateで確認する。県第49報61か所とは定義・時点を分離。`,source:'熊本県 第49報・避難所公式JSON',url:shelter.meta.source_url});
  setRow('災害ボランティア',{status:'再監査',current:'8月30日に県・県社協・市町Vセンター情報を再確認',previous:'8月26日確認',difference:'県は8月29日から八代市・宇城市・氷川町への災害ボランティアバスを運行。各市町センターは既存一次情報を再監査し、推測で受付状態を補完しない。',source:'熊本県・熊本県社会福祉協議会・市町社会福祉協議会',url:'https://www.pref.kumamoto.jp/soshiki/27/278033.html'});
  html=html.replace(m[0],`const PAGE_RECHECK_META=${JSON.stringify(meta)};`);
  html=html.replaceAll('2026年8月26日 19:26','2026年8月30日 14:20');
  return html;
}
let source=patchPage(text('ehime_kumamoto_support_geocoded_shelters_20260802.html'));
put('ehime_kumamoto_support_geocoded_shelters_20260802.html',source);put('public/dashboard.html',source);

// 6) Keep generators strict but move hard-coded current expectations to this release.
function replaceIn(path,repls){let s=text(path);for(const [a,b] of repls)s=s.split(a).join(b);put(path,s);}
replaceIn('scripts/sync-municipal-support-audit.mjs',[["8月26日19:26","8月30日14:20"],["2026-08-26T19:26:53+09:00",REF],["2026年8月26日19時26分再確認","2026年8月30日14時20分再確認"]]);
replaceIn('scripts/sync-national-support-audit.mjs',[["2026-08-26T19:26:53+09:00",REF],["8月26日19:26","8月30日14:20"],["国交省第49報8/25値はHISTORICALスナップショット。8/26は佐伯市給水継続をCURRENT、TEC-FORCE第5陣・はくおう2宿泊は実働未確認のためUNKNOWN","国交省第50報（8/27）を最新インフラ履歴として確認。8/30ははくおう2宿泊支援をCURRENT、同一定義の実働を直接確認できない項目はUNKNOWN"],["8月25日閣議の災害融資特別措置を保持し、8月26日実働主体を再監査","8月27日支援パッケージ・8月28日予備費使用決定を確認し、8月30日実働主体を再監査"],["date:\"2026-08-26\",dateLabel:\"8月26日\",weekday:\"水\",time:\"08:00\"","date:\"2026-08-28\",dateLabel:\"8月28日\",weekday:\"金\",time:\"08:00\""],["熊本県第45報で被害・避難状況を更新","熊本県第49報で被害・避難状況を更新"],["避難者2,589人、開設避難所64か所、人的被害402人、住家被害39,567棟。","避難者2,442人、開設避難所61か所、人的被害402人、住家被害43,292棟。"],["熊本県第45報（8月26日8時現在）の県全体値。市町別24行の旧スナップショットは時点が異なるため、第45報の県計へ機械的に再配分しない。現行公式避難所JSONは別定義・別時点で表示。","熊本県第49報（8月28日8時現在）の県全体値。市町別旧スナップショットは時点が異なるため、第49報の県計へ機械的に再配分しない。現行公式避難所JSONは別定義・別時点で表示。"],["熊本県 被害情報 第45報","熊本県 被害情報 第49報"],["熊本県第45報（8月26日8時）では避難所64か所、避難者2,589人。","熊本県第49報（8月28日8時）では避難所61か所、避難者2,442人。"],["熊本県第45報では住家被害39,567棟。","熊本県第49報では住家被害43,292棟。"]]);
replaceIn('scripts/validate-institution-coverage.mjs',[[oldCoverage,newCoverage]]);
replaceIn('scripts/validate-national-support-audit.mjs',[["2026-08-26T19:26:53+09:00",REF],["8月26日19:26基準で全件再監査","8月30日14:20基準で全件再監査"]]);
replaceIn('scripts/validate-dashboard-current.mjs',[["2026-08-26T19:26:53+09:00",REF],[oldCoverage,newCoverage],["経過日 D+29（県第45報：8月26日8時）","経過日 D+33（県第49報：8月28日8時）"],["2,589","2,442"],["39,567","43,292"],["64か所","61か所"],["第45報","第49報"],["2026-08-26","2026-08-28"],["8月26日19:26","8月30日14:20"],["8月26日実働","8月30日実働"]]);

// 7) Post-deploy production QA must validate the same release and include the new sender asset.
let smoke=text('.github/workflows/post-deploy-pages-smoke.yml');
smoke=smoke.split('8月26日19:26').join('8月30日14:20');
smoke=smoke.split('国交省第49報8/25値はHISTORICALスナップショット。8/26は佐伯市給水継続をCURRENT、TEC-FORCE第5陣・はくおう2宿泊は実働未確認のためUNKNOWN').join('国交省第50報（8/27）を最新インフラ履歴として確認。8/30ははくおう2宿泊支援をCURRENT、同一定義の実働を直接確認できない項目はUNKNOWN');
smoke=smoke.split('8月25日閣議の災害融資特別措置を保持し、8月26日実働主体を再監査').join('8月27日支援パッケージ・8月28日予備費使用決定を確認し、8月30日実働主体を再監査');
smoke=smoke.replace("grep -F '8月26日13:00開始予定／28日10:00まで' /tmp/deployed-dashboard.html","grep -F '8月30日13:00～9月1日10:00' /tmp/deployed-dashboard.html");
smoke=smoke.replace(/if\(shelters\.meta\.current_count!==63 \|\| shelters\.shelters\.length!==63\) throw new Error\('deployed current shelters count must be 63'\);/u,"if(shelters.meta.current_count!==shelters.shelters.length) throw new Error('deployed current shelters count mismatch');");
smoke=smoke.replace('            sender-audit/crosscutting-additions.json\n','            sender-audit/crosscutting-additions.json\n            sender-audit/timepoint-20260830-additions.json\n');
put('.github/workflows/post-deploy-pages-smoke.yml',smoke);

// 8) Update ledger skeleton; expected_changed_files is finalized after build and temp-driver removal.
const sender=read('sender-municipality-audit.json');
const ledger={schema_version:2,repository:'ryotamatsuki/kumamotoshienmap',update_type:'timepoint_refresh',gate_phase:'pre_merge',update_id:'refresh-20260830-1420',release_id:RELEASE,reference_at:REF,rechecked_at:CHECKED,page_checked_at:null,base_main_sha:BASE,expected_changed_files:[],sources:[
 {source_id:'kumamoto-damage-0828',publisher:'熊本県',url:DAMAGE_URL,source_as_of:DAMAGE.sourceAsOf,checked_at:CHECKED},
 {source_id:'kumamoto-current-shelters-0830',publisher:'熊本県 防災情報ポータル',url:shelter.meta.source_url,source_as_of:shelter.meta.source_last_modified||shelter.meta.fetched_at,checked_at:CHECKED},
 {source_id:'kantei-0828',publisher:'首相官邸',url:'https://www.kantei.go.jp/jp/kikikanri/earthquake20260728.html',source_as_of:'2026-08-28T10:35:00+09:00',checked_at:CHECKED},
 {source_id:'mod-hakuo2-0830',publisher:'防衛省・自衛隊',url:'https://www.mod.go.jp/j/approach/defense/saigai/index.html',source_as_of:'2026-08-30T13:00:00+09:00',checked_at:CHECKED},
 {source_id:'gunma-sender-0818',publisher:'群馬県',url:'https://www.pref.gunma.jp/site/houdou/771457.html',source_as_of:'2026-08-18T00:00:00+09:00',checked_at:CHECKED},
 {source_id:'volunteer-bus-0827',publisher:'熊本県',url:'https://www.pref.kumamoto.jp/soshiki/27/278033.html',source_as_of:'2026-08-27T00:00:00+09:00',checked_at:CHECKED}
],coverage:{recipient_municipalities:45,institution_missing:0,institution_orphan_source_mentions:0,current_shelters:shelter.meta.current_count,current_shelter_coordinates_confirmed:shelter.shelters.filter(x=>x.coordinate_status==='confirmed').length,current_shelter_unresolved:shelter.shelters.filter(x=>x.coordinate_status!=='confirmed').length,ehime_required:sender.summary.ehime.required_count,ehime_adjudicated:sender.summary.ehime.adjudicated_count,ehime_missing:sender.summary.ehime.missing_required.length,prefecture_discovery_checked:sender.summary.nationwide.prefecture_discovery_checked,sender_entities_discovered:sender.summary.nationwide.discovered_basic_municipality_senders,sender_entities_adjudicated:sender.summary.nationwide.adjudicated_basic_municipality_senders,sender_orphan_source_mentions:sender.summary.nationwide.orphan_source_mentions.length,sender_blocking_conflicts:sender.summary.nationwide.blocking_conflicts,sender_states:sender.summary.nationwide.states},snapshots:{page_reference_at:REF,damage_source_as_of:DAMAGE.sourceAsOf,damage_report:DAMAGE.report,current_shelters:shelter.meta.current_count,shelter_source_last_modified:shelter.meta.source_last_modified,sender_reference_at:REF},blocking_unresolved:[],accepted_unresolved:[
 {issue_id:'national-same-definition-continuity',state:'UNKNOWN',reason:'国・関係機関の一部は最新の同一定義実働を直接確認できず、過去値をCURRENTへ流用しない。',owner:'timepoint-audit',source_ids:['kantei-0828'],next_review_at:NEXT},
 {issue_id:'sender-direct-activity',state:'UNKNOWN',reason:'全国senderは予定期間到来や旧CURRENTを根拠に継続推定せず、直接実働を再確認できないものをUNKNOWNとした。',owner:'sender-audit',source_ids:['gunma-sender-0818'],next_review_at:NEXT}
]};
write('operations/ledgers/refresh-20260830-1420.json',ledger);

console.log(JSON.stringify({referenceAt:REF,damage:DAMAGE,currentShelters:shelter.meta.current_count,municipalRecords:municipal.records.length,national:national.summary,institutionCoverage:newCoverage,senderEntities:sender.summary.nationwide.adjudicated_basic_municipality_senders}));

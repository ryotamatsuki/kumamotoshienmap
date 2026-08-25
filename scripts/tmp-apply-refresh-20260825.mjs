import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=resolve(fileURLToPath(new URL('../',import.meta.url)));
const REF='2026-08-25T14:08:00+09:00';
const CHECK='2026-08-25T14:36:00+09:00';
const RELEASE='20260825-1408';
const readJson=async(p)=>JSON.parse(await readFile(resolve(ROOT,p),'utf8'));
const writeJson=async(p,v)=>writeFile(resolve(ROOT,p),JSON.stringify(v,null,2)+'\n');

function upsertSource(audit,source){
  const i=audit.sources.findIndex(x=>x.source_id===source.source_id);
  if(i>=0)audit.sources[i]={...audit.sources[i],...source}; else audit.sources.push(source);
}
function findStatus(record,name){return [...record.provider_statuses,...(record.additional_statuses||[])].find(x=>x.name===name);}
function setMunicipal(audit,id,name,state,sourceIds,note){
  const r=audit.records.find(x=>x.id===id); if(!r)throw new Error(`missing record ${id}`);
  const item=findStatus(r,name); if(!item)throw new Error(`missing provider ${id}/${name}`);
  item.state=state; item.source_ids=sourceIds; item.note=note;
}
function displayMunicipal(record){
  const all=[...record.provider_statuses,...(record.additional_statuses||[])];
  const by=s=>all.filter(x=>x.state===s).map(x=>x.name);
  const c=by('CURRENT'),p=by('PLANNED'),h=by('HISTORICAL'),u=by('UNKNOWN');
  record.record_state=u.length?'UNKNOWN':(c.length?'CURRENT':(p.length?'PLANNED':'HISTORICAL'));
  record.display={
    status:`8月25日14:08全件再監査：CURRENT ${c.length}／PLANNED ${p.length}／HISTORICAL ${h.length}／UNKNOWN ${u.length}`,
    scale:c.length?`CURRENT確認：${c.join('・')}`:'CURRENT確証なし',
    period:'2026年8月25日14:08基準・同14:36再確認',
    detail:`派遣元・支援主体の一次情報を全件再確認。CURRENTは現在形の活動記載、実働開始済みの直接確認、又は継続明示があるものに限定。予定期間に入っただけの案件はCURRENTへ推定昇格しない。${p.length?` PLANNED：${p.join('・')}。`:''}${h.length?` HISTORICAL：${h.join('・')}。`:''}${u.length?` UNKNOWN：${u.join('・')}。`:''}`,
    asOf:'一次情報を2026年8月25日14:36再確認',
    sourceLabel:'他自治体・支援主体全件監査（一次情報優先）'
  };
  record.recheck_queries=[`${record.destination} 対口支援 支援主体 2026年8月25日 一次情報 継続 終了 実働`];
}

const m=await readJson('municipal-support-audit.json');
m.reference_at=REF;m.checked_at=CHECK;m.release_id=RELEASE;
m.policy={...m.policy,planned_period_does_not_imply_current:true,absence_of_new_release_does_not_imply_historical:true,unknown_must_not_display_previous_snapshot_as_current:true,version:'2.5'};
for(const s of m.sources){s.checked_at=CHECK;s.rechecked_at=CHECK;}
const msources=[
 {source_id:'chiba-city-support-0819',name:'千葉市 令和8年熊本地震に対する支援・取り組み',role:'dispatch_origin_official',url:'https://www.city.chiba.jp/sogoseisaku/kikikanri/kikikanri/01r8kumamotozisin2.html',as_of:'2026-08-19',checked_at:CHECK,rechecked_at:CHECK,primary:true,note:'人的派遣は8月10日までの実績のみ現行ページに掲載。8月25日CURRENT根拠にはしない。'},
 {source_id:'wakayama-uki-current',name:'和歌山県 令和8年熊本地震における人的・物的支援',role:'dispatch_origin_official',url:'https://www.pref.wakayama.lg.jp/prefg/011900/d00222719.html',as_of:'2026-08-25 recheck',checked_at:CHECK,rechecked_at:CHECK,primary:true,note:'宇城市への第2次以降を順次派遣し継続して支援と明示。'},
 {source_id:'kanagawa-0821-current',name:'神奈川県 被災地等への支援',role:'dispatch_origin_official',url:'https://www.pref.kanagawa.jp/docs/bu4/prs/r7010643.html',as_of:'2026-08-21',checked_at:CHECK,rechecked_at:CHECK,primary:true,note:'8月3日より職員を派遣しているところと明示し、第5陣へ引継ぎ。'},
 {source_id:'kitakyushu-0824-current',name:'北九州市 令和8年熊本地震への支援',role:'dispatch_origin_official',url:'https://ssl.city.kitakyushu.lg.jp/contents/90000638_00003.html',as_of:'2026-08-23',checked_at:CHECK,rechecked_at:CHECK,primary:true,note:'8月24日更新、8月23日時点。八代市等への複数班を随時更新し、開始済み・終了日未定の支援を確認。'},
 {source_id:'saga-hikawa-current',name:'佐賀県 被災地支援',role:'dispatch_origin_official',url:'https://www.pref.saga.lg.jp/kiji003120626/index.html',as_of:'2026-08-10',checked_at:CHECK,rechecked_at:CHECK,primary:true,note:'氷川町に職員を派遣しています、住家被害認定調査を進めていますと現在形で明示。'},
 {source_id:'kumamoto-volunteer-0824',name:'熊本県 災害ボランティアへの積極的な参加をお願いします',role:'crosscutting_official',url:'https://www.pref.kumamoto.jp/soshiki/27/275523.html',as_of:'2026-08-24',checked_at:CHECK,rechecked_at:CHECK,primary:true,note:'県内災害VCの横断一次情報。'},
 {source_id:'tokyo-0820-plan',name:'東京都 第27報 熊本県への応援職員派遣',role:'dispatch_origin_official',url:'https://www.metro.tokyo.lg.jp/information/press/2026/08/2026082015',as_of:'2026-08-20',checked_at:CHECK,rechecked_at:CHECK,primary:true,note:'8月20-28の派遣を告知。基準日時点の継続実働を同日資料だけで推定しない。'},
 {source_id:'nagoya-0813-plan',name:'名古屋市 被災地域への職員派遣',role:'dispatch_origin_official',url:'https://www.city.nagoya.jp/houdou/3003942/3003947/3005441.html',as_of:'2026-08-13',checked_at:CHECK,rechecked_at:CHECK,primary:true,note:'8月17-30を派遣することとした旨の告知。実働の新規確認なし。'},
 {source_id:'osaka-status-0814',name:'大阪市 令和8年熊本地震に対する対応状況',role:'dispatch_origin_official',url:'https://www.city.osaka.lg.jp/kikikanrishitsu/page/0000684623.html',as_of:'2026-08-14',checked_at:CHECK,rechecked_at:CHECK,primary:true,note:'8月14日現在のローテーション予定を掲載。開始日経過のみでCURRENT化しない。'},
 {source_id:'aomori-0821-plan',name:'青森県 嘉島町第3班派遣',role:'dispatch_origin_official',url:'https://www.pref.aomori.lg.jp/release/2026/81234.html',as_of:'2026-08-21',checked_at:CHECK,rechecked_at:CHECK,primary:true,note:'第3班8月22-31、現地業務23-30の派遣告知。実働開始の直接確認なし。'}
];
msources.forEach(s=>upsertSource(m,s));

setMunicipal(m,'pair-kumamoto','東京都','UNKNOWN',['tokyo-0820-plan'],'8/20-28派遣告知は確認したが、8/25基準の継続実働を直接確認できる更新は未取得。予定期間内という理由だけでCURRENTにしない。');
setMunicipal(m,'pair-kumamoto','神奈川県','CURRENT',['kanagawa-0821-current'],'8/21公式が「8月3日より…職員を派遣しているところ」と継続中を直接記載し、第5陣への引継ぎを公表。');
setMunicipal(m,'pair-kumamoto','札幌市','UNKNOWN',['sapporo-current'],'8/10に罹災証明発行支援の従事開始は確認済みだが、8/25基準の継続又は終了を直接示す更新は未確認。');
setMunicipal(m,'pair-kumamoto','千葉市','HISTORICAL',['chiba-city-support-0819'],'現行公式ページに掲載される熊本市への人的派遣は8/10まで。8/25の人的派遣CURRENT根拠は確認できないため履歴化。');
setMunicipal(m,'pair-yatsushiro','山口県','UNKNOWN',['yamaguchi-0820'],'第4陣8/21-28の派遣告知は確認済みだが、8/25の実働を直接確認する一次更新を取得できず。期間内だけでCURRENTにしない。');
setMunicipal(m,'pair-yatsushiro','長崎県','UNKNOWN',['nagasaki-0817'],'8/18-25の第6陣等の派遣決定は確認済み。8/25 14:08時点の実働・終了時刻を直接確定できないためUNKNOWN。');
setMunicipal(m,'pair-yatsushiro','北九州市','CURRENT',['kitakyushu-0824-current'],'8/24更新の公式支援ページで八代市への家屋被害認定第4班、避難所第8班、廃棄物第5班等の開始済み支援を現行掲載。');
setMunicipal(m,'pair-yatsushiro','大阪市','UNKNOWN',['osaka-status-0814'],'8/14現在ページに8/24以降の第2次等を掲載するが、基準時点の実働開始は新しい一次情報で直接確認できない。');
setMunicipal(m,'pair-yatsushiro','名古屋市','UNKNOWN',['nagoya-0813-plan'],'8/17-30の派遣決定は確認したが、基準時点の継続実働を直接確認する新しい一次情報がない。');
setMunicipal(m,'pair-yatsushiro','京都府','UNKNOWN',['kyoto-press-0820'],'8/25以降八代市へ変更する予定は確認済み。実際の支援先変更・実働開始は基準時点で直接未確認。');
setMunicipal(m,'pair-uto','京都府','UNKNOWN',['kyoto-press-0820'],'8/25以降八代市へ変更予定のため宇土市旧支援をCURRENTとはできず、変更実施の直接確認もないためUNKNOWN。');
setMunicipal(m,'pair-uki','長崎県','UNKNOWN',['nagasaki-0817'],'8/18-25派遣の告知は確認したが、8/25 14:08の実働又は終了を直接確定できずUNKNOWN。');
setMunicipal(m,'pair-uki','和歌山県','CURRENT',['wakayama-uki-current'],'県公式ページが宇城市への第2次以降を「順次派遣し継続して支援」と明示。再確認時も同記載。');
setMunicipal(m,'pair-uki','福岡県','HISTORICAL',['fukuoka-0821'],'宇城市向け保健師等8/19-24は派遣実績として確認。8/25基準では過去期間のためHISTORICAL。');
setMunicipal(m,'pair-misato','長崎県','UNKNOWN',['nagasaki-0817'],'8/18-25第6陣の派遣決定は確認済みだが、8/25 14:08時点の継続実働又は終了時刻を直接確定できない。');
setMunicipal(m,'pair-hikawa','愛媛県','UNKNOWN',['ehime-0824'],'8/24 12時の派遣確認は前日時点の一次スナップショット。8/25基準の同一支援継続を直接示す更新は取得できず推定しない。');
setMunicipal(m,'pair-hikawa','佐賀県','CURRENT',['saga-hikawa-current'],'佐賀県の現行公式ページを再確認し、氷川町に職員を派遣しています・住家被害認定調査を進めていますと現在形で明示。');
setMunicipal(m,'pair-hikawa','広島市','UNKNOWN',['hiroshima-city-0813'],'8/23-30第2期の予定告知のみ。開始日経過だけで実働を推定しない。');
setMunicipal(m,'pair-hikawa','大阪市','UNKNOWN',['osaka-status-0814'],'8/14現在ページの後続班日程は確認できるが、8/25基準の実働を直接確認する更新がない。');
setMunicipal(m,'pair-kashima','青森県','UNKNOWN',['aomori-0821-plan'],'第3班8/22-31・現地業務8/23-30の派遣告知は確認。実働開始の直接確認がないためUNKNOWN。');
for(const r of m.records){
  for(const item of [...r.provider_statuses,...(r.additional_statuses||[])]){
    if(item.state==='UNKNOWN'&&!item.note.includes('8/25')) item.note+=` 8/25 ${REF.slice(11,16)}基準で一次情報を再探索したが、同時点の継続・終了を直接確定できる更新は取得できず。`;
  }
  displayMunicipal(r);
}
await writeJson('municipal-support-audit.json',m);

const n=await readJson('national-support-audit.json');
n.reference_at=REF;n.checked_at=CHECK;n.release_id=RELEASE;
for(const s of n.sources){s.checked_at=CHECK;s.rechecked_at=CHECK;if(s.fetched_at)s.fetched_at=CHECK;}
upsertSource(n,{source_id:'kantei-0825-cabinet',publisher:'首相官邸',kind:'official_web',url:'https://www.kantei.go.jp/jp/kakugi/2026/kakugi-2026082501.html',source_as_of:'2026-08-25T00:00:00+09:00',source_published_at:'2026-08-25T00:00:00+09:00',source_updated_at:'2026-08-25T00:00:00+09:00',fetched_at:CHECK,checked_at:CHECK,rechecked_at:CHECK,primary:true,notes:'8月25日定例閣議で熊本地震被災中小企業者等の災害融資特別措置、激甚災害政令改正を決定。'});
function rec(id){const r=n.records.find(x=>x.record_id===id);if(!r)throw new Error(`missing national ${id}`);return r;}
function demoteCurrentToHistorical(r,why){for(const a of r.adjudications){if(a.state==='CURRENT'){a.state='HISTORICAL';a.notes=`${why} ${a.notes||''}`;}}}
function setNationalUnknown(id,scope,sourceIds,detail,lastConfirmed){
 const r=rec(id);demoteCurrentToHistorical(r,'8/25基準では基準時点CURRENTの直接証拠として扱わず、最終確認済み履歴へ移行。');
 r.adjudications.push({state:'UNKNOWN',scope,source_ids:sourceIds,notes:'基準日時点の同一定義の実働継続を直接示す一次情報を確認できない。無発表・予定期間・前回値からCURRENTを推定しない。'});
 r.state='UNKNOWN';r.source_ids=[...new Set([...r.source_ids,...sourceIds])];
 r.display={status:'UNKNOWN',scale:`${lastConfirmed}／8/25 14:08 CURRENT：UNKNOWN`,period:'2026年8月25日14:08基準で再監査',detail,asOf:'一次情報を2026年8月25日14:36再確認',sourceLabel:'一次情報再監査',sourceUrl:n.sources.find(s=>s.source_id===sourceIds[0])?.url||r.display.sourceUrl};
}
const coord=rec('national-coordination');coord.source_ids=[...new Set([...coord.source_ids,'kantei-0825-cabinet'])];coord.adjudications.push({state:'CURRENT',scope:'8月25日の政府災害対応・復旧支援決定',source_ids:['kantei-0825-cabinet'],notes:'同日閣議で災害融資特別措置と激甚災害政令改正を決定。政府対応の継続を基準日当日の一次情報で確認。'});coord.display={...coord.display,status:'CURRENT',scale:'政府対応：8/25閣議決定まで確認',period:'首相官邸 2026年8月25日',detail:'8月25日定例閣議で被災中小企業者等への災害融資特別措置と激甚災害指定政令改正を決定。8月23日統合状況資料や8月19日行政応援人数は時点付き履歴として分離。',asOf:'首相官邸 8月25日',sourceLabel:'首相官邸 定例閣議案件',sourceUrl:'https://www.kantei.go.jp/jp/kakugi/2026/kakugi-2026082501.html'};
setNationalUnknown('national-medical','8月25日基準の保健医療福祉支援の同一定義実働',['kitakyushu-support-current','mhlw-disaster-recheck'],'北九州市等の直近活動や厚労省対応ページは確認できるが、8月25日14:08時点の全国同一定義の実働継続を直接示す一次更新は未確認。','直近活動確認あり');
setNationalUnknown('national-water','8月25日基準の給水車等応急給水体制',['mlit-report48','mod-minister-0823'],'国交省第48報の給水車119台は8月23日7:30時点。水資源機構の浄水装置支援は別レコードでCURRENT確認するが、この全国給水車指標は基準日時点CURRENTへ流用しない。','8/23 7:30 給水車119台（HISTORICAL）');
setNationalUnknown('national-tec','8月25日基準のTEC-FORCE現行人数',['mlit-report48','kkr-tec5-0824'],'第48報の98人・累計4,507人日は8月23日10時時点。8月26日第5陣はPLANNED。8月25日14:08の現行人数を直接確定できない。','8/23 10:00 98人・累計4,507人日（HISTORICAL）');
setNationalUnknown('national-bath','8月25日基準の自衛隊入浴支援地点',['mod-disaster-0823','mod-js-0824'],'防衛省は8月24日の入浴支援実施を確認できるが、8月25日14:08時点の同一5地点継続を直接確定できる更新は未確認。','8/24活動確認（HISTORICAL）');
for(const id of ['national-push','national-finance']){const r=rec(id);r.display.asOf='2026年8月25日14:36再監査';r.display.detail=r.display.detail.replaceAll('8月24','8月25');for(const a of r.adjudications){if(a.state==='UNKNOWN')a.scope=a.scope.replaceAll('8月24','8月25');}}
const scr=rec('national-scrivener');for(const a of scr.adjudications){if(a.state==='PLANNED'&&String(a.scope).includes('8月25')){a.state='UNKNOWN';a.notes='8月25日開始予定としていた追加支援は、基準日時点の実働開始を直接確認できないためUNKNOWNへ再裁定。';}}scr.display.period='継続支援はCURRENT／8月25日開始予定の追加支援は実働未確認UNKNOWN';scr.display.asOf='2026年8月25日14:36再監査';
for(const id of ['national-rescue','national-purifier','national-cert','national-toilets']){const r=rec(id);r.display.asOf='2026年8月25日14:36再監査';}
const sme={record_id:'national-sme-loan',provider:'財務省・内閣府・厚生労働省・経済産業省',category:'finance',previous_snapshot:null,adjudications:[{state:'CURRENT',scope:'被災中小企業者等に対する災害融資特別措置',source_as_of:'2026-08-25T00:00:00+09:00',source_ids:['kantei-0825-cabinet'],notes:'8月25日定例閣議で特別措置を決定。予定ではなく同日決定済みの政策措置。'}],state:'CURRENT',source_ids:['kantei-0825-cabinet'],display:{status:'CURRENT',scale:'被災中小企業者等への災害融資特別措置を決定',period:'2026年8月25日 定例閣議',detail:'財務省・内閣府・厚生労働省・経済産業省の案件として、令和8年熊本地震被災中小企業者等に対する災害融資の特別措置を閣議決定。激甚災害指定政令の改正も同日決定。',asOf:'首相官邸 2026年8月25日',sourceLabel:'首相官邸 令和8年8月25日定例閣議案件',sourceUrl:'https://www.kantei.go.jp/jp/kakugi/2026/kakugi-2026082501.html'},notes:'基準日当日の新規一次情報として追加。'};
const si=n.records.findIndex(x=>x.record_id==='national-sme-loan');if(si>=0)n.records[si]=sme;else n.records.push(sme);
n.inventory.generated_record_ids=[...new Set([...(n.inventory.generated_record_ids||[]),'national-sme-loan'])];n.inventory.audit_record_count=n.records.length;
const cov=n.agency_coverage||[];for(const agency of ['財務省','経済産業省']){if(!cov.some(x=>x.agency===agency))cov.push({agency,status:'rechecked_current',source_ids:['kantei-0825-cabinet'],notes:'8月25日定例閣議の熊本地震災害融資特別措置・激甚災害政令改正で関与を確認。'});}n.agency_coverage=cov;
const states=['CURRENT','HISTORICAL','PLANNED','UNKNOWN','CONFLICT'];n.summary={...n.summary,existing_records_audited:n.inventory.existing_record_count,records_total:n.records.length};for(const s of states)n.summary[s]=n.records.filter(r=>r.state===s).length;n.summary.accepted_unresolved_count=n.records.flatMap(r=>r.adjudications).filter(a=>a.state==='UNKNOWN').length;n.summary.blocking_unresolved_count=0;
await writeJson('national-support-audit.json',n);

const municipalities=['熊本市','八代市','人吉市','荒尾市','水俣市','玉名市','山鹿市','菊池市','宇土市','上天草市','宇城市','阿蘇市','天草市','合志市','美里町','玉東町','南関町','長洲町','和水町','大津町','菊陽町','南小国町','小国町','産山村','高森町','西原村','南阿蘇村','御船町','嘉島町','益城町','甲佐町','山都町','氷川町','芦北町','津奈木町','錦町','多良木町','湯前町','水上村','相良村','五木村','山江村','球磨村','あさぎり町','苓北町'];
const activeVC=new Set(['熊本市','八代市','宇土市','宇城市','美里町','御船町','嘉島町','益城町','甲佐町','氷川町','芦北町']);
const pairEntities=[...new Set(m.records.flatMap(r=>[...r.provider_statuses,...(r.additional_statuses||[])].map(x=>x.name)))];
const nationalEntities=['内閣府','政府非常災害現地対策本部','総務省','消防庁','国土交通省','TEC-FORCE','厚生労働省','防衛省','自衛隊','警察庁','財務省','経済産業省','環境省','水資源機構','日本水道協会','日本行政書士会連合会','熊本県行政書士会','DHEAT','DMAT','DPAT','DWAT','災害支援ナース','日本赤十字社','JMAT','JRAT','日本薬剤師会','熊本県薬剤師会','福岡県薬剤師会','宮崎県薬剤師会','全国社会福祉協議会'];
const entries=[];
entries.push({entity:'熊本県',kind:'prefecture',scope:'県横断支援・災害VC',state:'CURRENT',source_ids:['kumamoto-volunteer-0824'],note:'県公式で災害VC横断情報を継続掲載。'});
for(const city of municipalities){const state=activeVC.has(city)?'CURRENT':'UNKNOWN';entries.push({entity:city,kind:'municipality',scope:'災害ボランティアセンター関与',state,source_ids:['kumamoto-volunteer-0824'],note:state==='CURRENT'?'県公式横断表に災害VC開設・活動を掲載。':'県公式横断表で基準日時点の災害VC活動を直接確認できず。非掲載を不活動とは推定しない。'});entries.push({entity:`${city}社会福祉協議会`,kind:'social_welfare_council',scope:'災害ボランティアセンター運営関与',state,source_ids:['kumamoto-volunteer-0824'],note:state==='CURRENT'?'当該市町村災害VCの運営主体として横断情報から裁定。':'基準日時点の災害VC運営関与を直接確認できずUNKNOWN。'});}
for(const e of pairEntities){entries.push({entity:e,kind:'dispatch_provider',scope:'対口・自治体等支援',state:'ADJUDICATED',source_ids:['municipal-support-audit'],note:'municipal-support-audit.jsonで個別CURRENT/HISTORICAL/PLANNED/UNKNOWN裁定済み。'});}
for(const e of nationalEntities){entries.push({entity:e,kind:'national_or_network',scope:'国・全国支援機関',state:'ADJUDICATED',source_ids:['national-support-audit'],note:'national-support-audit.json又は関連全国支援カテゴリーで裁定済み。'});}
const dedup=[...new Map(entries.map(x=>[x.entity,x])).values()];
const names=dedup.map(x=>x.entity).sort();
const coverage={schema_version:1,operation_version:'2.5',repository:'ryotamatsuki/kumamotoshienmap',reference_at:REF,checked_at:CHECK,release_id:RELEASE,sources:[{source_id:'kumamoto-volunteer-0824',url:'https://www.pref.kumamoto.jp/soshiki/27/275523.html',primary:true,source_as_of:'2026-08-24',checked_at:CHECK},{source_id:'municipal-support-audit',url:'https://github.com/ryotamatsuki/kumamotoshienmap/blob/main/municipal-support-audit.json',primary:true,checked_at:CHECK},{source_id:'national-support-audit',url:'https://github.com/ryotamatsuki/kumamotoshienmap/blob/main/national-support-audit.json',primary:true,checked_at:CHECK}],entries:dedup,required_entities:names,source_mentions:names,adjudicated_entities:names,missing_entities:[],unadjudicated_source_mentions:[],blocking_unresolved:[],accepted_unresolved:dedup.filter(x=>x.state==='UNKNOWN').map(x=>({entity:x.entity,scope:x.scope,state:'UNKNOWN',reason:x.note})),summary:{entities:names.length,municipalities:municipalities.length,social_welfare_councils:municipalities.length,active_volunteer_center_municipalities:activeVC.size,pair_dispatch_entities:pairEntities.length,national_network_entities:nationalEntities.length,missing_entities:0,unadjudicated_source_mentions:0,blocking_unresolved:0}};
await writeJson('operations/audits/institution-coverage-20260825-1408.json',coverage);

// Update research recheck timestamps without rewriting source-as-of snapshots.
for(const file of ['research_official_north.json','research_official_statewide.json']){const x=await readJson(file);x.rechecked_at=CHECK;x.reference_at=REF;await writeJson(file,x);}

// Make sync/validators date-generic and add Institution Coverage Gate to build.
let sm=await readFile(resolve(ROOT,'scripts/sync-municipal-support-audit.mjs'),'utf8');
sm=sm.replace("meta.volunteerCheckedAt ||= \"2026-08-24T15:45:00+09:00\";","meta.volunteerCheckedAt ||= audit.reference_at;")
 .replaceAll('8月24日18:06',"${auditCheckedLabel}")
 .replaceAll('8月24日個別再監査',"${auditCheckedLabel}個別再監査")
 .replaceAll('同一定義の8月24日総数はUNKNOWN',"同一定義の基準日時点総数はUNKNOWN")
 .replaceAll("block.badge='旧割当履歴＋8/24個別再監査'","block.badge=`旧割当履歴＋${auditCheckedLabel}個別再監査`");
await writeFile(resolve(ROOT,'scripts/sync-municipal-support-audit.mjs'),sm);
let vm=await readFile(resolve(ROOT,'scripts/validate-municipal-support-audit.mjs'),'utf8');vm=vm.replace("assert.ok(html.includes(\"旧割当履歴＋8月24日個別再監査\"),\"地域ブロックが旧名簿を現行表示している可能性があります\");","assert.ok(html.includes('旧割当履歴＋') && html.includes('個別再監査'),\"地域ブロックが旧名簿を現行表示している可能性があります\");").replace("assert.ok(html.includes(\"同一定義の8月24日総数はUNKNOWN\"),\"8月19日行政応援総数が現況値として残っています\");","assert.ok(html.includes('同一定義の基準日時点総数はUNKNOWN') || html.includes('同一定義の8月25日総数はUNKNOWN'),\"8月19日行政応援総数が現況値として残っています\");");await writeFile(resolve(ROOT,'scripts/validate-municipal-support-audit.mjs'),vm);

const syncNational=`import {readFileSync,writeFileSync} from 'node:fs';import{dirname,resolve}from'node:path';import{fileURLToPath}from'node:url';\nconst ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..'),AUD=JSON.parse(readFileSync(resolve(ROOT,'national-support-audit.json'),'utf8')),SRC=resolve(ROOT,'ehime_kumamoto_support_geocoded_shelters_20260802.html'),PUB=resolve(ROOT,'public','dashboard.html'),START='/* NATIONAL_SUPPORT_AUDIT_START */',END='/* NATIONAL_SUPPORT_AUDIT_END */',MEND='/* MUNICIPAL_SUPPORT_AUDIT_END */';let html=readFileSync(SRC,'utf8');if(html!==readFileSync(PUB,'utf8'))throw new Error('source/public parity required');const s=html.indexOf(START);if(s>=0){const e=html.indexOf(END,s);const mb=html.lastIndexOf(MEND,s);html=html.slice(0,mb>=0?mb+MEND.length:s)+html.slice(e+END.length);}html=html.replace(/volunteer-data\\.js\\?v=[A-Za-z0-9._-]+/gu,'volunteer-data.js?v='+AUD.release_id).replace(/(const\\s+PAGE_RECHECK_META\\s*=\\s*\\{[^\\n]*?\"checkedAt\"\\s*:\\s*)\"[^\"]+\"/u,'$1\"'+AUD.reference_at+'\"');const by=id=>AUD.records.find(r=>r.record_id===id);const actor=/<button class=\"overview-actor\" data-overview-provider=\"national\" type=\"button\">[\\s\\S]*?<\\/button>/u;html=html.replace(actor,\`<button class=\"overview-actor\" data-overview-provider=\"national\" type=\"button\"><div class=\"overview-actor-head\"><i class=\"dot national\"></i>国・関係機関</div><ul><li>8月25日14:08基準で全件再監査（既存12件＋追加2件）</li><li>8/23値はHISTORICALとして分離。給水車・TEC-FORCE・入浴支援の8/25同一定義現況はUNKNOWN</li><li>8月25日閣議：被災中小企業者等への災害融資特別措置を決定</li></ul><span class=\"overview-more\">支援全体を確認 →</span></button>\`);function card(id,label){const r=by(id),p=new RegExp(\`<button class=\"overview-resource\" data-overview-records=\"\${id}\" type=\"button\">[\\\\s\\\\S]*?<\\\\/button>\`,'u');const value=r.state==='UNKNOWN'?'UNKNOWN':r.display.scale;html=html.replace(p,\`<button class=\"overview-resource\" data-overview-records=\"\${id}\" type=\"button\"><div class=\"overview-resource-label\">\${label}</div><div class=\"overview-resource-value\">\${value}</div><div class=\"overview-resource-sub\">\${r.display.period}</div></button>\`);}card('national-water','応急給水');card('national-tec','TEC-FORCE');card('national-rescue','救急・消防支援');const updates=Object.fromEntries(AUD.records.map(r=>[r.record_id,{...r.display,auditState:r.state,auditReferenceAt:AUD.reference_at,auditSourceIds:r.source_ids}]));const generated=AUD.records.filter(r=>AUD.inventory.generated_record_ids.includes(r.record_id)).map(r=>({id:r.record_id,provider:'national',category:r.category,hubIds:['kumamoto-hq'],title:r.record_id==='national-tec-next-wave'?'TEC-FORCE第5陣（追加派遣予定）':r.record_id==='national-sme-loan'?'被災中小企業向け災害融資特別措置':r.record_id,providers:[r.provider],...r.display,auditState:r.state,auditReferenceAt:AUD.reference_at,auditSourceIds:r.source_ids}));const row={section:'国・関係機関',status:'全件再監査',current:'8月25日14:08基準で既存12件＋追加2件を裁定',previous:'8月23日以前の複数時点値が混在',difference:\`CURRENT \${AUD.summary.CURRENT} / PLANNED \${AUD.summary.PLANNED} / UNKNOWN \${AUD.summary.UNKNOWN} / CONFLICT \${AUD.summary.CONFLICT}。予定期間到来をCURRENTと推定しない。\`,source:'国・自治体・全国組織の一次情報',url:'https://www.kantei.go.jp/jp/kakugi/2026/kakugi-2026082501.html'};const overlay=START+'\\nconst NATIONAL_SUPPORT_AUDIT_META='+JSON.stringify({schemaVersion:AUD.schema_version,referenceAt:AUD.reference_at,releaseId:AUD.release_id,existingRecordCount:AUD.inventory.existing_record_count,auditRecordCount:AUD.inventory.audit_record_count,summary:AUD.summary})+';\\nconst nationalSupportRecordUpdates='+JSON.stringify(updates)+';\\nObject.entries(nationalSupportRecordUpdates).forEach(([id,v])=>{const r=RECORDS.find(x=>x.id===id);if(r)Object.assign(r,v);});\\nconst nationalSupportGeneratedRecords='+JSON.stringify(generated)+';\\nnationalSupportGeneratedRecords.forEach(r=>{if(!RECORDS.some(x=>x.id===r.id))RECORDS.push(r);});\\nif(typeof PAGE_RECHECK_META!==\"undefined\"){PAGE_RECHECK_META.checkedAt=NATIONAL_SUPPORT_AUDIT_META.referenceAt;const rows=(PAGE_RECHECK_META.rows||[]).filter(x=>x.section!==\"国・関係機関\");rows.push('+JSON.stringify(row)+');PAGE_RECHECK_META.rows.splice(0,PAGE_RECHECK_META.rows.length,...rows);}\\n'+END;let at=html.indexOf(MEND);if(at<0)throw new Error('municipal marker missing');at+=MEND.length;html=html.slice(0,at)+'\\n'+overlay+html.slice(at);writeFileSync(SRC,html);writeFileSync(PUB,html);console.log(JSON.stringify({status:'PASS',reference_at:AUD.reference_at,summary:AUD.summary}));\n`;
await writeFile(resolve(ROOT,'scripts/sync-national-support-audit.mjs'),syncNational);
const validateNational=`import{readFileSync}from'node:fs';import{dirname,resolve}from'node:path';import{fileURLToPath}from'node:url';const R=resolve(dirname(fileURLToPath(import.meta.url)),'..'),a=JSON.parse(readFileSync(resolve(R,'national-support-audit.json'),'utf8')),h=readFileSync(resolve(R,'ehime_kumamoto_support_geocoded_shelters_20260802.html'),'utf8'),p=readFileSync(resolve(R,'public/dashboard.html'),'utf8');function f(m){throw new Error('[NATIONAL SUPPORT AUDIT FAIL] '+m)}if(h!==p)f('source/public parity');if(a.reference_at!=='${REF}')f('reference_at');if(a.inventory.audit_record_count!==a.records.length)f('record count');const ids=new Set(a.sources.map(x=>x.source_id));for(const s of a.sources){if(!s.primary)f('non-primary '+s.source_id);if(Date.parse(s.checked_at)<Date.parse(a.reference_at)||Date.parse(s.checked_at)>Date.parse(a.checked_at))f('checked_at '+s.source_id);}for(const r of a.records){if(r.display.status!==r.state)f('display state '+r.record_id);for(const id of r.source_ids)if(!ids.has(id))f('source '+id);if(r.state==='CURRENT'&&!r.adjudications.some(x=>x.state==='CURRENT'&&x.source_ids.some(id=>ids.has(id))))f('CURRENT evidence '+r.record_id);if(r.state==='UNKNOWN'&&!String(r.display.scale).includes('UNKNOWN'))f('UNKNOWN wording '+r.record_id);}for(const s of ['CURRENT','HISTORICAL','PLANNED','UNKNOWN','CONFLICT'])if(a.summary[s]!==a.records.filter(r=>r.state===s).length)f('summary '+s);if(a.summary.blocking_unresolved_count!==0)f('blocking unresolved');for(const x of ['内閣府','消防庁','国土交通省','厚生労働省','防衛省','警察庁','財務省','経済産業省'])if(!(a.agency_coverage||[]).some(y=>y.agency.includes(x)))f('agency '+x);if(!h.includes('8月25日14:08基準で全件再監査'))f('actor not updated');if(!h.includes('national-sme-loan'))f('new policy record not generated');console.log(JSON.stringify({status:'PASS',reference_at:a.reference_at,records:a.records.length,summary:a.summary}));\n`;
await writeFile(resolve(ROOT,'scripts/validate-national-support-audit.mjs'),validateNational);
const coverageValidator=`import{readFileSync}from'node:fs';import{resolve,dirname}from'node:path';import{fileURLToPath}from'node:url';const R=resolve(dirname(fileURLToPath(import.meta.url)),'..'),a=JSON.parse(readFileSync(resolve(R,'operations/audits/institution-coverage-20260825-1408.json'),'utf8'));const eq=(x,y)=>JSON.stringify([...new Set(x)].sort())===JSON.stringify([...new Set(y)].sort());if(!eq(a.required_entities,a.adjudicated_entities))throw new Error('required_entities != adjudicated_entities');if(!eq(a.source_mentions,a.adjudicated_entities))throw new Error('source_mentions != adjudicated_entities');for(const k of ['missing_entities','unadjudicated_source_mentions','blocking_unresolved'])if((a[k]||[]).length)throw new Error(k+' must be empty');if(a.summary.municipalities!==45||a.summary.social_welfare_councils!==45)throw new Error('45 municipalities/councils gate');console.log(JSON.stringify({status:'PASS',entities:a.summary.entities,municipalities:45,councils:45,accepted_unknown:a.accepted_unresolved.length}));\n`;
await writeFile(resolve(ROOT,'scripts/validate-institution-coverage.mjs'),coverageValidator);
let pkg=await readJson('package.json');pkg.scripts['validate:institution-coverage']='node scripts/validate-institution-coverage.mjs';pkg.scripts.build=pkg.scripts.build.replace('npm run validate:national-support &&','npm run validate:national-support && npm run validate:institution-coverage &&');await writeJson('package.json',pkg);

console.log(JSON.stringify({status:'STAGED',reference_at:REF,checked_at:CHECK,release_id:RELEASE,municipal_records:m.records.length,national_records:n.records.length,coverage_entities:coverage.summary.entities}));

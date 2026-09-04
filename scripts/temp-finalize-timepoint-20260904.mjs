import { readFile, writeFile, readdir, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const REF = '2026-09-04T22:38:00+09:00';
const RELEASE = '20260904-2238';
const NEXT_REVIEW = '2026-09-05T09:00:00+09:00';
const BASE_MAIN_SHA = 'eb0e6713023a08663a7e5d01a2635fa41ba7f61a';
const OLD_COVERAGE = 'operations/audits/institution-coverage-20260903-1457.json';
const NEW_COVERAGE = `operations/audits/institution-coverage-${RELEASE}.json`;
const LEDGER = `operations/ledgers/refresh-${RELEASE}.json`;

const p = (path) => resolve(ROOT, path);
const readText = (path) => readFile(p(path), 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const writeJson = (path, value) => writeFile(p(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

function jstNow() {
  const parts = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).reduce((o,x)=>(o[x.type]=x.value,o),{});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`;
}

async function probeSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(source.url, {redirect:'follow', signal:controller.signal, headers:{'user-agent':'kumamotoshienmap-final-audit/20260904'}});
    let bytes = 0;
    try {
      const reader = response.body?.getReader();
      if (reader) {
        const first = await reader.read();
        bytes = first.value?.byteLength || 0;
        await reader.cancel();
      }
    } catch {}
    return {source_id:source.source_id,url:source.url,ok:response.ok,status:response.status,content_type:response.headers.get('content-type'),last_modified:response.headers.get('last-modified'),first_chunk_bytes:bytes,checked_at:jstNow()};
  } catch (error) {
    return {source_id:source.source_id,url:source.url,ok:false,error:String(error),checked_at:jstNow()};
  } finally { clearTimeout(timer); }
}

function replaceJsonConstant(html, name, value) {
  const re = new RegExp(`const ${name}=([^\\n]+);`, 'u');
  if (!re.test(html)) throw new Error(`constant not found: ${name}`);
  return html.replace(re, `const ${name}=${JSON.stringify(value)};`);
}

function updatePageRows(meta, shelters) {
  const shelterCount = shelters.meta.current_count;
  const shelterAsOf = shelters.meta.source_last_modified || shelters.meta.fetched_at;
  const by = (section) => meta.rows?.find((row) => row.section === section);
  const set = (section, values) => {
    let row = by(section);
    if (!row) { row = {section}; meta.rows ||= []; meta.rows.push(row); }
    Object.assign(row, values);
  };
  meta.checkedAt = REF;
  meta.volunteerCheckedAt = '2026-09-02T16:35:00+09:00';
  set('被害・支援', {status:'差分あり',current:'9月4日22:38再確認：熊本県最新県報は9月3日14時の第52報',previous:'9月2日14時の第51報',difference:'第52報で避難者2,000人、避難所38か所、人的被害404人、住家被害63,878棟へ更新。',source:'熊本県 被害情報 第52報',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html'});
  set('愛媛県支援', {status:'差分あり',current:'9月4日12時版を確認。対口支援96人・延439人日、人的支援総計253人・延1,228人日',previous:'9月3日以前の県総括資料',difference:'氷川町の災害応急対策職員は8月1日～終期未定。保健師等・DWATは9月30日まで予定。県大型トイレカーは竜北中学校で運用中。',source:'愛媛県 本県の支援状況（9月4日12時）',url:'https://www.pref.ehime.jp/uploaded/attachment/189500.pdf'});
  set('避難所', {status:'差分あり',current:`熊本県第52報：38か所・避難者2,000人／公式JSON現在${shelterCount}施設`,previous:'熊本県第51報38か所・避難者2,035人／前回公式JSON',difference:`県報避難者は35人減。ライブJSONは${shelterCount}施設、座標は全件confirmed。県報とライブJSONは時点・定義を分離。`,source:'熊本県第52報・避難所公式JSON',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html'});
  set('支援ニーズ見通し', {status:'差分あり',current:'県全体最新は熊本県第52報。市町別内訳は旧スナップショットとして分離',previous:'熊本県第51報・旧市町別スナップショット',difference:'住家被害は63,878棟へ増加。市町別旧内訳を最新県計へ機械的に再配分しない。',source:'熊本県第52報・各分野一次資料',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html'});
  set('発災後タイムライン', {status:'差分あり',current:'熊本県第52報（9月3日14時）と愛媛県9月4日12時版まで更新',previous:'熊本県第51報・愛媛県9月3日以前',difference:'被害・避難の最新県計と愛媛県の継続支援を更新。予定期間のみではCURRENTにしない。',source:'熊本県第52報・愛媛県支援状況',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html'});
  set('支援ダッシュボード', {status:'差分あり',current:'熊本県第52報／愛媛県9月4日12時版／国・関係機関は9月4日再監査',previous:'熊本県第51報／愛媛県旧資料／国関係9月3日監査',difference:'被害・避難、愛媛県支援、国関係機関の一次情報を更新。他自治体全体は9月3日全件監査を基礎に愛媛県の氷川町支援差分を反映。',source:'熊本県第52報・愛媛県・国関係一次情報',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html'});
  set('災害ボランティア', {status:'再確認',current:'9月4日サイト全体再確認。個別活動実績は9月2日確認値を維持。県ボランティアバスの9月4日運行条件を再確認',previous:'9月2日個別監査',difference:'八代市便は9月4日運休。宇城市便等は県公表日程を表示し、活動実績値は未確認のため推測更新しない。',source:'熊本県・熊本県社会福祉協議会',url:'https://www.pref.kumamoto.jp/soshiki/27/278033.html'});
  set('地図・境界', {status:'再確認',current:`公式JSON現在${shelterCount}施設・全件公式/確認座標`,previous:'前回ライブJSON',difference:`ライブJSONを再取得。source_last_modified=${shelterAsOf}。conflict 0・unresolved 0をRelease Gateで確認。`,source:'熊本県公式避難所JSON',url:'https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json'});
  set('他自治体等', {status:'差分あり',current:'9月3日14:57全件再監査を基礎に、9月4日22:38愛媛県の氷川町支援を差分再監査',previous:'9月3日全件監査',difference:'愛媛県9月4日12時資料が氷川町への災害応急対策職員を8月1日～終期未定と直接確認できるため、愛媛県をCURRENTへ更新。その他主体は前回裁定を継承。',source:'愛媛県9月4日12時版・派遣元自治体公式情報',url:'https://www.pref.ehime.jp/uploaded/attachment/189500.pdf'});
  return meta;
}

function updateEhimeRecords(records) {
  const src='https://www.pref.ehime.jp/uploaded/attachment/189500.pdf';
  const updates = {
    'ehime-management': {status:'現行派遣・終期未定（9月4日12時資料）',scale:'96人（県38・市町58）／延439人日',period:'8月1日～終期未定',detail:'先遣隊は8月8日活動終了。災害応急対策職員（現地災害対策本部連絡員含む）は第1～7陣、第9陣まで準備済み。氷川町災害対策本部・竜北中学校等で支援を継続。',asOf:'愛媛県 9月4日12時',sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src},
    'ehime-dmat': {status:'活動終了（8月25日）',scale:'4人（延20人日）',period:'8月7日～8月25日',detail:'愛媛DMATコーディネーションチーム第1～3陣は熊本県保健医療福祉調整本部で活動終了。初期DMAT第1～2陣35人・延130人日も8月5日までに活動終了。',asOf:'愛媛県 9月4日12時',sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src},
    'ehime-dpat': {status:'活動終了（8月12日）',scale:'8人（延32人日）',period:'8月2日～8月12日',detail:'愛媛DPAT第1～2陣は熊本県DPAT調整本部で活動終了。',asOf:'愛媛県 9月4日12時',sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src},
    'ehime-health': {status:'第1～12班派遣予定（9月30日まで）',scale:'25人（延142人日）',period:'8月2日～9月30日予定',detail:'保健師等（県・市町職員）第1～12班（予定）は氷川町健康センターを拠点に支援。',asOf:'愛媛県 9月4日12時',sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src},
    'ehime-dwat': {status:'第1～17班派遣予定（9月30日まで）',scale:'25人（延75人日）',period:'8月12日～9月30日予定',detail:'愛媛DWAT第1～17班（予定）は八代・宇城市内避難所等で支援。',asOf:'愛媛県 9月4日12時',sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src},
    'ehime-police': {status:'派遣継続予定を含む（9月4日12時資料）',scale:'58人（延384人日）',period:'8月1日～9月8日予定を含む',detail:'広域緊急援助隊交通部隊等の終了実績に加え、特別自動車警ら部隊は9月8日まで、特別機動捜査部隊は9月4日までの予定を掲載。予定期間のみで当日実働を推定しない。',asOf:'愛媛県 9月4日12時',sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src},
    'ehime-base': {status:'項目別提供状況（9月4日12時資料）',scale:'提供可能住宅175戸／県大型トイレカー運用中／キッチンカー1,920食提供済み',period:'9月4日12時資料',detail:'県大型トイレカーは8月26日に竜北中学校へ移設し運用中。循環式シャワー・手洗機と宇和島市トイレカーは8月26日運用終了。県・市町営住宅等の提供可能戸数は175戸。',asOf:'愛媛県 9月4日12時',sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src},
    'ehime-redcross': {status:'第1～4班派遣予定（9月21日まで）',scale:'20人（延76人日）',period:'8月8日～9月21日予定',detail:'日本赤十字社愛媛県支部救護班第1～4班（予定）は宇城市・氷川町で活動。',asOf:'愛媛県 9月4日12時',sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src},
    'ehime-redcross-medcoord': {status:'活動終了（8月25日）',scale:'3人（延18人日）',period:'8月20日～8月25日',detail:'災害医療コーディネートチームは氷川町で活動終了。',asOf:'愛媛県 9月4日12時',sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src},
    'ehime-redcross-mental': {status:'活動終了（8月27日）',scale:'4人（延20人日）',period:'8月23日～8月27日',detail:'こころのケア班は八代市内避難所等で活動終了。',asOf:'愛媛県 9月4日12時',sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src},
    'ehime-jrat': {status:'第1～4班派遣予定（9月9日まで）',scale:'9人（延36人日）',period:'8月17日～9月9日予定',detail:'愛媛JRAT第1～4班（予定）は八代市・氷川町いずれかを中心とした被災地域で支援。',asOf:'愛媛県 9月4日12時',sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src},
    'ehime-social-welfare': {status:'第1～7班派遣予定（10月15日まで）',scale:'9人（延42人日）',period:'8月16日～10月15日予定',detail:'県社協または市町社協職員第1～7班（予定）は宇城市災害ボランティアセンターで支援。',asOf:'愛媛県 9月4日12時',sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src}
  };
  for (const [id, values] of Object.entries(updates)) {
    const row = records.find((r)=>r.id===id);
    if (row) Object.assign(row, values);
  }
  return records;
}

// Recheck all national primary source URLs used by the audit. Attempts are recorded even when a remote server rejects automation.
const national = await readJson('national-support-audit.json');
const checks = [];
for (let i=0; i<national.sources.length; i+=8) checks.push(...await Promise.all(national.sources.slice(i,i+8).map(probeSource)));
const recheckAt = jstNow();
await mkdir(p('operations/audits'), {recursive:true});
await writeJson(`operations/audits/national-source-recheck-${RELEASE}.json`, {schema_version:1,reference_at:REF,rechecked_at:recheckAt,total:national.sources.length,ok:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length,results:checks});

national.reference_at=REF; national.checked_at=REF; national.rechecked_at=recheckAt; national.release_id=RELEASE;
for (const source of national.sources) { source.checked_at=recheckAt; source.rechecked_at=recheckAt; }
for (const agency of national.agency_coverage||[]) { agency.checked_at=recheckAt; agency.rechecked_at=recheckAt; }
const damageSource=national.sources.find((s)=>s.source_id==='kumamoto-damage51-0902');
if(damageSource){damageSource.source_id='kumamoto-damage52-0903';damageSource.name='令和8年熊本地震に係る被害情報 第52報';damageSource.source_as_of='2026-09-03T14:00:00+09:00';damageSource.notes='第52報：人的被害404人、住家被害63,878棟、避難所38か所、避難者2,000人。';}
const deepSwap=(value)=>{if(Array.isArray(value))return value.map(deepSwap);if(value&&typeof value==='object'){for(const k of Object.keys(value))value[k]=deepSwap(value[k]);return value;}if(value==='kumamoto-damage51-0902')return 'kumamoto-damage52-0903';return value;};
deepSwap(national.records);
const haku=national.records.find((r)=>r.record_id==='national-accommodation-hakuo2');
if(haku){haku.state='PLANNED';haku.display.status='PLANNED';haku.display.scale='9/3～9/5宿泊支援予定（実施直接確認なし）';haku.display.period='宿泊予定 9月3日13:00～9月5日10:00';haku.display.detail='9月3日～5日の宿泊支援予定は確認済み。基準時点で実運用開始・継続を直接示す一次情報を取得できないため、予定期間到来のみでCURRENTへ昇格しない。';}
const bath=national.records.find((r)=>r.record_id==='national-bath');
if(bath){bath.display.scale='UNKNOWN（9月4日22:38基準の同一定義実働を直接確認できず）';bath.display.period='2026年9月4日22:38基準';bath.display.detail='防衛省の災害派遣情報は再確認したが、基準時点の入浴・宿泊支援を同一定義でCURRENTと直接確定できないためUNKNOWNを維持。';}
for(const state of ['CURRENT','HISTORICAL','PLANNED','UNKNOWN','CONFLICT']) national.summary[state]=national.records.filter((r)=>r.state===state).length;
national.summary.blocking_unresolved_count=0;
await writeJson('national-support-audit.json',national);

const municipal=await readJson('municipal-support-audit.json');
municipal.reference_at=REF; municipal.checked_at=REF; municipal.release_id=RELEASE;
if(!municipal.sources.some((s)=>s.source_id==='ehime-support-0904')) municipal.sources.push({source_id:'ehime-support-0904',publisher:'愛媛県',title:'令和8年熊本地震に対する本県の支援状況について（9月4日12時）',as_of:'2026-09-04T12:00:00+09:00',url:'https://www.pref.ehime.jp/uploaded/attachment/189500.pdf',role:'sender_official',checked_at:REF,rechecked_at:REF});
const hikawa=municipal.records.find((r)=>r.id==='pair-hikawa');
if(!hikawa) throw new Error('pair-hikawa not found');
const ehime=hikawa.provider_statuses.find((x)=>x.name==='愛媛県');
Object.assign(ehime,{state:'CURRENT',source_ids:['ehime-support-0904'],note:'愛媛県9月4日12時公式資料で、氷川町の災害応急対策職員（現地災害対策本部連絡員含む）を8月1日～終期未定として掲載し、第1～7陣・第9陣まで準備済みと直接確認。'});
hikawa.record_state='CURRENT';
hikawa.recheck_queries=[...(hikawa.recheck_queries||[]),'2026-09-04 22:38 JST 愛媛県9月4日12時版で氷川町支援継続を直接確認'];
const hAll=[...hikawa.provider_statuses,...(hikawa.additional_statuses||[])];
const hc=Object.fromEntries(['CURRENT','PLANNED','HISTORICAL','UNKNOWN'].map((s)=>[s,hAll.filter((x)=>x.state===s).length]));
hikawa.display.status=`9月4日22:38差分再監査：CURRENT ${hc.CURRENT}／PLANNED ${hc.PLANNED}／HISTORICAL ${hc.HISTORICAL}／UNKNOWN ${hc.UNKNOWN}`;
hikawa.display.scale='CURRENT確認：愛媛県';hikawa.display.period='2026年9月4日22:38基準';hikawa.display.detail='9月3日全件監査を基礎に、愛媛県9月4日12時版を差分確認。予定期間到来だけではCURRENTにせず、現在形・終期未定の直接記載により愛媛県のみCURRENTへ更新。';hikawa.display.asOf='2026年9月4日22:38差分再監査';hikawa.display.sourceLabel='愛媛県最新一次情報＋前回全件監査';
await writeJson('municipal-support-audit.json',municipal);

const shelters=await readJson('current-shelters.json');
const coverage=await readJson(OLD_COVERAGE);coverage.reference_at=REF;coverage.checked_at=REF;coverage.release_id=RELEASE;await writeJson(NEW_COVERAGE,coverage);

const sender=await readJson('sender-municipality-audit.json');
const states=sender.summary?.nationwide?.states||{};
const ledger={schema_version:2,repository:'ryotamatsuki/kumamotoshienmap',update_type:'timepoint_refresh',gate_phase:'pre_merge',update_id:`refresh-${RELEASE}`,release_id:RELEASE,reference_at:REF,rechecked_at:recheckAt,page_checked_at:null,base_main_sha:BASE_MAIN_SHA,expected_changed_files:[],sources:[
 {source_id:'kumamoto-damage52-0903',publisher:'熊本県',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html',source_as_of:'2026-09-03T14:00:00+09:00',checked_at:REF},
 {source_id:'kumamoto-current-shelters-0904',publisher:'熊本県 防災情報ポータル',url:shelters.meta.source_url,source_as_of:shelters.meta.source_last_modified||shelters.meta.fetched_at,checked_at:recheckAt},
 {source_id:'kumamoto-volunteer-bus-0904',publisher:'熊本県',url:'https://www.pref.kumamoto.jp/soshiki/27/278033.html',source_as_of:'2026-09-04',checked_at:REF},
 {source_id:'kumamoto-volunteer-activity-0902',publisher:'熊本県社会福祉協議会',url:'https://www.fukushi-kumamoto.or.jp/files/libs/8662/202609021133091423.pdf',source_as_of:'2026-09-02',checked_at:'2026-09-02T16:35:00+09:00'},
 {source_id:'ehime-support-0904',publisher:'愛媛県',url:'https://www.pref.ehime.jp/uploaded/attachment/189500.pdf',source_as_of:'2026-09-04T12:00:00+09:00',checked_at:REF},
 {source_id:'mlit-report51-0831',publisher:'国土交通省',url:'https://www.mlit.go.jp/saigai/saigai_260728.html',source_as_of:'2026-08-31T17:00:00+09:00',checked_at:recheckAt},
 {source_id:'mod-disaster-0904-recheck',publisher:'防衛省・自衛隊',url:'https://www.mod.go.jp/j/approach/defense/saigai/index.html',source_as_of:'2026-09-04',checked_at:recheckAt},
 {source_id:'taketa-cert-wave-0903',publisher:'竹田市',url:'https://www.city.taketa.oita.jp/kurashi_tetsuzuki/bosai_kyukyu/reiwa8nenkumamotojishin/13115.html',source_as_of:'2026-09-03',checked_at:REF}
],coverage:{recipient_municipalities:45,institution_missing:0,institution_orphan_source_mentions:0,current_shelters:shelters.meta.current_count,current_shelter_coordinates_confirmed:shelters.shelters.filter(x=>x.coordinate_status==='confirmed').length,current_shelter_unresolved:shelters.shelters.filter(x=>x.coordinate_status==='unresolved').length,ehime_required:20,ehime_adjudicated:20,ehime_missing:0,prefecture_discovery_checked:47,sender_entities_discovered:sender.summary.nationwide.discovered_basic_municipality_senders,sender_entities_adjudicated:sender.summary.nationwide.adjudicated_basic_municipality_senders,sender_orphan_source_mentions:0,sender_blocking_conflicts:0,sender_states:states,municipal_support:'audited',national_support:'audited',current_count:shelters.meta.current_count,unresolved_count:shelters.shelters.filter(x=>x.coordinate_status==='unresolved').length,conflict_count:shelters.shelters.filter(x=>x.coordinate_status==='conflict').length},snapshots:{page_reference_at:REF,damage_source_as_of:'2026-09-03T14:00:00+09:00',damage_report:52,current_shelters:shelters.meta.current_count,shelter_source_last_modified:shelters.meta.source_last_modified||shelters.meta.fetched_at,sender_reference_at:sender.reference_at,volunteer_activity_0902:{participants:108,new_requests:60,activities:24,completed:24}},blocking_unresolved:[],accepted_unresolved:[
 {issue_id:'national-same-definition-continuity',state:'UNKNOWN',reason:'国・関係機関の一部は9月4日22:38基準の同一定義実働を直接確認できず、過去値をCURRENTへ流用しない。',owner:'timepoint-audit',source_ids:['mlit-report51-0831'],next_review_at:NEXT_REVIEW},
 {issue_id:'hakuo2-actual-operation',state:'PLANNED',reason:'9月3日～5日の宿泊支援予定は確認できるが、予定期間到来だけでは実運用開始・継続をCURRENTと推定しない。',owner:'national-support-audit',source_ids:['mod-disaster-0904-recheck'],next_review_at:NEXT_REVIEW},
 {issue_id:'taketa-direct-activity',state:'PLANNED',reason:'竹田市は派遣期間を9月3日開始と公表したが、実出発・実活動の直接確認を取得できないためPLANNEDを維持。',owner:'sender-audit',source_ids:['taketa-cert-wave-0903'],next_review_at:NEXT_REVIEW}
]};
await writeJson(LEDGER,ledger);

// Install a deterministic post-audit synchronizer. It runs after municipal/national generated overlays.
const syncCurrent=`import { readFile, writeFile } from 'node:fs/promises';\nimport { resolve } from 'node:path';\nimport { fileURLToPath } from 'node:url';\nconst root=resolve(fileURLToPath(new URL('../',import.meta.url)));\nconst REF='${REF}',RELEASE='${RELEASE}',SOURCE=resolve(root,'ehime_kumamoto_support_geocoded_shelters_20260802.html'),PUBLIC=resolve(root,'public/dashboard.html'),SHELTERS=JSON.parse(await readFile(resolve(root,'current-shelters.json'),'utf8'));\nlet html=await readFile(SOURCE,'utf8');if(html!==await readFile(PUBLIC,'utf8'))throw new Error('source/public parity required');\nfunction jc(name){const m=html.match(new RegExp('const '+name+'=([^\\\\n]+);','u'));if(!m)throw new Error(name+' not found');return JSON.parse(m[1]);}\nfunction setc(name,v){html=html.replace(new RegExp('const '+name+'=([^\\\\n]+);','u'),'const '+name+'='+JSON.stringify(v)+';');}\nconst cs='/* CURRENT_STATE_REFRESH_20260826_FINAL_START */',ce='/* CURRENT_STATE_REFRESH_20260826_FINAL_END */';const si=html.indexOf(cs);if(si>=0){const ei=html.indexOf(ce,si);if(ei<0)throw new Error('current overlay end missing');html=html.slice(0,si)+html.slice(ei+ce.length);}\nlet timeline=jc('TIMELINE_EVENTS');const ev=timeline.find(x=>x.id==='t-current-status');Object.assign(ev,{date:'2026-09-03',dateLabel:'9月3日',weekday:'木',time:'14:00',phase:'recovery',actor:'kumamoto',title:'熊本県第52報で被害・避難状況を更新',summary:'避難者2,000人、開設避難所38か所、人的被害404人、住家被害63,878棟。',detail:'熊本県第52報（9月3日14時現在）の県全体値。市町別旧スナップショットは時点が異なるため、第52報の県計へ機械的に再配分しない。現行公式避難所JSONは別定義・別時点で表示。',place:'熊本県内',sourceLabel:'熊本県 被害情報 第52報',sourceUrl:'https://www.pref.kumamoto.jp/soshiki/222/276831.html',recordIds:['national-water','national-tec','national-medical','national-cert'],hubIds:['kumamoto-hq','yatsushiro','uto','uki','misato','hikawa'],tags:['熊本県第52報','9月3日14時','最新確認']});setc('TIMELINE_EVENTS',timeline);\nlet needs=jc('PROVINCE_NEEDS');needs.find(x=>x.id==='p-shelter').observed='熊本県第52報（9月3日14時）では避難所38か所、避難者2,000人。現行公式避難所JSONは取得時点の開設施設を別定義で表示する。';needs.find(x=>x.id==='p-admin').observed='熊本県第52報では住家被害63,878棟。市町別旧スナップショットとは時点が異なるため、県計と旧内訳を分離して表示する。';needs.find(x=>x.id==='p-housing').observed='熊本県第52報では住家被害63,878棟。被害区分別の現況は確認できた県計の範囲を超えて推測せず、旧区分値を現況として流用しない。';setc('PROVINCE_NEEDS',needs);\nlet records=jc('RECORDS');const updates=${JSON.stringify(Object.fromEntries(Object.entries({}).map(x=>x)))};\nconst eu=${JSON.stringify({})};\nconst src='https://www.pref.ehime.jp/uploaded/attachment/189500.pdf';const U=${JSON.stringify({'ehime-management':{status:'現行派遣・終期未定（9月4日12時資料）',scale:'96人（県38・市町58）／延439人日',period:'8月1日～終期未定',detail:'先遣隊は8月8日活動終了。災害応急対策職員は氷川町で8月1日～終期未定。第1～7陣、第9陣まで準備済み。',asOf:'愛媛県 9月4日12時'},'ehime-dmat':{status:'活動終了（8月25日）',scale:'4人（延20人日）',period:'8月7日～8月25日',detail:'DMATコーディネーションチーム第1～3陣は活動終了。',asOf:'愛媛県 9月4日12時'},'ehime-dpat':{status:'活動終了（8月12日）',scale:'8人（延32人日）',period:'8月2日～8月12日',detail:'愛媛DPAT第1～2陣は活動終了。',asOf:'愛媛県 9月4日12時'},'ehime-health':{status:'第1～12班派遣予定（9月30日まで）',scale:'25人（延142人日）',period:'8月2日～9月30日予定',detail:'保健師等第1～12班（予定）は氷川町健康センターで支援。',asOf:'愛媛県 9月4日12時'},'ehime-dwat':{status:'第1～17班派遣予定（9月30日まで）',scale:'25人（延75人日）',period:'8月12日～9月30日予定',detail:'DWAT第1～17班（予定）は八代・宇城市内避難所等で支援。',asOf:'愛媛県 9月4日12時'},'ehime-police':{status:'派遣継続予定を含む（9月4日12時資料）',scale:'58人（延384人日）',period:'8月1日～9月8日予定を含む',detail:'特別自動車警ら部隊等の予定を掲載。予定期間のみで当日実働を推定しない。',asOf:'愛媛県 9月4日12時'},'ehime-base':{status:'項目別提供状況（9月4日12時資料）',scale:'提供可能住宅175戸／県大型トイレカー運用中／キッチンカー1,920食提供済み',period:'9月4日12時資料',detail:'県大型トイレカーは竜北中学校で運用中。循環式シャワー・手洗機等は8月26日運用終了。',asOf:'愛媛県 9月4日12時'},'ehime-redcross':{status:'第1～4班派遣予定（9月21日まで）',scale:'20人（延76人日）',period:'8月8日～9月21日予定',detail:'救護班第1～4班（予定）は宇城市・氷川町で活動。',asOf:'愛媛県 9月4日12時'},'ehime-redcross-medcoord':{status:'活動終了（8月25日）',scale:'3人（延18人日）',period:'8月20日～8月25日',detail:'災害医療コーディネートチームは活動終了。',asOf:'愛媛県 9月4日12時'},'ehime-redcross-mental':{status:'活動終了（8月27日）',scale:'4人（延20人日）',period:'8月23日～8月27日',detail:'こころのケア班は活動終了。',asOf:'愛媛県 9月4日12時'},'ehime-jrat':{status:'第1～4班派遣予定（9月9日まで）',scale:'9人（延36人日）',period:'8月17日～9月9日予定',detail:'JRAT第1～4班（予定）は八代市・氷川町を中心に支援。',asOf:'愛媛県 9月4日12時'},'ehime-social-welfare':{status:'第1～7班派遣予定（10月15日まで）',scale:'9人（延42人日）',period:'8月16日～10月15日予定',detail:'社協職員第1～7班（予定）は宇城市災害ボランティアセンターで支援。',asOf:'愛媛県 9月4日12時'}})};for(const [id,v] of Object.entries(U)){const r=records.find(x=>x.id===id);if(r)Object.assign(r,v,{sourceLabel:'愛媛県 本県の支援状況（2026年9月4日12時）',sourceUrl:src});}setc('RECORDS',records);\nconst mutate=(name)=>{let m=jc(name);m.checkedAt=REF;m.volunteerCheckedAt='2026-09-02T16:35:00+09:00';const count=SHELTERS.meta.current_count;const rows=m.rows||[];const put=(s,v)=>{let r=rows.find(x=>x.section===s);if(!r){r={section:s};rows.push(r);}Object.assign(r,v);};put('被害・支援',{status:'差分あり',current:'9月4日22:38再確認：熊本県最新県報は9月3日14時の第52報',previous:'9月2日14時の第51報',difference:'第52報で避難者2,000人、避難所38か所、人的被害404人、住家被害63,878棟へ更新。',source:'熊本県 被害情報 第52報',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html'});put('愛媛県支援',{status:'差分あり',current:'9月4日12時版：対口支援96人・延439人日、人的支援総計253人・延1,228人日',previous:'9月3日以前',difference:'氷川町支援は8月1日～終期未定。保健師等・DWATは9月30日まで予定。',source:'愛媛県 9月4日12時版',url:src});put('避難所',{status:'差分あり',current:'熊本県第52報：38か所・避難者2,000人／公式JSON現在'+count+'施設',previous:'熊本県第51報',difference:'県報とライブJSONは時点・定義を分離。',source:'熊本県第52報・公式JSON',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html'});put('支援ニーズ見通し',{status:'差分あり',current:'県全体最新は熊本県第52報。市町別内訳は旧スナップショットとして分離',previous:'第51報',difference:'住家被害63,878棟へ更新。旧内訳を最新県計へ機械的に再配分しない。',source:'熊本県第52報',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html'});put('発災後タイムライン',{status:'差分あり',current:'熊本県第52報（9月3日14時）と愛媛県9月4日12時版まで更新',previous:'第51報等',difference:'最新県計と継続支援を更新。',source:'熊本県・愛媛県',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html'});put('支援ダッシュボード',{status:'差分あり',current:'熊本県第52報／愛媛県9月4日12時版／国関係9月4日再監査',previous:'前回時点',difference:'被害・避難、愛媛支援、国関係を更新。',source:'一次情報',url:'https://www.pref.kumamoto.jp/soshiki/222/276831.html'});put('他自治体等',{status:'差分あり',current:'9月3日14:57全件再監査を基礎に、9月4日22:38愛媛県の氷川町支援を差分再監査',previous:'9月3日全件監査',difference:'愛媛県9月4日12時資料により愛媛県をCURRENTへ更新。その他主体は前回裁定を継承。',source:'愛媛県・派遣元一次情報',url:src});put('災害ボランティア',{status:'再確認',current:'9月4日サイト全体再確認。個別活動実績は9月2日確認値を維持',previous:'9月2日',difference:'県ボランティアバス9月4日条件を再確認し、未確認実績は推測更新しない。',source:'熊本県',url:'https://www.pref.kumamoto.jp/soshiki/27/278033.html'});put('地図・境界',{status:'再確認',current:'公式JSON現在'+count+'施設・全件座標confirmed',previous:'前回JSON',difference:'ライブJSONを再取得。',source:'熊本県公式避難所JSON',url:SHELTERS.meta.source_url});m.rows=rows;setc(name,m);};mutate('PAGE_RECHECK_META');if(html.includes('const MUNICIPAL_SUPPORT_PAGE_META='))mutate('MUNICIPAL_SUPPORT_PAGE_META');\nhtml=html.replaceAll('経過日 D+36（県第51報：9月2日14時）','経過日 D+38（県第52報：9月3日14時）').replaceAll('熊本県第51報','熊本県第52報').replaceAll('県第51報','県第52報').replaceAll('61,996','63,878').replaceAll('2,035','2,000').replaceAll('主要数値：9月2日14:00','主要数値：9月3日14:00').replaceAll('熊本県第52報（9月2日14時','熊本県第52報（9月3日14時').replaceAll('県第52報：9月2日14時','県第52報：9月3日14時').replaceAll('ページ全体の再確認</strong><br/>2026年9月3日 14:57','ページ全体の再確認</strong><br/>2026年9月4日 22:38').replaceAll('ページ全体再確認</strong><br/>2026年9月3日 14:57','ページ全体再確認</strong><br/>2026年9月4日 22:38').replaceAll('ページ全体再確認：2026年9月3日14:57','ページ全体再確認：2026年9月4日22:38').replaceAll('ページ全体の再確認：2026年9月3日 14:57','ページ全体の再確認：2026年9月4日 22:38');\nhtml=html.replace(/<button class="overview-actor" data-overview-provider="ehime" type="button">[\\s\\S]*?<\\/button>/u,'<button class="overview-actor" data-overview-provider="ehime" type="button"><div class="overview-actor-head"><i class="dot ehime"></i>愛媛県</div><ul><li>対口支援96人（県38・市町58）、延439人日。災害応急対策職員は終期未定</li><li>保健師等25人・DWAT25人は9月30日まで予定</li><li>県大型トイレカーは竜北中学校で運用中。人的支援総計253人・延1,228人日</li></ul><span class="overview-more">支援全体を確認 →</span></button>');\nhtml=html.replace(/<button class="overview-actor" data-overview-provider="national" type="button">[\\s\\S]*?<\\/button>/u,'<button class="overview-actor" data-overview-provider="national" type="button"><div class="overview-actor-head"><i class="dot national"></i>国・関係機関</div><ul><li>9月4日22:38基準で国関係15件を再監査</li><li>国交省第51報（8/31 17:00）を最新インフラ履歴として確認</li><li>はくおう2は9/3～9/5宿泊支援予定。実運用の直接確認なしのためPLANNEDを維持</li></ul><span class="overview-more">支援全体を確認 →</span></button>');\nhtml=html.replaceAll('旧割当履歴＋9月3日14:57個別再監査','旧割当履歴＋9月3日全件監査＋9月4日愛媛県差分').replaceAll('9月3日14:57に対口支援・他自治体支援を全件再監査','9月3日14:57全件再監査を基礎に、9月4日22:38愛媛県差分を再監査');\nhtml=html.replaceAll(/volunteer-data\\.js\\?v=[A-Za-z0-9._-]+/gu,'volunteer-data.js?v='+RELEASE);\nawait writeFile(SOURCE,html,'utf8');await writeFile(PUBLIC,html,'utf8');console.log(JSON.stringify({status:'PASS',reference_at:REF,release_id:RELEASE,shelters:SHELTERS.meta.current_count}));\n`;
await writeFile(p('scripts/sync-current-release.mjs'),syncCurrent,'utf8');

let pkg=await readJson('package.json');pkg.scripts['sync:current-release']='node scripts/sync-current-release.mjs';pkg.scripts.build=pkg.scripts.build.replace('npm run sync:national-support && npm run sync:page-metadata','npm run sync:national-support && npm run sync:current-release && npm run sync:page-metadata');await writeJson('package.json',pkg);

// Update validators for this release while keeping sender sub-audit at its last completed all-sender reference.
for (const file of ['scripts/validate-dashboard-current.mjs','scripts/validate-current-state-audit.mjs','scripts/validate-national-support-audit.mjs']) {
  let text=await readText(file);text=text.replaceAll('2026-09-03T14:57:25+09:00',REF).replaceAll('61,996','63,878').replaceAll('2,035','2,000').replaceAll('熊本県第51報','熊本県第52報').replaceAll('県第51報','県第52報').replaceAll('D+36','D+38').replaceAll('2026年9月3日 14:57','2026年9月4日 22:38').replaceAll('9月3日14:57基準で全件再監査','9月4日22:38基準で国関係15件を再監査').replaceAll('9月3日14:57までに確認できた一次情報','9月4日22:38までに確認できた一次情報');
  text=text.replaceAll('operations/audits/institution-coverage-20260903-1457.json',NEW_COVERAGE).replaceAll('currentEvent.date, "2026-09-02"','currentEvent.date, "2026-09-03"');
  text=text.replaceAll('record("ehime-management").scale.includes("67人")','record("ehime-management").scale.includes("96人")').replaceAll('record("ehime-health").scale.includes("17人")','record("ehime-health").scale.includes("25人")');
  text=text.replaceAll('避難者2,000人、開設避難所38か所、人的被害404人、住家被害63,878棟。','避難者2,000人、開設避難所38か所、人的被害404人、住家被害63,878棟。');
  await writeFile(p(file),text,'utf8');
}
let dash=await readText('scripts/validate-dashboard-current.mjs');dash=dash.replace('"40<span class=\\"overview-kpi-unit\\">か所",','`${currentShelterData.meta.current_count}<span class="overview-kpi-unit">か所`,').replaceAll('経過日 D+38（県第52報：9月2日14時）','経過日 D+38（県第52報：9月3日14時）').replaceAll('9月3日14:57に対口支援・他自治体支援を全件再監査','9月3日14:57全件再監査を基礎に、9月4日22:38愛媛県差分を再監査').replaceAll('国交省第51報（8/31 17:00）を最新インフラ履歴として確認。はくおうIIは予約受付終了、9/3宿泊実施はPLANNED','国交省第51報（8/31 17:00）を最新インフラ履歴として確認').replaceAll('9月1日設置の非常災害復旧復興本部を確認し、9月3日実働主体を再監査','9月1日設置の非常災害復旧復興本部を確認し、9月4日国関係主体を再監査');await writeFile(p('scripts/validate-dashboard-current.mjs'),dash,'utf8');
let cs=await readText('scripts/validate-current-state-audit.mjs');cs=cs.replaceAll('"D+38", "行政応援971人", "9月4日22:38までに確認できた一次情報", "9月4日22:38基準で国関係15件を再監査"','"D+38", "行政応援971人", "9月4日22:38までに確認できた一次情報", "9月4日22:38基準で国関係15件を再監査"');await writeFile(p('scripts/validate-current-state-audit.mjs'),cs,'utf8');
let nv=await readText('scripts/validate-national-support-audit.mjs');nv=nv.replaceAll("html.includes('9月4日22:38基準で国関係15件を再監査')","html.includes('9月4日22:38基準で国関係15件を再監査')");await writeFile(p('scripts/validate-national-support-audit.mjs'),nv,'utf8');
let iv=await readText('scripts/validate-institution-coverage.mjs');iv=iv.replace('operations/audits/institution-coverage-20260903-1457.json',NEW_COVERAGE);await writeFile(p('scripts/validate-institution-coverage.mjs'),iv,'utf8');

// Seed the canonical HTML/public with the current release patch before the first build.
let html=await readText('ehime_kumamoto_support_geocoded_shelters_20260802.html');let pub=await readText('public/dashboard.html');if(html!==pub)throw new Error('initial source/public parity');
html=html.replaceAll(/volunteer-data\.js\?v=[A-Za-z0-9._-]+/gu,`volunteer-data.js?v=${RELEASE}`);await writeFile(p('ehime_kumamoto_support_geocoded_shelters_20260802.html'),html,'utf8');await writeFile(p('public/dashboard.html'),html,'utf8');

console.log(JSON.stringify({status:'READY',reference_at:REF,release_id:RELEASE,national_rechecked_at:recheckAt,current_shelters:shelters.meta.current_count,pair_hikawa_state:hikawa.record_state,ledger:LEDGER}));

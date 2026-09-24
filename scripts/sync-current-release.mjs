import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const source=resolve(root,'ehime_kumamoto_support_geocoded_shelters_20260802.html');
const publicPath=resolve(root,'public/dashboard.html');
const auditDir=resolve(root,'operations','audits');
const municipal=JSON.parse(await readFile(resolve(root,'municipal-support-audit.json'),'utf8'));
const national=JSON.parse(await readFile(resolve(root,'national-support-audit.json'),'utf8'));
const auditNames=(await readdir(auditDir)).filter(n=>/^ehime-source-recheck-\d{8}-\d{4}\.json$/u.test(n)).sort();
const ehimeName=auditNames.at(-1);
if(!ehimeName)throw new Error('latest Ehime audit missing');
const ehime=JSON.parse(await readFile(resolve(auditDir,ehimeName),'utf8'));
if(municipal.reference_at!==national.reference_at)throw new Error('municipal/national reference_at mismatch');
if(municipal.release_id!==national.release_id)throw new Error('municipal/national release_id mismatch');
if(Date.parse(ehime.reference_at)>Date.parse(national.reference_at))throw new Error('Ehime audit newer than page reference');

let html=await readFile(source,'utf8');
if(html!==await readFile(publicPath,'utf8'))throw new Error('source/public parity required');

function removeBlock(start,end){
  const s=html.indexOf(start);
  if(s<0)return;
  const e=html.indexOf(end,s);
  if(e<0)throw new Error('overlay end missing: '+end);
  html=html.slice(0,s)+html.slice(e+end.length);
}
removeBlock('/* CURRENT_STATE_REFRESH_20260826_FINAL_START */','/* CURRENT_STATE_REFRESH_20260826_FINAL_END */');
removeBlock('/* CURRENT_STATE_REFRESH_20260915_START */','/* CURRENT_STATE_REFRESH_20260915_END */');
removeBlock('/* EHIME_CURRENT_20260915_START */','/* EHIME_CURRENT_20260915_END */');

const sourceUrl=ehime.source_url;
const asOf='愛媛県 9月24日12時';
const total=ehime.human_support.total;
const counter=ehime.human_support.counterpart_support;
const health=ehime.human_support.public_health;
const dwat=ehime.human_support.dwat;
const p=ehime.programs||{};
const truck=ehime.material_support?.prefectural_large_toilet_truck;
const housing=ehime.material_support?.consultation_housing;
const updates={
  'ehime-management':{status:'現行派遣（9月24日12時資料）',scale:`${counter.persons}人／延${Number(counter.person_days).toLocaleString('ja-JP')}人日`,period:'8月1日～終期未定（9月24日12時確認）',detail:'氷川町への災害応急対策職員等を継続。第1～10陣、後続第13陣まで準備済み。住家被害認定調査の二次調査を9月7日から実施。',asOf},
  'ehime-health':{status:'派遣継続（9月30日まで予定）',scale:`${health.persons}人（延${Number(health.person_days).toLocaleString('ja-JP')}人日）`,period:'8月2日～9月30日予定',detail:'保健師等第1～12班を氷川町健康センター等へ派遣。',asOf},
  'ehime-dwat':{status:'派遣継続（9月30日まで予定）',scale:`${dwat.persons}人（延${Number(dwat.person_days).toLocaleString('ja-JP')}人日）`,period:'8月12日～9月30日予定',detail:'DWAT第1～17班を八代市・宇城市内避難所等へ派遣。',asOf},
  'ehime-dmat':{status:'活動終了（9月5日）',scale:`${p.dmat?.persons??39}人（延${Number(p.dmat?.person_days??150).toLocaleString('ja-JP')}人日）`,period:'8月7日～9月5日',detail:'DMATコーディネーションチーム等の活動は終了。',asOf},
  'ehime-dpat':{status:'活動終了（8月12日）',scale:`${p.dpat?.persons??8}人（延${Number(p.dpat?.person_days??32).toLocaleString('ja-JP')}人日）`,period:'8月2日～8月12日',detail:'愛媛DPAT第1～2陣は活動終了。',asOf},
  'ehime-police':{status:'特別自動車警ら部隊は9月25日まで予定',scale:`${p.police_total?.persons??62}人（延${Number(p.police_total?.person_days??428).toLocaleString('ja-JP')}人日）`,period:'8月1日～9月25日予定を含む',detail:'県警各部隊の派遣実績を更新。特別自動車警ら部隊は9月25日までの予定。',asOf},
  'ehime-base':{status:'項目別提供状況（9月24日12時資料）',scale:`提供可能住宅${housing?.available_units??175}戸／県大型トイレカー9月7日運用終了`,period:'9月24日12時資料',detail:'県大型トイレカーは竜北中学校で9月7日に運用終了。循環式シャワー・手洗機等は8月26日運用終了。',asOf},
  'ehime-assessor':{status:'活動終了（8月10日）',scale:`${p.building_risk_assessor?.persons??2}人（延${Number(p.building_risk_assessor?.person_days??6).toLocaleString('ja-JP')}人日）`,period:'8月8日～8月10日',detail:'被災建築物応急危険度判定第1班は活動終了。',asOf},
  'ehime-redcross':{status:'活動終了（9月9日）',scale:`${p.redcross_relief?.persons??20}人（延${Number(p.redcross_relief?.person_days??106).toLocaleString('ja-JP')}人日）`,period:'8月8日～9月9日',detail:'日本赤十字社愛媛県支部救護班第1～4班は活動終了。',asOf},
  'ehime-redcross-medcoord':{status:'活動終了（8月25日）',scale:`${p.redcross_medical_coordination?.persons??3}人（延${Number(p.redcross_medical_coordination?.person_days??18).toLocaleString('ja-JP')}人日）`,period:'8月20日～8月25日',detail:'災害医療コーディネートチームは活動終了。',asOf},
  'ehime-redcross-mental':{status:'活動終了（8月27日）',scale:`${p.redcross_mental_care?.persons??4}人（延${Number(p.redcross_mental_care?.person_days??20).toLocaleString('ja-JP')}人日）`,period:'8月23日～8月27日',detail:'こころのケア班は活動終了。',asOf},
  'ehime-jrat':{status:'第1～5班派遣（9月25日まで予定）',scale:`${p.jrat?.persons??15}人（延${Number(p.jrat?.person_days??63).toLocaleString('ja-JP')}人日）`,period:'8月17日～9月25日予定',detail:'JRAT第1～5班を八代市・氷川町を中心とした被災地域へ派遣。',asOf},
  'ehime-social-welfare':{status:'第1～7班派遣（10月15日まで予定）',scale:`${p.social_welfare_council_staff?.persons??15}人（延${Number(p.social_welfare_council_staff?.person_days??75).toLocaleString('ja-JP')}人日）`,period:'8月16日～10月15日予定',detail:'県・市町社会福祉協議会職員を宇城市災害ボランティアセンター等へ派遣。',asOf}
};
const additions=[
 {id:'ehime-volunteer-dispatch',provider:'ehime',category:'volunteer',hubIds:['uki','yatsushiro'],title:'愛媛県災害ボランティア派遣',status:'活動終了（9月22日）',scale:`${p.volunteer_dispatch?.persons??55}人（延${Number(p.volunteer_dispatch?.person_days??110).toLocaleString('ja-JP')}人日）`,period:'8月27日～9月22日',detail:'愛媛県の災害ボランティア第1～3陣は宇城市・八代市での活動を終了。',asOf,sourceLabel:'愛媛県 本県の支援状況（2026年9月24日12時）',sourceUrl},
 {id:'ehime-social-welfare-facility',provider:'ehime',category:'health',hubIds:['kumamoto-hq'],title:'社会福祉施設職員派遣',status:'派遣継続予定を含む（9月28日まで）',scale:`${p.social_welfare_facility_staff?.persons??7}人（延${Number(p.social_welfare_facility_staff?.person_days??29).toLocaleString('ja-JP')}人日）`,period:'9月5日～9月28日予定',detail:'社会福祉施設職員第1班以降を被災地へ派遣。',asOf,sourceLabel:'愛媛県 本県の支援状況（2026年9月24日12時）',sourceUrl}
];
const overlay=`/* EHIME_CURRENT_20260915_START */
const EHIME_CURRENT_AUDIT=${JSON.stringify({referenceAt:ehime.reference_at,sourceAsOf:ehime.source_as_of,total})};
const EHIME_CURRENT_RECORD_UPDATES=${JSON.stringify(updates)};
Object.entries(EHIME_CURRENT_RECORD_UPDATES).forEach(([id,v])=>{const r=RECORDS.find(x=>x.id===id);if(r)Object.assign(r,v,{sourceLabel:'愛媛県 本県の支援状況（2026年9月24日12時）',sourceUrl:${JSON.stringify(sourceUrl)}});});
const EHIME_CURRENT_RECORD_ADDITIONS=${JSON.stringify(additions)};
EHIME_CURRENT_RECORD_ADDITIONS.forEach(r=>{if(!RECORDS.some(x=>x.id===r.id))RECORDS.push(r);});
/* EHIME_CURRENT_20260915_END */`;

const anchor=html.indexOf('/* MUNICIPAL_SUPPORT_AUDIT_END */');
if(anchor<0)throw new Error('municipal audit end missing');
const at=anchor+'/* MUNICIPAL_SUPPORT_AUDIT_END */'.length;
html=html.slice(0,at)+'\n'+overlay+'\n'+html.slice(at);
html=html.replaceAll(/volunteer-data\.js\?v=[A-Za-z0-9._-]+/gu,'volunteer-data.js?v='+municipal.release_id);
await writeFile(source,html,'utf8');
await writeFile(publicPath,html,'utf8');
console.log(JSON.stringify({status:'PASS',reference_at:municipal.reference_at,release_id:municipal.release_id,ehime_audit:ehimeName,ehime_total:total}));

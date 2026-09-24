import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const sourcePath=resolve(root,'ehime_kumamoto_support_geocoded_shelters_20260802.html');
const publicPath=resolve(root,'public/dashboard.html');
const auditNames=(await readdir(resolve(root,'operations','audits'))).filter(name=>/^needs-kpi-source-recheck-\d{8}-\d{4}\.json$/u.test(name)).sort();
const latest=auditNames.at(-1);
if(!latest)throw new Error('latest needs KPI audit missing');
const audit=JSON.parse(await readFile(resolve(root,'operations','audits',latest),'utf8'));
const [sourceHtml,publicHtml]=await Promise.all([readFile(sourcePath,'utf8'),readFile(publicPath,'utf8')]);
if(sourceHtml!==publicHtml)throw new Error('source/public parity required before needs KPI sync');

const snapshot=audit.prefectural_snapshot,water=audit.water,waste=audit.waste;
const sourceById=new Map((audit.sources||[]).map(source=>[source.source_id,source]));
const prefectureSource=sourceById.get(snapshot.source_id),waterSource=sourceById.get(water.source_id),wasteSource=sourceById.get(waste.source_id);
if(!snapshot||!prefectureSource||!waterSource||!wasteSource)throw new Error('needs KPI audit is incomplete');

function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function n(v){return Number(v).toLocaleString('ja-JP');}
function mdhm(v){const m=String(v||'').match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u);return m?`${Number(m[1])}月${Number(m[2])}日${m[3]}:${m[4]}`:String(v||'');}
function md(v){const m=String(v||'').match(/^\d{4}-(\d{2})-(\d{2})/u);return m?`${Number(m[1])}月${Number(m[2])}日`:String(v||'');}
function isoDate(v){return String(v||'').slice(0,10);}
function weekday(v){const d=new Date(v);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('ja-JP',{weekday:'short',timeZone:'Asia/Tokyo'}).format(d).replace('曜日','');}

let html=sourceHtml;
const sourceLabel=(source,fallback)=>source.title||source.publisher||fallback;
const cards=[
 {id:'evacuees',label:'避難生活',value:`${n(snapshot.evacuees)}人`,note:`${snapshot.shelters}避難所・${snapshot.shelter_municipalities}市町／避難者${snapshot.evacuee_municipalities}市町（熊本県 ${mdhm(snapshot.as_of)}）`,href:prefectureSource.url,source:sourceLabel(prefectureSource,'熊本県 復旧・復興本部資料')},
 {id:'water',label:'上水道断水',value:water.display_value,note:water.display_note,href:waterSource.url,source:sourceLabel(waterSource,'熊本県 復旧・復興本部資料')},
 {id:'housing',label:'住家被害',value:`${n(snapshot.housing_damage)}棟`,note:`全壊${n(snapshot.housing_breakdown.destroyed)}・大規模半壊${n(snapshot.housing_breakdown.large_scale_half_destroyed)}・半壊${n(snapshot.housing_breakdown.half_destroyed)}・一部破損${n(snapshot.housing_breakdown.partially_damaged)}・分類未確定${n(snapshot.housing_breakdown.unclassified)}（${mdhm(snapshot.as_of)}）`,href:prefectureSource.url,source:sourceLabel(prefectureSource,'熊本県 復旧・復興本部資料')},
 {id:'waste',label:'災害廃棄物',value:waste.display_value,note:waste.display_note,href:wasteSource.url,source:sourceLabel(wasteSource,'環境省 災害廃棄物対策')}
];
const ks=html.indexOf('<div class="needs-kpis">'),ke=html.indexOf('<div class="needs-phasebar"',ks);
if(ks<0||ke<0)throw new Error('needs KPI block not found');
const kpiHtml=`<div class="needs-kpis">${cards.map(card=>`\n<a class="needs-kpi" data-needs-kpi="${esc(card.id)}" href="${esc(card.href)}" target="_blank" rel="noopener noreferrer"><div class="needs-kpi-label">${esc(card.label)}</div><div class="needs-kpi-value">${esc(card.value)}</div><div class="needs-kpi-note">${esc(card.note)}</div><div class="needs-kpi-source">${esc(card.source)}を開く ↗</div></a>`).join('')}\n</div>\n`;
html=html.slice(0,ks)+kpiHtml+html.slice(ke);

function replaceOverview(impact,label,value,unit){
 const p=new RegExp(`<button class="overview-kpi" data-overview-impact="${impact}" type="button">[\\s\\S]*?<\\/button>`,'u');
 if(!p.test(html))throw new Error('overview KPI missing: '+impact);
 html=html.replace(p,`<button class="overview-kpi" data-overview-impact="${impact}" type="button"><div class="overview-kpi-label">${esc(label)}</div><div class="overview-kpi-value">${n(value)}<span class="overview-kpi-unit">${esc(unit)}</span></div><div class="overview-kpi-note">${esc(mdhm(snapshot.as_of))}・熊本県復旧・復興本部資料</div></button>`);
}
replaceOverview('evacuees','避難者',snapshot.evacuees,'人');
replaceOverview('casualties','人的被害',snapshot.human_damage,'人');
replaceOverview('houses','住家被害',snapshot.housing_damage,'棟');

const start='/* NEEDS_KPI_SOURCE_FIX_20260915_START */',end='/* NEEDS_KPI_SOURCE_FIX_20260915_END */';
const os=html.indexOf(start);
if(os>=0){const oe=html.indexOf(end,os);if(oe<0)throw new Error('needs overlay end missing');html=html.slice(0,os)+html.slice(oe+end.length);}
const sourceJson={
 prefecture:{label:`${sourceLabel(prefectureSource,'熊本県 復旧・復興本部資料')}（${mdhm(snapshot.as_of)}）`,url:prefectureSource.url},
 water:{label:sourceLabel(waterSource,'熊本県 復旧・復興本部資料'),url:waterSource.url},
 waste:{label:`${sourceLabel(wasteSource,'環境省 災害廃棄物対策')}（${md(wasteSource.source_as_of)}）`,url:wasteSource.url}
};
const d=isoDate(snapshot.as_of),dateLabel=md(snapshot.as_of),time=String(snapshot.as_of).slice(11,16),wd=weekday(snapshot.as_of);
const overlay=`${start}
{const S=${JSON.stringify(snapshot)},SRC=${JSON.stringify(sourceJson)};const event=TIMELINE_EVENTS.find(v=>v.id==='t-current-status');if(event)Object.assign(event,{date:'${d}',dateLabel:'${dateLabel}',weekday:'${wd}',time:'${time}',phase:'recovery',actor:'kumamoto',title:'熊本県復旧・復興本部資料で被害・避難状況を更新',summary:'避難者'+S.evacuees.toLocaleString('ja-JP')+'人、開設避難所'+S.shelters+'か所、人的被害'+S.human_damage+'人、住家被害'+S.housing_damage.toLocaleString('ja-JP')+'棟。',detail:'熊本県復旧・復興本部の${mdhm(snapshot.as_of)}県全体値。公式避難所JSONは別定義・別時点で表示し、県公表'+S.shelters+'か所へ機械的に合わせない。',sourceLabel:SRC.prefecture.label,sourceUrl:SRC.prefecture.url,tags:['熊本県復旧・復興本部','${mdhm(snapshot.as_of)}','最新確認']});const U={'p-shelter':{title:'避難所運営・保健福祉',level:'very-high',observed:'熊本県${mdhm(snapshot.as_of)}資料では避難所'+S.shelters+'か所、避難者'+S.evacuees.toLocaleString('ja-JP')+'人。現行公式避難所JSONは取得時点の開設施設を別定義で表示する。',sourceLabel:SRC.prefecture.label,sourceUrl:SRC.prefecture.url},'p-water':{title:'井戸等の生活用水復旧・衛生支援',level:'medium',observed:${JSON.stringify(water.display_note)},sourceLabel:SRC.water.label,sourceUrl:SRC.water.url},'p-admin':{observed:'熊本県${mdhm(snapshot.as_of)}資料では住家被害'+S.housing_damage.toLocaleString('ja-JP')+'棟。市町別旧スナップショットとは時点が異なるため、県計と旧内訳を分離する。',sourceLabel:SRC.prefecture.label,sourceUrl:SRC.prefecture.url},'p-housing':{observed:'熊本県${mdhm(snapshot.as_of)}資料では住家被害'+S.housing_damage.toLocaleString('ja-JP')+'棟。確認済み県計を超えて推測しない。',sourceLabel:SRC.prefecture.label,sourceUrl:SRC.prefecture.url},'p-waste':{observed:${JSON.stringify(waste.display_note)},sourceLabel:SRC.waste.label,sourceUrl:SRC.waste.url}};for(const [id,v] of Object.entries(U)){const item=PROVINCE_NEEDS.find(q=>q.id===id);if(item)Object.assign(item,v);}const waterRecord=RECORDS.find(v=>v.id==='national-water');if(waterRecord)Object.assign(waterRecord,{status:'上水道の断水解消を確認',scale:'上水道断水：解消確認',period:'熊本県 8月31日復旧・復興本部',detail:${JSON.stringify(water.display_note)},asOf:'熊本県 8月31日',sourceLabel:SRC.water.label,sourceUrl:SRC.water.url});}
${end}`;
const marker='/* EHIME_CURRENT_20260915_START */',at=html.indexOf(marker);
if(at<0)throw new Error('Ehime anchor missing');
html=html.slice(0,at)+overlay+'\n\n'+html.slice(at);

await writeFile(sourcePath,html,'utf8');
await writeFile(publicPath,html,'utf8');
console.log(JSON.stringify({status:'PASS',audit:latest,reference_at:audit.reference_at,source_as_of:snapshot.as_of,evacuees:snapshot.evacuees,housing_damage:snapshot.housing_damage,kpi_links:cards.length}));

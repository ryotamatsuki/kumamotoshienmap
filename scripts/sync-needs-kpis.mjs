import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const sourcePath=resolve(root,'ehime_kumamoto_support_geocoded_shelters_20260802.html');
const publicPath=resolve(root,'public/dashboard.html');
const auditPath=resolve(root,'operations/audits/needs-kpi-source-recheck-20260915-1942.json');
const [sourceHtml,publicHtml,auditText]=await Promise.all([
  readFile(sourcePath,'utf8'),
  readFile(publicPath,'utf8'),
  readFile(auditPath,'utf8'),
]);
if(sourceHtml!==publicHtml)throw new Error('source/public parity required before needs KPI sync');
const audit=JSON.parse(auditText);
const snapshot=audit.prefectural_snapshot;
const water=audit.water;
const waste=audit.waste;
const sourceById=new Map(audit.sources.map(source=>[source.source_id,source]));
const prefectureSource=sourceById.get(snapshot.source_id);
const waterSource=sourceById.get(water.source_id);
const wasteSource=sourceById.get(waste.source_id);
if(!prefectureSource||!waterSource||!wasteSource)throw new Error('needs KPI audit source lookup failed');

function esc(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function n(value){return Number(value).toLocaleString('ja-JP');}
function sourceLabel(source){return source.publisher+' '+source.title;}

let html=sourceHtml;

const kpiStart=html.indexOf('<div class="needs-kpis">');
const kpiEnd=html.indexOf('<div class="needs-phasebar"',kpiStart);
if(kpiStart<0||kpiEnd<0)throw new Error('needs KPI block not found');
const cards=[
  {
    id:'evacuees',label:'避難生活',value:`${n(snapshot.evacuees)}人`,
    note:`${snapshot.shelters}避難所・${snapshot.shelter_municipalities}市町／避難者${snapshot.evacuee_municipalities}市町（熊本県 9/11 14:00）`,
    href:prefectureSource.url,source:'熊本県 第3回復旧・復興本部 参考資料'
  },
  {
    id:'water',label:'上水道断水',value:water.display_value,note:water.display_note,
    href:waterSource.url,source:'熊本県 第1回復旧・復興本部'
  },
  {
    id:'housing',label:'住家被害',value:`${n(snapshot.housing_damage)}棟`,
    note:`全壊${n(snapshot.housing_breakdown.destroyed)}・大規模半壊${n(snapshot.housing_breakdown.large_scale_half_destroyed)}・半壊${n(snapshot.housing_breakdown.half_destroyed)}・一部破損${n(snapshot.housing_breakdown.partially_damaged)}・分類未確定${n(snapshot.housing_breakdown.unclassified)}（9/11 14:00）`,
    href:prefectureSource.url,source:'熊本県 第3回復旧・復興本部 参考資料'
  },
  {
    id:'waste',label:'災害廃棄物',value:waste.display_value,note:waste.display_note,
    href:wasteSource.url,source:'環境省 9/11時点 災害廃棄物対策'
  }
];
const kpiHtml=`<div class="needs-kpis">${cards.map(card=>`\n<a class="needs-kpi" data-needs-kpi="${esc(card.id)}" href="${esc(card.href)}" target="_blank" rel="noopener noreferrer"><div class="needs-kpi-label">${esc(card.label)}</div><div class="needs-kpi-value">${esc(card.value)}</div><div class="needs-kpi-note">${esc(card.note)}</div><div class="needs-kpi-source">${esc(card.source)}を開く ↗</div></a>`).join('')}\n</div>\n`;
html=html.slice(0,kpiStart)+kpiHtml+html.slice(kpiEnd);

const needsCssPattern=/\.needs-kpis\{[^\n]*\}\.needs-kpi\{[^\n]*\}\.needs-kpi-label\{[^\n]*\}\.needs-kpi-value\{[^\n]*\}\.needs-kpi-note\{[^\n]*\}/u;
if(!needsCssPattern.test(html))throw new Error('needs KPI CSS block not found');
html=html.replace(needsCssPattern,'.needs-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}.needs-kpi{display:block;border:1px solid var(--line);border-radius:11px;background:#fff;padding:11px 12px;color:inherit;text-decoration:none;cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}.needs-kpi:hover,.needs-kpi:focus-visible{border-color:#6b96b2;box-shadow:0 5px 15px rgba(17,40,54,.10);transform:translateY(-1px);outline:none}.needs-kpi-label{font-size:9px;color:var(--muted);font-weight:850}.needs-kpi-value{margin-top:4px;font-size:21px;font-weight:900}.needs-kpi-note{margin-top:4px;color:var(--muted);font-size:9px;line-height:1.4}.needs-kpi-source{margin-top:7px;padding-top:6px;border-top:1px solid #edf1f3;color:#245f82;font-size:9px;font-weight:850;line-height:1.35}');

function replaceOverviewCard(impact,value,unit,note){
  const pattern=new RegExp(`<button class="overview-kpi" data-overview-impact="${impact}" type="button">[\\s\\S]*?<\\/button>`,'u');
  if(!pattern.test(html))throw new Error(`overview KPI ${impact} not found`);
  html=html.replace(pattern,`<button class="overview-kpi" data-overview-impact="${impact}" type="button"><div class="overview-kpi-label">${esc(impact==='evacuees'?'避難者':impact==='casualties'?'人的被害':'住家被害')}</div><div class="overview-kpi-value">${esc(n(value))}<span class="overview-kpi-unit">${esc(unit)}</span></div><div class="overview-kpi-note">${esc(note)}</div></button>`);
}
const prefNote='9月11日14時・熊本県復旧・復興本部参考資料';
replaceOverviewCard('evacuees',snapshot.evacuees,'人',prefNote);
replaceOverviewCard('casualties',snapshot.human_damage,'人',prefNote);
replaceOverviewCard('houses',snapshot.housing_damage,'棟',prefNote);
html=html.replace('熊本県第52報（9月3日14時）では住家被害63,878棟。被害区分・市町別旧スナップショットは対象時点が異なるため、県計へ機械的に再配分しない。',`熊本県9月11日14時参考資料では住家被害${n(snapshot.housing_damage)}棟。市町別旧スナップショットは対象時点が異なるため、最新県計へ機械的に再配分しない。`);

const provinceActionsPattern=/<div class="needs-actions"><a href="https:\/\/www\.pref\.kumamoto\.jp\/uploaded\/attachment\/316600\.pdf" target="_blank" rel="noopener">熊本県本部資料<\/a><a href="https:\/\/www\.pref\.kumamoto\.jp\/uploaded\/life\/277838_875456_misc\.pdf" target="_blank" rel="noopener">市町村別被害表<\/a><\/div>/u;
if(!provinceActionsPattern.test(html))throw new Error('province need hard-coded source actions not found');
html=html.replace(provinceActionsPattern,'<div class="needs-actions"><a href="${esc(x.sourceUrl||\'https://www.pref.kumamoto.jp/soshiki/5/278881.html\')}" target="_blank" rel="noopener noreferrer">${esc(x.sourceLabel||\'現在データの公式根拠\')} ↗</a></div>');

const overlayStart='/* NEEDS_KPI_SOURCE_FIX_20260915_START */';
const overlayEnd='/* NEEDS_KPI_SOURCE_FIX_20260915_END */';
const oldStart=html.indexOf(overlayStart);
if(oldStart>=0){const oldEnd=html.indexOf(overlayEnd,oldStart);if(oldEnd<0)throw new Error('needs KPI overlay end missing');html=html.slice(0,oldStart)+html.slice(oldEnd+overlayEnd.length);}
const sourceJson={
  prefecture:{label:'熊本県 第3回令和8年熊本地震復旧・復興本部 参考資料（9月11日14時）',url:prefectureSource.url},
  water:{label:'熊本県 第1回令和8年熊本地震復旧・復興本部',url:waterSource.url},
  waste:{label:'環境省 令和8年熊本地震における災害廃棄物対策（9月11日時点）',url:wasteSource.url}
};
const overlay=`${overlayStart}\n{const S=${JSON.stringify(snapshot)},SRC=${JSON.stringify(sourceJson)};const event=TIMELINE_EVENTS.find(v=>v.id==='t-current-status');if(event)Object.assign(event,{date:'2026-09-11',dateLabel:'9月11日',weekday:'金',time:'14:00',title:'熊本県復旧・復興本部参考資料で被害・避難状況を更新',summary:'避難者'+S.evacuees.toLocaleString('ja-JP')+'人、開設避難所'+S.shelters+'か所、人的被害'+S.human_damage+'人、住家被害'+S.housing_damage.toLocaleString('ja-JP')+'棟。',detail:'熊本県第3回復旧・復興本部会議の参考資料（9月11日14時現在）の県全体値。現行公式避難所JSONは別定義・別時点で表示し、県報'+S.shelters+'か所へ機械的に合わせない。',sourceLabel:SRC.prefecture.label,sourceUrl:SRC.prefecture.url,tags:['熊本県復旧・復興本部','9月11日14時','最新確認']});const U={'p-shelter':{title:'避難所運営・保健福祉',level:'very-high',observed:'熊本県9月11日14時参考資料では避難所'+S.shelters+'か所、避難者'+S.evacuees.toLocaleString('ja-JP')+'人。現行公式避難所JSONは取得時点の開設施設を別定義で表示する。',sourceLabel:SRC.prefecture.label,sourceUrl:SRC.prefecture.url},'p-water':{title:'井戸等の生活用水復旧・衛生支援',level:'medium',observed:'熊本県は8月31日の復旧・復興本部で「上水道の断水解消」を公表。旧8月21日の約4,300戸・給水車129台は履歴値で、現況値として使用しない。9月11日時点では被災井戸の応急修理支援を継続。',inference:'上水道の広域断水対応から、被災井戸等の生活用水復旧、衛生管理、個別施設の復旧支援へ重点が移る。',watch:'井戸等の復旧件数、生活用水相談、医療・福祉施設の個別復旧',sourceLabel:SRC.water.label,sourceUrl:SRC.water.url},'p-admin':{observed:'熊本県9月11日14時参考資料では住家被害'+S.housing_damage.toLocaleString('ja-JP')+'棟。市町別旧スナップショットとは時点が異なるため、県計と旧内訳を分離して表示する。',sourceLabel:SRC.prefecture.label,sourceUrl:SRC.prefecture.url},'p-housing':{observed:'熊本県9月11日14時参考資料では住家被害'+S.housing_damage.toLocaleString('ja-JP')+'棟。確認済み県計を超えて推測しない。',sourceLabel:SRC.prefecture.label,sourceUrl:SRC.prefecture.url},'p-waste':{observed:'環境省は9月11日時点の災害廃棄物対策資料を公表。仮置場の開設数は時点で変動するため、旧8月19日の「10市町村」を現況値として使用しない。',sourceLabel:SRC.waste.label,sourceUrl:SRC.waste.url}};for(const [id,v] of Object.entries(U)){const item=PROVINCE_NEEDS.find(q=>q.id===id);if(item)Object.assign(item,v);}const waterRecord=RECORDS.find(v=>v.id==='national-water');if(waterRecord)Object.assign(waterRecord,{status:'上水道の断水解消を確認',scale:'上水道断水：解消確認',period:'熊本県 8月31日復旧・復興本部',detail:'熊本県は8月31日の復旧・復興本部で「上水道の断水解消」を公表。国土交通省第47報の約4,300戸・給水車129台は8月21日時点の履歴値として扱い、現況値には使用しない。井戸等の生活用水復旧支援は継続。',asOf:'熊本県 8月31日',sourceLabel:SRC.water.label,sourceUrl:SRC.water.url});if(typeof currentSnapshot20260821!=='undefined')Object.assign(currentSnapshot20260821,{checkedAt:'${audit.reference_at}',currentAsOf:'${snapshot.as_of}'});if(typeof PAGE_RECHECK_META!=='undefined'){const row=PAGE_RECHECK_META.rows.find(v=>v.section==='支援ニーズ見通し');if(row)Object.assign(row,{status:'差分あり',current:'9月11日14時の熊本県参考資料、8月31日の上水道断水解消、環境省9月11日廃棄物資料へ更新',previous:'避難2,709人・断水約4,300戸・住家38,537棟・仮置場10市町村',difference:'県全体KPIの静的8月値を撤去。避難1,771人、住家68,851棟へ更新し、上水道断水は解消確認、災害廃棄物は処理継続として表示。各KPIから一次情報へ直接遷移可能にした。',source:'熊本県復旧・復興本部／環境省',url:SRC.prefecture.url});}}\n${overlayEnd}`;
const insertMarker='/* EHIME_CURRENT_20260915_START */';
const insertAt=html.indexOf(insertMarker);
if(insertAt<0)throw new Error('overlay insertion marker not found');
html=html.slice(0,insertAt)+overlay+'\n\n'+html.slice(insertAt);

await writeFile(sourcePath,html,'utf8');
await writeFile(publicPath,html,'utf8');
console.log(JSON.stringify({status:'PASS',reference_at:audit.reference_at,evacuees:snapshot.evacuees,housing_damage:snapshot.housing_damage,water:water.display_value,waste:waste.display_value,kpi_links:cards.length}));

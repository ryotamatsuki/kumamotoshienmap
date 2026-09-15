import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const sourcePath=resolve(root,'ehime_kumamoto_support_geocoded_shelters_20260802.html');
const publicPath=resolve(root,'public/dashboard.html');
const auditPath=resolve(root,'operations/audits/needs-kpi-source-recheck-20260915-1942.json');
const [sourceHtml,publicHtml,auditText]=await Promise.all([readFile(sourcePath,'utf8'),readFile(publicPath,'utf8'),readFile(auditPath,'utf8')]);
if(sourceHtml!==publicHtml)throw new Error('needs KPI source/public parity failed');
const audit=JSON.parse(auditText);
const snapshot=audit.prefectural_snapshot;
const start=sourceHtml.indexOf('<div class="needs-kpis">');
const end=sourceHtml.indexOf('<div class="needs-phasebar"',start);
if(start<0||end<0)throw new Error('needs KPI block missing');
const block=sourceHtml.slice(start,end);

for(const id of ['evacuees','water','housing','waste']){
  if(!block.includes(`data-needs-kpi="${id}"`))throw new Error(`needs KPI link missing: ${id}`);
}
for(const stale of ['2,709人','約4,300戸','4,284戸','給水車129台','38,537棟']){
  if(block.includes(stale))throw new Error(`stale needs KPI value remains: ${stale}`);
}
if(block.includes('<div class="needs-kpi-value">10市町村</div>'))throw new Error('historical waste municipality count remains as current KPI value');
for(const expected of [Number(snapshot.evacuees).toLocaleString('ja-JP')+'人',Number(snapshot.housing_damage).toLocaleString('ja-JP')+'棟','解消確認','処理継続','公式根拠']){
  if(!block.includes(expected))throw new Error(`current needs KPI value/source missing: ${expected}`);
}
const hrefs=[...block.matchAll(/<a class="needs-kpi"[^>]+href="([^"]+)"/gu)].map(match=>match[1]);
if(hrefs.length!==4)throw new Error(`needs KPI href count must be 4, got ${hrefs.length}`);
if(hrefs.some(url=>!/^https:\/\/(www\.pref\.kumamoto\.jp|www\.env\.go\.jp)\//u.test(url)))throw new Error(`needs KPI contains non-official source URL: ${JSON.stringify(hrefs)}`);
if(!sourceHtml.includes('熊本県9月11日14時参考資料では住家被害68,851棟'))throw new Error('province need current housing evidence not synchronized');
if(!sourceHtml.includes('旧8月21日の約4,300戸・給水車129台は履歴値で、現況値として使用しない'))throw new Error('historical water value is not explicitly demoted');
if(!sourceHtml.includes('旧8月19日の「10市町村」を現況値として使用しない'))throw new Error('historical waste value is not explicitly demoted');
if(!sourceHtml.includes('上水道の断水解消を確認'))throw new Error('water record resolution state missing');
if(!sourceHtml.includes("sourceUrl:SRC.prefecture.url"))throw new Error('province current source binding missing');
if(!sourceHtml.includes('data-overview-impact="evacuees"')||!sourceHtml.includes('1,771<span class="overview-kpi-unit">人</span>'))throw new Error('overview evacuee KPI is not current');
if(!sourceHtml.includes('407<span class="overview-kpi-unit">人</span>'))throw new Error('overview human-damage KPI is not current');
if(!sourceHtml.includes('68,851<span class="overview-kpi-unit">棟</span>'))throw new Error('overview housing KPI is not current');
if(!sourceHtml.includes('9月11日14時・熊本県復旧・復興本部参考資料'))throw new Error('overview current source note missing');

console.log(JSON.stringify({status:'PASS',evacuees:snapshot.evacuees,housing_damage:snapshot.housing_damage,kpi_links:hrefs.length,official_domains:[...new Set(hrefs.map(url=>new URL(url).hostname))]}));

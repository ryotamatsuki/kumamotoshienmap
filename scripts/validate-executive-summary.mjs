import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const auditDir=resolve(root,"operations","audits");
const names=await readdir(auditDir);
const latest=(re,label)=>{const name=names.filter(n=>re.test(n)).sort().at(-1);assert.ok(name,`${label} audit missing`);return name;};
const needsName=latest(/^needs-kpi-source-recheck-\d{8}-\d{4}\.json$/u,"needs");
const ehimeName=latest(/^ehime-source-recheck-\d{8}-\d{4}\.json$/u,"Ehime");
const volunteerName=latest(/^volunteer-source-recheck-\d{8}-\d{4}\.json$/u,"volunteer");
const [html,pub,needsText,ehimeText,volunteerText,sheltersText,municipalText,nationalText]=await Promise.all([
  readFile(resolve(root,"ehime_kumamoto_support_geocoded_shelters_20260802.html"),"utf8"),
  readFile(resolve(root,"public","dashboard.html"),"utf8"),
  readFile(resolve(auditDir,needsName),"utf8"),
  readFile(resolve(auditDir,ehimeName),"utf8"),
  readFile(resolve(auditDir,volunteerName),"utf8"),
  readFile(resolve(root,"current-shelters.json"),"utf8"),
  readFile(resolve(root,"municipal-support-audit.json"),"utf8"),
  readFile(resolve(root,"national-support-audit.json"),"utf8")
]);
assert.equal(html,pub,"source/public parity");
const needs=JSON.parse(needsText),ehime=JSON.parse(ehimeText),volunteer=JSON.parse(volunteerText);
const shelters=JSON.parse(sheltersText),municipal=JSON.parse(municipalText),national=JSON.parse(nationalText);
const d=needs.prefectural_snapshot;
const n=v=>Number(v).toLocaleString("ja-JP");
const mdhm=v=>{const m=String(v||"").match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u);return m?`${Number(m[1])}月${Number(m[2])}日${m[3]}:${m[4]}`:String(v||"");};
const ymd=v=>{const m=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})/u);return m?`${m[1]}年${Number(m[2])}月${Number(m[3])}日`:String(v||"");};

const s=html.indexOf('<div aria-labelledby="overviewViewTab"'),e=html.indexOf('<div aria-labelledby="needsViewTab"');
assert.ok(s>=0&&e>s,"executive summary range missing");
const executive=html.slice(s,e);
for(const value of [
  "知事・幹部向け 意思決定サマリー",
  `主要数値：${mdhm(d.as_of)}`,
  `${ymd(national.reference_at)}確認`,
  `復旧・生活再建段階（熊本県最新被害等：${mdhm(d.as_of)}）`,
  `${n(d.evacuees)}<span class="overview-kpi-unit">人`,
  `${d.shelters}<span class="overview-kpi-unit">か所`,
  `${n(d.human_damage)}<span class="overview-kpi-unit">人`,
  `${n(d.housing_damage)}<span class="overview-kpi-unit">棟`,
  "地図JSON最終取得",
  `対口支援${ehime.human_support.counterpart_support.persons}人`,
  `人的支援総計${ehime.human_support.total.persons}人・延${n(ehime.human_support.total.person_days)}人日`
])assert.ok(executive.includes(value),`executive summary missing: ${value}`);

const currentProviders=[];
for(const r of municipal.records||[])for(const item of [...(r.provider_statuses||[]),...(r.additional_statuses||[])])if(item.state==="CURRENT")currentProviders.push(`${item.name}→${r.destination}`);
for(const provider of [...new Set(currentProviders)])assert.ok(executive.includes(provider),`municipal CURRENT provider missing from executive: ${provider}`);

const metaMatch=html.match(/const\s+PAGE_RECHECK_META\s*=\s*(\{[^\n]*\});/u);
assert.ok(metaMatch,"PAGE_RECHECK_META missing");
const meta=JSON.parse(metaMatch[1]);
assert.equal(meta.checkedAt,national.reference_at,"PAGE_RECHECK_META checkedAt");
assert.equal(meta.volunteerCheckedAt,volunteer.checked_at,"PAGE_RECHECK_META volunteerCheckedAt");
const bySection=new Map((meta.rows||[]).map(row=>[row.section,row]));
for(const section of ["被害・支援","愛媛県支援","避難所","支援ニーズ見通し","発災後タイムライン","支援ダッシュボード","災害ボランティア","地図・境界","他自治体等","国・関係機関"])assert.ok(bySection.has(section),`PAGE_RECHECK_META row missing: ${section}`);
const damageText=JSON.stringify(bySection.get("被害・支援"));
for(const value of [mdhm(d.as_of),n(d.evacuees),String(d.human_damage),n(d.housing_damage)])assert.ok(damageText.includes(value),`damage row missing ${value}`);
const shelterText=JSON.stringify(bySection.get("避難所"));
assert.ok(shelterText.includes(`${d.shelters}か所`),"reported shelter count missing");
assert.ok(shelterText.includes(`地図JSON最終取得${shelters.meta.current_count}施設`),"last-fetched map shelter count missing");
const ehimeRow=JSON.stringify(bySection.get("愛媛県支援"));
for(const value of [String(ehime.human_support.counterpart_support.persons),n(ehime.human_support.counterpart_support.person_days),String(ehime.human_support.total.persons),n(ehime.human_support.total.person_days)])assert.ok(ehimeRow.includes(value),`Ehime row missing ${value}`);
assert.ok(JSON.stringify(bySection.get("国・関係機関")).includes(String(national.inventory.audit_record_count)),"national record count missing");
assert.equal(municipal.reference_at,national.reference_at,"municipal/national reference mismatch");

console.log(JSON.stringify({
  status:"PASS",needsAudit:needsName,ehimeAudit:ehimeName,volunteerAudit:volunteerName,
  major_as_of:d.as_of,page_checked_at:national.reference_at,reported_shelters:d.shelters,
  last_fetched_map_shelters:shelters.meta.current_count,executive_rows:meta.rows.length
}));

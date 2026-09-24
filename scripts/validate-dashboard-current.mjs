import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { assertCurrentPageMetadataSynced } from "./current-page-metadata.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const auditDir=resolve(root,"operations","audits");
const names=await readdir(auditDir);
const latest=(pattern,label)=>{const m=names.filter(n=>pattern.test(n)).sort().at(-1);assert.ok(m,label+" audit missing");return m;};
const needsName=latest(/^needs-kpi-source-recheck-\d{8}-\d{4}\.json$/u,"needs");
const ehimeName=latest(/^ehime-source-recheck-\d{8}-\d{4}\.json$/u,"ehime");
const volunteerName=latest(/^volunteer-source-recheck-\d{8}-\d{4}\.json$/u,"volunteer");

const [html,pub,shelterText,municipalText,nationalText,needsText,ehimeText,volunteerText]=await Promise.all([
  readFile(resolve(root,"ehime_kumamoto_support_geocoded_shelters_20260802.html"),"utf8"),
  readFile(resolve(root,"public/dashboard.html"),"utf8"),
  readFile(resolve(root,"current-shelters.json"),"utf8"),
  readFile(resolve(root,"municipal-support-audit.json"),"utf8"),
  readFile(resolve(root,"national-support-audit.json"),"utf8"),
  readFile(resolve(auditDir,needsName),"utf8"),
  readFile(resolve(auditDir,ehimeName),"utf8"),
  readFile(resolve(auditDir,volunteerName),"utf8")
]);
const shelters=JSON.parse(shelterText),municipal=JSON.parse(municipalText),national=JSON.parse(nationalText);
const needs=JSON.parse(needsText),ehime=JSON.parse(ehimeText),volunteer=JSON.parse(volunteerText),damage=needs.prefectural_snapshot;
const n=v=>Number(v).toLocaleString("ja-JP");
const mdhm=v=>{const m=String(v||"").match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u);return m?`${Number(m[1])}月${Number(m[2])}日${m[3]}:${m[4]}`:String(v||"");};

assert.equal(html,pub,"source/public parity");
assert.equal(municipal.reference_at,national.reference_at,"municipal/national reference_at");
assert.equal(municipal.release_id,national.release_id,"municipal/national release_id");
assert.ok(Date.parse(needs.reference_at)<=Date.parse(national.reference_at),"needs audit newer than page reference");
assert.ok(Date.parse(ehime.reference_at)<=Date.parse(national.reference_at),"Ehime audit newer than page reference");
assert.equal(shelters.meta.current_count,shelters.shelters.length,"current shelter count");
assert.ok(shelters.shelters.every(x=>x.coordinate_status==="confirmed"),"all current shelter coordinates must be confirmed");

function extract(name,next){
  const marker=`const ${name}=`,start=html.indexOf(marker);assert.ok(start>=0,`${name} missing`);
  const v=start+marker.length,nxt=html.indexOf(next,v);let depth=0,str=false,esc=false,end=-1;
  for(let i=v;i<nxt;i++){const c=html[i];if(str){if(esc)esc=false;else if(c==="\\\\")esc=true;else if(c==='"')str=false;continue;}if(c==='"'){str=true;continue;}if(c==="["||c==="{")depth++;else if(c==="]"||c==="}"){depth--;if(depth===0){end=i;break;}}}
  assert.ok(end>=v,`${name} parse end missing`);return JSON.parse(html.slice(v,end+1));
}
const meta=extract("PAGE_RECHECK_META","const PROVIDER_LABEL=");
assertCurrentPageMetadataSynced(html,meta);
assert.equal(meta.checkedAt,national.reference_at,"page checkedAt");
assert.equal(meta.volunteerCheckedAt,volunteer.checked_at,"volunteer checkedAt");

const display=html.slice(0,html.indexOf('<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js">'));
for(const value of [
  `${n(damage.evacuees)}<span class="overview-kpi-unit">人</span>`,
  `${n(damage.human_damage)}<span class="overview-kpi-unit">人</span>`,
  `${n(damage.housing_damage)}<span class="overview-kpi-unit">棟</span>`,
  mdhm(damage.as_of),
  `対口支援${ehime.human_support.counterpart_support.persons}人`,
  `人的支援総計${ehime.human_support.total.persons}人・延${n(ehime.human_support.total.person_days)}人日`,
  'data-view="overview"','data-view="needs"','data-view="timeline"','data-view="dashboard"','data-view="volunteer"','data-view="map"'
]) assert.ok(display.includes(value),`current display missing: ${value}`);

const dataStart=html.indexOf("const HUBS=");
const markerCandidates=["/* EHIME_CURRENT_20260915_END */","/* NATIONAL_SUPPORT_AUDIT_END */","/* MUNICIPAL_SUPPORT_AUDIT_END */"];
let dataEnd=Math.max(...markerCandidates.map(m=>{const i=html.lastIndexOf(m);return i<0?-1:i+m.length;}));
assert.ok(dataStart>=0&&dataEnd>dataStart,"runtime data region missing");
const sandbox={};
runInNewContext(`${html.slice(dataStart,dataEnd)}\nglobalThis.__r={PROVINCE_NEEDS,TIMELINE_EVENTS,RECORDS,CURRENT_SHELTER_META,CURRENT_SHELTER_ROWS,CURRENT_SHELTERS,PAGE_RECHECK_META};`,sandbox,{timeout:5000});
const r=sandbox.__r;
assert.equal(JSON.stringify(r.CURRENT_SHELTER_ROWS),JSON.stringify(shelters.shelters),"embedded current shelter rows");
assert.equal(r.CURRENT_SHELTER_META.currentCount,shelters.meta.current_count,"embedded shelter count");
const event=r.TIMELINE_EVENTS.find(x=>x.id==="t-current-status");assert.ok(event,"current timeline event missing");
assert.equal(event.date,String(damage.as_of).slice(0,10),"current timeline date");
for(const value of [n(damage.evacuees),String(damage.human_damage),n(damage.housing_damage)])assert.ok(event.summary.includes(value),`timeline missing ${value}`);
const ps=r.PROVINCE_NEEDS.find(x=>x.id==="p-shelter"),pa=r.PROVINCE_NEEDS.find(x=>x.id==="p-admin");
assert.ok(ps?.observed.includes(n(damage.evacuees)),"shelter need not current");
assert.ok(pa?.observed.includes(n(damage.housing_damage)),"admin need not current");
const em=r.RECORDS.find(x=>x.id==="ehime-management"),eh=r.RECORDS.find(x=>x.id==="ehime-health"),ed=r.RECORDS.find(x=>x.id==="ehime-dwat");
assert.ok(em?.scale.includes(String(ehime.human_support.counterpart_support.persons)),"Ehime counterpart runtime stale");
assert.ok(eh?.scale.includes(String(ehime.human_support.public_health.persons)),"Ehime health runtime stale");
assert.ok(ed?.scale.includes(String(ehime.human_support.dwat.persons)),"Ehime DWAT runtime stale");

console.log(JSON.stringify({status:"PASS",reference_at:national.reference_at,needsAudit:needsName,ehimeAudit:ehimeName,volunteerAudit:volunteerName,damage_as_of:damage.as_of,currentShelters:shelters.shelters.length}));

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { assertCurrentPageMetadataSynced } from "./current-page-metadata.mjs";
const REF="2026-09-15T01:05:48+09:00";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const [html,pub,shelterText,municipalText,nationalText,coverageText]=await Promise.all([
  readFile(resolve(root,"ehime_kumamoto_support_geocoded_shelters_20260802.html"),"utf8"),
  readFile(resolve(root,"public/dashboard.html"),"utf8"),
  readFile(resolve(root,"current-shelters.json"),"utf8"),
  readFile(resolve(root,"municipal-support-audit.json"),"utf8"),
  readFile(resolve(root,"national-support-audit.json"),"utf8"),
  readFile(resolve(root,"operations/audits/institution-coverage-20260915-0105.json"),"utf8")]);
const shelters=JSON.parse(shelterText),municipal=JSON.parse(municipalText),national=JSON.parse(nationalText),coverage=JSON.parse(coverageText);
assert.equal(html,pub,"source/public parity");
assert.equal(municipal.reference_at,REF,"municipal reference_at");
assert.equal(national.reference_at,REF,"national reference_at");
assert.equal(coverage.reference_at,REF,"institution coverage reference_at");
assert.equal(shelters.meta.current_count,38,"current shelter count");
assert.equal(shelters.shelters.length,38,"current shelter rows");
assert.ok(shelters.shelters.every(x=>x.coordinate_status==="confirmed"),"all current shelter coordinates must be confirmed");
const currentDisplay=html.slice(0,html.indexOf('<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js">'));
for(const value of ["経過日 D+49（県第56報：9月10日14時）","1,780<span class=\"overview-kpi-unit\">人","406<span class=\"overview-kpi-unit\">人","68,033<span class=\"overview-kpi-unit\">棟","9月15日01:05までに確認できた一次情報","9月15日01:05基準で国関係15件を再監査","はくおうⅡ入浴・休憩・宿泊支援：HISTORICAL／9月13日終了",'data-view="overview"','data-view="needs"','data-view="timeline"','data-view="dashboard"','data-view="volunteer"','data-view="map"']) assert.ok(currentDisplay.includes(value),`current display missing: ${value}`);
for(const stale of ["経過日 D+38（県第52報：9月3日14時）","9月7日15:22基準で国関係15件を再監査","人的支援総計260人・延1,307人日"]) assert.ok(!currentDisplay.includes(stale),`stale current display remains: ${stale}`);
function extract(name,next){const marker=`const ${name}=`,start=html.indexOf(marker);assert.ok(start>=0,`${name} missing`);const v=start+marker.length,n=html.indexOf(next,v);let depth=0,str=false,esc=false,end=-1;for(let i=v;i<n;i++){const c=html[i];if(str){if(esc)esc=false;else if(c==='\\')esc=true;else if(c==='"')str=false;continue;}if(c==='"'){str=true;continue;}if(c==='['||c==='{')depth++;else if(c===']'||c==='}'){depth--;if(depth===0){end=i;break;}}}assert.ok(end>=v,`${name} parse end missing`);return JSON.parse(html.slice(v,end+1));}
const meta=extract("PAGE_RECHECK_META","const PROVIDER_LABEL="); assertCurrentPageMetadataSynced(html,meta); assert.equal(meta.checkedAt,REF); assert.equal(meta.volunteerCheckedAt,REF);
const dataStart=html.indexOf("const HUBS="); const dataEnd=html.indexOf("/* MUNICIPAL_SUPPORT_AUDIT_END */")+"/* MUNICIPAL_SUPPORT_AUDIT_END */".length; assert.ok(dataStart>=0&&dataEnd>dataStart);
const sandbox={}; runInNewContext(`${html.slice(dataStart,dataEnd)}\nglobalThis.__r={PROVINCE_NEEDS,TIMELINE_EVENTS,RECORDS,CURRENT_SHELTER_META,CURRENT_SHELTER_ROWS,CURRENT_SHELTERS,PAGE_RECHECK_META};`,sandbox,{timeout:5000}); const r=sandbox.__r;
assert.equal(JSON.stringify(r.CURRENT_SHELTER_ROWS),JSON.stringify(shelters.shelters),"embedded current shelter rows");
assert.equal(r.CURRENT_SHELTER_META.currentCount,38); assert.equal(r.CURRENT_SHELTERS.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)).length,38);
const e=r.TIMELINE_EVENTS.find(x=>x.id==="t-current-status"); assert.ok(e); assert.equal(e.date,"2026-09-10"); assert.equal(e.summary,"避難者1,780人、開設避難所37か所、人的被害406人、住家被害68,033棟。"); assert.ok(e.tags.includes("熊本県第56報"));
const ps=r.PROVINCE_NEEDS.find(x=>x.id==="p-shelter"),pa=r.PROVINCE_NEEDS.find(x=>x.id==="p-admin"); assert.ok(ps.observed.includes("第56報")&&ps.observed.includes("1,780人")); assert.ok(pa.observed.includes("68,033棟"));
const em=r.RECORDS.find(x=>x.id==="ehime-management"),eh=r.RECORDS.find(x=>x.id==="ehime-health"),ed=r.RECORDS.find(x=>x.id==="ehime-dwat"); assert.ok(em.scale.includes("109人")&&em.scale.includes("延534人日")); assert.ok(eh.scale.includes("33人")); assert.ok(ed.scale.includes("34人"));
assert.ok(html.includes("historyRecords:PREGEOCODED_SHELTERS.map"),"historical/current shelter layer separation"); assert.ok(html.includes("filteredShelters().filter(isCurrentShelterMappable)"),"current map must filter mappable confirmed shelters");
console.log(JSON.stringify({status:"PASS",reference_at:REF,currentShelters:38,damageReport:56,national:national.summary}));

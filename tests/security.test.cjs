const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('volunteer.js','utf8');
const from=source.indexOf('function capacityPlainText(center){');
const end=source.indexOf('function capacitySortValue(center){',from);
if(from<0||end<=from)throw Error('capacityPlainText was not found');
const present=v=>v!==null&&v!==undefined&&v!=='';
const capacityPlainText=new Function('present','statusKey',source.slice(from,end)+'return capacityPlainText;')(present,c=>c.key||'recruiting');
test('calendar capacity labels are plain data and require escaping at render time',()=>{
 assert.equal(capacityPlainText({capacity_disclosed:true,daily_capacity:120,capacity_unit:'人／日'}),'120人／日');
 assert.equal(capacityPlainText({capacity_disclosed:false}),'非公表');
 const payload='<img src=x onerror=alert(1)>';
 assert.equal(capacityPlainText({capacity_disclosed:true,daily_capacity:2,capacity_unit:payload}),'2'+payload);
 assert.match(source,/esc\(info\.capacity\)/);
 assert.doesNotMatch(source,/capacityText\(center\)\.replace/);
});
test('dated refresh scripts no longer contain the two known identity replacements',()=>{
 const a=fs.readFileSync('scripts/fix-pagewide-20260813.mjs','utf8');
 const b=fs.readFileSync('scripts/update-pagewide-20260811.mjs','utf8');
 assert.doesNotMatch(a,/source = source\.replace\(\s*'const currentSupportOverrides20260811='/);
 assert.doesNotMatch(b,/updated = updated\.replace\(\/最新公表集計は2026年8月11日14時の89か所/);
});

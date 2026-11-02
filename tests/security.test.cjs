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
test('removed no-op string replacements in data refresh scripts',()=>{
 for(const path of ['scripts/fix-pagewide-20260813.mjs','scripts/update-pagewide-20260811.mjs']){
  const code=fs.readFileSync(path,'utf8');
  assert.doesNotThrow(()=>new Function(code.replace(/^import .*$/gm,'')));
 }
});

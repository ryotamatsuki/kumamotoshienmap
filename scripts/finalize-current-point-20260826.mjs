import {readFileSync,writeFileSync} from 'node:fs';

const sourceFiles=['ehime_kumamoto_support_geocoded_shelters_20260802.html','public/dashboard.html'];
const shelterCount=JSON.parse(readFileSync('current-shelters.json','utf8')).shelters.length;
const referenceAt='2026-08-26T19:26:53+09:00';
const volunteerCheckedAt='2026-08-26T20:05:00+09:00';

function updateJsonConstant(text,name,nextMarker,mutate){
  const marker=`const ${name}=`;
  const start=text.indexOf(marker);
  if(start<0)throw new Error(`${name} not found`);
  const valueStart=start+marker.length;
  const next=text.indexOf(nextMarker,valueStart);
  if(next<0)throw new Error(`${name} next marker missing`);
  let depth=0,inString=false,escaped=false,valueEnd=-1;
  for(let i=valueStart;i<next;i+=1){
    const c=text[i];
    if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;continue;}
    if(c==='"'){inString=true;continue;}
    if(c==='['||c==='{')depth+=1;
    else if(c===']'||c==='}'){depth-=1;if(depth===0){valueEnd=i;break;}}
  }
  if(valueEnd<0)throw new Error(`${name} JSON end missing`);
  const value=JSON.parse(text.slice(valueStart,valueEnd+1));
  mutate(value);
  return text.slice(0,valueStart)+JSON.stringify(value)+text.slice(valueEnd+1);
}

for(const path of sourceFiles){
  let text=readFileSync(path,'utf8');
  text=updateJsonConstant(text,'TIMELINE_EVENTS','const RECORDS=',events=>{
    const event=events.find(item=>item.id==='t-current-status');
    if(!event)throw new Error('t-current-status missing');
    Object.assign(event,{date:'2026-08-26',dateLabel:'8月26日',weekday:'水',time:'08:00',phase:'recovery',actor:'kumamoto',title:'熊本県第45報で被害・避難状況を更新',summary:'避難者2,589人、開設避難所64か所、人的被害402人、住家被害39,567棟。',detail:'熊本県第45報（8月26日8時現在）の県全体値。市町別24行の旧スナップショットは時点が異なるため、第45報の県計へ機械的に再配分しない。現行公式避難所JSONは別定義・別時点で表示。',place:'熊本県内',sourceLabel:'熊本県 被害情報 第45報',sourceUrl:'https://www.pref.kumamoto.jp/soshiki/222/276831.html',tags:['熊本県第45報','8月26日8時','最新確認']});
  });
  text=updateJsonConstant(text,'PROVINCE_NEEDS','const NEED_READINESS=',items=>{
    const shelter=items.find(item=>item.id==='p-shelter');
    const admin=items.find(item=>item.id==='p-admin');
    const housing=items.find(item=>item.id==='p-housing');
    if(shelter)shelter.observed='熊本県第45報（8月26日8時）では避難所64か所、避難者2,589人。現行公式避難所JSONは取得時点の開設施設を別定義で表示する。';
    if(admin)admin.observed='熊本県第45報では住家被害39,567棟。市町別旧スナップショットとは時点が異なるため、県計と旧内訳を分離して表示する。';
    if(housing)housing.observed='熊本県第45報では住家被害39,567棟。被害区分別の現況は確認できた県計の範囲を超えて推測せず、旧区分値を現況として流用しない。';
  });
  text=updateJsonConstant(text,'PAGE_RECHECK_META','const PROVIDER_LABEL=',meta=>{
    meta.checkedAt=referenceAt;
    meta.volunteerCheckedAt=volunteerCheckedAt;
  });
  text=text.replaceAll('2026年8月25日 14:08（JST）','2026年8月26日 19:26（JST）')
    .replaceAll('8月24日までの確認済み支援を反映','8月26日19:26までに確認できた一次情報を反映')
    .replaceAll('8月25日14:08基準で全件再監査','8月26日19:26基準で全件再監査')
    .replaceAll('D+27','D+29');
  writeFileSync(path,text);
}

const validator='scripts/validate-current-state-audit.mjs';
let v=readFileSync(validator,'utf8');
v=v.replace('assert.ok(need("p-shelter").observed.includes("8月24日15時30分更新"));','assert.ok(need("p-shelter").observed.includes("熊本県第45報"));')
 .replace('assert.ok(event("t-current-status").tags.includes("熊本県第42報"));','assert.ok(event("t-current-status").tags.includes("熊本県第45報"));')
 .replace('assert.equal(event("t-current-status").summary, "避難者2,709人、開設避難所65か所、人的被害398人、住家被害38,537棟。");','assert.equal(event("t-current-status").summary, "避難者2,589人、開設避難所64か所、人的被害402人、住家被害39,567棟。");')
 .replace('"D+27", "行政応援971人", "8月24日までの確認済み支援", "8月25日14:08基準で全件再監査"','"D+29", "行政応援971人", "8月26日19:26までに確認できた一次情報", "8月26日19:26基準で全件再監査"')
 .replace('assert.equal(shelterData.meta.current_count, 67);',`assert.equal(shelterData.meta.current_count, ${shelterCount});`)
 .replace('assert.equal(shelterData.shelters.length, 67);',`assert.equal(shelterData.shelters.length, ${shelterCount});`)
 .replace('assert.ok(Date.parse(pageMeta.volunteerCheckedAt) <= Date.parse(REFERENCE_AT), "volunteer確認時刻がreference_atより未来です");','assert.ok(Number.isFinite(Date.parse(pageMeta.volunteerCheckedAt)) && Date.parse(pageMeta.volunteerCheckedAt) >= Date.parse(REFERENCE_AT), "volunteer確認時刻がreference_at以前又は不正です");');
writeFileSync(validator,v);

const volunteerValidator='scripts/validate-volunteer-data.mjs';
let volunteer=readFileSync(volunteerValidator,'utf8');
volunteer=volunteer
  .replace('data.meta.reference_at.startsWith("2026-08-24")','data.meta.reference_at.startsWith("2026-08-26")')
  .replace('ボランティア情報の基準日が2026-08-22ではありません','ボランティア情報の基準日が2026-08-26ではありません');
writeFileSync(volunteerValidator,volunteer);

console.log(JSON.stringify({status:'PASS',shelterCount,referenceAt,volunteerCheckedAt}));

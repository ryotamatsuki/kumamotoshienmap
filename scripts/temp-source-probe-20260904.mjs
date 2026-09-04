import { readFile, writeFile } from 'node:fs/promises';

const referenceAt = '2026-09-04T15:09:00+09:00';
const urls = [
  ['kumamoto-damage','https://www.pref.kumamoto.jp/soshiki/222/276831.html'],
  ['kumamoto-current-shelters','https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json'],
  ['ehime-support','https://www.pref.ehime.jp/page/154856.html'],
  ['kumamoto-volunteer','https://www.fukushi-kumamoto.or.jp/'],
  ['mlit','https://www.mlit.go.jp/saigai/saigai_260728.html'],
  ['mod','https://www.mod.go.jp/j/approach/defense/saigai/index.html'],
  ['taketa','https://www.city.taketa.oita.jp/kurashi_tetsuzuki/bosai_kyukyu/reiwa8nenkumamotojishin/13115.html']
];

function jstNow() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d).reduce((o,p)=>(o[p.type]=p.value,o),{});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`;
}

const results = [];
for (const [id,url] of urls) {
  try {
    const response = await fetch(url, {redirect:'follow', headers:{'user-agent':'kumamotoshienmap-timepoint-probe/20260904'}});
    const text = await response.text();
    results.push({
      id,url,status:response.status,ok:response.ok,
      content_type:response.headers.get('content-type'),
      last_modified:response.headers.get('last-modified'),
      fetched_at:jstNow(),
      length:text.length,
      markers:{
        report51:text.includes('第51報'), report52:text.includes('第52報'),
        sep3:text.includes('9月3日') || text.includes('９月３日'),
        sep4:text.includes('9月4日') || text.includes('９月４日'),
        current:text.includes('派遣中') || text.includes('活動中') || text.includes('受付中') || text.includes('派遣しています') || text.includes('支援しています')
      },
      excerpt:text.replace(/\s+/g,' ').slice(0,800)
    });
  } catch (error) {
    results.push({id,url,ok:false,error:String(error),fetched_at:jstNow()});
  }
}

let candidate = null;
try {
  candidate = JSON.parse(await readFile('/tmp/current-shelters-candidate.json','utf8'));
} catch (error) {
  candidate = {error:String(error)};
}

const summary = {
  reference_at: referenceAt,
  generated_at:jstNow(),
  source_probe:results,
  current_shelter_candidate:{
    fetched_at:candidate?.fetched_at ?? null,
    source_last_modified:candidate?.source_last_modified ?? candidate?.source_updated_at ?? null,
    source_as_of:candidate?.source_as_of ?? null,
    count:Array.isArray(candidate?.shelters) ? candidate.shelters.length : candidate?.current_count ?? null,
    unresolved:Array.isArray(candidate?.unresolved) ? candidate.unresolved.length : candidate?.unresolved_count ?? null,
    conflicts:Array.isArray(candidate?.coordinate_conflicts) ? candidate.coordinate_conflicts.length : candidate?.conflict_count ?? null,
    raw_keys:candidate && typeof candidate === 'object' ? Object.keys(candidate) : []
  }
};
await writeFile('operations/audits/temp-source-probe-20260904.json', JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary.current_shelter_candidate,null,2));

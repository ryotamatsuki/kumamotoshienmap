import { writeFile } from 'node:fs/promises';

async function linksNear(url, marker) {
  const r = await fetch(url, {headers:{'user-agent':'kumamotoshienmap-link-probe/20260904'}});
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const text = await r.text();
  const idx = text.indexOf(marker);
  if (idx < 0) return {marker, found:false, links:[]};
  const chunk = text.slice(Math.max(0, idx - 2500), Math.min(text.length, idx + 3500));
  const links = [...chunk.matchAll(/href=["']([^"']+)["']/gi)]
    .map(m => new URL(m[1], url).href)
    .filter((v,i,a)=>a.indexOf(v)===i);
  return {marker, found:true, links};
}

const out = {
  generated_at: new Date().toISOString(),
  kumamoto_damage52: await linksNear('https://www.pref.kumamoto.jp/soshiki/222/276831.html', '第52報'),
  ehime_sep3: await linksNear('https://www.pref.ehime.jp/page/154856.html', '9月3日12時00分')
};
await writeFile('operations/audits/temp-link-probe-20260904.json', JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));

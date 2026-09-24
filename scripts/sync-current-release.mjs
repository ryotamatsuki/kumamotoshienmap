import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const source=resolve(root,'ehime_kumamoto_support_geocoded_shelters_20260802.html');
const publicPath=resolve(root,'public/dashboard.html');
const municipal=JSON.parse(await readFile(resolve(root,'municipal-support-audit.json'),'utf8'));
const national=JSON.parse(await readFile(resolve(root,'national-support-audit.json'),'utf8'));
if(municipal.reference_at!==national.reference_at)throw new Error('municipal/national reference_at mismatch');
if(municipal.release_id!==national.release_id)throw new Error('municipal/national release_id mismatch');
let html=await readFile(source,'utf8');
if(html!==await readFile(publicPath,'utf8'))throw new Error('source/public parity required');

function removeBlock(start,end){
  const s=html.indexOf(start);
  if(s<0)return;
  const e=html.indexOf(end,s);
  if(e<0)throw new Error('overlay end missing: '+end);
  html=html.slice(0,s)+html.slice(e+end.length);
}
removeBlock('/* CURRENT_STATE_REFRESH_20260826_FINAL_START */','/* CURRENT_STATE_REFRESH_20260826_FINAL_END */');
removeBlock('/* CURRENT_STATE_REFRESH_20260915_START */','/* CURRENT_STATE_REFRESH_20260915_END */');

const es='/* EHIME_CURRENT_20260915_START */',ee='/* EHIME_CURRENT_20260915_END */';
const si=html.indexOf(es);
if(si>=0){
  const ei=html.indexOf(ee,si);
  if(ei<0)throw new Error('Ehime overlay end missing');
  html=html.slice(0,si)+es+'\n'+ee+html.slice(ei+ee.length);
}else{
  const anchor=html.indexOf('/* MUNICIPAL_SUPPORT_AUDIT_END */');
  if(anchor<0)throw new Error('municipal audit end missing');
  const at=anchor+'/* MUNICIPAL_SUPPORT_AUDIT_END */'.length;
  html=html.slice(0,at)+'\n'+es+'\n'+ee+'\n'+html.slice(at);
}
html=html.replaceAll(/volunteer-data\.js\?v=[A-Za-z0-9._-]+/gu,'volunteer-data.js?v='+municipal.release_id);
await writeFile(source,html,'utf8');
await writeFile(publicPath,html,'utf8');
console.log(JSON.stringify({status:'PASS',reference_at:municipal.reference_at,release_id:municipal.release_id}));

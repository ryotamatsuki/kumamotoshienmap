import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PREFECTURES = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];
export const EHIME_REQUIRED = ["松山市","今治市","宇和島市","八幡浜市","新居浜市","西条市","大洲市","伊予市","四国中央市","西予市","東温市","上島町","久万高原町","松前町","砥部町","内子町","伊方町","松野町","鬼北町","愛南町"];
const VALID_STATES = new Set(["CURRENT","PLANNED","HISTORICAL","UNKNOWN","NO_EVIDENCE","CONFLICT"]);
const CURRENT_EVIDENCE = new Set(["explicit_current_activity","continuation_explicit","actual_dispatch_confirmed","actual_presence_confirmed","active_collection_explicit"]);

function json(path){ return JSON.parse(readFileSync(resolve(ROOT,path),"utf8")); }
function equalSet(a,b){ return a.length===b.length && a.every(v=>b.includes(v)); }
function validDate(v){ return typeof v==="string" && !Number.isNaN(Date.parse(v)); }
function counts(rows){ const out={CURRENT:0,PLANNED:0,HISTORICAL:0,UNKNOWN:0,NO_EVIDENCE:0,CONFLICT:0}; for(const row of rows) out[row.state]=(out[row.state]||0)+1; return out; }

export function loadSenderAudit(){
  const manifest=json("sender-municipality-audit.json");
  const sources=json(manifest.sources_file).sources;
  const discovery=json(manifest.discovery_file).prefecture_discovery;
  const entities=manifest.entity_files.flatMap(path=>json(path).entities);
  return {manifest,sources,discovery,entities};
}

export function validateSenderAudit(data,{scope="all"}={}){
  const {manifest,sources,discovery,entities}=data;
  const errors=[];
  const err=m=>errors.push(m);
  const sourceMap=new Map();
  for(const s of sources){
    if(!s?.source_id || sourceMap.has(s.source_id)) err(`source id invalid/duplicate: ${s?.source_id}`);
    else sourceMap.set(s.source_id,s);
    if(!/^https:\/\//.test(String(s?.url||""))) err(`source URL invalid: ${s?.source_id}`);
    if(!Number.isInteger(s?.tier) || s.tier<1 || s.tier>5) err(`source tier invalid: ${s?.source_id}`);
  }
  const entityMap=new Map();
  for(const e of entities){
    if(!e?.entity || entityMap.has(e.entity)) { err(`entity missing/duplicate: ${e?.entity}`); continue; }
    entityMap.set(e.entity,e);
    for(const key of ["prefecture","municipality_type","kind","state","support_types","destinations","source_ids","evidence_note","checked_at","next_review_at","sources_checked"]){ if(e[key]===undefined || e[key]===null) err(`${e.entity}: missing ${key}`); }
    if(e.kind!=="basic_municipality_sender") err(`${e.entity}: non-municipality kind in sender denominator`);
    if(!VALID_STATES.has(e.state)) err(`${e.entity}: invalid state ${e.state}`);
    if(!PREFECTURES.includes(e.prefecture)) err(`${e.entity}: invalid prefecture ${e.prefecture}`);
    if(!validDate(e.checked_at)||!validDate(e.next_review_at)) err(`${e.entity}: invalid audit timestamps`);
    if(!Array.isArray(e.source_ids)||e.source_ids.length===0) err(`${e.entity}: source_ids required`);
    for(const id of e.source_ids||[]) if(!sourceMap.has(id)) err(`${e.entity}: unknown source ${id}`);
    if(e.state==="CURRENT"){
      if(!CURRENT_EVIDENCE.has(e.current_evidence_type)) err(`${e.entity}: CURRENT without permitted current_evidence_type`);
      if(!(e.source_ids||[]).some(id=>(sourceMap.get(id)?.tier??9)<=4)) err(`${e.entity}: CURRENT supported only by discovery/secondary sources`);
    }
    if(e.state==="UNKNOWN" && !(typeof e.reason==="string"&&e.reason.trim())) err(`${e.entity}: UNKNOWN requires reason`);
    if(e.state==="NO_EVIDENCE" && (!(typeof e.reason==="string"&&e.reason.trim()) || !Array.isArray(e.sources_checked))) err(`${e.entity}: NO_EVIDENCE requires reason and sources_checked`);
    if(e.state==="CONFLICT") err(`${e.entity}: blocking CONFLICT remains`);
  }

  if(scope==="all"||scope==="ehime"){
    if(!equalSet(manifest.ehime_required_entities||[],EHIME_REQUIRED)) err("Ehime required universe is not exactly 20 canonical municipalities");
    const required=entities.filter(e=>e.prefecture==="愛媛県"&&e.required===true);
    if(required.length!==20) err(`Ehime required entity count must be 20, got ${required.length}`);
    const names=required.map(e=>e.entity);
    for(const name of EHIME_REQUIRED) if(!names.includes(name)) err(`Ehime required entity missing: ${name}`);
  }

  if(scope==="all"||scope==="nationwide"){
    if(discovery.length!==47) err(`prefecture discovery must contain 47 rows, got ${discovery.length}`);
    const seen=new Set();
    for(const d of discovery){
      if(seen.has(d.prefecture)) err(`duplicate prefecture discovery: ${d.prefecture}`); seen.add(d.prefecture);
      if(d.discovery_state!=="CHECKED") err(`${d.prefecture}: discovery not CHECKED`);
      if(!validDate(d.checked_at)||!String(d.search_query||"").trim()) err(`${d.prefecture}: discovery evidence incomplete`);
      for(const n of d.sender_candidates_found||[]) if(!entityMap.has(n)) err(`${d.prefecture}: discovered sender not adjudicated: ${n}`);
    }
    for(const p of PREFECTURES) if(!seen.has(p)) err(`prefecture discovery missing: ${p}`);
  }

  if(scope==="all"||scope==="mentions"){
    const mentions=manifest.source_mentions||[];
    if(new Set(mentions).size!==mentions.length) err("source_mentions contains duplicates");
    for(const n of mentions) if(!entityMap.has(n)) err(`orphan source mention: ${n}`);
    for(const e of entities) if(!mentions.includes(e.entity)) err(`adjudicated sender absent from source mention universe: ${e.entity}`);
  }

  const ehime=entities.filter(e=>e.prefecture==="愛媛県"&&e.required===true);
  const actualEhime=counts(ehime), actualNation=counts(entities);
  if(JSON.stringify(actualEhime)!==JSON.stringify(manifest.summary?.ehime?.states)) err("Ehime summary state counts do not match entity rows");
  if(JSON.stringify(actualNation)!==JSON.stringify(manifest.summary?.nationwide?.states)) err("Nationwide summary state counts do not match entity rows");
  if(manifest.summary?.nationwide?.discovered_basic_municipality_senders!==entities.length) err("Nationwide discovered sender count does not match entity rows");
  if(manifest.summary?.nationwide?.adjudicated_basic_municipality_senders!==entities.length) err("Nationwide adjudicated sender count does not match entity rows");
  if(manifest.summary?.nationwide?.prefecture_discovery_checked!==discovery.filter(d=>d.discovery_state==="CHECKED").length) err("Prefecture discovery summary mismatch");
  if((manifest.blocking_unresolved||[]).length) err("blocking_unresolved is not empty");
  return errors;
}

export function senderSummary(data){
  const ehime=data.entities.filter(e=>e.prefecture==="愛媛県"&&e.required===true);
  return {ehime:{required:ehime.length,states:counts(ehime)},nationwide:{entities:data.entities.length,states:counts(data.entities)},prefecturesChecked:data.discovery.filter(d=>d.discovery_state==="CHECKED").length,sourceMentions:data.manifest.source_mentions.length};
}

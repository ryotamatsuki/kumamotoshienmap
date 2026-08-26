import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PREFECTURES = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];
export const EHIME_REQUIRED = ["松山市","今治市","宇和島市","八幡浜市","新居浜市","西条市","大洲市","伊予市","四国中央市","西予市","東温市","上島町","久万高原町","松前町","砥部町","内子町","伊方町","松野町","鬼北町","愛南町"];
const VALID_STATES = new Set(["CURRENT","PLANNED","HISTORICAL","UNKNOWN","NO_EVIDENCE","CONFLICT"]);
const CURRENT_EVIDENCE = new Set(["explicit_current_activity","continuation_explicit","actual_dispatch_confirmed","actual_presence_confirmed","active_collection_explicit"]);
const NEXT_REVIEW_AT = "2026-08-28T09:00:00+09:00";

function json(path){ return JSON.parse(readFileSync(resolve(ROOT,path),"utf8")); }
function equalSet(a,b){ return a.length===b.length && a.every(v=>b.includes(v)); }
function validDate(v){ return typeof v==="string" && !Number.isNaN(Date.parse(v)); }
function counts(rows){ const out={CURRENT:0,PLANNED:0,HISTORICAL:0,UNKNOWN:0,NO_EVIDENCE:0,CONFLICT:0}; for(const row of rows) out[row.state]=(out[row.state]||0)+1; return out; }
function entityKey(prefecture,entity){ return `${prefecture}/${entity}`; }

function expandEntityPayload(payload){
  if(Array.isArray(payload.entities)) return payload.entities;
  if(!Array.isArray(payload.compact_entities)) return [];
  return payload.compact_entities.map(([prefecture,entity,municipalityType,sourceId,destination,supportType,state])=>{
    const isCurrent=state==="CURRENT";
    let note;
    if(sourceId==="himeji-current") note="市公式が被災自治体への応援派遣を行っている旨を明示し、災害用トイレトレーラーを8月21日～9月4日に宇城市へ派遣。";
    else if(sourceId==="tokyo-wave-0814") note="東京都公式の派遣職員内訳に支援主体として明記。予定期間だけで基準時点の実働継続・終了を推定しない。";
    else if(sourceId==="shinonsen-support") note="町公式で実派遣・活動開始を確認できるが、8月27日基準の継続又は終了を直接確定できない。";
    else note="横断的な災害支援代理寄附ページで協力・代理自治体として発見。secondary sourceは候補発見にのみ用い、基準時点の活動状態を一次情報なしにCURRENTへ昇格しない。";
    const row={entity,prefecture,municipality_type:municipalityType,kind:"basic_municipality_sender",required:false,state,support_types:[supportType],destinations:[destination],source_ids:[sourceId],evidence_note:note,checked_at:payload.reference_at,next_review_at:NEXT_REVIEW_AT,source_as_of:null,sources_checked:[sourceId]};
    if(isCurrent) row.current_evidence_type="explicit_current_activity";
    else row.reason=note;
    return row;
  });
}

export function loadSenderAudit(){
  const manifest=json("sender-municipality-audit.json");
  const sources=[...json(manifest.sources_file).sources,...(manifest.sources_additions_file?json(manifest.sources_additions_file).sources:[])];
  const entities=manifest.entity_files.flatMap(path=>expandEntityPayload(json(path)));
  const discovery=json(manifest.discovery_file).prefecture_discovery.map(row=>structuredClone(row));
  const sourceMentionAdditions=manifest.discovery_additions_file?json(manifest.discovery_additions_file).source_mentions:[];
  const discoveryByPrefecture=new Map(discovery.map(row=>[row.prefecture,row]));
  for(const [prefecture,entity,sourceId] of sourceMentionAdditions){
    const row=discoveryByPrefecture.get(prefecture);
    if(row){
      row.sender_candidates_found=[...new Set([...(row.sender_candidates_found||[]),entity])];
      row.sources_checked=[...new Set([...(row.sources_checked||[]),sourceId])];
    }
  }
  return {manifest,sources,discovery,entities,sourceMentionAdditions};
}

export function validateSenderAudit(data,{scope="all"}={}){
  const {manifest,sources,discovery,entities,sourceMentionAdditions=[]}=data;
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
  const entitiesByName=new Map();
  for(const e of entities){
    const key=entityKey(e?.prefecture,e?.entity);
    if(!e?.entity || !e?.prefecture || entityMap.has(key)) { err(`entity missing/duplicate: ${key}`); continue; }
    entityMap.set(key,e);
    if(!entitiesByName.has(e.entity)) entitiesByName.set(e.entity,[]);
    entitiesByName.get(e.entity).push(e);
    for(const field of ["prefecture","municipality_type","kind","state","support_types","destinations","source_ids","evidence_note","checked_at","next_review_at","sources_checked"]){ if(e[field]===undefined || e[field]===null) err(`${key}: missing ${field}`); }
    if(!Object.hasOwn(e,"source_as_of")) err(`${key}: source_as_of field is required (null allowed when source has no explicit as-of)`);
    if(e.kind!=="basic_municipality_sender") err(`${key}: non-municipality kind in sender denominator`);
    if(!VALID_STATES.has(e.state)) err(`${key}: invalid state ${e.state}`);
    if(!PREFECTURES.includes(e.prefecture)) err(`${key}: invalid prefecture ${e.prefecture}`);
    if(!validDate(e.checked_at)||!validDate(e.next_review_at)) err(`${key}: invalid audit timestamps`);
    if(!Array.isArray(e.source_ids)||e.source_ids.length===0) err(`${key}: source_ids required`);
    for(const id of e.source_ids||[]) if(!sourceMap.has(id)) err(`${key}: unknown source ${id}`);
    if(e.state==="CURRENT"){
      if(!CURRENT_EVIDENCE.has(e.current_evidence_type)) err(`${key}: CURRENT without permitted current_evidence_type`);
      const eligible=(e.source_ids||[]).some(id=>{ const s=sourceMap.get(id); return s && s.tier<=3; });
      if(!eligible) err(`${key}: CURRENT lacks Tier 1-3 primary/official evidence`);
    }
    if(e.state==="UNKNOWN" && !(typeof e.reason==="string"&&e.reason.trim())) err(`${key}: UNKNOWN requires reason`);
    if(e.state==="NO_EVIDENCE" && (!(typeof e.reason==="string"&&e.reason.trim()) || !Array.isArray(e.sources_checked))) err(`${key}: NO_EVIDENCE requires reason and sources_checked`);
    if(e.state==="CONFLICT") err(`${key}: blocking CONFLICT remains`);
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
      for(const n of d.sender_candidates_found||[]){
        if(!entityMap.has(entityKey(d.prefecture,n))) err(`${d.prefecture}: discovered sender not adjudicated: ${n}`);
      }
    }
    for(const p of PREFECTURES) if(!seen.has(p)) err(`prefecture discovery missing: ${p}`);
  }

  if(scope==="all"||scope==="mentions"){
    const mentionKeys=new Set();
    const baseMentions=manifest.source_mentions||[];
    if(new Set(baseMentions).size!==baseMentions.length) err("base source_mentions contains duplicates");
    for(const name of baseMentions){
      const matches=entitiesByName.get(name)||[];
      if(matches.length===0) err(`orphan source mention: ${name}`);
      else if(matches.length>1) err(`ambiguous legacy source mention requires prefecture-qualified addition: ${name}`);
      else mentionKeys.add(entityKey(matches[0].prefecture,matches[0].entity));
    }
    for(const row of sourceMentionAdditions){
      if(!Array.isArray(row)||row.length<3){err("source mention addition is malformed");continue;}
      const [prefecture,name,sourceId]=row;
      const key=entityKey(prefecture,name);
      if(mentionKeys.has(key)) err(`duplicate source mention key: ${key}`);
      mentionKeys.add(key);
      if(!sourceMap.has(sourceId)) err(`source mention ${key}: unknown source ${sourceId}`);
      if(!entityMap.has(key)) err(`orphan source mention: ${key}`);
    }
    for(const [key] of entityMap) if(!mentionKeys.has(key)) err(`adjudicated sender absent from source mention universe: ${key}`);
    if(manifest.summary?.nationwide?.source_mentions!==mentionKeys.size) err(`source mention summary mismatch: expected=${manifest.summary?.nationwide?.source_mentions} actual=${mentionKeys.size}`);
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
  const sourceMentions=(data.manifest.source_mentions?.length||0)+(data.sourceMentionAdditions?.length||0);
  return {ehime:{required:ehime.length,states:counts(ehime)},nationwide:{entities:data.entities.length,states:counts(data.entities)},prefecturesChecked:data.discovery.filter(d=>d.discovery_state==="CHECKED").length,sourceMentions};
}

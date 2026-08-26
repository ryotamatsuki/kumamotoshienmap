import assert from "node:assert/strict";
import { loadSenderAudit, validateSenderAudit } from "./sender-coverage-lib.mjs";

const base=loadSenderAudit();
assert.deepEqual(validateSenderAudit(base),[],"canonical sender audit must pass before destructive tests");
const clone=()=>structuredClone(base);
const mustFail=(label,mutate)=>{
  const data=clone(); mutate(data);
  const errors=validateSenderAudit(data);
  assert.ok(errors.length>0,`${label}: gate unexpectedly passed`);
  return errors[0];
};
const results=[];
results.push(["missing-ehime-required",mustFail("missing-ehime-required",d=>{d.manifest.ehime_required_entities=d.manifest.ehime_required_entities.filter(v=>v!=="松山市");})]);
results.push(["null-state",mustFail("null-state",d=>{d.entities.find(e=>e.entity==="今治市").state=null;})]);
results.push(["uwajima-orphan",mustFail("uwajima-orphan",d=>{d.entities=d.entities.filter(e=>e.entity!=="宇和島市");})]);
results.push(["tokorozawa-orphan",mustFail("tokorozawa-orphan",d=>{d.entities=d.entities.filter(e=>e.entity!=="所沢市");})]);
results.push(["aichi-discovery-missing",mustFail("aichi-discovery-missing",d=>{d.discovery=d.discovery.filter(r=>r.prefecture!=="愛知県");})]);
results.push(["schedule-only-current",mustFail("schedule-only-current",d=>{const e=d.entities.find(e=>e.entity==="下関市");e.state="CURRENT";delete e.current_evidence_type;})]);
results.push(["unknown-without-reason",mustFail("unknown-without-reason",d=>{delete d.entities.find(e=>e.entity==="上島町").reason;})]);
results.push(["46-prefectures",mustFail("46-prefectures",d=>{d.discovery.find(r=>r.prefecture==="北海道").discovery_state="UNCHECKED";})]);
results.push(["special-ward-orphan",mustFail("special-ward-orphan",d=>{d.manifest.source_mentions.push("千代田区");})]);
results.push(["non-municipality-denominator",mustFail("non-municipality-denominator",d=>{d.entities.find(e=>e.entity==="所沢市").kind="fire_service_union";})]);
console.log(JSON.stringify({status:"PASS",destructive_cases:results.length,cases:results}));

import { loadSenderAudit, senderSummary, validateSenderAudit } from "./sender-coverage-lib.mjs";

const arg=process.argv.find(v=>v.startsWith("--scope="));
const scope=arg?arg.slice("--scope=".length):"all";
if(!["all","ehime","nationwide","mentions"].includes(scope)){
  console.error(`Unknown scope: ${scope}`); process.exit(2);
}
const data=loadSenderAudit();
const errors=validateSenderAudit(data,{scope});
if(errors.length){
  for(const error of errors) console.error(`[SENDER COVERAGE FAIL] ${error}`);
  process.exit(1);
}
console.log(JSON.stringify({status:"PASS",scope,...senderSummary(data)}));

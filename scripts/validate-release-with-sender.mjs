import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { ROOT } from "./sender-coverage-lib.mjs";

function run(script,args=[]){
  const result=spawnSync(process.execPath,[resolve(ROOT,"scripts",script),...args],{cwd:ROOT,stdio:"inherit"});
  if(result.error) throw result.error;
  if(result.status!==0) process.exit(result.status??1);
}
run("validate-update-release.mjs",process.argv.slice(2));
run("validate-sender-coverage.mjs",["--scope=all"]);
console.log(JSON.stringify({status:"PASS",existing_release_gate:true,sender_coverage_gate:true}));

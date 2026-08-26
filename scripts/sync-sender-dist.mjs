import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "./sender-coverage-lib.mjs";

const dist=resolve(ROOT,"dist");
mkdirSync(dist,{recursive:true});
for(const file of ["sender-municipality-audit.json","sender-municipalities.html"]){
  cpSync(resolve(ROOT,file),resolve(dist,file));
}
cpSync(resolve(ROOT,"sender-audit"),resolve(dist,"sender-audit"),{recursive:true});
console.log(JSON.stringify({status:"PASS",sender_dist_synced:true}));

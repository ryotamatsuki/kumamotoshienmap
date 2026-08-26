import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { ROOT } from "./sender-coverage-lib.mjs";

const pairs=[["sender-municipality-audit.json","sender-municipality-audit.json"],["sender-municipalities.html","sender-municipalities.html"]];
function walk(dir){return readdirSync(dir).flatMap(name=>{const p=resolve(dir,name);return statSync(p).isDirectory()?walk(p):[p];});}
for(const source of walk(resolve(ROOT,"sender-audit"))){pairs.push([relative(ROOT,source),relative(resolve(ROOT,"sender-audit"),source).replace(/^/,"sender-audit/")]);}
for(const [src,dst] of pairs){
  const a=readFileSync(resolve(ROOT,src));
  const b=readFileSync(resolve(ROOT,"dist",dst));
  assert.ok(a.equals(b),`${src} and dist/${dst} differ`);
}
console.log(JSON.stringify({status:"PASS",files:pairs.length,sender_dist_parity:true}));

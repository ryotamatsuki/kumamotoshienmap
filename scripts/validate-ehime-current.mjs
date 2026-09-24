import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const auditDir=resolve(root,"operations","audits");
const names=(await readdir(auditDir)).filter(n=>/^ehime-source-recheck-\d{8}-\d{4}\.json$/u.test(n)).sort();
const latest=names.at(-1);assert.ok(latest,"Ehime audit missing");
const [html,pub,auditText,producer]=await Promise.all([
 readFile(resolve(root,"ehime_kumamoto_support_geocoded_shelters_20260802.html"),"utf8"),
 readFile(resolve(root,"public/dashboard.html"),"utf8"),
 readFile(resolve(auditDir,latest),"utf8"),
 readFile(resolve(root,"scripts/sync-current-release.mjs"),"utf8")
]);
assert.equal(html,pub,"source/public parity");
const a=JSON.parse(auditText),total=a.human_support.total,counter=a.human_support.counterpart_support,health=a.human_support.public_health,dwat=a.human_support.dwat;
const n=v=>Number(v).toLocaleString("ja-JP");
for(const v of [
 `対口支援${counter.persons}人`,
 `延${n(counter.person_days)}人日`,
 `${health.persons}人（延${n(health.person_days)}人日）`,
 `${dwat.persons}人（延${n(dwat.person_days)}人日）`,
 `人的支援総計${total.persons}人・延${n(total.person_days)}人日`
])assert.ok(html.includes(v),`最新愛媛値がありません: ${v}`);
assert.ok(html.includes(a.source_url),"愛媛県一次情報URLがありません");
assert.ok(producer.includes("ehime-source-recheck-"),"sync producer is not audit-driven");
console.log(JSON.stringify({status:"PASS",audit:latest,source_as_of:a.source_as_of,humanSupport:total,counterpart:counter,health,dwat}));

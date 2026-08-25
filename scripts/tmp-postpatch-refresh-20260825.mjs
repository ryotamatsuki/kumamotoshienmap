import {readFile,writeFile} from 'node:fs/promises';
const path='scripts/sync-municipal-support-audit.mjs';
let s=await readFile(path,'utf8');
s=s.replaceAll('${auditCheckedLabel}','8月25日14:08')
 .replaceAll("block.badge=`旧割当履歴＋8月25日14:08個別再監査`","block.badge='旧割当履歴＋8月25日14:08個別再監査'");
await writeFile(path,s);

const validator='scripts/validate-dashboard-current.mjs';
let v=await readFile(validator,'utf8');
v=v.replaceAll('国交省第48報：給水車119台、TEC-FORCE現時点98人・累計4,507人日','8/23値はHISTORICALとして分離。給水車・TEC-FORCE・入浴支援の8/25同一定義現況はUNKNOWN')
 .replaceAll('TEC-FORCE現時点98人・累計4,507人日','8月25日閣議：被災中小企業者等への災害融資特別措置を決定')
 .replaceAll('checkedAt\\\":\\\"2026-08-24T22:38:32+09:00','checkedAt\\\":\\\"2026-08-25T14:08:00+09:00')
 .replaceAll('8月24日22:38に対口支援・他自治体支援を全件再監査','8月25日14:08に対口支援・他自治体支援を全件再監査')
 .replaceAll('2026年8月24日 22:38','2026年8月25日 14:08');
await writeFile(validator,v);

const smoke='.github/workflows/post-deploy-pages-smoke.yml';
let w=await readFile(smoke,'utf8');
w=w.replaceAll('8月24日22:38全件再監査基準・23:58追加再監査','8月25日14:08基準で全件再監査')
 .replaceAll('国交省第48報：給水車119台、TEC-FORCE現時点98人・累計4,507人日','8/23値はHISTORICALとして分離。給水車・TEC-FORCE・入浴支援の8/25同一定義現況はUNKNOWN')
 .replaceAll('旧UNKNOWN 8件を追加再裁定：6件CURRENT、2件UNKNOWN。全国同一定義総数等は詳細で時点分離、8月26日TEC-FORCE第5陣はPLANNED','8月25日閣議：被災中小企業者等への災害融資特別措置を決定')
 .replaceAll('旧割当履歴＋8月24日個別再監査','旧割当履歴＋8月25日14:08個別再監査')
 .replaceAll('8月24日18:06','8月25日14:08')
 .replaceAll('119台','UNKNOWN')
 .replaceAll('98人','UNKNOWN');
await writeFile(smoke,w);
console.log(JSON.stringify({status:'PATCHED'}));

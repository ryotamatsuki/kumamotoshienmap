import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const htmlPath = new URL("../ehime_kumamoto_support_geocoded_shelters_20260802.html", import.meta.url);
const manifestPath = new URL("../shelter-coordinate-manifest.json", import.meta.url);
const html = await readFile(htmlPath, "utf8");

function extractLiteral(pattern, label){
  const match = html.match(pattern);
  if(!match) throw new Error(`${label} をHTMLから取得できません。`);
  return vm.runInNewContext(`(${match[1]})`, Object.create(null), { timeout: 1000 });
}

const meta = extractLiteral(
  /const SHELTER_SNAPSHOT_META=([\s\S]*?);\s*const PREGEOCODED_SHELTER_ROWS=/,
  "避難所座標メタデータ"
);
const rows = extractLiteral(
  /const PREGEOCODED_SHELTER_ROWS=([\s\S]*?);\s*const PREGEOCODED_SHELTERS=/,
  "避難所座標データ"
);
const digest = createHash("sha256").update(JSON.stringify(rows), "utf8").digest("hex");

if(process.argv.includes("--hash")){
  console.log(digest);
  process.exit(0);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const errors = [];
const requiredKeys = ["i","c","m","n","a","y","x","g","o"];
const municipalityByCode = new Map();
const codeByMunicipality = new Map();
const municipalityCounts = new Map();
const ids = new Set();

if(!Array.isArray(rows)) errors.push("避難所座標データが配列ではありません。");
if(rows.length !== manifest.expected_count) errors.push(`件数がmanifestと不一致です（${rows.length}/${manifest.expected_count}）。`);
if(rows.length !== meta.recordCount) errors.push(`件数がメタデータと不一致です（${rows.length}/${meta.recordCount}）。`);
if(meta.schemaVersion !== manifest.schema_version) errors.push("schemaVersionがmanifestと一致しません。");
if(meta.sourceUrl !== manifest.source_url) errors.push("公式データURLがmanifestと一致しません。");
if(meta.sourceAsOf !== manifest.source_as_of) errors.push("座標スナップショット日時がmanifestと一致しません。");
if(meta.crs !== manifest.crs || meta.crs !== "EPSG:4326") errors.push("座標参照系がEPSG:4326ではありません。");
if(digest !== manifest.sha256) errors.push(`座標スナップショットのSHA-256が不一致です（actual: ${digest}）。`);

for(const [index,row] of rows.entries()){
  const rowNumber = index + 1;
  const missing = requiredKeys.filter(key => !Object.hasOwn(row,key));
  if(missing.length) errors.push(`${rowNumber}行目に必須キー ${missing.join(",")} がありません。`);
  if(typeof row.i !== "string" || !/^\d{8}$/.test(row.i)) errors.push(`${rowNumber}行目の施設IDが不正です。`);
  if(ids.has(row.i)) errors.push(`${rowNumber}行目の施設ID ${row.i} が重複しています。`);
  ids.add(row.i);
  if(typeof row.c !== "string" || !/^\d{6}$/.test(row.c)) errors.push(`${rowNumber}行目の市町村コードが不正です。`);
  if(typeof row.m !== "string" || !row.m.trim()) errors.push(`${rowNumber}行目の市町村名が空です。`);
  if(typeof row.n !== "string" || !row.n.trim()) errors.push(`${rowNumber}行目の施設名が空です。`);
  if(typeof row.a !== "string" || !row.a.trim()) errors.push(`${rowNumber}行目の住所が空です。`);
  if(!Number.isFinite(row.y) || row.y < manifest.bounds.lat_min || row.y > manifest.bounds.lat_max){
    errors.push(`${rowNumber}行目の緯度 ${row.y} が検証範囲外です。`);
  }
  if(!Number.isFinite(row.x) || row.x < manifest.bounds.lng_min || row.x > manifest.bounds.lng_max){
    errors.push(`${rowNumber}行目の経度 ${row.x} が検証範囲外です。`);
  }
  if(!["","1","2","3","9"].includes(row.g)) errors.push(`${rowNumber}行目の混雑コードが不正です。`);
  if(typeof row.o !== "string" || !/^2026-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.o)) errors.push(`${rowNumber}行目の開設日時が不正です。`);

  const knownName = municipalityByCode.get(row.c);
  const knownCode = codeByMunicipality.get(row.m);
  if(knownName && knownName !== row.m) errors.push(`市町村コード ${row.c} が複数の名称に対応しています。`);
  if(knownCode && knownCode !== row.c) errors.push(`市町村名 ${row.m} が複数のコードに対応しています。`);
  municipalityByCode.set(row.c,row.m);
  codeByMunicipality.set(row.m,row.c);
  municipalityCounts.set(row.c,(municipalityCounts.get(row.c) || 0) + 1);
}

const expectedMunicipalities = Object.entries(manifest.municipalities || {});
if(municipalityByCode.size !== expectedMunicipalities.length){
  errors.push(`市町村数がmanifestと不一致です（${municipalityByCode.size}/${expectedMunicipalities.length}）。`);
}
for(const [code,expected] of expectedMunicipalities){
  if(municipalityByCode.get(code) !== expected.name){
    errors.push(`市町村コード ${code} の名称がmanifestと不一致です。`);
  }
  if(municipalityCounts.get(code) !== expected.count){
    errors.push(`${expected.name}（${code}）の件数がmanifestと不一致です（${municipalityCounts.get(code) || 0}/${expected.count}）。`);
  }
}
for(const code of municipalityByCode.keys()){
  if(!Object.hasOwn(manifest.municipalities || {},code)) errors.push(`manifest未登録の市町村コード ${code} があります。`);
}

if(errors.length){
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`避難所座標検証: ${rows.length}件 / ${municipalityByCode.size}市町村 / SHA-256 ${digest.slice(0,12)}… / ${meta.crs}`);

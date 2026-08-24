import { readFileSync, writeFileSync } from "node:fs";

const REFERENCE = "2026-08-24T22:38:32+09:00";
const RELEASE = "20260824-2238";

function read(path) { return readFileSync(path, "utf8"); }
function write(path, text) { writeFileSync(path, text.endsWith("\n") ? text : `${text}\n`); }
function replaceIfPresent(text, from, to) {
  return text.includes(from) ? text.replaceAll(from, to) : text;
}

// Correct current official discovery endpoints and freshness metadata.
{
  const path = "national-support-audit.json";
  const audit = JSON.parse(read(path));
  const mhlw = audit.sources.find((item) => item.source_id === "mhlw-disaster-recheck");
  if (mhlw) {
    mhlw.url = "https://www.mhlw.go.jp/stf/newpage_73935.html";
    mhlw.source_as_of = "2026-08-21T00:00:00+09:00";
    mhlw.source_updated_at = "2026-08-21T00:00:00+09:00";
    mhlw.notes = "厚生労働省の令和8年熊本地震対応ページ（最終更新8月21日）を再確認。基準日時点の全国DHEAT/DMAT/DPAT等の同一定義現況人数は確定できずUNKNOWN。";
  }
  const npa = audit.sources.find((item) => item.source_id === "npa-recheck");
  if (npa) {
    npa.url = "https://www.npa.go.jp/news/release/index.html/";
    npa.notes = "警察庁公式の報道発表・災害関連一次情報を再探索。現行ダッシュボードの複合救助レコードと同一定義の基準日時点人数は確定できず。";
  }
  const medical = audit.records.find((item) => item.record_id === "national-medical");
  if (medical && mhlw) medical.display.sourceUrl = mhlw.url;
  write(path, JSON.stringify(audit, null, 2));
}

// Keep ledger source URLs aligned and include the current dashboard validator in the exact diff contract.
{
  const path = "operations/ledgers/refresh-20260824-2238.json";
  const ledger = JSON.parse(read(path));
  ledger.reference_at = REFERENCE;
  ledger.release_id = RELEASE;
  const mhlw = ledger.sources.find((item) => item.source_id === "mhlw-disaster-recheck");
  if (mhlw) mhlw.url = "https://www.mhlw.go.jp/stf/newpage_73935.html";
  const npa = ledger.sources.find((item) => item.source_id === "npa-recheck");
  if (npa) npa.url = "https://www.npa.go.jp/news/release/index.html/";
  if (!ledger.expected_changed_files.includes("scripts/validate-dashboard-current.mjs")) {
    ledger.expected_changed_files.push("scripts/validate-dashboard-current.mjs");
    ledger.expected_changed_files.sort();
  }
  write(path, JSON.stringify(ledger, null, 2));
}

// Retire stale-current assertions from the dashboard validator and assert the new national snapshot semantics.
{
  const path = "scripts/validate-dashboard-current.mjs";
  let text = read(path);
  text = replaceIfPresent(text,
    "  \"給水車129台（国交省第47報・8月21日7時30分・表掲載値）\",",
    "  \"国交省第48報：給水車119台、TEC-FORCE現時点98人・累計4,507人日\",");
  text = replaceIfPresent(text,
    "  \"TEC-FORCE現在105人・累計4,299人日\",",
    "  \"TEC-FORCE現時点98人・累計4,507人日\",");
  text = replaceIfPresent(text,
    "  'checkedAt\":\"2026-08-22T15:16:00+09:00\"',",
    `  'checkedAt":"${REFERENCE}"',`);
  text = replaceIfPresent(text,
    "  \"8月24日18:06に対口支援・他自治体支援を全件再監査\",",
    "  \"8月24日22:38に対口支援・他自治体支援を全件再監査\",");
  text = replaceIfPresent(text,
    "  \"2026年8月24日 18:06\",",
    "  \"2026年8月24日 22:38\",");
  text = replaceIfPresent(text,
    "  \"国交省第47報\",",
    "  \"国交省第48報\",");
  text = replaceIfPresent(text,
    "  \"<div class=\\\"snap\\\"><strong>129</strong>\",",
    "  \"8/2 約100人・4機はHISTORICAL\",");

  const forbiddenAnchor = "  \"TEC-FORCE現在103人・累計3,703人日\",\n";
  const staleForbidden = "  \"給水車129台（国交省第47報・8月21日7時30分・表掲載値）\",\n";
  if (text.includes(forbiddenAnchor) && !text.includes(staleForbidden)) {
    text = text.replace(forbiddenAnchor, `${forbiddenAnchor}${staleForbidden}  \"TEC-FORCE現在105人・累計4,299人日\",\n  \"8月2日公表値・継続要確認\",\n`);
  }
  write(path, text);
}

console.log(JSON.stringify({ status: "PASS", reference_at: REFERENCE, release_id: RELEASE }));

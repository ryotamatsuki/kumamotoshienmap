import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [html, pub, needsText, sheltersText, municipalText, nationalText] = await Promise.all([
  readFile(resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html"), "utf8"),
  readFile(resolve(root, "public", "dashboard.html"), "utf8"),
  readFile(resolve(root, "operations", "audits", "needs-kpi-source-recheck-20260915-1942.json"), "utf8"),
  readFile(resolve(root, "current-shelters.json"), "utf8"),
  readFile(resolve(root, "municipal-support-audit.json"), "utf8"),
  readFile(resolve(root, "national-support-audit.json"), "utf8"),
]);
assert.equal(html, pub, "source/public parity");
const needs = JSON.parse(needsText);
const shelters = JSON.parse(sheltersText);
const municipal = JSON.parse(municipalText);
const national = JSON.parse(nationalText);
const executiveStart = html.indexOf('<div aria-labelledby="overviewViewTab"');
const executiveEnd = html.indexOf('<div aria-labelledby="needsViewTab"');
assert.ok(executiveStart >= 0 && executiveEnd > executiveStart, "executive summary range missing");
const executive = html.slice(executiveStart, executiveEnd);

for (const value of [
  "知事・幹部向け 意思決定サマリー",
  "主要数値：9月11日14:00（9月15日19:42再確認）",
  "2026年9月15日確認",
  "<span>主要数値：9月11日14:00</span>",
  "復旧・生活再建段階（熊本県最新被害等：9月11日14:00）",
  "1,771<span class=\"overview-kpi-unit\">人",
  `${shelters.meta.current_count}<span class="overview-kpi-unit">か所`,
  "407<span class=\"overview-kpi-unit\">人",
  "68,851<span class=\"overview-kpi-unit\">棟",
  `公式JSON現在・最終更新2026-09-15 00:29:57`,
  "9月15日01:05基準で対口支援・他自治体支援を全件再監査",
  "福岡県→宇土市",
  "愛媛県→氷川町",
  "終了予定日は同資料で特定せず",
]) assert.ok(executive.includes(value), `executive summary missing: ${value}`);

for (const stale of [
  "主要数値：9月3日14:00",
  "2026年8月24日確認",
  "主要数値：8月24日8:00",
  "8月20日時点で確認できない施設単位情報",
  "8月24日22:38に対口支援・他自治体支援を全件再監査",
  "日付要確認まで予定",
]) assert.ok(!executive.includes(stale), `stale executive summary remains: ${stale}`);

const metaMatch = html.match(/const\s+PAGE_RECHECK_META\s*=\s*(\{[^\n]*\});/u);
assert.ok(metaMatch, "PAGE_RECHECK_META missing");
const meta = JSON.parse(metaMatch[1]);
assert.equal(meta.checkedAt, national.reference_at, "PAGE_RECHECK_META checkedAt");
const bySection = new Map((meta.rows || []).map((row) => [row.section, row]));
for (const section of ["被害・支援","愛媛県支援","避難所","支援ニーズ見通し","発災後タイムライン","支援ダッシュボード","災害ボランティア","地図・境界","他自治体等","国・関係機関"]) assert.ok(bySection.has(section), `PAGE_RECHECK_META row missing: ${section}`);
assert.ok(bySection.get("被害・支援").current.includes("9月11日14:00"));
assert.ok(bySection.get("被害・支援").current.includes("9月15日19:42"));
assert.ok(bySection.get("被害・支援").difference.includes("避難者1,771人"));
assert.ok(bySection.get("被害・支援").difference.includes("人的被害407人"));
assert.ok(bySection.get("被害・支援").difference.includes("住家被害68,851棟"));
assert.ok(bySection.get("避難所").current.includes(`公式JSON現在${shelters.meta.current_count}施設`));
assert.ok(bySection.get("他自治体等").current.includes("福岡県→宇土市"));
assert.ok(bySection.get("他自治体等").current.includes("愛媛県→氷川町"));
assert.ok(bySection.get("国・関係機関").current.includes(`${national.inventory.audit_record_count}件`));
assert.equal(needs.prefectural_snapshot.evacuees, 1771);
assert.equal(needs.prefectural_snapshot.human_damage, 407);
assert.equal(needs.prefectural_snapshot.housing_damage, 68851);
assert.equal(municipal.reference_at, "2026-09-15T01:05:48+09:00");

console.log(JSON.stringify({
  status: "PASS",
  major_as_of: needs.prefectural_snapshot.as_of,
  needs_rechecked_at: needs.reference_at,
  page_checked_at: national.reference_at,
  current_shelters: shelters.meta.current_count,
  executive_rows: meta.rows.length,
}));

import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, 'ehime_kumamoto_support_geocoded_shelters_20260802.html');
const publicPath = resolve(root, 'public', 'dashboard.html');
const auditDir = resolve(root, 'operations', 'audits');

function n(value) { return Number(value).toLocaleString('ja-JP'); }
function mdhm(value) {
  const m = String(value ?? '').match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u);
  return m ? `${Number(m[1])}月${Number(m[2])}日${m[3]}:${m[4]}` : String(value ?? '');
}
function ymd(value) { return String(value ?? '').slice(0, 10); }
function latestByName(names, pattern) {
  const matches = names.filter((name) => pattern.test(name)).sort();
  assert.ok(matches.length > 0, `監査ファイルがありません: ${pattern}`);
  return matches.at(-1);
}
function blockBetween(text, startToken, endToken, label) {
  const start = text.indexOf(startToken);
  const end = text.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `${label} block missing`);
  return text.slice(start, end);
}
function extractSingleLineJsonConstant(text, name) {
  const match = text.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\{[^\\n]*\\});`, 'u'));
  assert.ok(match, `${name} missing`);
  return JSON.parse(match[1]);
}
function extractAssignedObject(text, marker, label) {
  const start = text.indexOf(marker);
  assert.ok(start >= 0, `${label} marker missing`);
  let i = start + marker.length;
  while (/\s/u.test(text[i] ?? '')) i += 1;
  assert.equal(text[i], '{', `${label} object start missing`);
  let depth = 0; let str = false; let esc = false; let end = -1;
  for (; i < text.length; i += 1) {
    const c = text[i];
    if (str) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') str = false;
      continue;
    }
    if (c === '"') { str = true; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  assert.ok(end > 0, `${label} object end missing`);
  return JSON.parse(text.slice(start + marker.length, end + 1));
}

const [html, publicHtml, sheltersText, auditNames] = await Promise.all([
  readFile(htmlPath, 'utf8'),
  readFile(publicPath, 'utf8'),
  readFile(resolve(root, 'current-shelters.json'), 'utf8'),
  readdir(auditDir),
]);
assert.equal(html, publicHtml, 'source/public parity');
const shelters = JSON.parse(sheltersText);
const needsAuditName = latestByName(auditNames, /^needs-kpi-source-recheck-\d{8}-\d{4}\.json$/u);
const needsAudit = JSON.parse(await readFile(resolve(auditDir, needsAuditName), 'utf8'));
const snapshot = needsAudit.prefectural_snapshot;
assert.ok(snapshot && needsAudit.water && needsAudit.waste, 'currentness audit is incomplete');
const sourceById = new Map((needsAudit.sources ?? []).map((source) => [source.source_id, source]));
const prefectureSource = sourceById.get(snapshot.source_id);
const waterSource = sourceById.get(needsAudit.water.source_id);
const wasteSource = sourceById.get(needsAudit.waste.source_id);
for (const [label, source] of [['prefecture', prefectureSource], ['water', waterSource], ['waste', wasteSource]]) {
  assert.ok(source && /^https:\/\//u.test(source.url), `${label} official source missing`);
}

// 1) 支援ニーズKPI: 値だけでなく、カード自体が一次情報への実リンクであることを必須化する。
const needsBlock = blockBetween(html, '<div class="needs-kpis">', '<div class="needs-phasebar"', 'needs KPI');
const cardTags = [...needsBlock.matchAll(/<a class="needs-kpi"[^>]*data-needs-kpi="([^"]+)"[^>]*href="([^"]+)"[^>]*>/gu)];
assert.equal(cardTags.length, 4, `needs KPI cards must be 4 links, got ${cardTags.length}`);
const links = new Map(cardTags.map((match) => [match[1], { href: match[2], tag: match[0] }]));
const expectedLinks = new Map([
  ['evacuees', prefectureSource.url], ['housing', prefectureSource.url],
  ['water', waterSource.url], ['waste', wasteSource.url],
]);
for (const [id, href] of expectedLinks) {
  const link = links.get(id);
  assert.ok(link, `needs KPI is not clickable: ${id}`);
  assert.equal(link.href, href, `needs KPI official href mismatch: ${id}`);
  assert.match(link.tag, /target="_blank"/u, `needs KPI target missing: ${id}`);
  assert.match(link.tag, /rel="[^"]*noopener/u, `needs KPI rel=noopener missing: ${id}`);
}
const expectedCurrentValues = [
  `${n(snapshot.evacuees)}人`, `${n(snapshot.housing_damage)}棟`,
  needsAudit.water.display_value, needsAudit.waste.display_value,
];
for (const value of expectedCurrentValues) assert.ok(needsBlock.includes(value), `needs KPI current value missing: ${value}`);
for (const stale of needsAudit.water.historical_values_not_current ?? []) {
  assert.ok(!needsBlock.includes(`<div class="needs-kpi-value">${stale}</div>`), `historical water value used as current KPI: ${stale}`);
}
for (const [id, source] of [['evacuees', prefectureSource], ['housing', prefectureSource], ['water', waterSource], ['waste', wasteSource]]) {
  assert.ok(needsBlock.includes(source.publisher), `needs KPI publisher label missing for ${id}: ${source.publisher}`);
}

// 2) 知事・幹部向けサマリー: 最新県計と現行JSONを別定義として同時に同期する。
const executive = blockBetween(html, '<div aria-labelledby="overviewViewTab"', '<div aria-labelledby="needsViewTab"', 'executive summary');
for (const value of [
  `${n(snapshot.evacuees)}<span class="overview-kpi-unit">人</span>`,
  `${n(snapshot.human_damage)}<span class="overview-kpi-unit">人</span>`,
  `${n(snapshot.housing_damage)}<span class="overview-kpi-unit">棟</span>`,
  `${snapshot.shelters}<span class="overview-kpi-unit">か所</span>`,
  mdhm(snapshot.as_of),
]) assert.ok(executive.includes(value), `executive summary current value/timepoint missing: ${value}`);
assert.ok(executive.includes('地図JSON最終取得'), 'executive summary must label last-fetched shelter JSON separately');
assert.ok(executive.includes(String(shelters.meta.source_last_modified).replace('T', ' ').replace('+09:00', '')), 'executive summary shelter JSON timestamp missing');

// 3) PAGE_RECHECK_META: 全派生面をcoverage rowとして保持し、同じcanonical snapshotへ同期する。
const meta = extractSingleLineJsonConstant(html, 'PAGE_RECHECK_META');
const rows = new Map((meta.rows ?? []).map((row) => [row.section, row]));
const requiredRows = ['被害・支援', '愛媛県支援', '避難所', '支援ニーズ見通し', '発災後タイムライン', '支援ダッシュボード', '災害ボランティア', '地図・境界', '他自治体等', '国・関係機関'];
for (const section of requiredRows) assert.ok(rows.has(section), `PAGE_RECHECK_META row missing: ${section}`);
const damageRowText = JSON.stringify(rows.get('被害・支援'));
for (const value of [n(snapshot.evacuees), String(snapshot.human_damage), n(snapshot.housing_damage), mdhm(snapshot.as_of)]) {
  assert.ok(damageRowText.includes(value), `PAGE_RECHECK_META damage snapshot missing: ${value}`);
}
const shelterRowText = JSON.stringify(rows.get('避難所'));
assert.ok(shelterRowText.includes(`${snapshot.shelters}か所`), 'reported shelter snapshot missing from PAGE_RECHECK_META');
assert.ok(shelterRowText.includes(`地図JSON最終取得${shelters.meta.current_count}施設`), 'last-fetched shelter JSON count missing from PAGE_RECHECK_META');
for (const section of ['支援ニーズ見通し', '発災後タイムライン', '支援ダッシュボード']) {
  assert.ok(JSON.stringify(rows.get(section)).includes(mdhm(snapshot.as_of)), `${section} timepoint is not synchronized`);
}

// 4) Runtime overlay source: sync scriptが古い監査JSONを読み込んでも見逃さない。
const overlayStart = html.indexOf('/* NEEDS_KPI_SOURCE_FIX_20260915_START */');
const overlayEnd = html.indexOf('/* NEEDS_KPI_SOURCE_FIX_20260915_END */', overlayStart);
assert.ok(overlayStart >= 0 && overlayEnd > overlayStart, 'needs currentness runtime overlay missing');
const overlay = html.slice(overlayStart, overlayEnd);
const overlaySnapshot = extractAssignedObject(overlay, '{const S=', 'runtime currentness snapshot');
assert.deepEqual(overlaySnapshot, snapshot, 'runtime currentness snapshot differs from latest audit');
const overlaySources = extractAssignedObject(overlay, ',SRC=', 'runtime currentness sources');
assert.equal(overlaySources.prefecture?.url, prefectureSource.url, 'runtime prefecture source URL mismatch');
assert.equal(overlaySources.water?.url, waterSource.url, 'runtime water source URL mismatch');
assert.equal(overlaySources.waste?.url, wasteSource.url, 'runtime waste source URL mismatch');
for (const value of [String(snapshot.evacuees), String(snapshot.human_damage), String(snapshot.housing_damage)]) {
  assert.ok(overlay.includes(value) || JSON.stringify(overlaySnapshot).includes(value), `runtime overlay snapshot value missing: ${value}`);
}
assert.ok(overlay.includes(`date:'${ymd(snapshot.as_of)}'`) || overlay.includes(`date:"${ymd(snapshot.as_of)}"`), 'runtime timeline date differs from canonical source_as_of');

console.log(JSON.stringify({
  status: 'PASS',
  audit: needsAuditName,
  source_as_of: snapshot.as_of,
  evacuees: snapshot.evacuees,
  human_damage: snapshot.human_damage,
  housing_damage: snapshot.housing_damage,
  reported_shelters: snapshot.shelters,
  current_shelters_json: shelters.meta.current_count,
  needs_links: cardTags.length,
  page_recheck_rows: rows.size,
}));

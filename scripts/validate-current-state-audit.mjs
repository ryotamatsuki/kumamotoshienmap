import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCurrentPageMetadataSynced } from './current-page-metadata.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [html, pub, sheltersText, municipalText, nationalText, auditNames] = await Promise.all([
  readFile(resolve(root, 'ehime_kumamoto_support_geocoded_shelters_20260802.html'), 'utf8'),
  readFile(resolve(root, 'public/dashboard.html'), 'utf8'),
  readFile(resolve(root, 'current-shelters.json'), 'utf8'),
  readFile(resolve(root, 'municipal-support-audit.json'), 'utf8'),
  readFile(resolve(root, 'national-support-audit.json'), 'utf8'),
  readdir(resolve(root, 'operations', 'audits')),
]);
const shelters = JSON.parse(sheltersText);
const municipal = JSON.parse(municipalText);
const national = JSON.parse(nationalText);
assert.equal(html, pub, 'source/public parity');
assert.equal(municipal.reference_at, national.reference_at, 'municipal/national reference_at mismatch');

const needsAuditName = auditNames.filter((name) => /^needs-kpi-source-recheck-\d{8}-\d{4}\.json$/u.test(name)).sort().at(-1);
assert.ok(needsAuditName, 'latest needs currentness audit missing');
const needsAudit = JSON.parse(await readFile(resolve(root, 'operations', 'audits', needsAuditName), 'utf8'));
const snapshot = needsAudit.prefectural_snapshot;
assert.ok(snapshot, 'prefectural current snapshot missing');

const metaMatch = html.match(/const\s+PAGE_RECHECK_META\s*=\s*(\{[^\n]*\});/u);
assert.ok(metaMatch, 'PAGE_RECHECK_META missing');
const meta = JSON.parse(metaMatch[1]);
assertCurrentPageMetadataSynced(html, meta);
assert.equal(meta.checkedAt, national.reference_at, 'PAGE_RECHECK_META.checkedAt must match page-wide national/municipal reference_at');
assert.equal(meta.volunteerCheckedAt, national.reference_at, 'PAGE_RECHECK_META.volunteerCheckedAt mismatch');

assert.equal(shelters.meta.current_count, shelters.shelters.length, 'current shelter count mismatch');
assert.ok(shelters.shelters.length > 0, 'current shelters must not be empty');
assert.ok(shelters.shelters.every((row) => row.coordinate_status === 'confirmed'), 'current shelters contain unresolved/conflict coordinates');
assert.equal(shelters.shelters.filter((row) => row.coordinate_status === 'conflict').length, 0, 'current shelter coordinate conflict');

// Current-stateの意味論は横断Gateへ一本化し、旧報番号・旧人数の固定値をここへ再導入しない。
try {
  execFileSync(process.execPath, [resolve(root, 'scripts', 'validate-currentness-surfaces.mjs')], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  throw new Error(`currentness surface gate failed from current-state audit: ${error.stderr || error.stdout || error.message}`);
}

const majorLabel = (() => {
  const m = String(snapshot.as_of).match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u);
  return m ? `${Number(m[1])}月${Number(m[2])}日${m[3]}:${m[4]}` : String(snapshot.as_of);
})();
const display = html.slice(0, html.indexOf('<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js">'));
for (const value of [
  `復旧・生活再建段階（熊本県最新被害等：${majorLabel}）`,
  `${Number(snapshot.evacuees).toLocaleString('ja-JP')}<span class="overview-kpi-unit">人</span>`,
  `${Number(snapshot.housing_damage).toLocaleString('ja-JP')}<span class="overview-kpi-unit">棟</span>`,
]) assert.ok(display.includes(value), `current display missing canonical value: ${value}`);

console.log(JSON.stringify({
  status: 'PASS',
  checkedAt: meta.checkedAt,
  currentnessAudit: needsAuditName,
  damageSourceAsOf: snapshot.as_of,
  evacuees: snapshot.evacuees,
  humanDamage: snapshot.human_damage,
  housingDamage: snapshot.housing_damage,
  shelters: shelters.shelters.length,
  nationalStates: national.summary,
}));

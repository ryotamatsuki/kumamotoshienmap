import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const auditNames = readdirSync(resolve(ROOT, 'operations', 'audits'))
  .filter((name) => /^needs-kpi-source-recheck-\d{8}-\d{4}\.json$/u.test(name)).sort();
const latestAudit = auditNames.at(-1);
if (!latestAudit) throw new Error('latest needs currentness audit missing');
const COPY_PATHS = [
  'scripts/validate-currentness-surfaces.mjs',
  'ehime_kumamoto_support_geocoded_shelters_20260802.html',
  'public/dashboard.html',
  'current-shelters.json',
  `operations/audits/${latestAudit}`,
];

function prepare() {
  const root = mkdtempSync(join(tmpdir(), 'kumamoto-currentness-gate-'));
  for (const relativePath of COPY_PATHS) {
    const source = resolve(ROOT, relativePath);
    if (!existsSync(source)) throw new Error(`fixture missing: ${relativePath}`);
    const destination = resolve(root, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
  return root;
}
function run(root) {
  return spawnSync(process.execPath, [resolve(root, 'scripts', 'validate-currentness-surfaces.mjs')], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
}
function mutateBoth(root, transform) {
  for (const relativePath of ['ehime_kumamoto_support_geocoded_shelters_20260802.html', 'public/dashboard.html']) {
    const path = resolve(root, relativePath);
    writeFileSync(path, transform(readFileSync(path, 'utf8')));
  }
}
function expectPass(name, result) {
  if (result.status !== 0) throw new Error(`${name}: expected PASS\n${result.stdout}\n${result.stderr}`);
}
function expectFailure(name, result, pattern) {
  if (result.status === 0) throw new Error(`${name}: expected failure but passed`);
  const output = `${result.stdout}\n${result.stderr}`;
  if (!pattern.test(output)) throw new Error(`${name}: unexpected failure\n${output}`);
}
function currentAudit() {
  return JSON.parse(readFileSync(resolve(ROOT, 'operations', 'audits', latestAudit), 'utf8'));
}

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

test('baseline passes', () => {
  const root = prepare();
  try { expectPass('baseline', run(root)); } finally { rmSync(root, { recursive: true, force: true }); }
});

test('stale needs KPI value is blocked', () => {
  const root = prepare(); const audit = currentAudit();
  try {
    const current = `${Number(audit.prefectural_snapshot.evacuees).toLocaleString('ja-JP')}人`;
    mutateBoth(root, (html) => html.replace(`<div class="needs-kpi-value">${current}</div>`, '<div class="needs-kpi-value">2,709人</div>'));
    expectFailure('stale needs KPI', run(root), /current value missing|needs KPI/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('unlinked needs KPI is blocked', () => {
  const root = prepare();
  try {
    mutateBoth(root, (html) => html.replace(/(<a class="needs-kpi" data-needs-kpi="evacuees") href="[^"]+"/u, '$1'));
    expectFailure('unlinked KPI', run(root), /must be 4 links|not clickable/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('stale executive KPI is blocked', () => {
  const root = prepare(); const audit = currentAudit();
  try {
    const current = `${Number(audit.prefectural_snapshot.evacuees).toLocaleString('ja-JP')}<span class="overview-kpi-unit">人</span>`;
    mutateBoth(root, (html) => {
      const start = html.indexOf('<div aria-labelledby="overviewViewTab"');
      const end = html.indexOf('<div aria-labelledby="needsViewTab"', start);
      const block = html.slice(start, end).replace(current, '2,709<span class="overview-kpi-unit">人</span>');
      return html.slice(0, start) + block + html.slice(end);
    });
    expectFailure('stale executive KPI', run(root), /executive summary current value\/timepoint missing/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('stale PAGE_RECHECK_META is blocked', () => {
  const root = prepare(); const audit = currentAudit();
  try {
    const sourceAsOf = audit.prefectural_snapshot.as_of;
    const m = sourceAsOf.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u);
    const label = `${Number(m[1])}月${Number(m[2])}日${m[3]}:${m[4]}`;
    mutateBoth(root, (html) => html.replace(/const PAGE_RECHECK_META=(\{[^\n]*\});/u, (full) => full.replaceAll(label, '8月24日08:00')));
    expectFailure('stale recheck meta', run(root), /PAGE_RECHECK_META damage snapshot missing|timepoint is not synchronized/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('stale runtime overlay snapshot is blocked', () => {
  const root = prepare(); const audit = currentAudit();
  try {
    const current = `"evacuees":${audit.prefectural_snapshot.evacuees}`;
    mutateBoth(root, (html) => {
      const start = html.indexOf('/* NEEDS_KPI_SOURCE_FIX_20260915_START */');
      const end = html.indexOf('/* NEEDS_KPI_SOURCE_FIX_20260915_END */', start);
      const block = html.slice(start, end).replace(current, '"evacuees":2709');
      return html.slice(0, start) + block + html.slice(end);
    });
    expectFailure('stale runtime overlay', run(root), /runtime currentness snapshot differs/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

let passed = 0;
for (const { name, fn } of cases) {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
console.log(JSON.stringify({ status: 'PASS', passed, total: cases.length, audit: latestAudit }));

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const files = [
  'national-support-audit.json',
  'municipal-support-audit.json',
  'research_official_north.json',
  'research_official_south.json',
  'research_official_statewide.json',
  'sender-audit/sources.json',
  'sender-audit/sources-additions.json',
  'sender-audit/discovery.json',
  'sender-audit/discovery-additions.json',
  'sender-audit/crosscutting-additions.json',
  'sender-audit/timepoint-20260828-additions.json',
  'sender-audit/timepoint-20260830-additions.json',
  'sender-audit/timepoint-20260831-additions.json',
  'sender-audit/timepoint-20260901-additions.json',
];

function collectUrls(value, out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'url' && typeof item === 'string' && /^https?:\/\//u.test(item)) out.add(item);
      else collectUrls(item, out);
    }
  }
  return out;
}

const urls = new Set([
  'https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json',
  'https://www.pref.kumamoto.jp/soshiki/1/274517.html',
  'https://www.pref.kumamoto.jp/soshiki/222/276831.html',
  'https://www.mlit.go.jp/saigai/saigai_260728.html',
  'https://www.fdma.go.jp/disaster/info/',
  'https://www.mod.go.jp/j/approach/defense/saigai/index.html',
  'https://www.mod.go.jp/js/press/',
]);

for (const file of files) {
  try {
    collectUrls(JSON.parse(await readFile(file, 'utf8')), urls);
  } catch (error) {
    console.error(`WARN parse ${file}: ${error.message}`);
  }
}

const results = [];
const list = [...urls].sort();
let cursor = 0;
const workerCount = 12;

async function probe(url) {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'kumamotoshienmap-refresh-audit/20260902',
        accept: 'text/html,application/json,application/pdf,*/*;q=0.8',
      },
    });
    clearTimeout(timer);
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || '';
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    let snippet = null;
    if (/text|json|xml|javascript/u.test(contentType)) {
      snippet = buffer.toString('utf8').replace(/\s+/gu, ' ').slice(0, 500);
    }
    return {
      url,
      ok: response.ok,
      status: response.status,
      final_url: response.url,
      content_type: contentType,
      content_length: buffer.length,
      last_modified: response.headers.get('last-modified'),
      etag: response.headers.get('etag'),
      sha256,
      snippet,
      elapsed_ms: Date.now() - started,
    };
  } catch (error) {
    return { url, ok: false, error: String(error), elapsed_ms: Date.now() - started };
  }
}

async function worker() {
  while (cursor < list.length) {
    const index = cursor++;
    const result = await probe(list[index]);
    results[index] = result;
    console.log(JSON.stringify({ index: index + 1, total: list.length, url: result.url, status: result.status ?? null, ok: result.ok, error: result.error ?? null }));
  }
}

await Promise.all(Array.from({ length: workerCount }, () => worker()));
const report = {
  generated_at: new Date().toISOString(),
  url_count: list.length,
  ok_count: results.filter((row) => row?.ok).length,
  failed_count: results.filter((row) => !row?.ok).length,
  results,
};
await writeFile('/tmp/source-probe-20260902.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const senderFiles = (await readdir('sender-audit')).filter((name) => name.endsWith('.json'));
const senderEntities = [];
for (const name of senderFiles) {
  const data = JSON.parse(await readFile(`sender-audit/${name}`, 'utf8'));
  if (!Array.isArray(data.entities)) continue;
  for (const entity of data.entities) {
    senderEntities.push({
      file: name,
      entity: entity.entity,
      prefecture: entity.prefecture,
      state: entity.state,
      support_types: entity.support_types,
      destinations: entity.destinations,
      source_ids: entity.source_ids,
      evidence_note: entity.evidence_note,
      reason: entity.reason,
      current_evidence_type: entity.current_evidence_type,
      next_review_at: entity.next_review_at,
      checked_at: entity.checked_at,
    });
  }
}
const byState = Object.groupBy(senderEntities, (row) => row.state ?? 'NULL');
const due = senderEntities.filter((row) => row.next_review_at && row.next_review_at <= '2026-09-02T16:16:00+09:00');
const national = JSON.parse(await readFile('national-support-audit.json', 'utf8'));
const municipal = JSON.parse(await readFile('municipal-support-audit.json', 'utf8'));
const statewide = JSON.parse(await readFile('research_official_statewide.json', 'utf8'));
const digest = {
  generated_at: new Date().toISOString(),
  sender_total_rows: senderEntities.length,
  sender_state_counts: Object.fromEntries(Object.entries(byState).map(([k,v]) => [k,v.length])),
  planned: senderEntities.filter((row) => row.state === 'PLANNED'),
  current: senderEntities.filter((row) => row.state === 'CURRENT'),
  due_review_count: due.length,
  due_reviews: due,
  national_summary: national.summary,
  national_records: national.records?.map((row) => ({record_id: row.record_id, state: row.state, display: row.display})) ?? [],
  municipal_summary: municipal.summary ?? null,
  municipal_records: municipal.records?.map((row) => ({record_id: row.record_id, state: row.state, display: row.display})) ?? [],
  volunteer: {
    reference_at: statewide.reference_at,
    checked_at: statewide.checked_at,
    linked_municipal_centers: statewide.statewide_facts?.linked_municipal_centers,
    observations: statewide.additional_official_observations,
  },
};
await writeFile('/tmp/audit-digest-20260902.json', `${JSON.stringify(digest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ url_count: report.url_count, ok_count: report.ok_count, failed_count: report.failed_count, sender_state_counts: digest.sender_state_counts, due_review_count: digest.due_review_count }));

export function extractPageRecheckMeta(html) {
  const match = html.match(/const\s+PAGE_RECHECK_META\s*=\s*(\{[^\n]*\});/u);
  if (!match) throw new Error("PAGE_RECHECK_METAが見つかりません。");
  let value;
  try { value = JSON.parse(match[1]); }
  catch (error) { throw new Error(`PAGE_RECHECK_METAを解析できません: ${error.message}`); }
  if (!value?.checkedAt || Number.isNaN(Date.parse(value.checkedAt))) {
    throw new Error(`PAGE_RECHECK_META.checkedAtがRFC3339日時ではありません: ${value?.checkedAt}`);
  }
  if (value.volunteerCheckedAt && Number.isNaN(Date.parse(value.volunteerCheckedAt))) {
    throw new Error(`PAGE_RECHECK_META.volunteerCheckedAtがRFC3339日時ではありません: ${value.volunteerCheckedAt}`);
  }
  return value;
}

function dateParts(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}(?:Z|[+-]\d{2}:\d{2})$/u);
  if (!match) throw new Error(`表示用日時へ変換できません: ${value}`);
  return { year:Number(match[1]), month:Number(match[2]), day:Number(match[3]), hour:match[4], minute:match[5] };
}

export function formatPageCheckedAt(value, { compact = false } = {}) {
  const p = dateParts(value);
  return `${p.year}年${p.month}月${p.day}日${compact ? "" : " "}${p.hour}:${p.minute}`;
}

function replaceExactlyOnce(html, pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = [...html.matchAll(new RegExp(pattern.source, flags))].length;
  if (count !== 1) throw new Error(`${label}の同期対象が1件ではありません: ${count}件`);
  return html.replace(pattern, replacement);
}

export function syncCurrentPageMetadata(html, meta = extractPageRecheckMeta(html)) {
  const checkedLabel = formatPageCheckedAt(meta.checkedAt);
  const checkedCompact = formatPageCheckedAt(meta.checkedAt, { compact:true });
  const volunteerAt = meta.volunteerCheckedAt || meta.checkedAt;
  const volunteerLabel = formatPageCheckedAt(volunteerAt);
  let next = html;
  next = replaceExactlyOnce(next, /(<div class="subtitle">[^<]*ページ全体の再確認：)[^<]+(<\/div>)/u, `$1${checkedLabel}（JST）$2`, "header subtitle");
  next = replaceExactlyOnce(next, /(<span class="badge">ページ全体再確認：)[^<]+(<\/span>)/u, `$1${checkedCompact}$2`, "header badge");
  next = replaceExactlyOnce(next, /(<div class="overview-update"><strong>ページ全体の再確認<\/strong><br\/>)[^<]+(<br\/>)/u, `$1${checkedLabel}（JST）$2`, "overview checked-at");
  next = replaceExactlyOnce(next, /(<div class="page-recheck-meta"><span>サイト確認：)[^<]+(<\/span>)/u, `$1${checkedLabel}（JST）$2`, "page recheck checked-at");
  next = replaceExactlyOnce(next, /(<span>ボランティア個別確認：)[^<]+(確認済み<\/span>)/u, `$1${volunteerLabel}$2`, "volunteer checked-at");
  next = replaceExactlyOnce(next, /(<div class="timeline-update"><strong>ページ全体再確認<\/strong><br\/>)[^<]+(<br\/>)/u, `$1${checkedLabel}（JST）$2`, "timeline checked-at");
  next = replaceExactlyOnce(next, /(<div class="dashboard-update"><strong>ページ全体再確認<\/strong><br\/>)[^<]+(<br\/>)/u, `$1${checkedLabel}（JST）$2`, "dashboard checked-at");
  next = replaceExactlyOnce(next, /(const currentSnapshot20260821=\{checkedAt:')[^']+(',currentAsOf:)/u, `$1${meta.checkedAt}$2`, "currentSnapshot initial checkedAt");
  next = replaceExactlyOnce(next, /(Object\.assign\(currentSnapshot20260821,\{checkedAt:')[^']+(',currentAsOf:)/u, `$1${meta.checkedAt}$2`, "currentSnapshot cleanup checkedAt");
  return next;
}

export function assertCurrentPageMetadataSynced(html, meta = extractPageRecheckMeta(html)) {
  const synced = syncCurrentPageMetadata(html, meta);
  if (synced !== html) {
    throw new Error(`現況表示時刻がPAGE_RECHECK_METAと一致していません。expected=${meta.checkedAt}`);
  }
  return meta;
}

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const dataPath = resolve(root, "current-shelters.json");
const sourcePath = resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const publicPath = resolve(root, "public", "dashboard.html");
const startMarker = "/* CURRENT_SHELTER_DATA_START */";
const endMarker = "/* CURRENT_SHELTER_DATA_END */";

const data = JSON.parse(await readFile(dataPath, "utf8"));
if (!Array.isArray(data.shelters)) throw new Error("current-shelters.jsonのsheltersが配列ではありません。");
if (!Number.isInteger(data.meta?.current_count) || data.meta.current_count !== data.shelters.length) {
  throw new Error(`current-shelters.jsonのmeta.current_countとshelters件数が不一致です（${data.meta?.current_count}/${data.shelters.length}）。`);
}
// Keep the generated rows lossless. New provenance/cross-check fields added by
// update-current-shelters.mjs must reach the reviewed HTML without another manual
// mapping change.
const rows = data.shelters.map((row) => ({ ...row }));
const coordinateMasterSourceLabel = data.meta.coordinate_master_source_as_of
  ? `${String(data.meta.coordinate_master_source_as_of).slice(0, 10)}_coordinate_master`
  : "coordinate_master";
const meta = {
  sourceLabel: "熊本県公式の現在開設避難所一覧",
  sourceAsOf: data.meta.source_last_modified || data.meta.fetched_at,
  sourceUrl: data.meta.source_url,
  sourceKind: data.meta.source_kind,
  fetchedAt: data.meta.fetched_at,
  sourceLastModified: data.meta.source_last_modified,
  currentDefinition: data.meta.current_definition,
  currentCount: data.meta.current_count,
  coordinateMasterSourceUrl: data.meta.coordinate_master_source_url,
  coordinateMasterSourceAsOf: data.meta.coordinate_master_source_as_of,
  coordinateMasterExpectedCount: data.meta.coordinate_master_expected_count,
  coordinateMasterCrs: data.meta.coordinate_master_crs,
  coordinateMasterSourceLabel,
  coordinatePriority: data.meta.coordinate_priority ?? null,
  coordinateConflictThresholdM: data.meta.coordinate_conflict_threshold_m ?? null,
  statusUrl: "https://portal.bousai.pref.kumamoto.jp/sp.html?p=evacuation%2Fshelter",
  crs: data.meta.coordinate_master_crs,
};
const mappedRows = `CURRENT_SHELTER_ROWS.map((row) => ({
  facilityId: row.facility_id,
  municipalityCode: row.municipality_code,
  municipality: row.municipality,
  name: row.name,
  address: row.address,
  status: row.status,
  congestion: row.congestion || "不明",
  openedAt: row.opened_at,
  closedAt: row.closed_at,
  coordinateStatus: row.coordinate_status,
  coordinateMatchMethod: row.coordinate_match_method,
  coordinateMasterId: row.coordinate_master_id,
  candidateMasterIds: row.candidate_master_ids,
  lat: row.lat,
  lng: row.lng,
  crs: CURRENT_SHELTER_META.coordinateMasterCrs,
  coordinateSource: row.coordinate_source
    || (row.coordinate_master_id && row.coordinate_source_as_of === CURRENT_SHELTER_META.coordinateMasterSourceAsOf
      ? CURRENT_SHELTER_META.coordinateMasterSourceLabel
      : null),
  coordinateSourceAsOf: row.coordinate_source_as_of,
  coordinateCrosscheck: row.coordinate_crosscheck ?? null,
  source: "current-official-list",
}))`;
const block = [
  startMarker,
  `const CURRENT_SHELTER_META=${JSON.stringify(meta)};`,
  `const CURRENT_SHELTER_ROWS=${JSON.stringify(rows)};`,
  `const CURRENT_SHELTERS=${mappedRows};`,
  endMarker,
].join("\n");

function upsert(html) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start >= 0 && end > start) {
    return `${html.slice(0, start)}${block}${html.slice(end + endMarker.length)}`;
  }
  const anchor = "const SHELTER_EXPECTED_TOTAL=206;";
  const index = html.indexOf(anchor);
  if (index < 0) throw new Error("現行避難所データの挿入位置が見つかりません。");
  return `${html.slice(0, index)}${block}\n${html.slice(index)}`;
}

const source = upsert(await readFile(sourcePath, "utf8"));
const published = upsert(await readFile(publicPath, "utf8"));
if (source !== published) throw new Error("生成前のsource/public HTMLが一致していません。");
await writeFile(sourcePath, source, "utf8");
await writeFile(publicPath, source, "utf8");

console.log(JSON.stringify({
  currentCount: rows.length,
  confirmed: rows.filter((row) => row.coordinate_status === "confirmed").length,
  unresolved: rows.filter((row) => row.coordinate_status === "unresolved").length,
  conflicts: rows.filter((row) => row.coordinate_status === "conflict").length,
  coordinateSources: rows.reduce((result, row) => {
    const source = row.coordinate_source || (row.coordinate_master_id ? coordinateMasterSourceLabel : "unresolved");
    result[source] = (result[source] || 0) + 1;
    return result;
  }, {}),
  sourcePath,
  publicPath,
}));

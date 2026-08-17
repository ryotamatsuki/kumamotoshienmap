import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const sourceUrl = "https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json";
const sourceHtmlPath = resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const outputPath = resolve(root, "current-shelters.json");
const coordinateMasterAsOf = "2026-08-02T23:21:09+09:00";

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(/[‐‑‒–—―ー−－]/g, "-");
}

function normalizeAddress(value) {
  return normalizeName(value).replace(/^熊本県/, "");
}

function matchCoordinate(item, master) {
  const exact = master.filter((row) => (
    row.m === item.municipalityName && row.n === item.name && row.a === item.address
  ));
  if (exact.length === 1) return { row: exact[0], method: "municipality_name_address_exact", candidates: [exact[0].i] };

  const normalized = master.filter((row) => (
    normalizeName(row.m) === normalizeName(item.municipalityName)
    && normalizeName(row.n) === normalizeName(item.name)
    && normalizeAddress(row.a) === normalizeAddress(item.address)
  ));
  if (normalized.length === 1) return { row: normalized[0], method: "municipality_name_address_normalized", candidates: [normalized[0].i] };
  if (normalized.length > 1) return { row: null, method: "ambiguous_municipality_name_address", candidates: normalized.map((row) => row.i) };

  const byAddress = master.filter((row) => (
    normalizeName(row.m) === normalizeName(item.municipalityName)
    && normalizeAddress(row.a) === normalizeAddress(item.address)
  ));
  if (byAddress.length === 1) return { row: byAddress[0], method: "municipality_address_normalized", candidates: [byAddress[0].i] };

  const byName = master.filter((row) => (
    normalizeName(row.m) === normalizeName(item.municipalityName)
    && normalizeName(row.n) === normalizeName(item.name)
  ));
  if (byName.length > 1) return { row: null, method: "ambiguous_municipality_name", candidates: byName.map((row) => row.i) };
  return { row: null, method: "unresolved_no_unique_candidate", candidates: [] };
}

const response = await fetch(sourceUrl, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`公式避難所JSONの取得に失敗しました: HTTP ${response.status}`);
const payload = await response.json();
const html = await readFile(sourceHtmlPath, "utf8");
const masterMatch = html.match(/const PREGEOCODED_SHELTER_ROWS=([\s\S]*?);\s*const PREGEOCODED_SHELTERS=/);
if (!masterMatch) throw new Error("8月2日座標マスターをHTMLから抽出できません。");
const coordinateMaster = JSON.parse(masterMatch[1]);
if (coordinateMaster.length !== 206) throw new Error(`座標マスター件数が206件ではありません: ${coordinateMaster.length}`);

const currentItems = (payload.items || []).filter((item) => item.shelterStartTimestamp && !item.shelterEndTimestamp);
const shelters = currentItems.map((item) => {
  const match = matchCoordinate(item, coordinateMaster);
  return {
    facility_id: String(item.facilityId ?? ""),
    municipality_code: String(item.municipalityCd ?? ""),
    municipality: String(item.municipalityName ?? ""),
    name: String(item.name ?? ""),
    address: String(item.address ?? ""),
    status: "開設",
    congestion: item.crowdedStatus ?? null,
    opened_at: String(item.shelterStartTimestamp),
    closed_at: null,
    coordinate_status: match.row ? "confirmed" : "unresolved",
    coordinate_match_method: match.method,
    coordinate_master_id: match.row ? String(match.row.i) : null,
    lat: match.row ? match.row.y : null,
    lng: match.row ? match.row.x : null,
    coordinate_source_as_of: match.row ? coordinateMasterAsOf : null,
    candidate_master_ids: match.candidates,
  };
});

const formatJst = (date) => {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`;
};
const parseHeaderDate = (name) => {
  const value = response.headers.get(name);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatJst(date);
};
const data = {
  schema_version: 1,
  meta: {
    source_url: sourceUrl,
    source_kind: "熊本県公式避難所JSON",
    fetched_at: parseHeaderDate("date") || formatJst(new Date()),
    source_last_modified: parseHeaderDate("last-modified"),
    current_definition: "熊本県公式の現在開設中一覧（shelterStartTimestampあり・shelterEndTimestamp空）",
    current_count: shelters.length,
    coordinate_master_source_url: sourceUrl,
    coordinate_master_source_as_of: coordinateMasterAsOf,
    coordinate_master_expected_count: coordinateMaster.length,
    coordinate_master_crs: "EPSG:4326",
  },
  shelters,
};

await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  currentCount: shelters.length,
  confirmed: shelters.filter((row) => row.coordinate_status === "confirmed").length,
  unresolved: shelters.filter((row) => row.coordinate_status === "unresolved").length,
  sourceLastModified: data.meta.source_last_modified,
}));

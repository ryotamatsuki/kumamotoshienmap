import { readFile, realpath, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const sourceUrl = "https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json";
const sourceHtmlPath = resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const outputPath = resolve(root, "current-shelters.json");
const coordinateMasterAsOf = "2026-08-02T23:21:09+09:00";

// 100mは施設代表点の座標差を自動的に正しいと決めず、人手確認へ回すための閾値。
const COORDINATE_CONFLICT_THRESHOLD_METERS = 100;
const EARTH_RADIUS_METERS = 6_378_137;

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\s　]/gu, "")
    .replace(/[‐‑‒–—―ー−－]/gu, "-");
}

function normalizeMunicipality(value) {
  return normalizeText(value).replace(/^熊本県/u, "");
}

function normalizeAddress(value) {
  return normalizeMunicipality(value);
}

function normalizeFacilityId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function parseCoordinate(value, minimum, maximum) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum) return null;
  return numeric;
}

function readCoordinate(row, latitudeKeys, longitudeKeys) {
  const latitudeKey = latitudeKeys.find((key) => Object.hasOwn(row, key));
  const longitudeKey = longitudeKeys.find((key) => Object.hasOwn(row, key));
  const lat = parseCoordinate(latitudeKey ? row[latitudeKey] : undefined, -90, 90);
  const lng = parseCoordinate(longitudeKey ? row[longitudeKey] : undefined, -180, 180);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

function normalizeMasterRow(row) {
  return {
    id: normalizeFacilityId(row?.i),
    municipality: String(row?.m ?? ""),
    name: String(row?.n ?? ""),
    address: String(row?.a ?? ""),
    coordinate: readCoordinate(row ?? {}, ["y", "lat", "latitude"], ["x", "lng", "longitude"]),
  };
}

function buildMasterIndex(masterRows) {
  const byId = new Map();
  for (const row of masterRows) {
    if (!row.id) continue;
    const candidates = byId.get(row.id) ?? [];
    candidates.push(row);
    byId.set(row.id, candidates);
  }
  return byId;
}

function candidateIds(rows) {
  return rows.map((row) => row.id).filter(Boolean);
}

function matchCoordinate(item, masterRows, masterById) {
  const facilityId = normalizeFacilityId(item.facilityId);
  if (facilityId) {
    const idMatches = masterById.get(facilityId) ?? [];
    if (idMatches.length > 1) {
      return { row: null, method: "ambiguous_facility_id", candidates: candidateIds(idMatches) };
    }
    if (idMatches.length === 1) {
      const row = idMatches[0];
      if (!row.coordinate) {
        return { row: null, method: "unresolved_master_coordinate_invalid", candidates: [row.id] };
      }
      return { row, method: "facility_id", candidates: [row.id] };
    }
  }

  const exact = masterRows.filter((row) => (
    row.municipality === item.municipalityName
    && row.name === item.name
    && row.address === item.address
  ));
  if (exact.length === 1) {
    if (!exact[0].coordinate) {
      return { row: null, method: "unresolved_master_coordinate_invalid", candidates: [exact[0].id] };
    }
    return { row: exact[0], method: "municipality_name_address_exact", candidates: [exact[0].id] };
  }
  if (exact.length > 1) return { row: null, method: "ambiguous_municipality_name_address_exact", candidates: candidateIds(exact) };

  const normalized = masterRows.filter((row) => (
    normalizeMunicipality(row.municipality) === normalizeMunicipality(item.municipalityName)
    && normalizeText(row.name) === normalizeText(item.name)
    && normalizeAddress(row.address) === normalizeAddress(item.address)
  ));
  if (normalized.length === 1) {
    if (!normalized[0].coordinate) {
      return { row: null, method: "unresolved_master_coordinate_invalid", candidates: [normalized[0].id] };
    }
    return { row: normalized[0], method: "municipality_name_address_normalized", candidates: [normalized[0].id] };
  }
  if (normalized.length > 1) {
    return { row: null, method: "ambiguous_municipality_name_address", candidates: candidateIds(normalized) };
  }

  const byAddress = masterRows.filter((row) => (
    normalizeMunicipality(row.municipality) === normalizeMunicipality(item.municipalityName)
    && normalizeAddress(row.address) === normalizeAddress(item.address)
  ));
  if (byAddress.length === 1) {
    if (!byAddress[0].coordinate) {
      return { row: null, method: "unresolved_master_coordinate_invalid", candidates: [byAddress[0].id] };
    }
    return { row: byAddress[0], method: "municipality_address_normalized", candidates: [byAddress[0].id] };
  }
  if (byAddress.length > 1) {
    return { row: null, method: "ambiguous_municipality_address", candidates: candidateIds(byAddress) };
  }

  // 施設名だけの一致は住所違いを誤って確定し得るため、推測による座標付与には使わない。
  const byName = masterRows.filter((row) => (
    normalizeMunicipality(row.municipality) === normalizeMunicipality(item.municipalityName)
    && normalizeText(row.name) === normalizeText(item.name)
  ));
  if (byName.length > 1) {
    return { row: null, method: "ambiguous_municipality_name", candidates: candidateIds(byName) };
  }
  return { row: null, method: "unresolved_no_unique_candidate", candidates: candidateIds(byName) };
}

function haversineDistanceMeters(first, second) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(second.lat - first.lat);
  const longitudeDelta = toRadians(second.lng - first.lng);
  const firstLatitude = toRadians(first.lat);
  const secondLatitude = toRadians(second.lat);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function roundDistance(value) {
  return Math.round(value * 100) / 100;
}

function coordinateCrosscheck(officialCoordinate, masterRow) {
  if (!masterRow) return null;
  if (!masterRow.coordinate) {
    return {
      status: "master_coordinate_invalid",
      threshold_m: COORDINATE_CONFLICT_THRESHOLD_METERS,
      master_id: masterRow.id,
      master_source_as_of: coordinateMasterAsOf,
    };
  }
  const distanceMeters = roundDistance(haversineDistanceMeters(officialCoordinate, masterRow.coordinate));
  return {
    status: distanceMeters > COORDINATE_CONFLICT_THRESHOLD_METERS ? "conflict" : "within_threshold",
    threshold_m: COORDINATE_CONFLICT_THRESHOLD_METERS,
    distance_m: distanceMeters,
    master_id: masterRow.id,
    master_lat: masterRow.coordinate.lat,
    master_lng: masterRow.coordinate.lng,
    master_source_as_of: coordinateMasterAsOf,
  };
}

function parseHeaderDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatJst(date);
}

function formatJst(date) {
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
}

function extractOfficialItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.shelters)) return payload.shelters;
  throw new Error("公式避難所JSONにitems配列がありません。");
}

function createShelterRow(item, officialCoordinate, officialCoordinateAsOf, masterRows, masterById) {
  const fallbackMatch = matchCoordinate(item, masterRows, masterById);
  const facilityIdMatches = masterById.get(normalizeFacilityId(item.facilityId)) ?? [];
  const sameIdMasterRow = facilityIdMatches.length === 1 ? facilityIdMatches[0] : null;
  const crosscheck = officialCoordinate ? coordinateCrosscheck(officialCoordinate, sameIdMasterRow) : null;
  const usesOfficialCoordinate = Boolean(officialCoordinate);
  const isConflict = crosscheck?.status === "conflict";
  const coordinate = officialCoordinate ?? fallbackMatch.row?.coordinate ?? null;
  const source = usesOfficialCoordinate
    ? "current_official_json"
    : fallbackMatch.row
      ? "2026-08-02_coordinate_master"
      : null;
  const sourceAsOf = usesOfficialCoordinate
    ? officialCoordinateAsOf
    : fallbackMatch.row
      ? coordinateMasterAsOf
      : null;
  const coordinateStatus = coordinate
    ? isConflict ? "conflict" : "confirmed"
    : "unresolved";
  const coordinateMasterId = usesOfficialCoordinate
    ? crosscheck?.master_id ?? null
    : fallbackMatch.row?.id ?? null;

  return {
    facility_id: normalizeFacilityId(item.facilityId) ?? "",
    municipality_code: String(item.municipalityCd ?? ""),
    municipality: String(item.municipalityName ?? ""),
    name: String(item.name ?? ""),
    address: String(item.address ?? ""),
    status: "開設",
    congestion: item.crowdedStatus ?? null,
    opened_at: String(item.shelterStartTimestamp),
    closed_at: null,
    coordinate_status: coordinateStatus,
    coordinate_source: source,
    coordinate_match_method: usesOfficialCoordinate ? "official_json_coordinate" : fallbackMatch.method,
    coordinate_master_id: coordinateMasterId,
    lat: coordinate?.lat ?? null,
    lng: coordinate?.lng ?? null,
    coordinate_source_as_of: sourceAsOf,
    coordinate_crosscheck: crosscheck,
    candidate_master_ids: usesOfficialCoordinate ? crosscheck?.master_id ? [crosscheck.master_id] : [] : fallbackMatch.candidates,
  };
}

function parseArguments(argv) {
  const options = { dryRun: false, outputPath: null };
  const productionPath = resolve(root, "current-shelters.json");

  const setOutputPath = (value) => {
    if (!value || value.startsWith("--")) throw new Error("--output/--candidate-outputには出力先パスが必要です。");
    const resolvedPath = resolve(process.cwd(), value);
    if (options.outputPath && options.outputPath !== resolvedPath) {
      throw new Error(`出力先が複数指定されています（${options.outputPath} / ${resolvedPath}）。`);
    }
    options.outputPath = resolvedPath;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      console.log([
        "Usage: node scripts/update-current-shelters.mjs [--dry-run] [--output <path>]",
        "  --dry-run                         本番 current-shelters.json を変更しない",
        "  --output <path>                   出力先を指定（dry-runでは候補JSON）",
        "  --candidate-output <path>         --outputの安全な別名",
        "  --output=<path> / --candidate-output=<path>  同上",
      ].join("\n"));
      process.exit(0);
    }
    const inlineOutput = argument.match(/^--(?:output|candidate-output)=(.+)$/u);
    if (inlineOutput) {
      setOutputPath(inlineOutput[1]);
      continue;
    }
    if (argument === "--output" || argument === "--candidate-output") {
      setOutputPath(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`未知のオプションです: ${argument}`);
  }

  if (options.dryRun && options.outputPath === productionPath) {
    throw new Error(`dry-runの出力先に本番ファイルを指定できません: ${productionPath}`);
  }
  return options;
}

const { dryRun: isDryRun, outputPath: requestedOutputPath } = parseArguments(process.argv.slice(2));
const writePath = requestedOutputPath ?? (isDryRun ? null : outputPath);
if (isDryRun && requestedOutputPath) {
  const productionRealPath = await realpath(outputPath).catch(() => outputPath);
  const requestedRealPath = await realpath(requestedOutputPath).catch(() => requestedOutputPath);
  if (requestedRealPath === productionRealPath) {
    throw new Error(`dry-runの出力先が本番current-shelters.jsonを指しています: ${requestedOutputPath}`);
  }
}
const response = await fetch(sourceUrl, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`公式避難所JSONの取得に失敗しました: HTTP ${response.status}`);
const fetchedAt = formatJst(new Date());
const sourceLastModified = parseHeaderDate(response.headers.get("last-modified"));
const officialCoordinateAsOf = sourceLastModified ?? fetchedAt;
const payload = await response.json();
const html = await readFile(sourceHtmlPath, "utf8");
const masterMatch = html.match(/const PREGEOCODED_SHELTER_ROWS=([\s\S]*?);\s*const PREGEOCODED_SHELTERS=/);
if (!masterMatch) throw new Error("8月2日座標マスターをHTMLから抽出できません。");
const rawCoordinateMaster = JSON.parse(masterMatch[1]);
if (rawCoordinateMaster.length !== 206) throw new Error(`座標マスター件数が206件ではありません: ${rawCoordinateMaster.length}`);
const coordinateMaster = rawCoordinateMaster.map(normalizeMasterRow);
const masterById = buildMasterIndex(coordinateMaster);

const currentItems = extractOfficialItems(payload).filter((item) => item.shelterStartTimestamp && !item.shelterEndTimestamp);
const shelters = currentItems.map((item) => createShelterRow(
  item,
  readCoordinate(item, ["latitude"], ["longitude"]),
  officialCoordinateAsOf,
  coordinateMaster,
  masterById,
));

const data = {
  schema_version: 1,
  meta: {
    source_url: sourceUrl,
    source_kind: "熊本県公式避難所JSON",
    fetched_at: fetchedAt,
    source_last_modified: sourceLastModified,
    current_definition: "熊本県公式の現在開設中一覧（shelterStartTimestampあり・shelterEndTimestamp空）",
    current_count: shelters.length,
    coordinate_priority: [
      "current_official_json",
      "2026-08-02_coordinate_master_facility_id",
      "2026-08-02_coordinate_master_municipality_name_address",
    ],
    coordinate_conflict_threshold_m: COORDINATE_CONFLICT_THRESHOLD_METERS,
    coordinate_master_source_url: sourceUrl,
    coordinate_master_source_as_of: coordinateMasterAsOf,
    coordinate_master_expected_count: coordinateMaster.length,
    coordinate_master_crs: "EPSG:4326",
  },
  shelters,
};

if (writePath) {
  await writeFile(writePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  dryRun: isDryRun,
  fetchedAt,
  sourceLastModified,
  currentCount: shelters.length,
  officialCoordinates: shelters.filter((row) => row.coordinate_source === "current_official_json").length,
  fallbackCoordinates: shelters.filter((row) => row.coordinate_source === "2026-08-02_coordinate_master").length,
  confirmed: shelters.filter((row) => row.coordinate_status === "confirmed").length,
  conflicts: shelters.filter((row) => row.coordinate_status === "conflict").length,
  unresolved: shelters.filter((row) => row.coordinate_status === "unresolved").length,
  conflictFacilityIds: shelters
    .filter((row) => row.coordinate_status === "conflict")
    .map((row) => row.facility_id),
  outputPath: writePath,
}));

import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CURRENT_PATH = resolve(ROOT, "current-shelters.json");
const DEFAULT_MASTER_PATH = resolve(ROOT, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const DEFAULT_MANIFEST_PATH = resolve(ROOT, "shelter-coordinate-manifest.json");
const OFFICIAL_SOURCE_URL = "https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json";
// 100 m is a review threshold: official and historical coordinates farther apart
// must be investigated instead of silently selecting either coordinate.
const COORDINATE_CONFLICT_DISTANCE_METERS = 100;
const COORDINATE_MASTER_ID_PATTERN = /^\d{8}$/u;
const REQUIRED_META_FIELDS = [
  "source_url", "source_kind", "fetched_at", "source_last_modified",
  "current_definition", "current_count", "coordinate_master_source_as_of",
  "coordinate_master_expected_count",
];
const REQUIRED_SHELTER_FIELDS = [
  "facility_id", "municipality_code", "municipality", "name", "address",
  "status", "opened_at", "closed_at", "coordinate_status",
  "coordinate_match_method", "coordinate_master_id", "lat", "lng",
  "coordinate_source_as_of", "candidate_master_ids",
];
const CURRENT_STATUS_PATTERN = /^(?:open|opened|current|active|operational|inservice|開設|開設中|現在開設中)$/i;
const CLOSED_STATUS_PATTERN = /(?:closed|close|inactive|suspended|終了|閉鎖|休止|未開設)/i;
const UNSAFE_MATCH_METHOD_PATTERN = /(?:guess|guessed|inferred|estimate|estimated|manual|unknown|推測|推定|曖昧|手動)/i;
const UNRESOLVED_MATCH_METHOD_PATTERN = /(?:unresolved|unknown|none|not.?found|not.?applicable|n\/a|pending|ambig|candidate|未確認|未解決|未付与|候補|不明|なし)/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ][0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\.\d+)?)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)?$/u;

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const hasOwn = (value, key) => isRecord(value) && Object.hasOwn(value, key);
const nonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC")
    .replace(/[\u00a0\s]+/gu, "")
    .replace(/[‐‑‒–—―−ー－]/gu, "-")
    .toLocaleLowerCase("ja-JP");
}
const normalizeMunicipality = (value) => normalizeText(value);
const normalizeName = (value) => normalizeText(value)
  .replace(/[（）()［］\[\]【】「」『』]/gu, "")
  .replace(/[・･]/gu, "");
const normalizeAddress = (value) => normalizeText(value)
  .replace(/^〒?\d{3}-?\d{4}/u, "")
  .replace(/^熊本県/u, "");
const normalizeStatus = (value) => normalizeText(value);
const normalizeCoordinateStatus = (value) => normalizeText(value).replace(/[-_ ]/gu, "");

function coordinateKind(value) {
  const token = normalizeCoordinateStatus(value);
  if (["confirmed", "resolved", "matched", "verified", "coordinateconfirmed", "座標確認済み", "確認済み"].includes(token)) return "confirmed";
  if (["unresolved", "unverified", "unknown", "pending", "notfound", "notconfirmed", "座標未確認", "未確認", "未解決"].includes(token)) return "unresolved";
  if (["conflict", "座標矛盾", "座標不一致", "衝突"].includes(token)) return "conflict";
  return null;
}

function coordinateSourceKind(value, shelter, meta) {
  const token = normalizeCoordinateStatus(value);
  if (token && (token.includes("official") || token.includes("currentjson") || token.includes("officialjson") || (token.includes("公式") && token.includes("json")))) return "current_official_json";
  if (token && (token.includes("coordinatemaster") || token.includes("座標マスター") || token.includes("位置履歴"))) return "coordinate_master";
  // Compatibility for schema v1 rows generated before coordinate_source existed.
  if (!nonEmptyString(value) && nonEmptyString(shelter.coordinate_master_id) && shelter.coordinate_source_as_of === meta?.coordinate_master_source_as_of) return "coordinate_master";
  return nonEmptyString(value) ? "other" : null;
}

const isValidDateValue = (value) => typeof value === "string" && Boolean(value.trim()) && ISO_DATE_PATTERN.test(value.trim()) && Number.isFinite(Date.parse(value));
function finiteCoordinatePair(lat, lng) {
  const latitude = typeof lat === "number" ? lat : Number(lat);
  const longitude = typeof lng === "number" ? lng : Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { lat: latitude, lng: longitude };
}
function haversineDistanceMeters(first, second) {
  const radius = 6_371_008.8;
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(second.lat - first.lat);
  const dLng = radians(second.lng - first.lng);
  const lat1 = radians(first.lat);
  const lat2 = radians(second.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const pathFromArgument = (value) => resolve(process.cwd(), value);

function parseArguments(argv) {
  const options = { currentPath: DEFAULT_CURRENT_PATH, masterPath: DEFAULT_MASTER_PATH, manifestPath: DEFAULT_MANIFEST_PATH, allowConflicts: false };
  const positional = [];
  for (const argument of argv) {
    if (argument === "--help" || argument === "-h") {
      console.log([
        "Usage: node scripts/validate-current-shelters.mjs [current-shelters.json]",
        "  --current=<path>    現行避難所JSON（既定: current-shelters.json）",
        "  --master=<path>     位置履歴マスターJSON/HTML",
        "  --manifest=<path>   座標マニフェストJSON",
        "  --allow-conflicts   conflictを報告して継続（通常のbuildでは指定しない）",
      ].join("\n"));
      process.exit(0);
    }
    if (argument === "--allow-conflicts") { options.allowConflicts = true; continue; }
    const match = argument.match(/^--(current|master|manifest)=(.+)$/u);
    if (match) {
      const [, name, value] = match;
      options[`${name}Path`] = pathFromArgument(value);
      continue;
    }
    if (argument.startsWith("--")) throw new Error(`未知のオプションです: ${argument}`);
    positional.push(argument);
  }
  if (positional.length > 1) throw new Error("current-shelters.jsonの指定は1つまでです。");
  if (positional.length === 1) options.currentPath = pathFromArgument(positional[0]);
  return options;
}

async function exists(path) {
  try { await access(path, fsConstants.F_OK); return true; } catch { return false; }
}
async function readJson(path, label) {
  let text;
  try { text = await readFile(path, "utf8"); } catch (error) { throw new Error(`${label}を読み込めません: ${path}\n${error.message}`); }
  try { return JSON.parse(text); } catch (error) { throw new Error(`${label}のJSONが不正です: ${path}\n${error.message}`); }
}
function parseJavaScriptLiteral(source, label) {
  try { return vm.runInNewContext(`(${source})`, Object.create(null), { timeout: 2_000 }); }
  catch (error) { throw new Error(`${label}を解析できません: ${error.message}`); }
}
function extractRowsFromHtml(html, path) {
  const metaMatch = html.match(/const\s+SHELTER_SNAPSHOT_META\s*=\s*(\{[\s\S]*?\});\s*const\s+PREGEOCODED_SHELTER_ROWS\s*=/u);
  const rowsMatch = html.match(/const\s+PREGEOCODED_SHELTER_ROWS\s*=\s*(\[[\s\S]*?\]);\s*const\s+PREGEOCODED_SHELTERS\s*=/u);
  if (!rowsMatch) throw new Error(`座標マスターHTMLからPREGEOCODED_SHELTER_ROWSを取得できません: ${path}`);
  return { rawRows: parseJavaScriptLiteral(rowsMatch[1], "座標マスター行"), metadata: metaMatch ? parseJavaScriptLiteral(metaMatch[1], "座標マスターmetadata") : {} };
}
function extractRowsFromJson(payload, path) {
  if (Array.isArray(payload)) return { rawRows: payload, metadata: {} };
  if (!isRecord(payload)) throw new Error(`座標マスターJSONは配列またはrowsを持つオブジェクトである必要があります: ${path}`);
  const rows = payload.rows ?? payload.shelters ?? payload.records ?? payload.coordinates;
  if (!Array.isArray(rows)) throw new Error(`座標マスターJSONにrows配列がありません: ${path}`);
  return { rawRows: rows, metadata: payload.meta ?? payload.metadata ?? payload };
}
function pick(row, keys) {
  for (const key of keys) if (hasOwn(row, key)) return row[key];
  return undefined;
}
function normalizeMasterRow(row, index) {
  if (!isRecord(row)) return { index, id: undefined, municipalityCode: undefined, municipality: undefined, name: undefined, address: undefined, lat: undefined, lng: undefined };
  return {
    index,
    id: pick(row, ["i", "coordinate_master_id", "facility_id", "facilityId", "id"]),
    municipalityCode: pick(row, ["c", "municipality_code", "municipalityCode"]),
    municipality: pick(row, ["m", "municipality"]),
    name: pick(row, ["n", "name", "facility_name", "facilityName"]),
    address: pick(row, ["a", "address"]),
    lat: pick(row, ["y", "lat", "latitude"]),
    lng: pick(row, ["x", "lng", "longitude"]),
  };
}
async function loadCoordinateMaster(options) {
  const manifest = await readJson(options.manifestPath, "座標マニフェスト");
  let raw;
  try { raw = await readFile(options.masterPath, "utf8"); } catch (error) { throw new Error(`座標マスターを読み込めません: ${options.masterPath}\n${error.message}`); }
  let extracted;
  try { extracted = extname(options.masterPath).toLocaleLowerCase() === ".html" ? extractRowsFromHtml(raw, options.masterPath) : extractRowsFromJson(JSON.parse(raw), options.masterPath); }
  catch (error) { throw new Error(`座標マスターを解析できません: ${options.masterPath}\n${error.message}`); }
  const rows = extracted.rawRows.map((row, index) => normalizeMasterRow(row, index));
  const metadata = extracted.metadata ?? {};
  const sourceAsOf = metadata.source_as_of ?? metadata.sourceAsOf ?? manifest.source_as_of ?? null;
  const digest = createHash("sha256").update(JSON.stringify(extracted.rawRows), "utf8").digest("hex");
  return { manifest, rows, sourceAsOf, digest };
}
function addMasterErrors(master, errors) {
  const { manifest, rows, sourceAsOf, digest } = master;
  if (!isRecord(manifest)) { errors.push("座標マニフェストがオブジェクトではありません。"); return; }
  if (!Number.isInteger(manifest.expected_count) || manifest.expected_count < 1) errors.push(`座標マニフェストのexpected_countが正の整数ではありません（${manifest.expected_count}）。`);
  else if (rows.length !== manifest.expected_count) errors.push(`座標マスター件数がマニフェストと一致しません（${rows.length}/${manifest.expected_count}件）。`);
  if (manifest.source_as_of && sourceAsOf && manifest.source_as_of !== sourceAsOf) errors.push("座標マスターのsource_as_ofがマニフェストと一致しません。");
  if (manifest.sha256 && digest !== manifest.sha256) errors.push(`座標マスターのSHA-256がマニフェストと不一致です（actual: ${digest}）。`);
  const ids = new Set();
  for (const row of rows) {
    const label = `座標マスター${row.index + 1}行目`;
    if (!nonEmptyString(row.id)) errors.push(`${label}のcoordinate_master_idが空です。`);
    if (nonEmptyString(row.id) && !COORDINATE_MASTER_ID_PATTERN.test(String(row.id))) errors.push(`${label}のcoordinate_master_idが8桁ID形式ではありません。`);
    if (nonEmptyString(row.id) && ids.has(String(row.id))) errors.push(`${label}のcoordinate_master_id ${row.id} が重複しています。`);
    if (nonEmptyString(row.id)) ids.add(String(row.id));
    if (typeof row.municipalityCode !== "string" || !/^\d{6}$/u.test(row.municipalityCode)) errors.push(`${label}のmunicipality_codeが不正です。`);
    if (!nonEmptyString(row.municipality)) errors.push(`${label}のmunicipalityが空です。`);
    if (!nonEmptyString(row.name)) errors.push(`${label}のnameが空です。`);
    if (!nonEmptyString(row.address)) errors.push(`${label}のaddressが空です。`);
    if (!finiteCoordinatePair(row.lat, row.lng)) errors.push(`${label}の緯度経度が数値または範囲内ではありません。`);
  }
}
function validateMeta(data, master, errors) {
  if (!isRecord(data)) { errors.push("current-shelters.jsonのルートがオブジェクトではありません。"); return null; }
  if (data.schema_version !== 1) errors.push(`schema_versionは1である必要があります（${data.schema_version}）。`);
  if (!isRecord(data.meta)) { errors.push("metaがオブジェクトではありません。"); return null; }
  const meta = data.meta;
  for (const key of REQUIRED_META_FIELDS) if (!hasOwn(meta, key)) errors.push(`meta.${key}がありません。`);
  if (meta.source_url !== OFFICIAL_SOURCE_URL) errors.push(`meta.source_urlが熊本県公式避難所JSONではありません（${meta.source_url}）。`);
  if (!nonEmptyString(meta.source_kind) || !/公式.*避難所.*json|official.*json/iu.test(meta.source_kind)) errors.push("meta.source_kindが熊本県公式避難所JSONを示していません。");
  if (!isValidDateValue(meta.fetched_at)) errors.push("meta.fetched_atがISO形式の日時ではありません。");
  if (meta.source_last_modified !== null && !isValidDateValue(meta.source_last_modified)) errors.push("meta.source_last_modifiedはnullまたはISO形式の日時である必要があります。");
  if (!nonEmptyString(meta.current_definition)) errors.push("meta.current_definitionが空です。");
  else if (!/shelterStartTimestamp.*shelterEndTimestamp/iu.test(meta.current_definition)) errors.push("meta.current_definitionにshelterStartTimestampあり・shelterEndTimestamp空の条件がありません。");
  if (!Number.isInteger(meta.current_count) || meta.current_count < 0) errors.push("meta.current_countは0以上の整数である必要があります。");
  if (!isValidDateValue(meta.coordinate_master_source_as_of)) errors.push("meta.coordinate_master_source_as_ofがISO形式の日時ではありません。");
  if (!Number.isInteger(meta.coordinate_master_expected_count) || meta.coordinate_master_expected_count < 1) errors.push("meta.coordinate_master_expected_countは正の整数である必要があります。");
  else if (meta.coordinate_master_expected_count !== master.rows.length) errors.push(`meta.coordinate_master_expected_countが座標マスター件数と一致しません（${meta.coordinate_master_expected_count}/${master.rows.length}）。`);
  if (master.sourceAsOf && meta.coordinate_master_source_as_of !== master.sourceAsOf) errors.push("meta.coordinate_master_source_as_ofが座標マスターの時点と一致しません。");
  if (isRecord(master.manifest) && master.manifest.expected_count !== meta.coordinate_master_expected_count) errors.push("meta.coordinate_master_expected_countが座標マニフェストと一致しません。");
  return meta;
}

function getOfficialCoordinate(row, sourceKind) {
  const nestedKeys = ["official_coordinate", "officialCoordinate", "current_official_coordinate", "currentOfficialCoordinate", "source_coordinate"];
  for (const key of nestedKeys) {
    if (!isRecord(row[key])) continue;
    const value = row[key];
    const pair = finiteCoordinatePair(value.lat ?? value.latitude, value.lng ?? value.longitude);
    if (pair) return { ...pair, label: key };
    if (value.lat !== undefined || value.latitude !== undefined || value.lng !== undefined || value.longitude !== undefined) return { invalid: true, label: key };
  }
  const aliases = [["official_lat", "official_lng"], ["official_latitude", "official_longitude"], ["current_official_lat", "current_official_lng"], ["current_official_latitude", "current_official_longitude"], ["source_lat", "source_lng"], ["latitude", "longitude"]];
  for (const [latKey, lngKey] of aliases) {
    if (!hasOwn(row, latKey) && !hasOwn(row, lngKey)) continue;
    const pair = finiteCoordinatePair(row[latKey], row[lngKey]);
    return pair ? { ...pair, label: `${latKey}/${lngKey}` } : { invalid: true, label: `${latKey}/${lngKey}` };
  }
  if (sourceKind === "current_official_json") {
    const pair = finiteCoordinatePair(row.lat, row.lng);
    if (pair) return { ...pair, label: "lat/lng" };
  }
  return null;
}
function getDeclaredDistance(row) {
  const values = [
    row.coordinate_distance_m,
    row.coordinateDistanceMeters,
    row.coordinate_master_distance_m,
    isRecord(row.coordinate_comparison) ? row.coordinate_comparison.distance_m : undefined,
    isRecord(row.coordinate_comparison) ? row.coordinate_comparison.distanceMeters : undefined,
    isRecord(row.coordinate_crosscheck) ? row.coordinate_crosscheck.distance_m : undefined,
  ];
  const value = values.find((candidate) => candidate !== undefined && candidate !== null && candidate !== "");
  if (value === undefined) return null;
  const distance = Number(value);
  return Number.isFinite(distance) && distance >= 0 ? distance : NaN;
}
function isConflictDeclared(row, kind) {
  if (kind === "conflict" || row.coordinate_conflict === true || row.coordinateConflict === true) return true;
  if (isRecord(row.coordinate_comparison) && ["conflict", "座標矛盾", "座標不一致"].includes(normalizeCoordinateStatus(row.coordinate_comparison.status))) return true;
  return isRecord(row.coordinate_crosscheck) && ["conflict", "座標矛盾", "座標不一致"].includes(normalizeCoordinateStatus(row.coordinate_crosscheck.status));
}
function validateTimestampFields(shelter, label, errors) {
  const startKey = ["shelterStartTimestamp", "shelter_start_timestamp", "opened_at"].find((key) => hasOwn(shelter, key));
  const endKey = ["shelterEndTimestamp", "shelter_end_timestamp", "closed_at"].find((key) => hasOwn(shelter, key));
  if (!startKey || !nonEmptyString(shelter[startKey])) errors.push(`${label}にshelterStartTimestamp相当の開設時刻がありません。`);
  if (endKey && shelter[endKey] !== null && shelter[endKey] !== "") errors.push(`${label}にshelterEndTimestamp相当の終了時刻が入っています。`);
}
function validateIdentityAgainstMaster(shelter, masterRow, label, errors) {
  if (shelter.municipality_code !== masterRow.municipalityCode) errors.push(`${label}のmunicipality_codeが座標マスター ${masterRow.id} と一致しません。`);
  if (normalizeMunicipality(shelter.municipality) !== normalizeMunicipality(masterRow.municipality)) errors.push(`${label}のmunicipalityが座標マスター ${masterRow.id} と一致しません。`);
  const sameName = normalizeName(shelter.name) === normalizeName(masterRow.name);
  const sameAddress = normalizeAddress(shelter.address) === normalizeAddress(masterRow.address);
  if (!sameName && !sameAddress) errors.push(`${label}は座標マスター ${masterRow.id} と市町村・施設名・住所で突合できません。`);
}

function validateShelters(data, meta, master, errors, options) {
  if (!isRecord(data) || !Array.isArray(data.shelters)) { errors.push("sheltersが配列ではありません。"); return { confirmed: 0, unresolved: 0, conflicts: 0, sources: {} }; }
  const shelters = data.shelters;
  if (!Number.isInteger(meta?.current_count) || meta.current_count !== shelters.length) errors.push(`meta.current_countとshelters件数が不一致です（${meta?.current_count}/${shelters.length}）。未解決施設を含む現行一覧を削除せず保持してください。`);
  const masterById = new Map(master.rows.filter((row) => nonEmptyString(row.id)).map((row) => [String(row.id), row]));
  const seenFacilityIds = new Set();
  const seenIdentity = new Set();
  const sources = Object.create(null);
  let confirmed = 0; let unresolved = 0; let conflicts = 0;

  for (const [index, shelter] of shelters.entries()) {
    const label = `shelters[${index}]`;
    if (!isRecord(shelter)) { errors.push(`${label}がオブジェクトではありません。`); continue; }
    for (const key of REQUIRED_SHELTER_FIELDS) if (!hasOwn(shelter, key)) errors.push(`${label}.${key}がありません。`);
    if (!nonEmptyString(shelter.facility_id)) errors.push(`${label}.facility_idが空です。`);
    else if (seenFacilityIds.has(shelter.facility_id)) errors.push(`${label}.facility_id ${shelter.facility_id} が重複しています。`);
    else seenFacilityIds.add(shelter.facility_id);
    if (typeof shelter.municipality_code !== "string" || !/^\d{6}$/u.test(shelter.municipality_code)) errors.push(`${label}.municipality_codeが6桁コードではありません。`);
    if (!nonEmptyString(shelter.municipality)) errors.push(`${label}.municipalityが空です。`);
    if (!nonEmptyString(shelter.name)) errors.push(`${label}.nameが空です。`);
    if (!nonEmptyString(shelter.address)) errors.push(`${label}.addressが空です。`);
    if (!nonEmptyString(shelter.opened_at) || !isValidDateValue(shelter.opened_at)) errors.push(`${label}.opened_atがISO形式の日時ではありません。`);
    validateTimestampFields(shelter, label, errors);
    const status = normalizeStatus(shelter.status);
    if (!CURRENT_STATUS_PATTERN.test(status) || CLOSED_STATUS_PATTERN.test(status)) errors.push(`${label}.statusが現行の開設中を示していません（${shelter.status}）。過去の位置履歴を現行母集団に流用しないでください。`);
    if (shelter.closed_at !== null && shelter.closed_at !== "") errors.push(`${label}.closed_atは現在開設中の施設ではnullまたは空文字である必要があります。`);
    const identityKey = [shelter.municipality_code, normalizeMunicipality(shelter.municipality), normalizeName(shelter.name), normalizeAddress(shelter.address)].join("|");
    if (seenIdentity.has(identityKey)) errors.push(`${label}が市町村・施設名・住所の組合せで重複しています。`); else seenIdentity.add(identityKey);

    const kind = coordinateKind(shelter.coordinate_status);
    if (!kind) { errors.push(`${label}.coordinate_statusがconfirmed/resolved、unresolved、conflictのいずれでもありません（${shelter.coordinate_status}）。`); continue; }
    const matchMethod = typeof shelter.coordinate_match_method === "string" ? shelter.coordinate_match_method.trim() : "";
    if (!matchMethod) errors.push(`${label}.coordinate_match_methodが空です。`);
    if (UNSAFE_MATCH_METHOD_PATTERN.test(matchMethod) && (kind === "confirmed" || !UNRESOLVED_MATCH_METHOD_PATTERN.test(matchMethod))) errors.push(`${label}.coordinate_match_methodが推測・曖昧な確定を示しています（${matchMethod}）。`);
    if (!Array.isArray(shelter.candidate_master_ids)) errors.push(`${label}.candidate_master_idsが配列ではありません。`);
    const candidates = Array.isArray(shelter.candidate_master_ids) ? shelter.candidate_master_ids : [];
    for (const candidateId of candidates) {
      if (typeof candidateId !== "string" || !COORDINATE_MASTER_ID_PATTERN.test(candidateId)) errors.push(`${label}.candidate_master_idsに8桁ID形式でない値があります（${candidateId}）。`);
      else if (!masterById.has(candidateId)) errors.push(`${label}.candidate_master_idsの${candidateId}が位置履歴マスターにありません。`);
    }
    const sourceKind = coordinateSourceKind(shelter.coordinate_source, shelter, meta);
    if (hasOwn(shelter, "coordinate_source") && !nonEmptyString(shelter.coordinate_source)) errors.push(`${label}.coordinate_sourceが空です。`);
    if (sourceKind === "other") errors.push(`${label}.coordinate_sourceが公式JSONまたは座標マスターを示していません（${shelter.coordinate_source}）。`);
    if (sourceKind) sources[sourceKind] = (sources[sourceKind] ?? 0) + 1;
    const officialCoordinate = getOfficialCoordinate(shelter, sourceKind);
    if (officialCoordinate?.invalid) errors.push(`${label}の公式JSON座標（${officialCoordinate.label}）が数値または範囲内ではありません。`);
    const declaredDistance = getDeclaredDistance(shelter);
    if (Number.isNaN(declaredDistance)) errors.push(`${label}.coordinate_distance_m等が非数値です。`);
    const masterId = nonEmptyString(shelter.coordinate_master_id) ? String(shelter.coordinate_master_id) : null;
    if (masterId && !COORDINATE_MASTER_ID_PATTERN.test(masterId)) errors.push(`${label}.coordinate_master_idが8桁ID形式ではありません。`);
    const masterRow = masterId ? masterById.get(masterId) : (nonEmptyString(shelter.facility_id) ? masterById.get(String(shelter.facility_id)) : undefined);
    if (masterId && !masterRow) errors.push(`${label}.coordinate_master_id ${masterId} が位置履歴マスターにありません。`);
    const currentCoordinate = finiteCoordinatePair(shelter.lat, shelter.lng);
    const masterCoordinate = masterRow ? finiteCoordinatePair(masterRow.lat, masterRow.lng) : null;
    const conflictDistance = officialCoordinate && !officialCoordinate.invalid && masterCoordinate ? haversineDistanceMeters(officialCoordinate, masterCoordinate) : null;
    if (declaredDistance !== null && Number.isFinite(declaredDistance) && conflictDistance !== null && Math.abs(declaredDistance - conflictDistance) > 1) errors.push(`${label}の宣言距離${declaredDistance.toFixed(1)}mと再計算距離${conflictDistance.toFixed(1)}mが一致しません。`);
    const conflictByDistance = conflictDistance !== null && conflictDistance > COORDINATE_CONFLICT_DISTANCE_METERS;
    const conflictDeclared = isConflictDeclared(shelter, kind);
    if (conflictByDistance) errors.push(`${label}は公式JSON座標と位置履歴マスターが${conflictDistance.toFixed(1)}m乖離しています（閾値${COORDINATE_CONFLICT_DISTANCE_METERS}m）。conflictとして扱い、自動採用しないでください。`);
    if (conflictDeclared && !options.allowConflicts) errors.push(`${label}にcoordinate conflictが記録されています。自動採用せず、出典を確認してください。`);
    if (conflictByDistance || conflictDeclared) conflicts += 1;
    if (kind === "conflict") { if (currentCoordinate) errors.push(`${label}はconflictなのに地図採用座標lat/lngがあります。`); continue; }

    if (kind === "unresolved") {
      unresolved += 1;
      if (officialCoordinate && !officialCoordinate.invalid) errors.push(`${label}はunresolvedですが公式JSON座標が存在します。公式座標を優先してconfirmedにしてください。`);
      if (masterId) errors.push(`${label}はunresolvedなのにcoordinate_master_idが設定されています。`);
      if (shelter.lat !== null || shelter.lng !== null) errors.push(`${label}はunresolvedなのにlat/lngが設定されています。`);
      if (shelter.coordinate_source_as_of !== null) errors.push(`${label}はunresolvedなのにcoordinate_source_as_ofが設定されています。`);
      if (matchMethod && !UNRESOLVED_MATCH_METHOD_PATTERN.test(matchMethod)) errors.push(`${label}はunresolvedなのにcoordinate_match_methodが未確認を示していません（${matchMethod}）。`);
      continue;
    }

    confirmed += 1;
    if (!currentCoordinate) errors.push(`${label}はconfirmedなのにlat/lngが有限数ではありません。`);
    if (sourceKind === "current_official_json") {
      if (!officialCoordinate || officialCoordinate.invalid) errors.push(`${label}は公式JSON座標出典なのに公式座標を取得できません。`);
      else if (!currentCoordinate || currentCoordinate.lat !== officialCoordinate.lat || currentCoordinate.lng !== officialCoordinate.lng) errors.push(`${label}は公式JSON座標を採用していません。公式JSON座標を第一優先にしてください。`);
      if (!isValidDateValue(shelter.coordinate_source_as_of) || ![meta.source_last_modified, meta.fetched_at].includes(shelter.coordinate_source_as_of)) errors.push(`${label}.coordinate_source_as_ofが公式JSONの取得・Last-Modified時点と一致しません。`);
      if (!/(?:official|json|公式)/iu.test(matchMethod)) errors.push(`${label}.coordinate_match_methodが公式JSON座標採用を示していません（${matchMethod}）。`);
    } else if (sourceKind === "coordinate_master") {
      if (!masterId || !masterRow) errors.push(`${label}は座標マスターfallbackなのに一意なcoordinate_master_idがありません。`);
      else {
        if (candidates.length !== 1 || candidates[0] !== masterId) errors.push(`${label}は座標マスターfallbackなのにcandidate_master_idsが単一のcoordinate_master_idと一致しません。`);
        if (!currentCoordinate || !masterCoordinate || currentCoordinate.lat !== masterCoordinate.lat || currentCoordinate.lng !== masterCoordinate.lng) errors.push(`${label}.lat/lngが位置履歴マスター ${masterRow.id} と一致しません。`);
        validateIdentityAgainstMaster(shelter, masterRow, label, errors);
      }
      if (!isValidDateValue(shelter.coordinate_source_as_of) || shelter.coordinate_source_as_of !== meta.coordinate_master_source_as_of) errors.push(`${label}.coordinate_source_as_ofが位置履歴マスター時点と一致しません。`);
      if (officialCoordinate && conflictDistance !== null && conflictDistance <= COORDINATE_CONFLICT_DISTANCE_METERS) errors.push(`${label}は公式JSON座標があるのに位置履歴マスター座標を採用しています。公式JSON座標を優先してください。`);
    } else errors.push(`${label}のconfirmed座標の出典が判定できません。公式JSONまたは位置履歴マスターを明示してください。`);
  }
  if (conflicts > 0 && options.allowConflicts) console.warn(`座標conflictを${conflicts}件検出しました（--allow-conflictsにより継続）。`);
  return { confirmed, unresolved, conflicts, sources };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!(await exists(options.currentPath))) throw new Error(`現行避難所データがありません: ${options.currentPath}`);
  const data = await readJson(options.currentPath, "current-shelters.json");
  const master = await loadCoordinateMaster(options);
  const errors = [];
  addMasterErrors(master, errors);
  const meta = validateMeta(data, master, errors);
  const counts = validateShelters(data, meta, master, errors, options);
  const onlyAllowedConflictErrors = options.allowConflicts && errors.length > 0 && errors.every((error) => /conflict|乖離|自動採用せず/u.test(error));
  if (errors.length > 0 && !onlyAllowedConflictErrors) {
    console.error(["現行避難所JSON検証失敗:", ...errors].join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({
    current: Array.isArray(data.shelters) ? data.shelters.length : 0,
    map: counts.confirmed,
    unresolved: counts.unresolved,
    conflicts: counts.conflicts,
    coordinate_sources: counts.sources,
    historical_coordinate_master: master.rows.length,
    historical_source_as_of: master.sourceAsOf,
    conflict_threshold_meters: COORDINATE_CONFLICT_DISTANCE_METERS,
  }));
}

try { await main(); }
catch (error) { console.error(`現行避難所JSON検証を実行できません: ${error.message}`); process.exitCode = 1; }

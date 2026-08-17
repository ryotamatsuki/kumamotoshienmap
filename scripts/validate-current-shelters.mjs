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
const EXPECTED_COORDINATE_MASTER_COUNT = 206;
const EXPECTED_CURRENT_COUNT = 72;
const EXPECTED_CONFIRMED_COUNT = 67;
const EXPECTED_UNRESOLVED_COUNT = 5;
const EXPECTED_CURRENT_DEFINITION = "熊本県公式の現在開設中一覧（shelterStartTimestampあり・shelterEndTimestamp空）";
const COORDINATE_MASTER_ID_PATTERN = /^\d{8}$/u;

const REQUIRED_META_FIELDS = [
  "source_url",
  "fetched_at",
  "source_last_modified",
  "current_definition",
  "current_count",
  "coordinate_master_source_as_of",
  "coordinate_master_expected_count",
];

const REQUIRED_SHELTER_FIELDS = [
  "facility_id",
  "municipality_code",
  "municipality",
  "name",
  "address",
  "status",
  "opened_at",
  "closed_at",
  "coordinate_status",
  "coordinate_match_method",
  "coordinate_master_id",
  "lat",
  "lng",
  "coordinate_source_as_of",
  "candidate_master_ids",
];

const CURRENT_STATUS_PATTERN = /^(?:open|opened|current|active|operational|inservice|開設|開設中|現在開設中)$/i;
const CLOSED_STATUS_PATTERN = /(?:closed|close|inactive|suspended|終了|閉鎖|休止|未開設)/i;
const UNSAFE_MATCH_METHOD_PATTERN = /(?:guess|guessed|inferred|estimate|estimated|manual|unknown|推測|推定|曖昧|手動)/i;
const UNRESOLVED_MATCH_METHOD_PATTERN = /(?:unresolved|unknown|none|not.?found|not.?applicable|n\/a|pending|ambig|candidate|未確認|未解決|未付与|候補|不明|なし)/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ][0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\.\d+)?)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)?$/;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isRecord(value) && Object.hasOwn(value, key);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u00a0\s]+/gu, "")
    .replace(/[‐‑‒–—―−ー－]/gu, "-")
    .toLocaleLowerCase("ja-JP");
}

function normalizeMunicipality(value) {
  return normalizeText(value);
}

function normalizeName(value) {
  return normalizeText(value)
    .replace(/[（）()［］\[\]【】「」『』]/gu, "")
    .replace(/[・･]/gu, "");
}

function normalizeAddress(value) {
  return normalizeText(value)
    .replace(/^〒?\d{3}-?\d{4}/u, "")
    .replace(/^熊本県/u, "");
}

function normalizeStatus(value) {
  return normalizeText(value);
}

function normalizeCoordinateStatus(value) {
  return normalizeText(value).replace(/[-_ ]/gu, "");
}

function coordinateKind(value) {
  const token = normalizeCoordinateStatus(value);
  if (["confirmed", "resolved", "matched", "verified", "coordinateconfirmed", "座標確認済み", "確認済み"].includes(token)) {
    return "confirmed";
  }
  if (["unresolved", "unverified", "unknown", "pending", "notfound", "notconfirmed", "座標未確認", "未確認", "未解決"].includes(token)) {
    return "unresolved";
  }
  return null;
}

function isValidDateValue(value) {
  if (typeof value !== "string" || !value.trim() || !ISO_DATE_PATTERN.test(value.trim())) return false;
  return Number.isFinite(Date.parse(value));
}

function isHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function pathFromArgument(value) {
  return resolve(process.cwd(), value);
}

function parseArguments(argv) {
  const options = {
    currentPath: DEFAULT_CURRENT_PATH,
    masterPath: DEFAULT_MASTER_PATH,
    manifestPath: DEFAULT_MANIFEST_PATH,
  };
  const positional = [];

  for (const argument of argv) {
    if (argument === "--help" || argument === "-h") {
      console.log([
        "Usage: node scripts/validate-current-shelters.mjs [current-shelters.json]",
        "  --current=<path>   現行避難所JSON（既定: current-shelters.json）",
        "  --master=<path>    206点の座標マスターJSON/HTML",
        "  --manifest=<path>  座標マニフェストJSON",
      ].join("\n"));
      process.exit(0);
    }
    const match = argument.match(/^--(current|master|manifest)=(.+)$/u);
    if (match) {
      const [, name, value] = match;
      if (name === "current") options.currentPath = pathFromArgument(value);
      if (name === "master") options.masterPath = pathFromArgument(value);
      if (name === "manifest") options.manifestPath = pathFromArgument(value);
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
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path, label) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`${label}を読み込めません: ${path}\n${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label}のJSONが不正です: ${path}\n${error.message}`);
  }
}

function parseJavaScriptLiteral(source, label) {
  try {
    return vm.runInNewContext(`(${source})`, Object.create(null), { timeout: 2_000 });
  } catch (error) {
    throw new Error(`${label}を解析できません: ${error.message}`);
  }
}

function extractRowsFromHtml(html, path) {
  const metaMatch = html.match(
    /const\s+SHELTER_SNAPSHOT_META\s*=\s*(\{[\s\S]*?\});\s*const\s+PREGEOCODED_SHELTER_ROWS\s*=/u,
  );
  const rowsMatch = html.match(
    /const\s+PREGEOCODED_SHELTER_ROWS\s*=\s*(\[[\s\S]*?\]);\s*const\s+PREGEOCODED_SHELTERS\s*=/u,
  );
  if (!rowsMatch) {
    throw new Error(`座標マスターHTMLからPREGEOCODED_SHELTER_ROWSを取得できません: ${path}`);
  }
  return {
    rawRows: parseJavaScriptLiteral(rowsMatch[1], "座標マスター行"),
    metadata: metaMatch ? parseJavaScriptLiteral(metaMatch[1], "座標マスター metadata") : {},
  };
}

function extractRowsFromJson(payload, path) {
  if (Array.isArray(payload)) return { rawRows: payload, metadata: {} };
  if (!isRecord(payload)) throw new Error(`座標マスターJSONは配列またはrowsを持つオブジェクトである必要があります: ${path}`);

  const rows = payload.rows ?? payload.shelters ?? payload.records ?? payload.coordinates;
  if (!Array.isArray(rows)) {
    throw new Error(`座標マスターJSONにrows配列がありません: ${path}`);
  }
  return {
    rawRows: rows,
    metadata: payload.meta ?? payload.metadata ?? payload,
  };
}

function pick(row, keys) {
  for (const key of keys) {
    if (hasOwn(row, key)) return row[key];
  }
  return undefined;
}

function normalizeMasterRow(row, index) {
  if (!isRecord(row)) {
    return { index, id: undefined, municipalityCode: undefined, municipality: undefined, name: undefined, address: undefined, lat: undefined, lng: undefined };
  }
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
  try {
    raw = await readFile(options.masterPath, "utf8");
  } catch (error) {
    throw new Error(`座標マスターを読み込めません: ${options.masterPath}\n${error.message}`);
  }

  const extracted = extname(options.masterPath).toLocaleLowerCase() === ".html"
    ? extractRowsFromHtml(raw, options.masterPath)
    : extractRowsFromJson(JSON.parse(raw), options.masterPath);
  const rows = extracted.rawRows.map((row, index) => normalizeMasterRow(row, index));
  const metadata = extracted.metadata ?? {};
  const sourceAsOf = metadata.source_as_of ?? metadata.sourceAsOf ?? manifest.source_as_of ?? null;
  const sourceUrl = metadata.source_url ?? metadata.sourceUrl ?? manifest.source_url ?? null;
  const digest = createHash("sha256").update(JSON.stringify(extracted.rawRows), "utf8").digest("hex");

  return { manifest, rawRows: extracted.rawRows, rows, metadata, sourceAsOf, sourceUrl, digest };
}

function addMasterErrors(master, errors) {
  const { manifest, rows, sourceAsOf, digest } = master;
  if (!isRecord(manifest)) {
    errors.push("座標マニフェストがオブジェクトではありません。");
    return;
  }
  if (manifest.expected_count !== EXPECTED_COORDINATE_MASTER_COUNT) {
    errors.push(`座標マニフェストのexpected_countが206ではありません（${manifest.expected_count}）。`);
  }
  if (rows.length !== EXPECTED_COORDINATE_MASTER_COUNT) {
    errors.push(`座標マスター件数が206ではありません（${rows.length}件）。`);
  }
  if (manifest.source_as_of && sourceAsOf && manifest.source_as_of !== sourceAsOf) {
    errors.push("座標マスターのsource_as_ofがマニフェストと一致しません。");
  }
  if (manifest.sha256 && digest !== manifest.sha256) {
    errors.push(`座標マスターのSHA-256がマニフェストと不一致です（actual: ${digest}）。`);
  }

  const ids = new Set();
  for (const row of rows) {
    const label = `座標マスター${row.index + 1}行目`;
    if (!nonEmptyString(row.id)) errors.push(`${label}のcoordinate_master_idが空です。`);
    if (nonEmptyString(row.id) && !COORDINATE_MASTER_ID_PATTERN.test(row.id)) {
      errors.push(`${label}のcoordinate_master_idが8桁ID形式ではありません。`);
    }
    if (nonEmptyString(row.id) && ids.has(row.id)) errors.push(`${label}のcoordinate_master_id ${row.id} が重複しています。`);
    if (nonEmptyString(row.id)) ids.add(row.id);
    if (typeof row.municipalityCode !== "string" || !/^\d{6}$/u.test(row.municipalityCode)) {
      errors.push(`${label}のmunicipality_codeが不正です。`);
    }
    if (!nonEmptyString(row.municipality)) errors.push(`${label}のmunicipalityが空です。`);
    if (!nonEmptyString(row.name)) errors.push(`${label}のnameが空です。`);
    if (!nonEmptyString(row.address)) errors.push(`${label}のaddressが空です。`);
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) errors.push(`${label}の緯度経度が数値ではありません。`);
    if (Number.isFinite(row.lat) && (row.lat < -90 || row.lat > 90)) errors.push(`${label}の緯度が範囲外です。`);
    if (Number.isFinite(row.lng) && (row.lng < -180 || row.lng > 180)) errors.push(`${label}の経度が範囲外です。`);
  }
}

function validateMeta(data, master, errors) {
  if (!isRecord(data)) {
    errors.push("current-shelters.jsonのルートがオブジェクトではありません。");
    return null;
  }
  if (data.schema_version !== 1) errors.push(`schema_versionは1である必要があります（${data.schema_version}）。`);
  if (!isRecord(data.meta)) {
    errors.push("metaがオブジェクトではありません。");
    return null;
  }

  const meta = data.meta;
  for (const key of REQUIRED_META_FIELDS) {
    if (!hasOwn(meta, key)) errors.push(`meta.${key}がありません。`);
  }
  if (!isHttpUrl(meta.source_url)) errors.push("meta.source_urlがhttp(s) URLではありません。");
  if (!isValidDateValue(meta.fetched_at)) errors.push("meta.fetched_atがISO形式の日時ではありません。");
  if (meta.source_last_modified !== null && !isValidDateValue(meta.source_last_modified)) {
    errors.push("meta.source_last_modifiedはnullまたはISO形式の日時である必要があります。");
  }
  if (!nonEmptyString(meta.current_definition)) {
    errors.push("meta.current_definitionが空です。");
  } else if (meta.current_definition !== EXPECTED_CURRENT_DEFINITION) {
    errors.push(`meta.current_definitionが想定された現行一覧の抽出条件と一致しません（${meta.current_definition}）。`);
  }
  if (!Number.isInteger(meta.current_count) || meta.current_count < 0) {
    errors.push("meta.current_countは0以上の整数である必要があります。");
  } else if (meta.current_count !== EXPECTED_CURRENT_COUNT) {
    errors.push(`meta.current_countは${EXPECTED_CURRENT_COUNT}である必要があります（${meta.current_count}）。`);
  }
  if (!isValidDateValue(meta.coordinate_master_source_as_of)) {
    errors.push("meta.coordinate_master_source_as_ofがISO形式の日時ではありません。");
  }
  if (meta.coordinate_master_expected_count !== EXPECTED_COORDINATE_MASTER_COUNT) {
    errors.push(`meta.coordinate_master_expected_countは206である必要があります（${meta.coordinate_master_expected_count}）。`);
  }
  if (master.sourceAsOf && meta.coordinate_master_source_as_of !== master.sourceAsOf) {
    errors.push("meta.coordinate_master_source_as_ofが座標マスターの時点と一致しません。");
  }
  if (isRecord(master.manifest) && master.manifest.expected_count !== meta.coordinate_master_expected_count) {
    errors.push("meta.coordinate_master_expected_countが座標マニフェストと一致しません。");
  }
  return meta;
}

function validateShelters(data, meta, master, errors) {
  if (!isRecord(data) || !Array.isArray(data.shelters)) {
    errors.push("sheltersが配列ではありません。");
    return { confirmed: 0, unresolved: 0 };
  }
  const shelters = data.shelters;
  if (Number.isInteger(meta?.current_count) && meta.current_count !== shelters.length) {
    errors.push(`meta.current_countとshelters件数が不一致です（${meta.current_count}/${shelters.length}）。未解決施設を含む現行一覧を削除せず保持してください。`);
  }

  const masterById = new Map(master.rows.filter((row) => nonEmptyString(row.id)).map((row) => [String(row.id), row]));
  const seenFacilityIds = new Set();
  const seenIdentity = new Map();
  let confirmed = 0;
  let unresolved = 0;

  for (const [index, shelter] of shelters.entries()) {
    const label = `shelters[${index}]`;
    if (!isRecord(shelter)) {
      errors.push(`${label}がオブジェクトではありません。`);
      continue;
    }
    for (const key of REQUIRED_SHELTER_FIELDS) {
      if (!hasOwn(shelter, key)) errors.push(`${label}.${key}がありません。`);
    }

    if (!nonEmptyString(shelter.facility_id)) errors.push(`${label}.facility_idが空です。`);
    if (nonEmptyString(shelter.facility_id)) {
      if (seenFacilityIds.has(shelter.facility_id)) errors.push(`${label}.facility_id ${shelter.facility_id} が重複しています。`);
      seenFacilityIds.add(shelter.facility_id);
    }
    if (typeof shelter.municipality_code !== "string" || !/^\d{6}$/u.test(shelter.municipality_code)) {
      errors.push(`${label}.municipality_codeが6桁コードではありません。`);
    }
    if (!nonEmptyString(shelter.municipality)) errors.push(`${label}.municipalityが空です。`);
    if (!nonEmptyString(shelter.name)) errors.push(`${label}.nameが空です。`);
    if (!nonEmptyString(shelter.address)) errors.push(`${label}.addressが空です。`);
    if (!nonEmptyString(shelter.opened_at) || !isValidDateValue(shelter.opened_at)) {
      errors.push(`${label}.opened_atがISO形式の日時ではありません。`);
    }

    const status = normalizeStatus(shelter.status);
    if (!CURRENT_STATUS_PATTERN.test(status) || CLOSED_STATUS_PATTERN.test(status)) {
      errors.push(`${label}.statusが現行の開設中を示していません（${shelter.status}）。過去206点を現行一覧に流用しないでください。`);
    }
    if (shelter.closed_at !== null && shelter.closed_at !== "") {
      errors.push(`${label}.closed_atは現在開設中の施設ではnullまたは空文字である必要があります。`);
    }

    const identityKey = [
      shelter.municipality_code,
      normalizeMunicipality(shelter.municipality),
      normalizeName(shelter.name),
      normalizeAddress(shelter.address),
    ].join("|");
    if (seenIdentity.has(identityKey)) {
      errors.push(`${label}が${seenIdentity.get(identityKey)}と市町村・施設名・住所の組合せで重複しています。`);
    } else {
      seenIdentity.set(identityKey, label);
    }

    const kind = coordinateKind(shelter.coordinate_status);
    if (!kind) {
      errors.push(`${label}.coordinate_statusがconfirmed/resolvedまたはunresolved系ではありません（${shelter.coordinate_status}）。`);
      continue;
    }
    const matchMethod = typeof shelter.coordinate_match_method === "string" ? shelter.coordinate_match_method.trim() : "";
    if (!matchMethod) errors.push(`${label}.coordinate_match_methodが空です。`);
    if (UNSAFE_MATCH_METHOD_PATTERN.test(matchMethod) && (kind === "confirmed" || !UNRESOLVED_MATCH_METHOD_PATTERN.test(matchMethod))) {
      errors.push(`${label}.coordinate_match_methodが推測・曖昧な確定を示しています（${matchMethod}）。`);
    }

    if (!Array.isArray(shelter.candidate_master_ids)) {
      errors.push(`${label}.candidate_master_idsが配列ではありません。`);
    }
    const candidateMasterIds = Array.isArray(shelter.candidate_master_ids) ? shelter.candidate_master_ids : [];
    const candidateIdSet = new Set();
    for (const candidateId of candidateMasterIds) {
      if (typeof candidateId !== "string" || !COORDINATE_MASTER_ID_PATTERN.test(candidateId)) {
        errors.push(`${label}.candidate_master_idsに8桁ID形式でない値があります（${candidateId}）。`);
      }
      if (candidateIdSet.has(candidateId)) errors.push(`${label}.candidate_master_idsに重複IDがあります（${candidateId}）。`);
      candidateIdSet.add(candidateId);
      if (typeof candidateId === "string" && !masterById.has(candidateId)) {
        errors.push(`${label}.candidate_master_idsの${candidateId}が206点の座標マスターにありません。`);
      }
    }

    if (kind === "unresolved") {
      unresolved += 1;
      if (shelter.coordinate_master_id !== null && shelter.coordinate_master_id !== "") {
        errors.push(`${label}はunresolvedなのにcoordinate_master_idが設定されています。`);
      }
      if (shelter.lat !== null || shelter.lng !== null) {
        errors.push(`${label}はunresolvedなのにlat/lngが設定されています。`);
      }
      if (shelter.coordinate_source_as_of !== null) {
        errors.push(`${label}はunresolvedなのにcoordinate_source_as_ofが設定されています。`);
      }
      if (matchMethod && !UNRESOLVED_MATCH_METHOD_PATTERN.test(matchMethod)) {
        errors.push(`${label}はunresolvedなのにcoordinate_match_methodが未確認を示していません（${matchMethod}）。`);
      }
      continue;
    }

    confirmed += 1;
    if (!nonEmptyString(shelter.coordinate_master_id)) {
      errors.push(`${label}はconfirmedなのにcoordinate_master_idがありません。`);
      continue;
    }
    if (!COORDINATE_MASTER_ID_PATTERN.test(shelter.coordinate_master_id)) {
      errors.push(`${label}.coordinate_master_idが8桁ID形式ではありません。`);
    }
    if (candidateMasterIds.length !== 1 || candidateMasterIds[0] !== shelter.coordinate_master_id) {
      errors.push(`${label}はconfirmedなのにcandidate_master_idsが単一のcoordinate_master_idと一致しません。`);
    }
    if (!isValidDateValue(shelter.coordinate_source_as_of)) {
      errors.push(`${label}.coordinate_source_as_ofがISO形式の日時ではありません。`);
    } else if (shelter.coordinate_source_as_of !== meta.coordinate_master_source_as_of) {
      errors.push(`${label}.coordinate_source_as_ofが座標マスター時点と一致しません。`);
    }
    const masterRow = masterById.get(String(shelter.coordinate_master_id));
    if (!masterRow) {
      errors.push(`${label}.coordinate_master_id ${shelter.coordinate_master_id} が206点の座標マスターにありません。`);
      continue;
    }
    if (!Number.isFinite(shelter.lat) || !Number.isFinite(shelter.lng)) {
      errors.push(`${label}はconfirmedなのにlat/lngが有限数ではありません。`);
    } else {
      if (shelter.lat !== masterRow.lat) errors.push(`${label}.latが座標マスター ${masterRow.id} と一致しません。`);
      if (shelter.lng !== masterRow.lng) errors.push(`${label}.lngが座標マスター ${masterRow.id} と一致しません。`);
    }
    if (shelter.municipality_code !== masterRow.municipalityCode) {
      errors.push(`${label}のmunicipality_codeが座標マスター ${masterRow.id} と一致しません。`);
    }
    if (normalizeMunicipality(shelter.municipality) !== normalizeMunicipality(masterRow.municipality)) {
      errors.push(`${label}のmunicipalityが座標マスター ${masterRow.id} と一致しません。`);
    }

    const currentName = normalizeName(shelter.name);
    const currentAddress = normalizeAddress(shelter.address);
    const masterName = normalizeName(masterRow.name);
    const masterAddress = normalizeAddress(masterRow.address);
    const sameMunicipality = master.rows.filter((row) =>
      row.municipalityCode === shelter.municipality_code &&
      normalizeMunicipality(row.municipality) === normalizeMunicipality(shelter.municipality),
    );
    const exactCandidates = sameMunicipality.filter((row) => normalizeName(row.name) === currentName && normalizeAddress(row.address) === currentAddress);
    const addressCandidates = sameMunicipality.filter((row) => normalizeAddress(row.address) === currentAddress);
    const nameCandidates = sameMunicipality.filter((row) => normalizeName(row.name) === currentName);
    let candidates = exactCandidates;
    if (candidates.length === 0) candidates = addressCandidates.length > 0 ? addressCandidates : nameCandidates;

    if (candidates.length === 0) {
      errors.push(`${label}は座標マスター ${masterRow.id} と市町村・施設名・住所で突合できません。`);
    } else if (candidates.length > 1) {
      errors.push(`${label}の座標候補が曖昧です（${candidates.map((row) => row.id).join(", ")}）。unresolvedで保持してください。`);
    } else if (String(candidates[0].id) !== String(masterRow.id)) {
      errors.push(`${label}のcoordinate_master_idが市町村・施設名・住所から得られる候補と異なります。`);
    }

    const methodToken = normalizeText(matchMethod);
    if (/(?:exact|完全)/iu.test(methodToken) && (currentName !== masterName || currentAddress !== masterAddress)) {
      errors.push(`${label}のcoordinate_match_methodがexactなのに施設名または住所が完全一致していません。`);
    }
    if (/(?:address|住所)/iu.test(methodToken) && currentAddress !== masterAddress) {
      errors.push(`${label}のcoordinate_match_methodが住所一致を示すのに住所が一致していません。`);
    }
    if (/(?:name|facility|施設名)/iu.test(methodToken) && currentName !== masterName) {
      errors.push(`${label}のcoordinate_match_methodが施設名一致を示すのに施設名が一致していません。`);
    }
  }

  if (confirmed !== EXPECTED_CONFIRMED_COUNT) {
    errors.push(`coordinate_status=confirmedの件数が${EXPECTED_CONFIRMED_COUNT}ではありません（${confirmed}件）。`);
  }
  if (unresolved !== EXPECTED_UNRESOLVED_COUNT) {
    errors.push(`coordinate_status=unresolvedの件数が${EXPECTED_UNRESOLVED_COUNT}ではありません（${unresolved}件）。`);
  }

  return { confirmed, unresolved };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!(await exists(options.currentPath))) {
    throw new Error(`現行避難所データがありません: ${options.currentPath}`);
  }
  const data = await readJson(options.currentPath, "current-shelters.json");
  const master = await loadCoordinateMaster(options);
  const errors = [];

  addMasterErrors(master, errors);
  const meta = validateMeta(data, master, errors);
  const counts = validateShelters(data, meta, master, errors);

  if (errors.length > 0) {
    console.error(["現行避難所JSON検証失敗:", ...errors].join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(
    `現行避難所検証: 現在${data.shelters.length}件 / 地図表示${counts.confirmed}件 / 座標未確認${counts.unresolved}件 / 座標マスター${master.rows.length}件（${master.sourceAsOf}）`,
  );
}

try {
  await main();
} catch (error) {
  console.error(`現行避難所JSON検証を実行できません: ${error.message}`);
  process.exitCode = 1;
}

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COPY_PATHS = [
  "scripts/validate-update-release.mjs",
  "scripts/validate-current-shelters.mjs",
  "ehime_kumamoto_support_geocoded_shelters_20260802.html",
  "public/dashboard.html",
  "dist/dashboard.html",
  "dist/server/index.js",
  "volunteer.css",
  "volunteer-data.js",
  "volunteer.js",
  "current-shelters.json",
  "dist/volunteer.css",
  "dist/volunteer-data.js",
  "dist/volunteer.js",
  "dist/current-shelters.json",
  ".openai/hosting.json",
  "dist/.openai/hosting.json",
  "index.html",
  "shelter-coordinate-manifest.json",
];

function sh(cwd, command, args = []) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function copyFixture(root) {
  for (const relativePath of COPY_PATHS) {
    const source = resolve(ROOT, relativePath);
    if (!existsSync(source)) throw new Error(`self-test fixture source missing: ${relativePath}`);
    const destination = resolve(root, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
}

function prepare() {
  const root = mkdtempSync(join(tmpdir(), "kumamoto-release-gate-"));
  copyFixture(root);
  writeFileSync(resolve(root, "history-fixture.json"), `${JSON.stringify({ state: "HISTORICAL", source_as_of: "2000-01-01T00:00:00+09:00" }, null, 2)}\n`);
  sh(root, "git", ["init", "-b", "main"]);
  sh(root, "git", ["config", "user.email", "release-gate-test@example.invalid"]);
  sh(root, "git", ["config", "user.name", "Release Gate Test"]);
  sh(root, "git", ["add", "-A"]);
  sh(root, "git", ["commit", "-m", "fixture baseline"]);
  return root;
}

function runNode(root, relativeScript, args = []) {
  return spawnSync(process.execPath, [resolve(root, relativeScript), ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function expectFailure(name, result, expectedPattern = null) {
  if (result.status === 0) throw new Error(`${name}: expected failure but command passed`);
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (expectedPattern && !expectedPattern.test(combined)) {
    throw new Error(`${name}: failed for an unexpected reason\n${combined}`);
  }
}

function expectPass(name, result) {
  if (result.status !== 0) throw new Error(`${name}: expected pass but command failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
}

function releaseId(root) {
  const html = readFileSync(resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html"), "utf8");
  const match = html.match(/volunteer-data\.js\?v=([A-Za-z0-9._-]+)/u);
  if (!match) throw new Error("release_id not found in fixture HTML");
  return match[1];
}

function referenceAt(root) {
  const source = readFileSync(resolve(root, "volunteer-data.js"), "utf8");
  const match = source.match(/"reference_at"\s*:\s*"([^"]+)"/u);
  if (!match) throw new Error("reference_at not found in volunteer-data.js");
  return match[1];
}

function ledger(root, expectedChangedFiles, overrides = {}) {
  const reference = referenceAt(root);
  const nextReview = new Date(Date.parse(reference) + 86_400_000).toISOString();
  const payload = {
    schema_version: 2,
    repository: "ryotamatsuki/kumamotoshienmap",
    update_type: "timepoint_refresh",
    gate_phase: "pre_merge",
    update_id: "refresh-20990101-0000",
    release_id: releaseId(root),
    reference_at: reference,
    page_checked_at: null,
    base_main_sha: sh(root, "git", ["rev-parse", "HEAD"]),
    expected_changed_files: expectedChangedFiles,
    sources: [{ source_id: "test-source", url: "https://example.invalid/test" }],
    coverage: {
      current_count: JSON.parse(readFileSync(resolve(root, "current-shelters.json"), "utf8")).shelters.length,
      unresolved_count: 0,
      conflict_count: 0,
    },
    snapshots: {},
    blocking_unresolved: [],
    accepted_unresolved: [],
    ...overrides,
  };
  if (payload.accepted_unresolved === "VALID") {
    payload.accepted_unresolved = [{
      issue_id: "unknown-official-status",
      state: "UNKNOWN",
      reason: "Official source does not currently publish the value.",
      owner: "release-owner",
      source_ids: ["test-source"],
      next_review_at: nextReview,
    }];
  }
  return payload;
}

function writeLedger(root, payload) {
  writeFileSync(resolve(root, "UPDATE_LEDGER.json"), `${JSON.stringify(payload, null, 2)}\n`);
  sh(root, "git", ["add", "UPDATE_LEDGER.json"]);
}

function mutate(path, transform) {
  const current = readFileSync(path, "utf8");
  writeFileSync(path, transform(current));
}

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

test("source/public parity mismatch is blocked", () => {
  const root = prepare();
  try {
    mutate(resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html"), (value) => `${value}\n<!-- injected parity fault -->\n`);
    const result = runNode(root, "scripts/validate-update-release.mjs");
    expectFailure("parity mismatch", result, /バイト一致/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("release_id mismatch is blocked", () => {
  const root = prepare();
  try {
    const oldId = releaseId(root);
    const newId = oldId === "20990101-0000" ? "20990101-0001" : "20990101-0000";
    for (const relativePath of ["ehime_kumamoto_support_geocoded_shelters_20260802.html", "public/dashboard.html", "dist/dashboard.html", "dist/server/index.js"]) {
      mutate(resolve(root, relativePath), (value) => value.replaceAll(oldId, newId));
    }
    writeLedger(root, ledger(root, [
      "UPDATE_LEDGER.json",
      "dist/dashboard.html",
      "dist/server/index.js",
      "ehime_kumamoto_support_geocoded_shelters_20260802.html",
      "public/dashboard.html",
    ], { release_id: oldId }));
    const result = runNode(root, "scripts/validate-update-release.mjs", ["--ledger=UPDATE_LEDGER.json", "--require-ledger-if-data-change"]);
    expectFailure("release mismatch", result, /release_id/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("expected_changed_files omission is blocked", () => {
  const root = prepare();
  try {
    writeLedger(root, ledger(root, ["UPDATE_LEDGER.json", "current-shelters.json"]));
    const result = runNode(root, "scripts/validate-update-release.mjs", ["--ledger=UPDATE_LEDGER.json", "--require-ledger-if-data-change"]);
    expectFailure("expected files", result, /expected_changed_files/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("candidate count mismatch is blocked", () => {
  const root = prepare();
  try {
    const candidatePath = resolve(root, "candidate-count.json");
    const candidate = JSON.parse(readFileSync(resolve(root, "current-shelters.json"), "utf8"));
    candidate.meta.current_count += 1;
    writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
    const result = runNode(root, "scripts/validate-current-shelters.mjs", [`--candidate=${candidatePath}`]);
    expectFailure("candidate count", result, /current_count/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("candidate coordinate conflict is blocked", () => {
  const root = prepare();
  try {
    const candidatePath = resolve(root, "candidate-conflict.json");
    const candidate = JSON.parse(readFileSync(resolve(root, "current-shelters.json"), "utf8"));
    candidate.shelters[0].coordinate_status = "conflict";
    candidate.shelters[0].coordinate_crosscheck = {
      ...(candidate.shelters[0].coordinate_crosscheck ?? {}),
      status: "conflict",
      threshold_m: 100,
      distance_m: 101,
    };
    writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
    const result = runNode(root, "scripts/validate-current-shelters.mjs", [`--candidate=${candidatePath}`]);
    expectFailure("candidate conflict", result, /conflict|乖離|自動採用/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("stale current metadata is blocked", () => {
  const root = prepare();
  try {
    writeLedger(root, ledger(root, ["UPDATE_LEDGER.json"], { reference_at: "2000-01-01T00:00:00+09:00" }));
    const result = runNode(root, "scripts/validate-update-release.mjs", ["--ledger=UPDATE_LEDGER.json"]);
    expectFailure("stale metadata", result, /reference_at/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("historical dates are not blanket-rejected", () => {
  const root = prepare();
  try {
    writeFileSync(resolve(root, "history-fixture.json"), `${JSON.stringify({ state: "HISTORICAL", source_as_of: "1990-01-01T00:00:00+09:00" }, null, 2)}\n`);
    const result = runNode(root, "scripts/validate-update-release.mjs");
    expectPass("historical date", result);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("accepted unresolved with review metadata may pass", () => {
  const root = prepare();
  try {
    writeLedger(root, ledger(root, ["UPDATE_LEDGER.json"], { accepted_unresolved: "VALID" }));
    const result = runNode(root, "scripts/validate-update-release.mjs", ["--ledger=UPDATE_LEDGER.json"]);
    expectPass("accepted unresolved", result);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("blocking unresolved is blocked", () => {
  const root = prepare();
  try {
    writeLedger(root, ledger(root, ["UPDATE_LEDGER.json"], {
      blocking_unresolved: [{ issue_id: "blocking", reason: "Cannot safely publish current state." }],
    }));
    const result = runNode(root, "scripts/validate-update-release.mjs", ["--ledger=UPDATE_LEDGER.json"]);
    expectFailure("blocking unresolved", result, /blocking_unresolved/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

let failed = 0;
for (const { name, fn } of cases) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}\n${error.stack ?? error.message}`);
  }
}
if (failed > 0) {
  console.error(`${failed}/${cases.length} release-gate self-tests failed.`);
  process.exitCode = 1;
} else {
  console.log(`${cases.length}/${cases.length} release-gate self-tests passed.`);
}

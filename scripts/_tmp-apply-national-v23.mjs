import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REFERENCE = "2026-08-24T22:38:32+09:00";
const RELEASE = "20260824-2238";

function path(relative) { return resolve(ROOT, relative); }
function read(relative) { return readFileSync(path(relative), "utf8"); }
function write(relative, value) { writeFileSync(path(relative), value.endsWith("\n") ? value : `${value}\n`); }
function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`missing patch anchor: ${label}`);
  return text.replace(from, to);
}

// Keep the previously completed municipal audit on the same release reference.
{
  const relative = "municipal-support-audit.json";
  const data = JSON.parse(read(relative));
  data.reference_at = REFERENCE;
  data.checked_at = REFERENCE;
  data.release_id = RELEASE;
  write(relative, JSON.stringify(data, null, 2));
}

// Build pipeline: national audit is generated after municipal and before page metadata.
{
  const relative = "package.json";
  const pkg = JSON.parse(read(relative));
  pkg.scripts["sync:national-support"] = "node scripts/sync-national-support-audit.mjs";
  pkg.scripts["validate:national-support"] = "node scripts/validate-national-support-audit.mjs";
  pkg.scripts.build = "npm run generate:volunteer && npm run generate:current-shelter-data && npm run sync:municipal-support && npm run sync:national-support && npm run sync:page-metadata && npm run validate:dashboard && npm run validate:current-state && npm run validate:timeline && npm run validate:volunteer && npm run validate:shelters && npm run validate:current-shelters && npm run validate:municipal-support && npm run validate:national-support && node scripts/build-sites.mjs && npm run validate:dist";
  write(relative, JSON.stringify(pkg, null, 2));
}

// Release Gate: national audit is a sensitive timepoint artifact and mandatory on every refresh.
{
  const relative = "scripts/validate-update-release.mjs";
  let text = read(relative);
  text = replaceOnce(text,
    "  /^municipal-support-audit\\.json$/u,\n",
    "  /^municipal-support-audit\\.json$/u,\n  /^national-support-audit\\.json$/u,\n",
    "national sensitive path");
  const municipalFunction = `function validateMunicipalSupportAudit() {\n  const validatorPath = resolve(ROOT, \"scripts\", \"validate-municipal-support-audit.mjs\");\n  if (!existsSync(validatorPath)) fail(\"scripts/validate-municipal-support-audit.mjsがありません。\");\n  if (!existsSync(resolve(ROOT, \"municipal-support-audit.json\"))) fail(\"municipal-support-audit.jsonがありません。時点修正では対口支援・他自治体支援の全件再監査が必須です。\");\n  try {\n    execFileSync(process.execPath, [validatorPath], { cwd: ROOT, encoding: \"utf8\", stdio: [\"ignore\", \"pipe\", \"pipe\"] });\n  } catch (error) {\n    fail(\`対口支援・他自治体支援の全件再監査validatorが失敗しました。\${error.stderr || error.stdout || error.message}\`);\n  }\n  return true;\n}\n`;
  if (!text.includes(municipalFunction)) throw new Error("missing municipal validator function anchor");
  const nationalFunction = `${municipalFunction}\nfunction validateNationalSupportAudit() {\n  const validatorPath = resolve(ROOT, \"scripts\", \"validate-national-support-audit.mjs\");\n  if (!existsSync(validatorPath)) fail(\"scripts/validate-national-support-audit.mjsがありません。\");\n  if (!existsSync(resolve(ROOT, \"national-support-audit.json\"))) fail(\"national-support-audit.jsonがありません。時点修正では国・関係機関支援の全件再監査が必須です。\");\n  try {\n    execFileSync(process.execPath, [validatorPath], { cwd: ROOT, encoding: \"utf8\", stdio: [\"ignore\", \"pipe\", \"pipe\"] });\n  } catch (error) {\n    fail(\`国・関係機関支援の全件再監査validatorが失敗しました。\${error.stderr || error.stdout || error.message}\`);\n  }\n  return true;\n}\n`;
  text = text.replace(municipalFunction, nationalFunction);
  text = replaceOnce(text,
    "  if (conflicts !== undefined && conflicts !== 0) fail(`UPDATE_LEDGERがcoordinate conflictを含みます: ${conflicts}`);\n}",
    "  if (conflicts !== undefined && conflicts !== 0) fail(`UPDATE_LEDGERがcoordinate conflictを含みます: ${conflicts}`);\n  if (ledger.update_type === \"timepoint_refresh\" && ledger.coverage?.municipal_support !== \"audited\") fail(\"timepoint_refreshではcoverage.municipal_support=auditedが必須です。\");\n  if (ledger.update_type === \"timepoint_refresh\" && ledger.coverage?.national_support !== \"audited\") fail(\"timepoint_refreshではcoverage.national_support=auditedが必須です。\");\n}",
    "ledger audit coverage");
  text = replaceOnce(text,
    "validateMunicipalSupportAudit();\nconst currentShelter",
    "validateMunicipalSupportAudit();\nvalidateNationalSupportAudit();\nconst currentShelter",
    "national validator invocation");
  text = replaceOnce(text,
    "  municipal_support_checked: true,\n}));",
    "  municipal_support_checked: true,\n  national_support_checked: true,\n}));",
    "release output national checked");
  write(relative, text);
}

// Release Gate self-tests: stale audit, omission and UNKNOWN-old-current are failure injections.
{
  const relative = "scripts/test-release-gate.mjs";
  let text = read(relative);
  text = replaceOnce(text,
    "  \"scripts/validate-municipal-support-audit.mjs\",\n  \"municipal-support-audit.json\",",
    "  \"scripts/validate-municipal-support-audit.mjs\",\n  \"scripts/validate-national-support-audit.mjs\",\n  \"municipal-support-audit.json\",\n  \"national-support-audit.json\",",
    "self-test national fixture");
  const anchor = `test(\"blocking unresolved is blocked\", () => {`;
  if (!text.includes(anchor)) throw new Error("self-test insertion anchor missing");
  const tests = `test(\"stale national-support audit is blocked\", () => {\n  const root = prepare();\n  try {\n    const auditPath = resolve(root, \"national-support-audit.json\");\n    const audit = JSON.parse(readFileSync(auditPath, \"utf8\"));\n    audit.reference_at = \"2000-01-01T00:00:00+09:00\";\n    audit.checked_at = \"2000-01-01T00:00:00+09:00\";\n    writeFileSync(auditPath, \`\${JSON.stringify(audit, null, 2)}\\n\`);\n    const result = runNode(root, \"scripts/validate-update-release.mjs\");\n    expectFailure(\"stale national audit\", result, /国・関係機関|national|reference_at|全件再監査/u);\n  } finally { rmSync(root, { recursive: true, force: true }); }\n});\n\ntest(\"national record omission is blocked\", () => {\n  const root = prepare();\n  try {\n    const auditPath = resolve(root, \"national-support-audit.json\");\n    const audit = JSON.parse(readFileSync(auditPath, \"utf8\"));\n    audit.records = audit.records.filter((item) => item.record_id !== \"national-water\");\n    audit.inventory.audit_record_count = audit.records.length;\n    audit.summary.records_total = audit.records.length;\n    audit.summary.CURRENT -= 1;\n    writeFileSync(auditPath, \`\${JSON.stringify(audit, null, 2)}\\n\`);\n    const result = runNode(root, \"scripts/validate-update-release.mjs\");\n    expectFailure(\"national omission\", result, /未裁定|監査対象|national-water|全件再監査/u);\n  } finally { rmSync(root, { recursive: true, force: true }); }\n});\n\ntest(\"UNKNOWN national old snapshot as current is blocked\", () => {\n  const root = prepare();\n  try {\n    const auditPath = resolve(root, \"national-support-audit.json\");\n    const audit = JSON.parse(readFileSync(auditPath, \"utf8\"));\n    const target = audit.records.find((item) => item.record_id === \"national-rescue\");\n    target.display.scale = target.previous_snapshot.value;\n    writeFileSync(auditPath, \`\${JSON.stringify(audit, null, 2)}\\n\`);\n    const result = runNode(root, \"scripts/validate-update-release.mjs\");\n    expectFailure(\"unknown national old current\", result, /UNKNOWN|旧スナップショット|current scale|国・関係機関/u);\n  } finally { rmSync(root, { recursive: true, force: true }); }\n});\n\n`;
  text = text.replace(anchor, `${tests}${anchor}`);
  write(relative, text);
}

// CI syntax coverage for the new permanent scripts.
{
  const relative = ".github/workflows/validate-update.yml";
  let text = read(relative);
  text = replaceOnce(text,
    "          node --check scripts/test-release-gate.mjs\n",
    "          node --check scripts/test-release-gate.mjs\n          node --check scripts/sync-national-support-audit.mjs\n          node --check scripts/validate-national-support-audit.mjs\n",
    "CI national syntax checks");
  write(relative, text);
}

// Post-deploy smoke must assert the national audit overlay and reject the legacy current wording.
{
  const relative = ".github/workflows/post-deploy-pages-smoke.yml";
  let text = read(relative);
  text = replaceOnce(text,
    "          grep -F './ehime_kumamoto_support_geocoded_shelters_20260802.html' /tmp/root.html\n",
    "          grep -F './ehime_kumamoto_support_geocoded_shelters_20260802.html' /tmp/root.html\n          grep -F 'NATIONAL_SUPPORT_AUDIT_START' \"$deployed\"\n          grep -F '8月24日22:38に既存12レコードを全件再監査' \"$deployed\"\n          grep -F '国交省第48報・8月23日7時30分時点' \"$deployed\"\n          grep -F '8/2 約100人・4機はHISTORICAL' \"$deployed\"\n          if grep -F '8月2日公表値・継続要確認' \"$deployed\"; then\n            echo \"::error title=Stale national support::Legacy rescue current wording is still deployed.\"\n            exit 1\n          fi\n",
    "post deploy national smoke");
  write(relative, text);
}

// Operation manual Version 2.3 and mandatory national full-audit section.
{
  const relative = "時点修正更新オペレーション.md";
  let text = read(relative);
  text = replaceOnce(text,
    "> Version 2.2（2026-08-24改訂）",
    "> Version 2.3（2026-08-24改訂）",
    "operation version");
  text = text.replace("> Version 2.1.1のRelease Gateに加え、", "> Version 2.2までのRelease Gateに加え、国・関係機関支援の全件再監査を恒久化する。\n>\n> ");
  const section9 = "## 9. 現在避難所 candidateフロー";
  if (!text.includes(section9)) throw new Error("operation section 9 anchor missing");
  const section82 = `### 8.2 国・関係機関支援の全件再監査（必須）\n\n全ての\`timepoint_refresh\`で、\`provider: national\`および画面上「国・関係機関」に分類する全国組織を独立した更新対象として全件再監査する。対象は固定リストだけでなく、現行ダッシュボードのコードから機械的に抽出し、内閣府、消防庁、国土交通省、厚生労働省、防衛省、警察庁、その他現行表示に存在する国機関、日本赤十字社・JMAT・JRAT等の全国組織を漏れなく確認する。\n\n監査結果は\`national-support-audit.json\`へ保存し、\`reference_at\`と\`release_id\`をページおよびUPDATE_LEDGERと一致させる。\`scripts/sync-national-support-audit.mjs\`を唯一の生成経路とし、\`scripts/validate-national-support-audit.mjs\`を通常buildとRelease Gateの双方から必ず実行する。\n\n必須ルール：\n\n- 古い資料の値を「最新要確認」「継続要確認」だけでCURRENT表示しない。現在状態を確定できなければUNKNOWNとし、旧値はHISTORICALとしてのみ保持する。\n- 派遣予定・出発予定・予定期間内であることだけを根拠にCURRENTへ昇格しない。実働確認前はPLANNEDとする。\n- 最新発表がないこと、404、検索結果がないことを終了根拠にしない。終了・撤収・活動完了を公式に確認できた場合だけHISTORICALへ移す。\n- 過去累計値と現在活動人数を同一指標として扱わない。TEC-FORCE等は「現時点人数」と「累計人日」を明確に分離する。\n- 省庁ごとに\`source_as_of\`が異なる値を、同一時点の全国集計のように表示しない。監査時点\`reference_at\`と資料対象時点\`source_as_of\`を別表示する。\n- CURRENTの最終根拠は原則として一次情報とし、二次情報は一次資料発見・クロスチェック用途に限定する。\n- 愛媛県由来は愛媛県支援、自治体由来は\`municipal-support-audit.json\`へ分離し、national側へ二重計上しない。\n\n全てのtimepoint refreshは、\`municipal-support-audit.json\`と\`national-support-audit.json\`の双方が最新\`reference_at\`と一致し、各validatorがPASSしなければ完了扱いにしない。\n\n実装上は次を必須とする。\n\n\`\`\`sh\nnpm run sync:municipal-support\nnpm run sync:national-support\nnpm run validate:municipal-support\nnpm run validate:national-support\n\`\`\`\n\nRelease Gateは\`national_support_checked: true\`を出力し、監査ファイル欠落、reference_at不一致、既存nationalレコードの未裁定、CURRENTの一次情報不足、UNKNOWN旧スナップショットのcurrent表示、HISTORICAL/PLANNEDの現況誤表示をFAILさせる。\n\n`;
  text = text.replace(section9, `${section82}${section9}`);
  write(relative, text);
}

console.log(JSON.stringify({status:"PASS", reference_at:REFERENCE, release_id:RELEASE}));

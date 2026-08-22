import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractPageRecheckMeta, syncCurrentPageMetadata } from "./current-page-metadata.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const sourcePath = resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const publicPath = resolve(root, "public", "dashboard.html");

const sourceBefore = await readFile(sourcePath, "utf8");
const publicBefore = await readFile(publicPath, "utf8");
if (sourceBefore !== publicBefore) throw new Error("同期前のsource/public HTMLが一致していません。");
const pageMeta = extractPageRecheckMeta(sourceBefore);
const sourceAfter = syncCurrentPageMetadata(sourceBefore, pageMeta);
const publicAfter = syncCurrentPageMetadata(publicBefore, pageMeta);
if (sourceAfter !== publicAfter) throw new Error("同期後のsource/public HTMLが一致しません。");
await writeFile(sourcePath, sourceAfter, "utf8");
await writeFile(publicPath, sourceAfter, "utf8");

console.log(JSON.stringify({
  checkedAt: pageMeta.checkedAt,
  volunteerCheckedAt: pageMeta.volunteerCheckedAt || pageMeta.checkedAt,
  sourceChanged: sourceAfter !== sourceBefore,
  sourcePublicParity: true,
}));

import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
copyFileSync(join(root, "public", "dashboard.html"), join(output, "index.html"));

console.log("Built dist/index.html from the verified dashboard source.");

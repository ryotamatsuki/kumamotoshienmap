import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const metadataDirectory = join(root, "dist", ".openai");

mkdirSync(metadataDirectory, { recursive: true });
copyFileSync(
  join(root, ".openai", "hosting.json"),
  join(metadataDirectory, "hosting.json"),
);

console.log("Copied Sites metadata into the vinext deployment artifact.");

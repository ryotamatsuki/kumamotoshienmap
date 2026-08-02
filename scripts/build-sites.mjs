import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const originalPath = join(
  root,
  "ehime_kumamoto_support_geocoded_shelters_20260802.html",
);
const publicPath = join(root, "public", "dashboard.html");
const original = readFileSync(originalPath);
const dashboard = readFileSync(publicPath);

if (!original.equals(dashboard)) {
  throw new Error("The published dashboard does not match the reviewed source.");
}

const output = join(root, "dist");
const serverDirectory = join(output, "server");
const metadataDirectory = join(output, ".openai");
const dashboardText = dashboard.toString("utf8");
const workerSource = `const dashboard = ${JSON.stringify(dashboardText)};

const htmlHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Language": "ja",
  "Cache-Control": "private, no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const isDashboard = url.pathname === "/" || url.pathname === "/dashboard.html";

    if (!isDashboard) {
      return new Response("Not Found", { status: 404 });
    }

    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers: htmlHeaders });
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    return new Response(dashboard, { status: 200, headers: htmlHeaders });
  },
};
`;

rmSync(output, { recursive: true, force: true });
mkdirSync(serverDirectory, { recursive: true });
mkdirSync(metadataDirectory, { recursive: true });
writeFileSync(join(serverDirectory, "index.js"), workerSource, "utf8");
copyFileSync(publicPath, join(output, "dashboard.html"));
copyFileSync(
  join(root, ".openai", "hosting.json"),
  join(metadataDirectory, "hosting.json"),
);

console.log("Built a Sites worker that serves the verified dashboard unchanged.");

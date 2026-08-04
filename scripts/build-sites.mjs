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
const volunteerCss = readFileSync(join(root, "volunteer.css"), "utf8");
const volunteerData = readFileSync(join(root, "volunteer-data.js"), "utf8");
const volunteerApp = readFileSync(join(root, "volunteer.js"), "utf8");

if (!original.equals(dashboard)) {
  throw new Error("The published dashboard does not match the reviewed source.");
}

const output = join(root, "dist");
const serverDirectory = join(output, "server");
const metadataDirectory = join(output, ".openai");
const workerConfigPath = join(output, "wrangler.json");
const dashboardText = dashboard.toString("utf8");
const workerSource = `const dashboard = ${JSON.stringify(dashboardText)};
const volunteerCss = ${JSON.stringify(volunteerCss)};
const volunteerData = ${JSON.stringify(volunteerData)};
const volunteerApp = ${JSON.stringify(volunteerApp)};

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
    const assets = {
      "/volunteer.css": [volunteerCss, "text/css; charset=utf-8"],
      "/volunteer-data.js": [volunteerData, "text/javascript; charset=utf-8"],
      "/volunteer.js": [volunteerApp, "text/javascript; charset=utf-8"],
    };

    if (url.pathname === "/favicon.ico") {
      return new Response(null, {
        status: 204,
        headers: { ...htmlHeaders, "Cache-Control": "public, max-age=86400" },
      });
    }

    if (!isDashboard && !assets[url.pathname]) {
      return new Response("Not Found", { status: 404 });
    }

    if (assets[url.pathname]) {
      const [body, contentType] = assets[url.pathname];
      if (request.method === "HEAD") {
        return new Response(null, { status: 200, headers: { ...htmlHeaders, "Content-Type": contentType } });
      }
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
      }
      return new Response(body, { status: 200, headers: { ...htmlHeaders, "Content-Type": contentType } });
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
writeFileSync(join(serverDirectory, "index.mjs"), workerSource, "utf8");
writeFileSync(
  workerConfigPath,
  `${JSON.stringify(
    {
      $schema: "node_modules/wrangler/config-schema.json",
      main: "server/index.mjs",
      compatibility_date: "2026-08-04",
    },
    null,
    2,
  )}\n`,
  "utf8",
);
copyFileSync(publicPath, join(output, "dashboard.html"));
copyFileSync(join(root, "volunteer.css"), join(output, "volunteer.css"));
copyFileSync(join(root, "volunteer-data.js"), join(output, "volunteer-data.js"));
copyFileSync(join(root, "volunteer.js"), join(output, "volunteer.js"));
copyFileSync(
  join(root, ".openai", "hosting.json"),
  join(metadataDirectory, "hosting.json"),
);

console.log("Built a Sites worker that serves the verified dashboard unchanged.");

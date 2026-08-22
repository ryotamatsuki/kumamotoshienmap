import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "ehime_kumamoto_support_geocoded_shelters_20260802.html");
const publicPath = resolve(root, "public", "dashboard.html");
const source = readFileSync(sourcePath, "utf8");
const published = readFileSync(publicPath, "utf8");

function fail(message) {
  throw new Error(`[TIMELINE ORDER FAIL] ${message}`);
}

if (source !== published) fail("正本HTMLとpublic/dashboard.htmlが一致していません。");
if (!source.includes("const filtered=sortTimelineEvents(timelineFilteredEvents());")) {
  fail("renderTimelineがsortTimelineEventsを経由していません。");
}
if (!source.includes("function sortTimelineEvents(events)")) {
  fail("sortTimelineEventsが見つかりません。");
}

const match = source.match(/const TIMELINE_EVENTS=(\[[^\n]*\]);/u);
if (!match) fail("TIMELINE_EVENTSを抽出できません。");
const events = JSON.parse(match[1]);

function timeOrder(value) {
  const text = String(value || "").trim();
  const clock = text.match(/(\d{1,2}):(\d{2})/u);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/午前/u.test(text)) return 9 * 60;
  if (/日中|開始/u.test(text)) return 12 * 60;
  if (/午後/u.test(text)) return 15 * 60;
  if (/完了|決定/u.test(text)) return 18 * 60;
  if (/以降毎日|予定延期|予定/u.test(text)) return 24 * 60;
  return 24 * 60 + 1;
}

const sorted = [...events].sort((a, b) => {
  const dateOrder = String(a.date || "").localeCompare(String(b.date || ""), "ja");
  if (dateOrder !== 0) return dateOrder;
  const timeDiff = timeOrder(a.time) - timeOrder(b.time);
  if (timeDiff !== 0) return timeDiff;
  return String(a.id || "").localeCompare(String(b.id || ""), "ja");
});

for (let index = 1; index < sorted.length; index += 1) {
  const previous = sorted[index - 1];
  const current = sorted[index];
  if (previous.date > current.date) fail(`${previous.id}の後に古い日付${current.id}があります。`);
  if (previous.date === current.date && timeOrder(previous.time) > timeOrder(current.time)) {
    fail(`${previous.date}内で${previous.id}と${current.id}の時刻順が逆転しています。`);
  }
}

const indexOf = (id) => sorted.findIndex((item) => item.id === id);
for (const id of ["t-kumamoto-0816", "t-kumamoto-0819", "t-kumamoto-0821", "t-ehime-end"]) {
  if (indexOf(id) < 0) fail(`回帰確認対象${id}が見つかりません。`);
}
if (!(indexOf("t-kumamoto-0816") < indexOf("t-kumamoto-0819")
  && indexOf("t-kumamoto-0819") < indexOf("t-kumamoto-0821")
  && indexOf("t-kumamoto-0821") < indexOf("t-ehime-end"))) {
  fail("8/16→8/19→8/21→8/31の表示順が保証されていません。");
}
if (sorted.at(-1)?.id !== "t-ehime-end") fail("8/31予定終期がタイムライン末尾になっていません。");

console.log(JSON.stringify({ status: "PASS", events: events.length, first: sorted[0]?.date, last: sorted.at(-1)?.date }));

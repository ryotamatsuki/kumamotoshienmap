import { readFile, writeFile } from "node:fs/promises";

const checkedAt = "2026-08-13T13:14:31+09:00";
const files = ["research_official_north.json", "research_official_south.json"];
const sourceUpdates = {
  "熊本市": { url: "https://www.kumamoto-city-csw.or.jp/%E3%80%90%E7%AC%AC1%E6%9C%9F%E3%80%80%E3%83%9C%E3%83%A9%E3%83%B3%E3%83%86%E3%82%A3%E3%82%A2%E8%BF%BD%E5%8A%A0%E5%8B%9F%E9%9B%86%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6%E3%80%91/", updated: "2026-08-07" },
  "八代市": { url: "https://www.yatsushiro-shakyo.jp/homepage_new/R08_saigai_vc_volunteer.html", updated: "2026-08-10" },
  "宇土市": { url: "https://www.utoshakyou.jp/volunteer_2026.html", updated: "2026-08-09" },
  "宇城市": { url: "https://www.shakyou-uki.jp/oshirase/12239-2/", updated: "2026-08-13" },
  "美里町": { url: "https://misatoshakyo.or.jp/pages/455/", updated: null },
  "御船町": { url: "https://mifune-shakyo.jp/pages/51/detail%3D1/b_id%3D269/r_id%3D55#block269-55", updated: null },
  "嘉島町": { url: "https://kashima-shakyo.or.jp/publics/index/1/detail%3D1/b_id%3D1/r_id%3D127", updated: "2026-08-05" },
  "益城町": { url: "https://www.mashiki-shakyo.or.jp/news/2010/", updated: "2026-08-06" },
  "甲佐町": { url: "https://kosa-shakyo.or.jp/pages/50/", updated: null },
  "氷川町": { url: "https://hikawa-syakyo.jp/news/%e7%81%bd%e5%ae%b3%e3%83%9c%e3%83%a9%e3%83%b3%e3%83%86%e3%82%a3%e3%82%a2%e5%8B%9f%e9%9b%86%e3%81%ae%e3%81%8a%e7%9f%a5%e3%82%89%e3%81%9b%e3%80%90%ef%bc%98-%ef%bc%91%ef%bc%94%ef%bd%9e%ef%bc%92%０/", updated: "2026-08-09" },
  "芦北町": { url: "https://www.ashikita-shakyo.com/news/%e7%81%bd%e5%ae%b3%e3%83%9c%e3%83%a9%e3%83%b3%e3%83%86%e3%82%a3%e3%82%a2%e5%8B%9F%E9%9B%86%E7%B5%82%E4%BA%86%E3%81%AE%E3%81%8A%E7%9F%A5%E3%82%89%E3%81%9B/", updated: "2026-08-10" },
};
const changes = {
  "宇土市": { status: "受付終了・詳細要確認", dates: "第2期：8月13日～19日、70人程度／日、全国募集。公式申込フォームは8月13日確認時に回答受付終了だが、理由は公表されていないため定員到達とは断定しない。5人以上の団体は個別照会。", cap: 70, formStatus: "受付終了（理由未公表）", recheck: "差分あり", note: "公式ページは第2期70人程度／日・全国募集を掲載。申込フォームは回答受付終了だが理由不明のため定員到達とは扱わない。", previous: "募集中（第2期・50人程度／日）", change: "受入目安を70人程度／日に更新。フォームは回答受付終了（理由未公表）。", form: "https://forms.gle/FCwVAHmc4htUM5Au8" },
  "宇城市": { status: "受付終了・次回日程要確認", dates: "8月15日～23日の日別申込を掲載。8月13日確認時点で各公表日の定員到達・締切を確認。団体フォームは掲載されているが、参加確定ではない。", recheck: "差分あり", note: "8月13日公式告知で当日受付終了を確認。8月15～23日の個人受付は各日定員到達・締切。次回日程は要確認。", previous: "募集中（一部日定員到達）", change: "8月13日確認で当日受付終了。公表済み日程は定員到達・締切として更新。", form: "https://www.shakyou-uki.jp/oshirase/12239-2/" },
  "美里町": { status: "募集休止（定員到達）", dates: "申込み定員に達したため募集休止。再開日・活動期間・定員数は未公表。", recheck: "変更なし・要再確認", note: "8月13日公式ページで募集休止を再確認。再開日は未公表。", previous: "募集休止（定員到達）", change: "変更なし。公式ページを再確認。" },
  "御船町": { status: "募集中（8月16日～22日・人数上限あり）", dates: "8月14日～15日は活動休止。8月16日～22日は事前登録を受付。人数上限はあるが数値は未公表。", recheck: "差分あり", note: "8月13日確認で8月16～22日の事前登録を確認。8月14～15日は休止。団体・県外・大型バス・宿泊条件は要再確認。", previous: "定員到達", change: "8月16～22日を事前登録受付へ補正。8月14～15日は休止。", form: "https://mifune-shakyo.jp/pages/51/detail%3D1/b_id%3D269/r_id%3D55#block269-55" },
  "嘉島町": { status: "情報未確認（前回値保持）", dates: "公式サイトはTLSエラーで8月13日時点の再取得不能。前回確認値は8月11～16日活動休止、8月17日以降未確認。", recheck: "確認できず", note: "公式サイトのTLSエラーで再取得できず。募集再開・団体・県外・大型バス・保険条件は要再確認。募集なしとは判定しない。", previous: "活動休止（8月11～16日）", change: "再取得不能。前回値を保持し、募集なしとは判定しない。" },
  "益城町": { status: "活動休止・8月17日以降要再確認", dates: "8月11日～16日は活動休止。8月17日以降は再開予定だが、募集日・申込方法・人数は8月13日確認時点で未公表。", recheck: "確認できず", note: "8月17日以降の募集詳細は未公表。前回の70人程度／日・全国募集は保持するが、現行受付とは扱わない。", previous: "一時休止", change: "8月17日以降は再開予定だが募集詳細未公表。" },
  "甲佐町": { status: "受付終了・団体は要調整", dates: "活動日は8月13・14・17～21日、8月15～16日は活動なし。個人フォームは8月13～18日受付終了、8月19～21日は選択可能だったが、8月13日確認時点で回答受付終了。5人以上団体は個別調整。", recheck: "差分あり", note: "8月13日確認で個人フォーム回答受付終了を確認。九州圏内募集、団体は個別調整。", previous: "募集中（一部日受付終了）", change: "個人フォームを受付終了（理由未公表）へ更新。" },
  "氷川町": { status: "受付終了・活動状況要確認", dates: "8月13日は休所、8月14～20日は募集日程（8月17日は休止）。フォームは8月13日確認時点で回答受付終了、理由は未公表。", recheck: "差分あり", note: "8月13日確認で8月13日休所とフォーム回答受付終了を確認。定員・団体・大型バス・宿泊・保険条件は要再確認。", previous: "受付終了・活動状況要確認", change: "8月13日休所を明記。フォーム受付終了は理由未公表のまま保持。" },
  "芦北町": { status: "募集終了・8月17日以降要再確認", dates: "一般募集は8月10日で終了。8月11～12日は事前登録団体のみ、8月13～16日は活動休止、8月17日に通常VCへ移行予定。移行後の条件は未公表。", recheck: "差分あり", note: "8月10日公式終了告知を再確認。8月13～16日休止、8月17日通常VC移行予定。移行後条件は要再確認。", previous: "募集終了", change: "8月13～16日の休止と8月17日通常VC移行予定を更新。" },
};
sourceUpdates["氷川町"].url = "https://hikawa-syakyo.jp/news/%E7%81%BD%E5%AE%B3%E3%83%9C%E3%83%A9%E3%83%B3%E3%83%86%E3%82%A3%E3%82%A2%E5%8B%9F%E9%9B%86%E3%81%AE%E3%81%8A%E7%9F%A5%E3%82%89%E3%81%9B%E3%80%90%EF%BC%98-%EF%BC%91%EF%BC%94%EF%BD%9E%EF%BC%92%EF%BC%90%E3%80%91/";

for (const file of files) {
  const data = JSON.parse(await readFile(file, "utf8"));
  data.checked_at = checkedAt;
  for (const source of data.municipalities.flatMap((center) => center.sources || [])) source.checked_at = checkedAt;
  for (const center of data.municipalities) {
    const source = sourceUpdates[center.municipality];
    const update = changes[center.municipality];
    center.checked_at = checkedAt;
    center.needs_reconfirmation = true;
    if (source) {
      center.official_source_url = source.url;
      center.source_updated_at = source.updated;
      for (const item of center.sources || []) {
        item.checked_at = checkedAt;
        if (item.url === source.url) item.updated_at = source.updated;
      }
    }
    if (!update) continue;
    center.recruitment_status = update.status;
    center.activity_dates_text = update.dates;
    center.recheck_status = update.recheck;
    center.recheck_note = update.note;
    center.previous_known_state = update.previous;
    center.change_from_previous = update.change;
    center.change_status = update.recheck === "確認できず" ? "確認できず" : update.recheck.includes("差分") ? "募集状況更新" : "変更なし・要再確認";
    if (update.cap !== undefined) center.daily_capacity = update.cap;
    if (update.formStatus !== undefined) center.application_form_status = update.formStatus;
    if (update.form) center.application_url = update.form;
  }
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const statewidePath = "research_official_statewide.json";
const statewide = JSON.parse(await readFile(statewidePath, "utf8"));
statewide.checked_at = checkedAt;
for (const source of statewide.sources || []) source.checked_at = checkedAt;
if (statewide.statewide_facts) {
  statewide.statewide_facts.checked_at = checkedAt;
  statewide.statewide_facts.latest_checked_at = checkedAt;
}
await writeFile(statewidePath, `${JSON.stringify(statewide, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ checkedAt, files: [...files, statewidePath] }));

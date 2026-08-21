import { readFile, writeFile } from "node:fs/promises";

const checkedAt = "2026-08-21T15:00:00+09:00";
const root = new URL("../", import.meta.url);
const paths = {
  north: new URL("research_official_north.json", root),
  south: new URL("research_official_south.json", root),
  statewide: new URL("research_official_statewide.json", root),
};

const [north, south, statewide] = await Promise.all(
  Object.values(paths).map(async (path) => JSON.parse(await readFile(path, "utf8"))),
);
const centers = [...north.municipalities, ...south.municipalities];
const center = (name) => {
  const value = centers.find((item) => item.municipality === name);
  if (!value) throw new Error(`Missing municipality: ${name}`);
  return value;
};
const source = (publisher, title, url, facts) => ({
  publisher,
  title,
  url,
  published_at: null,
  updated_at: null,
  checked_at: checkedAt,
  facts_used: facts,
});
function addSource(target, entry) {
  target.sources = Array.isArray(target.sources) ? target.sources : [];
  if (!target.sources.some((item) => item.url === entry.url)) target.sources.unshift(entry);
  else target.sources = target.sources.map((item) => item.url === entry.url ? { ...item, ...entry } : item);
}
function dedupeSources(target) {
  const byUrl = new Map();
  for (const item of Array.isArray(target.sources) ? target.sources : []) byUrl.set(item.url, item);
  target.sources = [...byUrl.values()];
}
function touchChecked(value) {
  if (Array.isArray(value)) return value.forEach(touchChecked);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "checked_at" && typeof child === "string") value[key] = checkedAt;
    else touchChecked(child);
  }
}
function update(name, values) {
  Object.assign(center(name), values, { checked_at: checkedAt, needs_reconfirmation: true });
}

touchChecked(north);
touchChecked(south);
touchChecked(statewide);
north.checked_at = checkedAt;
north.scope = "令和8年熊本地震・災害ボランティア公式一次情報（熊本市、宇土市、宇城市、美里町、御船町、嘉島町）・2026年8月21日再確認";
south.checked_at = checkedAt;
south.scope = "令和8年熊本地震・災害ボランティア公式一次情報（益城町、甲佐町、八代市、氷川町、芦北町）・2026年8月21日再確認";
statewide.checked_at = checkedAt;
statewide.statewide_facts.checked_at = checkedAt;
statewide.statewide_facts.latest_checked_at = checkedAt;

update("熊本市", {
  recheck_status: "変更なし・要再確認",
  recheck_note: "8月21日に公式告知を再確認。第2期8月16～23日は両拠点とも必要人数到達で締切。8月24日以降の再告知は未発表で、募集なしとは判定しない。",
  change_status: "第2期募集締切・8月24日以降未発表",
  change_from_previous: "第2期8月16～23日は必要人数到達で締切。8月24日以降は住民ニーズに応じて再告知予定だが、現時点で新告知なし。",
  remarks: "第2期締切は公式告知に基づく。8月24日以降は未発表のため、募集中・募集なしのいずれにも推測しない。",
});
addSource(center("熊本市"), source("熊本市社会福祉協議会", "８/１３時点での第２期ボランティア募集状況のお知らせ", center("熊本市").official_source_url, "第2期8月16～23日の必要人数到達による締切、8月24日以降の再告知予定"));

update("宇土市", {
  recruitment_status: "募集中（第3期・8月20日～27日・8月25～26日活動なし・全国）",
  activity_start_date: "2026-08-20",
  activity_end_date: "2026-08-27",
  activity_dates_text: "第3期は8月20日～27日。8月25日・26日は活動中止。個人は全国から募集し、団体は5人以上・8月28日～9月6日の別日程で事前調整する。",
  activity_windows: [
    { start_date: "2026-08-20", end_date: "2026-08-27", status: "募集中", form_status: "個人申込フォーム掲載" },
    { start_date: "2026-08-28", end_date: "2026-09-06", status: "団体受付", form_status: "5人以上・団体事前調整" },
  ],
  group_allowed: true,
  group_application_available: true,
  application_url: "https://www.utoshakyou.jp/volunteer_2026.html",
  application_urls: { individual: "https://forms.gle/FCwVAHmc4htUM5Au8", group: "https://www.utoshakyou.jp/volunteer_2026.html" },
  application_method: "個人は公式申込フォーム。団体は5人以上を対象に公式ページの案内から事前調整。8月25・26日は活動なし。",
  application_deadline: "個人は定員に達し次第終了。団体は8月28日～9月6日の日程を要調整。",
  application_form_status: "第3期個人フォーム掲載・団体5人以上の事前調整",
  official_source_title: "災害ボランティア第3期募集のお知らせ",
  source_updated_at: null,
  recheck_status: "差分あり",
  recheck_note: "8月21日に公式ページを再確認。個人8月20～27日、8月25・26日休止、団体5人以上8月28日～9月6日の案内を反映。",
  change_status: "第3期・団体日程更新",
  previous_known_state: "募集中（第2期・8月13日～19日）",
  change_from_previous: "第2期から第3期へ更新。個人の活動日、休止日、5人以上団体の別日程を分離表示。",
  remarks: "全国募集は個人参加の条件。団体は5人以上の事前調整で、愛媛県団体の参加確定とは扱わない。",
  ehime_dispatch_status: "全国募集（個人）・団体は5人以上の個別調整",
});
addSource(center("宇土市"), source("宇土市社会福祉協議会", "災害ボランティア第3期募集のお知らせ", "https://www.utoshakyou.jp/volunteer_2026.html", "個人8月20～27日、8月25・26日活動なし、団体5人以上8月28日～9月6日"));

update("宇城市", {
  recruitment_status: "募集中（8月20日～24日・26日～31日・事前申込）",
  activity_start_date: "2026-08-20",
  activity_end_date: "2026-08-31",
  activity_dates_text: "8月20日～24日、26日～31日は日別の事前申込を受付。8月25日は活動なし。団体申込は一時休止で、個人の申込みと参加確定を分けて表示する。",
  activity_windows: [
    { start_date: "2026-08-20", end_date: "2026-08-24", status: "募集中", form_status: "個人日別フォーム" },
    { start_date: "2026-08-26", end_date: "2026-08-31", status: "募集中", form_status: "個人日別フォーム" },
  ],
  group_allowed: false,
  group_application_available: false,
  application_method: "個人の日別公式事前申込フォーム。8月25日は活動なし。団体申込は一時休止。",
  application_form_status: "個人8月20～24日・26～31日受付、団体申込は一時休止",
  source_updated_at: null,
  recheck_status: "差分あり",
  recheck_note: "8月21日に公式告知を再確認。個人8月20～24日・26～31日、8月25日休止、団体申込一時休止を反映。",
  change_status: "募集日程・団体受付更新",
  previous_known_state: "募集中（8月17日～24日・26日～31日）",
  change_from_previous: "活動日を8月20日～24日・26日～31日に更新し、団体申込は一時休止へ変更。",
  remarks: "日別フォームの受付状況は変動するため、申込み前に公式ページを再確認する。全国募集の過去情報は現行の団体受入を意味しない。",
  ehime_dispatch_status: "個人募集・団体申込一時休止",
});
addSource(center("宇城市"), source("宇城市社会福祉協議会", "ボランティア活動へ参加を希望される方へ（8月20日以降）", "https://www.shakyou-uki.jp/oshirase/12239-2/", "個人8月20～24日・26～31日、8月25日休止、団体申込一時休止"));

update("美里町", {
  center_status: "開設・活動中",
  recruitment_status: "募集案内掲載（8月22日～30日・各日約40人、現行フォーム受付終了）",
  activity_start_date: "2026-08-22",
  activity_end_date: "2026-08-30",
  activity_dates_text: "8月22日～30日を各日約40人で募集。日別の受付状況、対象地域、団体条件は公式ページで確認する。",
  activity_windows: [{ start_date: "2026-08-22", end_date: "2026-08-30", status: "募集中", form_status: "公式受付" }],
  daily_capacity: 40,
  capacity_disclosed: true,
  recruitment_area: null,
  outside_prefecture_allowed: null,
  outside_kyushu_allowed: null,
  individual_allowed: true,
  application_method: "公式ページで8月22日～30日・各日約40人の募集案内を確認。現行フォームは受付終了のため、再開・残席・団体受入・県外参加条件は公式ページへ要照会。",
  application_url: null,
  application_urls: null,
  application_form_status: "募集案内掲載・現行フォーム受付終了",
  official_source_title: "美里町災害ボランティアセンター 8月22日～30日の募集",
  official_source_url: "https://misatoshakyo.or.jp/pages/467/",
  source_updated_at: null,
  recheck_status: "差分あり",
  recheck_note: "8月21日に公式ページを再確認。8月22～30日、各日約40人の募集を反映。",
  change_status: "募集再開・日程更新",
  previous_known_state: "募集休止（定員到達）",
  change_from_previous: "募集休止から8月22～30日の募集へ更新。各日約40人を現行値とする。",
  remarks: "現行ページで確認できた日程・人数のみを反映。県外・団体受入条件は別途要照会。",
  ehime_dispatch_status: "募集案内掲載・現行フォーム受付終了・県外団体条件要照会",
  eligibility_currently_applicable: false,
});
addSource(center("美里町"), source("美里町社会福祉協議会", "美里町災害ボランティアセンター 8月22日～30日の募集", "https://misatoshakyo.or.jp/pages/467/", "8月22～30日、各日約40人"));

update("御船町", {
  recruitment_status: "募集中（8月24日団体、8月25・27～29日）",
  activity_start_date: "2026-08-24",
  activity_end_date: "2026-08-29",
  activity_dates_text: "8月24日は団体のみ、8月25日・27～29日は活動予定。8月26日・30日・31日は活動なし。申込みと参加確定は分けて表示する。",
  activity_windows: [
    { start_date: "2026-08-24", end_date: "2026-08-24", status: "団体受付", form_status: "団体のみ" },
    { start_date: "2026-08-25", end_date: "2026-08-25", status: "募集中", form_status: "日別受付" },
    { start_date: "2026-08-27", end_date: "2026-08-29", status: "募集中", form_status: "日別受付" },
  ],
  application_method: "日別の事前登録。8月24日は団体のみ。参加確定はセンターからの連絡で確認する。",
  application_url: "https://mifune-shakyo.jp/pages/51/detail%3D1/b_id%3D269/r_id%3D56",
  application_form_status: "8月24日団体のみ、8月25日・27～29日受付。8月26日・30日・31日は活動なし。",
  official_source_title: "御船町災害ボランティアセンターからのお知らせ（8月24日以降）",
  official_source_url: "https://mifune-shakyo.jp/pages/51/detail%3D1/b_id%3D269/r_id%3D56",
  source_updated_at: null,
  recheck_status: "差分あり",
  recheck_note: "8月21日に公式告知を再確認。8月24日団体、8月25・27～29日活動、8月26・30・31日休止の日程を反映。",
  change_status: "現行日程更新",
  previous_known_state: "情報未確認（8月16日～22日・人数上限あり）",
  change_from_previous: "8月24日以降の日程を更新し、団体のみの日を分離。活動なしの日も明示。",
  remarks: "8月24日の団体受付は日付限定。県外団体・愛媛県団体の参加確定、残席、大型バス条件は要照会。",
  ehime_dispatch_status: "8月24日団体のみ・参加可否要照会",
  eligibility_currently_applicable: true,
});
addSource(center("御船町"), source("御船町社会福祉協議会", "御船町災害ボランティアセンターからのお知らせ（8月24日以降）", "https://mifune-shakyo.jp/pages/51/detail%3D1/b_id%3D269/r_id%3D56", "8月24日団体、8月25・27～29日活動、8月26・30・31日休止"));

update("嘉島町", {
  center_status: "開設・事前受付",
  recruitment_status: "募集案内掲載（事前受付・8月21日～22日、現行フォーム受付終了）",
  activity_start_date: "2026-08-21",
  activity_end_date: "2026-08-22",
  activity_dates_text: "8月21日～22日の災害ボランティア事前受付を公式告知。参加対象地域、人数、団体条件、参加確定は要確認。",
  activity_windows: [{ start_date: "2026-08-21", end_date: "2026-08-22", status: "事前受付", form_status: "公式案内" }],
  daily_capacity: null,
  capacity_disclosed: null,
  recruitment_area: null,
  outside_prefecture_allowed: null,
  outside_kyushu_allowed: null,
  individual_allowed: true,
  group_allowed: null,
  group_application_available: null,
  application_method: "8月21日～22日の事前受付案内を確認。現行フォームは受付終了のため、人数・対象地域・団体条件・再開は公式ホームページとセンターへ要確認。",
  application_url: null,
  application_urls: null,
  application_form_status: "事前受付案内掲載・現行フォーム受付終了",
  official_source_title: "災害ボランティア事前受付（8月21日～22日）",
  official_source_url: "https://kashima-shakyo.or.jp/",
  source_updated_at: null,
  recheck_status: "差分あり",
  recheck_note: "8月21日に公式記事を確認。8月21～22日の事前受付を反映し、県外参加可否や団体条件は推測しない。",
  change_status: "事前受付日程更新",
  previous_known_state: "情報未確認（8月17日以降要確認）",
  change_from_previous: "未確認から8月21～22日の事前受付へ更新。対象地域・人数・団体条件は要照会。",
  remarks: "最新記事で確認できない県外可否・団体条件を、過去の地域限定情報から推測しない。",
  ehime_dispatch_status: "現行フォーム受付終了・愛媛県参加可否要照会",
  eligibility_currently_applicable: false,
});
center("嘉島町").sources = (center("嘉島町").sources || []).map((item) => item.url?.includes("kashima-shakyo.or.jp") ? { ...item, url: "https://kashima-shakyo.or.jp/" } : item);
addSource(center("嘉島町"), source("嘉島町社会福祉協議会", "災害ボランティア事前受付（8月21日～22日）", "https://kashima-shakyo.or.jp/", "8月21～22日の事前受付案内、現行フォーム受付終了"));

update("益城町", {
  center_status: "開設・活動中",
  recruitment_status: "募集中（第3期・8月24日～28日・30人／日）",
  activity_start_date: "2026-08-24",
  activity_end_date: "2026-08-28",
  activity_dates_text: "第3期は8月24日～28日、各日30人。申込状況・参加確定は公式フォームとセンターの最新案内で確認する。",
  activity_windows: [{ start_date: "2026-08-24", end_date: "2026-08-28", status: "募集中", form_status: "第3期公式受付" }],
  daily_capacity: 30,
  capacity_disclosed: true,
  application_method: "第3期公式申込フォーム。各日30人で、定員到達時は受付終了。",
  application_deadline: "第3期8月24日～28日・各日30人。",
  application_form_status: "第3期8月24日～28日・各日30人",
  official_source_title: "第3期災害ボランティア募集",
  official_source_url: "https://www.mashiki-shakyo.or.jp/news/2068/",
  source_updated_at: null,
  recheck_status: "差分あり",
  recheck_note: "8月21日に公式告知を再確認。第3期8月24～28日、各日30人の募集を反映。",
  change_status: "第3期募集日程更新",
  previous_known_state: "情報未確認（8月17日以降の再開条件要確認）",
  change_from_previous: "休止後の未確認状態から、第3期8月24～28日・各日30人へ更新。",
  remarks: "全国募集の条件は過去公表値を保持。第3期の県外団体・団体受入は別途要照会。",
  ehime_dispatch_status: "募集中・団体受入要照会",
  eligibility_currently_applicable: true,
});
addSource(center("益城町"), source("益城町社会福祉協議会", "第3期災害ボランティア募集", "https://www.mashiki-shakyo.or.jp/news/2068/", "第3期8月24～28日、各日30人"));

update("甲佐町", {
  center_status: "開設・募集準備中",
  recruitment_status: "受付終了（8月29日まで必要人数到達）・以降未定",
  activity_start_date: null,
  activity_end_date: null,
  activity_dates_text: "8月29日までの公表日程は必要人数到達で受付終了。8月30日以降は決まり次第公式告知を確認する。",
  activity_windows: [],
  daily_capacity: null,
  capacity_disclosed: null,
  recruitment_area: null,
  outside_prefecture_allowed: null,
  outside_kyushu_allowed: null,
  individual_allowed: null,
  group_allowed: null,
  group_application_available: null,
  application_method: "8月29日まで受付終了。8月30日以降の募集日程・申込方法は決まり次第公式告知を確認する。",
  application_url: null,
  application_form_status: "8月29日まで受付終了・以降未定",
  official_source_title: "甲佐町災害ボランティアセンター（近日募集予定）",
  official_source_url: "https://kosa-shakyo.or.jp/pages/50/",
  source_updated_at: null,
  recheck_status: "差分あり",
  recheck_note: "8月21日に公式ページを再確認。8月29日まで必要人数到達で受付終了、8月30日以降は未定との現行表示を反映。",
  change_status: "受付終了・以降未定へ更新",
  previous_known_state: "受付終了・団体は要調整",
  change_from_previous: "近日募集予定・詳細未確認から、8月29日まで受付終了・以降未定へ更新。",
  remarks: "過去の九州圏内制限・愛媛県不可は最新記事で再掲されていないため、現行条件とは扱わない。",
  ehime_dispatch_status: "8月29日まで受付終了・以降の参加条件要照会",
  eligibility_currently_applicable: false,
});
addSource(center("甲佐町"), source("甲佐町社会福祉協議会", "甲佐町災害ボランティアセンター（近日募集予定）", "https://kosa-shakyo.or.jp/pages/50/", "8月29日まで必要人数到達で受付終了、8月30日以降は未定"));

update("八代市", {
  recruitment_status: "募集中（個人8月24日～31日／団体5人以上8月24日～9月30日）",
  activity_start_date: "2026-08-24",
  activity_end_date: "2026-09-30",
  activity_dates_text: "個人は8月24日～31日、団体は5人以上で8月24日～9月30日。個人・団体とも参加確定はセンターの連絡で確認する。",
  activity_windows: [
    { start_date: "2026-08-24", end_date: "2026-08-31", status: "募集中", form_status: "個人受付" },
    { start_date: "2026-08-24", end_date: "2026-09-30", status: "団体受付", form_status: "5人以上・団体受付" },
  ],
  group_allowed: true,
  group_application_available: true,
  application_method: "個人は8月24日～31日、団体は5人以上で8月24日～9月30日。団体フォームとセンター案内を確認する。",
  application_deadline: "個人8月24日～31日、団体5人以上8月24日～9月30日。",
  application_form_status: "個人8月24日～31日・団体5人以上8月24日～9月30日",
  application_urls: { group: "https://9c3d4cf9.form.kintoneapp.com/public/saigaivc-yoyaku-dantai-08-yatsushiro", individual: "https://www.yatsushiro-shakyo.jp/homepage_new/R08_saigai_vc_volunteer.html" },
  official_source_title: "八代市災害ボランティアセンター／8月24日以降の募集",
  source_updated_at: null,
  recheck_status: "差分あり",
  recheck_note: "8月21日に公式ページを再確認。個人8月24～31日、団体5人以上8月24日～9月30日の募集を反映。県外・愛媛県可否は要照会。",
  change_status: "個人・団体募集日程更新",
  previous_known_state: "限定募集（団体・個別照会）",
  change_from_previous: "個別照会表示から、個人・5人以上団体の現行日程へ更新。",
  remarks: "団体受付経路の掲載は参加確定を意味しない。県外・愛媛県からの参加条件はセンターへ確認する。",
  ehime_dispatch_status: "個人・5人以上団体募集・県外条件要照会",
  eligibility_currently_applicable: true,
});
addSource(center("八代市"), source("八代市社会福祉協議会", "八代市災害ボランティアセンター／8月24日以降の募集", "https://www.yatsushiro-shakyo.jp/homepage_new/R08_saigai_vc_volunteer.html", "個人8月24～31日、団体5人以上8月24日～9月30日"));

update("氷川町", {
  recruitment_status: "募集中（8月21日～27日・8月24日休止）",
  activity_start_date: "2026-08-21",
  activity_end_date: "2026-08-27",
  activity_dates_text: "8月21～23日、25～27日は募集。8月24日は活動休止。公式フォームの受付状況と暑熱等による変更を活動前に確認する。",
  activity_windows: [{ start_date: "2026-08-21", end_date: "2026-08-27", status: "募集中", form_status: "8月24日休止" }],
  application_form_status: "8月21～27日受付（8月24日は活動休止）",
  official_source_title: "氷川町災害ボランティアセンター公式募集情報",
  official_source_url: "https://hikawa-syakyo.jp/news/",
  source_updated_at: null,
  recheck_status: "差分あり",
  recheck_note: "8月21日に公式一覧を再確認。8月21～27日募集、8月24日休止を反映。",
  change_status: "募集日程・休止日更新",
  previous_known_state: "募集中（8月14日～20日・8月17日休止）",
  change_from_previous: "募集期間を8月21～27日に更新し、8月24日を休止日として明示。",
  remarks: "全国募集・公式フォーム掲載は参加確定を意味しない。中止条件と当日の受付状況を再確認する。",
  ehime_dispatch_status: "全国募集中・参加確定要確認",
  eligibility_currently_applicable: true,
});
addSource(center("氷川町"), source("氷川町社会福祉協議会", "氷川町災害ボランティアセンター公式募集情報", "https://hikawa-syakyo.jp/news/", "8月21～27日募集、8月24日休止"));

update("芦北町", {
  center_status: "開設中（事前登録者への個別依頼方式）",
  recruitment_status: "一般公開募集終了・事前登録者へ随時個別依頼",
  activity_start_date: null,
  activity_end_date: null,
  activity_dates_text: "一般公開募集は終了。事前登録者へ必要時に個別連絡する方式で、現行の個人・団体・愛媛県参加条件は未確認。",
  activity_windows: [],
  recruitment_area: null,
  outside_prefecture_allowed: null,
  outside_kyushu_allowed: null,
  individual_allowed: null,
  group_allowed: null,
  group_application_available: null,
  application_method: "一般公開募集は終了。事前登録者へ必要時に個別連絡。",
  application_url: null,
  application_form_status: "一般公開募集終了・事前登録者へ個別連絡",
  official_source_title: "【重要】芦北町災害ボランティアセンターの今後の運営体制について",
  official_source_url: "https://www.ashikita-shakyo.com/news/%E3%80%90%E9%87%8D%E8%A6%81%E3%80%91%E8%8A%A6%E5%8C%97%E7%94%BA%E7%81%BD%E5%AE%B3%E3%83%9C%E3%83%A9%E3%83%B3%E3%83%86%E3%82%A3%E3%82%A2%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC%E3%81%AE%E4%BB%8A%E5%BE%8C%E3%81%AE%E9%81%8B%E5%96%B6%E4%BD%93%E5%88%B6%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6/",
  source_updated_at: null,
  recheck_status: "差分あり",
  recheck_note: "8月21日に公式告知を再確認。一般公開募集終了後は事前登録者への必要時個別依頼方式であることを反映。",
  change_status: "通常運営方式更新",
  previous_known_state: "情報未確認（8月17日以降の通常VC移行条件要確認）",
  change_from_previous: "一般公開募集終了後の運営方式を確認し、事前登録者への個別依頼として表示。",
  remarks: "事前登録は参加確定を意味しない。現行の個人・団体・愛媛県からの参加可否はセンターへ照会する。",
  ehime_dispatch_status: "事前登録者への個別依頼・参加条件要照会",
  eligibility_currently_applicable: false,
});
addSource(center("芦北町"), source("芦北町社会福祉協議会", "【重要】芦北町災害ボランティアセンターの今後の運営体制について", center("芦北町").official_source_url, "一般公開募集終了、事前登録者へ必要時に個別依頼"));

dedupeSources(statewide);
addSource(statewide, source("熊本県", "災害ボランティアへの積極的な参加をお願いします（最新確認）", "https://www.pref.kumamoto.jp/soshiki/27/275523.html", "県全体の災害ボランティア募集案内を再確認"));
addSource(statewide, source("熊本県社会福祉協議会", "災害ボランティア事前登録・市町別最新情報", "https://www.fukushi-kumamoto.or.jp/pages/291/detail%3D1/b_id%3D4334/r_id%3D2213/", "県全体の事前登録・市町別最新情報を再確認"));

await Promise.all([
  writeFile(paths.north, `${JSON.stringify(north, null, 2)}\n`, "utf8"),
  writeFile(paths.south, `${JSON.stringify(south, null, 2)}\n`, "utf8"),
  writeFile(paths.statewide, `${JSON.stringify(statewide, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ checkedAt, municipalities: centers.map((item) => item.municipality), sourcesAdded: 13 }));

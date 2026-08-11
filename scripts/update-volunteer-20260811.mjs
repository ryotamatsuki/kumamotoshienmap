import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkedAt = "2026-08-11T19:17:17+09:00";
const files = ["research_official_north.json", "research_official_south.json"];
const datasets = files.map((file) => ({file, data: JSON.parse(readFileSync(join(root, file), "utf8"))}));
const centers = new Map(datasets.flatMap(({data}) => data.municipalities.map((center) => [center.municipality, center])));

function source(publisher, title, url, publishedAt = null, updatedAt = null) {
  return {publisher, title, url, published_at: publishedAt, updated_at: updatedAt, checked_at: checkedAt};
}
function replaceSource(center, next) {
  const previous = Array.isArray(center.sources) ? center.sources : [];
  center.sources = [next, ...previous.filter((item) => item.url !== next.url)];
}
function update(name, values, sourceValue) {
  const center = centers.get(name);
  if (!center) throw new Error(`Missing municipality: ${name}`);
  Object.assign(center, values, {checked_at: checkedAt});
  if (sourceValue) {
    center.official_source_name = sourceValue.publisher;
    center.official_source_title = sourceValue.title;
    center.official_source_url = sourceValue.url;
    center.source_published_at = sourceValue.published_at;
    center.source_updated_at = sourceValue.updated_at;
    replaceSource(center, sourceValue);
  }
}

update("熊本市", {
  recruitment_status: "定員到達",
  activity_dates_text: "本部8月5日～14日、南区サテライト8月10日～14日。第1期はいずれも募集締切。8月15日以降は住民ニーズを踏まえて再告知予定",
  activity_windows: [
    {district: "本部センター", start_date: "2026-08-05", end_date: "2026-08-14", status: "定員到達", capacity: 20, capacity_unit: "人程度／日", form_status: "募集締切"},
    {district: "南区サテライト", start_date: "2026-08-10", end_date: "2026-08-14", status: "定員到達", capacity: 40, capacity_unit: "人程度／日", form_status: "募集締切"}
  ],
  needs_reconfirmation: true,
  recheck_status: "変更なし・要再確認",
  recheck_note: "8月11日確認時点で第1期募集締切後の新しい募集記事を確認できず、8月15日以降は再告知予定",
  change_status: "変更なし・要再確認",
  change_from_previous: "第1期募集締切の状態を保持。8月15日以降の再募集は未確認",
  previous_known_state: "定員到達",
  remarks: "本部20人程度／日、南区サテライト40人程度／日は地区別の受入目安であり、合算した市全体人数・空き人数ではない。"
}, source("熊本市社会福祉協議会", "募集締切【第1期 ボランティア追加募集について】", "https://www.kumamoto-city-csw.or.jp/%E3%80%90%E7%AC%AC1%E6%9C%9F%E3%80%80%E3%83%9C%E3%83%A9%E3%83%B3%E3%83%86%E3%82%A3%E3%82%A2%E8%BF%BD%E5%8A%A0%E5%8B%9F%E9%9B%86%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6%E3%80%91/", "2026-08-07"));

update("八代市", {
  center_status: "開設・活動中",
  recruitment_status: "募集中（団体申込フォーム掲載・個人第1弾フォーム受付終了）",
  activity_start_date: "2026-08-10",
  activity_end_date: "2026-08-16",
  activity_dates_text: "第1弾：8月10日～16日。個人第1弾フォームは受付終了。5人以上の団体は団体申込フォームで事前調整",
  activity_windows: [{start_date: "2026-08-10", end_date: "2026-08-16", status: "募集中", form_status: "団体申込フォームで事前調整", application_url: "https://9c3d4cf9.form.kintoneapp.com/public/saigaivc-yoyaku-dantai-08-yatsushiro"}],
  capacity_disclosed: false,
  daily_capacity: null,
  total_capacity: null,
  recruitment_area: null,
  outside_prefecture_allowed: null,
  individual_allowed: true,
  group_allowed: true,
  group_application_available: true,
  application_required: true,
  application_method: "個人第1弾フォームは受付終了。5人以上の団体は団体申込フォーム入力後に災害ボランティアセンターと活動日を調整",
  application_url: "https://9c3d4cf9.form.kintoneapp.com/public/saigaivc-yoyaku-dantai-08-yatsushiro",
  application_urls: {group: "https://9c3d4cf9.form.kintoneapp.com/public/saigaivc-yoyaku-dantai-08-yatsushiro"},
  application_form_status: "団体申込フォーム受付中・個人第1弾フォーム受付終了",
  vehicle_need: "軽トラックでの参加を歓迎",
  needs_reconfirmation: false,
  recheck_status: "募集方法変更を確認",
  recheck_note: "8月10日付公式案内で、5人以上の団体は専用フォームによる事前調整へ変更。個人第1弾フォームは受付終了",
  change_status: "団体申込方法変更・個人フォーム受付終了",
  change_from_previous: "個人フォーム中心の案内から、5人以上の団体は団体申込フォームで事前調整へ変更",
  previous_known_state: "募集中（団体は電話で事前相談）",
  remarks: "公式ページの『全国各地から問合せ』は参加対象地域の明示ではないため、県外参加可とは判定しない。"
}, source("八代市社会福祉協議会", "八代市災害ボランティアセンター／ボランティアの皆様へ（団体申込方法が変わります）", "https://www.yatsushiro-shakyo.jp/homepage_new/R08_saigai_vc_volunteer.html", "2026-08-10", "2026-08-10"));

update("宇土市", {
  center_status: "開設・第2期活動予定",
  recruitment_status: "受付終了・詳細要確認",
  activity_start_date: "2026-08-13",
  activity_end_date: "2026-08-19",
  activity_dates_text: "第2期：8月13日～19日。8月12日はニーズ整理・調整のため活動なし。公式募集ページは募集案内を掲載中だが、公式申込フォームは8月11日確認時に受付終了",
  activity_windows: [{start_date: "2026-08-13", end_date: "2026-08-19", status: "受付終了・詳細要確認", capacity: 70, capacity_unit: "人程度／日", form_status: "受付終了（理由未公表）", application_url: "https://forms.gle/FCwVAHmc4htUM5Au8"}],
  daily_capacity: 70,
  capacity_unit: "人程度／日",
  capacity_disclosed: true,
  recruitment_area: "全国",
  outside_prefecture_allowed: true,
  outside_kyushu_allowed: true,
  ehime_participation_allowed: true,
  individual_allowed: true,
  group_allowed: null,
  group_application_available: null,
  application_required: true,
  application_method: "個人は公式活動申込フォーム。5人以上の団体はメール照会（前回確認値。現在の団体受入は再確認が必要）",
  application_url: "https://forms.gle/FCwVAHmc4htUM5Au8",
  application_form_status: "受付終了（理由未公表）",
  needs_reconfirmation: true,
  recheck_status: "受入目安変更・フォーム受付終了を確認",
  recheck_note: "公式ページは70人程度／日・全国から参加受付を掲載する一方、申込フォームは受付終了。理由が公表されていないため定員到達とは断定しない",
  change_status: "受入目安50人程度／日→70人程度／日・申込フォーム受付終了（理由未公表）",
  change_from_previous: "第2期の受入目安を50人程度／日から70人程度／日に更新。申込フォームは受付終了（理由未公表）",
  previous_known_state: "募集中（第2期・50人程度／日）",
  remarks: "70人程度／日は1日当たりの受入目安であり、期間合計・空き人数・不足人数ではない。フォーム受付終了を定員到達と表示しない。"
}, source("宇土市社会福祉協議会", "災害ボランティア第2期募集のお知らせ", "https://www.utoshakyou.jp/volunteer_2026.html", null, "2026-08-09"));

update("宇城市", {
  center_status: "開設・活動中",
  recruitment_status: "募集中（一部日定員到達）",
  activity_start_date: "2026-08-15",
  activity_end_date: "2026-08-23",
  activity_dates_text: "8月15日～23日の日別申込を掲載。8月15・17・18・19・22・23日は定数到達、8月16・20・21日は受付中を確認（8月11日確認）",
  activity_windows: [
    {start_date: "2026-08-15", end_date: "2026-08-15", status: "定員到達", form_status: "定数到達"},
    {start_date: "2026-08-16", end_date: "2026-08-16", status: "募集中", form_status: "受付中"},
    {start_date: "2026-08-17", end_date: "2026-08-19", status: "定員到達", form_status: "定数到達"},
    {start_date: "2026-08-20", end_date: "2026-08-21", status: "募集中", form_status: "受付中"},
    {start_date: "2026-08-22", end_date: "2026-08-23", status: "定員到達", form_status: "定数到達"}
  ],
  recruitment_area: "全国",
  outside_prefecture_allowed: true,
  individual_allowed: true,
  group_allowed: null,
  group_application_available: null,
  application_required: true,
  application_method: "日別の公式申込フォーム。受付状況は各日のフォームで確認",
  application_url: "https://www.shakyou-uki.jp/oshirase/12239-2/",
  vehicle_need: "軽トラック持参者に当日使用の協力を依頼",
  needs_reconfirmation: true,
  recheck_status: "日別受付状況を更新",
  recheck_note: "8月20・21日は受付中、その他の公表日は定数到達。日別の募集人数は公表なし",
  change_status: "日別受付更新・全国募集の掲載を確認",
  change_from_previous: "8月15～23日の日別フォームを確認。8月20・21日は受付中、他の公表日は定数到達。県社協一覧で全国募集を確認",
  previous_known_state: "募集中（一部日定員到達）",
  remarks: "日別フォームの受付状態は変動するため、申込み前に公式フォームを再確認する。"
}, source("宇城市社会福祉協議会", "ボランティア活動へ参加を希望される方へ", "https://www.shakyou-uki.jp/oshirase/12239-2/", "2026-08-08", "2026-08-08"));

update("美里町", {
  center_status: "開設・活動調整中",
  recruitment_status: "一時休止",
  activity_start_date: null,
  activity_end_date: null,
  activity_dates_text: "募集期間内の申込定員到達により募集休止。再開日・現行活動期間は公表なし",
  activity_windows: [],
  recruitment_area: "全国",
  outside_prefecture_allowed: true,
  individual_allowed: null,
  group_allowed: null,
  group_application_available: null,
  application_method: "募集休止中。再開日・申込方法は要確認",
  application_form_status: "募集休止",
  needs_reconfirmation: true,
  recheck_status: "休止継続・再開日要確認",
  recheck_note: "現行ページは申込定員到達による募集休止を掲載。再開日・現行活動期間は確認できず",
  change_status: "募集休止継続・対象地域情報を更新",
  change_from_previous: "募集期間内の定員到達による休止を保持。熊本県社協の現行一覧で全国募集の区分を確認したが、再開日は未公表",
  previous_known_state: "一時休止",
  remarks: "過去の個人・団体フォームを現在の団体受入可能とは扱わない。活動先までの移動・車両提供依頼は掲載情報として保持する。"
}, source("美里町社会福祉協議会", "令和8年熊本地震に伴う美里町災害ボランティアセンターの受付について", "https://misatoshakyo.or.jp/pages/455/", null, null));

update("御船町", {
  center_status: "開設・活動中（公表日程あり）",
  recruitment_status: "定員到達",
  activity_start_date: "2026-08-11",
  activity_end_date: "2026-08-22",
  activity_dates_text: "8月11日～13日及び8月16日～22日は日別申込フォームが人数上限到達で締切。8月14日・15日は活動休止",
  activity_windows: [
    {start_date: "2026-08-11", end_date: "2026-08-13", status: "定員到達", form_status: "人数上限に達したため予約締切"},
    {start_date: "2026-08-14", end_date: "2026-08-15", status: "一時休止", form_status: null},
    {start_date: "2026-08-16", end_date: "2026-08-22", status: "定員到達", form_status: "人数上限に達したため予約締切"}
  ],
  recruitment_area: "全国",
  outside_prefecture_allowed: true,
  individual_allowed: true,
  group_allowed: true,
  group_application_available: true,
  application_required: true,
  application_method: "活動日別の個人・団体共通公式申込フォーム（全公表日が人数上限到達で締切）",
  application_form_status: "全公表日が人数上限到達で締切",
  needs_reconfirmation: false,
  recheck_status: "現行日程追加・全公表日上限到達を確認",
  recheck_note: "8月11～13日及び8月16～22日の各フォームで人数上限到達による締切、8月14・15日は活動休止を確認",
  change_status: "現行日程追加・全公表日人数上限到達・8月14～15日休止",
  change_from_previous: "8月11～13日及び8月16～22日の日程を追加確認。全公表日が人数上限到達で締切、14・15日は休止",
  previous_known_state: "情報未確認（8月3～8日終了後の次期日程未確認）",
  remarks: "人数の数値は非公表。上限到達を0人とは表示しない。個人・団体の双方は各フォームの公式タイトルで確認。愛媛県団体、大型バス、1団体当たり人数は別途要調整。"
}, source("御船町社会福祉協議会", "御船町災害ボランティアセンターよりお知らせです", "https://mifune-shakyo.jp/pages/51/detail=1/b_id=269/r_id=55#block269-55", "2026-08-04", "2026-08-07"));

update("嘉島町", {
  center_status: "開設・活動休止中（8月11日～16日）",
  recruitment_status: "一時休止",
  activity_start_date: "2026-08-08",
  activity_end_date: "2026-08-10",
  activity_dates_text: "8月8日～10日の募集は定員到達。8月11日～16日は活動休止。8月17日以降は公表情報を要確認",
  activity_windows: [
    {start_date: "2026-08-08", end_date: "2026-08-10", status: "定員到達", capacity: 30, capacity_unit: "人／日", form_status: "回答受付終了"},
    {start_date: "2026-08-11", end_date: "2026-08-16", status: "一時休止", form_status: "活動休止"}
  ],
  daily_capacity: 30,
  capacity_unit: "人／日",
  capacity_disclosed: true,
  recruitment_area: "熊本県内在住者",
  outside_prefecture_allowed: false,
  individual_allowed: true,
  group_allowed: null,
  group_application_available: null,
  needs_reconfirmation: true,
  recheck_status: "活動休止継続・8月17日以降要確認",
  recheck_note: "8月11日個別ページはTLS／サーバーエラー。前回確認済みの8月8～10日定員到達、11～16日休止を保持",
  change_status: "定員到達→一時休止（公表済み日程による状態遷移）",
  change_from_previous: "8月8～10日の募集は定員到達、8月11～16日は活動休止。8月17日以降の再開条件は未公表",
  previous_known_state: "定員到達",
  remarks: "30人／日は8月8～10日の公表値で、現在の募集人数ではない。8月17日以降の再開を推測しない。"
}, source("嘉島町社会福祉協議会", "お盆期間中（8月11～16日）のボランティア活動休止について", "https://kashima-shakyo.or.jp/publics/index/1/detail%3D1/b_id%3D1/r_id%3D127", "2026-08-05"));

update("益城町", {
  center_status: "開設・活動休止中",
  recruitment_status: "一時休止",
  activity_start_date: "2026-08-11",
  activity_end_date: "2026-08-16",
  activity_dates_text: "8月11日～16日は活動休止。8月17日以降は活動再開予定だが、募集日・申込方法・人数は未公表",
  activity_windows: [
    {start_date: "2026-08-07", end_date: "2026-08-10", status: "募集中", capacity: 70, capacity_unit: "人／日", form_status: "追加募集"},
    {start_date: "2026-08-11", end_date: "2026-08-16", status: "一時休止", form_status: "活動休止"},
    {start_date: "2026-08-17", end_date: "2026-08-24", status: "募集予定", form_status: "詳細未公表"}
  ],
  daily_capacity: 70,
  capacity_unit: "人／日",
  capacity_disclosed: true,
  recruitment_area: "全国",
  outside_prefecture_allowed: true,
  individual_allowed: true,
  group_allowed: null,
  group_application_available: null,
  needs_reconfirmation: true,
  recheck_status: "活動休止・再開詳細要確認",
  recheck_note: "8月11～16日は活動休止。8月17日以降は再開予定との記載のみで、募集日・申込方法・人数は未公表",
  change_status: "募集中→一時休止（再開詳細未公表）",
  change_from_previous: "8月7～10日の追加募集後、8月11～16日は活動休止。8月17日以降は再開予定だが詳細未公表",
  previous_known_state: "募集中（8月7～10日・70人程度／日）",
  remarks: "70人／日は8月7～10日の公表値で現在の空き・募集人数ではない。再開予定を現在募集中とは表示しない。"
}, source("益城町社会福祉協議会", "【8/11〜8/16 ボランティア活動 一時休止のお知らせ】", "https://www.mashiki-shakyo.or.jp/news/2010/", "2026-08-06"));

update("甲佐町", {
  center_status: "開設・活動中",
  recruitment_status: "募集中（一部日受付終了）",
  activity_start_date: "2026-08-13",
  activity_end_date: "2026-08-21",
  activity_dates_text: "活動日：8月13日、14日、17日、18日、19日、20日、21日。個人フォームでは8月13～18日は受付終了、8月19～21日は選択可能（8月11日確認）",
  activity_windows: [
    {start_date: "2026-08-13", end_date: "2026-08-14", status: "募集中（一部日受付終了）", capacity: 30, capacity_unit: "人／日", form_status: "個人受付終了・団体は要調整"},
    {start_date: "2026-08-15", end_date: "2026-08-16", status: "活動なし", form_status: null},
    {start_date: "2026-08-17", end_date: "2026-08-18", status: "募集中（一部日受付終了）", capacity: 30, capacity_unit: "人／日", form_status: "個人受付終了・団体は要調整"},
    {start_date: "2026-08-19", end_date: "2026-08-21", status: "募集中", capacity: 30, capacity_unit: "人／日", form_status: "個人フォーム受付中"}
  ],
  daily_capacity: 30,
  capacity_unit: "人／日",
  capacity_disclosed: true,
  recruitment_area: "九州圏内在住者",
  outside_prefecture_allowed: true,
  outside_kyushu_allowed: false,
  ehime_participation_allowed: false,
  individual_allowed: true,
  group_allowed: true,
  group_application_available: true,
  application_required: true,
  application_method: "個人は公式Googleフォーム。5人以上の団体は別の団体申込フォーム",
  application_url: "https://forms.gle/VvS46pcwKpX1XJRZ8",
  application_form_status: "8月13～18日は受付終了、8月19～21日は選択可能。団体フォームURLは未確認",
  needs_reconfirmation: false,
  recheck_status: "募集日追加・一部日受付終了を確認",
  recheck_note: "公式ページで活動日、1日30名、5人以上の団体申込経路を確認。個人フォームは19～21日が選択可能",
  change_status: "募集日追加・1日30人公表・5人以上の団体申込経路明示・一部日受付終了",
  change_from_previous: "8月13～21日の活動日、1日30名、5人以上の団体申込経路を確認。13～18日は個人フォーム受付終了、19～21日は選択可能",
  previous_known_state: "定員到達・8月12日まで募集締切",
  remarks: "フォームの動的な残り枠は保存・表示・集計しない。九州圏内在住者の地域条件のため、愛媛県からの一般参加は対象外。団体フォームURL自体は公式ページで確認できず、推測しない。"
}, source("甲佐町社会福祉協議会", "甲佐町災害ボランティアセンター", "https://kosa-shakyo.or.jp/pages/50/", null, null));

update("氷川町", {
  center_status: "開設・活動中（申込受付状況要確認）",
  recruitment_status: "受付終了・活動状況要確認",
  activity_start_date: "2026-08-14",
  activity_end_date: "2026-08-20",
  activity_dates_text: "8月14日～20日の募集を公表（8月17日は活動休止）。公式申込フォームは8月11日時点で回答受付終了。終了理由は未公表",
  activity_windows: [
    {start_date: "2026-08-14", end_date: "2026-08-16", status: "受付終了・活動状況要確認", form_status: "回答受付終了"},
    {start_date: "2026-08-17", end_date: "2026-08-17", status: "活動休止", form_status: null},
    {start_date: "2026-08-18", end_date: "2026-08-20", status: "受付終了・活動状況要確認", form_status: "回答受付終了"}
  ],
  recruitment_area: "全国",
  outside_prefecture_allowed: true,
  individual_allowed: true,
  group_allowed: null,
  group_application_available: null,
  application_required: true,
  application_method: "公式Googleフォーム（現在は回答受付終了）",
  application_url: "https://forms.gle/qEg4x2XLFeRyLZF57",
  application_form_status: "回答受付終了（理由未公表）",
  needs_reconfirmation: true,
  recheck_status: "追加日程・フォーム受付終了を確認",
  recheck_note: "8月14～20日の日程を確認。フォームは受付終了だが、理由は公表されていないため定員到達とは断定しない",
  change_status: "募集期間追加・新旧申込フォーム受付終了（理由未公表）",
  change_from_previous: "8月14～20日の追加日程を確認。旧8月8～12日フォームと新フォームはいずれも受付終了",
  previous_known_state: "募集中（8月8～12日・全国募集）",
  remarks: "公式記事の曜日表記は採用せず、日付のみ表示。受付終了を定員到達・募集終了とは推測しない。"
}, source("氷川町社会福祉協議会", "災害ボランティア募集のお知らせ【8/14～20】", "https://hikawa-syakyo.jp/news/%e7%81%bd%e5%ae%b3%e3%83%9c%e3%83%a9%e3%83%b3%e3%83%86%e3%82%a3%e3%82%a2%e5%8b%9f%e9%9b%86%e3%81%ae%e3%81%8a%e7%9f%a5%e3%82%89%e3%81%9b%e3%80%90%ef%bc%98-%ef%bc%91%ef%bc%94%ef%bd%9e%ef%bc%92%ef%bc%90/", "2026-08-09"));

update("芦北町", {
  center_status: "開設中（8月11～12日は事前登録団体のみ、8月13～16日休止、8月17日通常VC移行予定）",
  recruitment_status: "募集終了",
  activity_start_date: null,
  activity_end_date: "2026-08-10",
  activity_dates_text: "一般募集は8月10日で終了。8月11～12日は事前登録済み団体のみ活動、8月13～16日は活動休止、8月17日に通常のボランティアセンターへ移行予定",
  activity_windows: [
    {start_date: "2026-08-11", end_date: "2026-08-12", status: "事前登録団体のみ", form_status: "一般募集終了"},
    {start_date: "2026-08-13", end_date: "2026-08-16", status: "一時休止", form_status: "活動休止"},
    {start_date: "2026-08-17", end_date: "2026-08-24", status: "募集予定", form_status: "通常VC移行予定・条件未公表"}
  ],
  recruitment_area: "八代市を除く熊本県南地域及びそれより南の県（鹿児島県など）",
  outside_prefecture_allowed: true,
  eligibility_currently_applicable: false,
  individual_allowed: false,
  group_allowed: true,
  group_application_available: false,
  application_required: true,
  application_method: "個人・団体の公式フォームはいずれも回答受付終了。8月11～12日は事前登録済み団体のみ",
  application_form_status: "募集終了（フォーム受付終了）",
  application_url: "https://forms.gle/eq2e9DF5WBhT8Xd48",
  application_urls: {individual: "https://forms.gle/eq2e9DF5WBhT8Xd48", group: "https://forms.gle/MxJ1PGtwxKXFfLMd9"},
  needs_reconfirmation: false,
  recheck_status: "一般募集終了・通常VC移行予定を確認",
  recheck_note: "8月10日をもって一般募集終了。11～12日は事前登録団体のみ、13～16日は休止、17日は通常VC移行予定",
  change_status: "募集中→募集終了・申込フォーム閉鎖・通常VC移行予定",
  change_from_previous: "一般募集終了とフォーム受付終了を確認。8月11～12日は事前登録団体のみ、13～16日は休止、17日は移行予定",
  previous_known_state: "募集中（地域限定・個人／団体フォーム）",
  remarks: "県外対象地域は一般募集終了前の公表条件であり、現在参加可能を意味しない。8月17日以降を募集中とは表示しない。愛媛県団体受入は未確認。"
}, source("芦北町社会福祉協議会", "災害ボランティア募集終了のお知らせ", "https://www.ashikita-shakyo.com/news/%e7%81%bd%e5%ae%b3%e3%83%9c%e3%a9%e3%83%b3%e3%83%86%e3%82%a3%e3%82%a2%e5%8b%9f%e9%9b%86%e7%b5%82%e4%ba%86%e3%81%ae%e3%81%8a%e7%9f%a5%e3%82%89%e3%81%9b/", "2026-08-10"));

for (const {data} of datasets) {
  data.checked_at = checkedAt;
  data.key_changes_from_previous = [...new Set((data.municipalities || []).map((center) => center.change_status).filter(Boolean))].map((change_status) => ({change_status, detail: change_status}));
  for (const item of data.municipalities || []) {
    item.checked_at = checkedAt;
    for (const entry of item.sources || []) entry.checked_at = checkedAt;
  }
  for (const entry of data.official_sources || []) entry.checked_at = checkedAt;
  writeFileSync(join(root, data === datasets[0].data ? files[0] : files[1]), JSON.stringify(data, null, 2) + "\n", "utf8");
}

const statewidePath = join(root, "research_official_statewide.json");
const statewide = JSON.parse(readFileSync(statewidePath, "utf8"));
statewide.checked_at = checkedAt;
for (const entry of statewide.sources || []) entry.checked_at = checkedAt;
const statewideSource = source("熊本県", "災害ボランティアへの積極的な参加をお願いします", "https://www.pref.kumamoto.jp/soshiki/27/275523.html", null, "2026-08-10");
statewide.sources = [statewideSource, ...(statewide.sources || []).filter((entry) => entry.url !== statewideSource.url)];
if (statewide.statewide_facts) {
  statewide.statewide_facts.checked_at = checkedAt;
  statewide.statewide_facts.latest_checked_at = checkedAt;
  statewide.statewide_facts.linked_municipal_centers = ["熊本市", "八代市", "宇土市", "宇城市", "美里町", "御船町", "嘉島町", "益城町", "甲佐町", "氷川町", "芦北町"];
}
writeFileSync(statewidePath, JSON.stringify(statewide, null, 2) + "\n", "utf8");
console.log(`Updated volunteer research snapshots for ${centers.size} municipalities at ${checkedAt}`);

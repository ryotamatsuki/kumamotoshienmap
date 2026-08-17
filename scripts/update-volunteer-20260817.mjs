import { readFile, writeFile } from "node:fs/promises";

const checkedAt = "2026-08-17T09:45:00+09:00";
const files = ["research_official_north.json", "research_official_south.json"];
const sourceDefinitions = {
  "熊本市": {
    publisher: "熊本市社会福祉協議会",
    title: "８/１３時点での第２期ボランティア募集状況のお知らせ",
    url: "https://www.kumamoto-city-csw.or.jp/%EF%BC%98-%EF%BC%91%EF%BC%93%E6%99%82%E7%82%B9%E3%81%A7%E3%81%AE%E7%AC%AC%EF%BC%92%E6%9C%9F%E3%83%9C%E3%83%A9%E3%83%B3%E3%83%86%E3%82%A3%E3%82%A2%E5%8B%9F%E9%9B%86%E7%8A%B6%E6%B3%81%E3%81%AE%E3%81%8A/",
    published_at: "2026-08-14",
    updated_at: "2026-08-14",
  },
  "宇土市": {
    publisher: "宇土市社会福祉協議会",
    title: "災害ボランティア第２期募集のお知らせ",
    url: "https://www.utoshakyou.jp/volunteer_2026.html",
    published_at: null,
    updated_at: "2026-08-09",
  },
  "宇城市": {
    publisher: "宇城市社会福祉協議会",
    title: "ボランティア活動へ参加を希望される方へ",
    url: "https://www.shakyou-uki.jp/oshirase/12239-2/",
    published_at: "2026-08-17",
    updated_at: "2026-08-16",
  },
  "氷川町": {
    publisher: "氷川町社会福祉協議会",
    title: "氷川町災害ボランティアセンターの休所日のお知らせ",
    url: "https://hikawa-syakyo.jp/news/%E6%B0%B7%E5%B7%9D%E7%94%BA%E7%81%BD%E5%AE%B3%E3%83%9C%E3%83%A9%E3%83%B3%E3%83%86%E3%82%A3%E3%82%A2%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC%E3%81%AE%E4%BC%91%E6%89%80%E6%97%A5%E3%81%AE%E3%81%8A%E7%9F%A5%E3%82%89%E3%81%9B/",
    published_at: "2026-08-16",
    updated_at: "2026-08-16",
  },
};

// Keep URL variants in the source history, but use the canonical URL above for
// the current record. The recruitment article remains a separate source.
sourceDefinitions["氷川町"].url = "https://hikawa-syakyo.jp/news/%E6%B0%B7%E5%B7%9D%E7%94%BA%E7%81%BD%E5%AE%B3%E3%83%9C%E3%83%A9%E3%83%B3%E3%83%86%E3%82%A3%E3%82%A2%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC%E3%81%AE%E4%BC%91%E6%89%80%E6%97%A5%E3%81%AE%E3%81%8A%E7%9F%A5%E3%82%89%E3%81%9B/";

function sourceEntry(definition, facts_used = null) {
  return {
    publisher: definition.publisher,
    title: definition.title,
    url: definition.url,
    published_at: definition.published_at,
    updated_at: definition.updated_at,
    checked_at: checkedAt,
    ...(facts_used ? { facts_used } : {}),
  };
}

function upsertSource(center, definition, facts_used = null) {
  center.sources = Array.isArray(center.sources) ? center.sources : [];
  const existing = center.sources.find((item) => item.url === definition.url);
  const value = sourceEntry(definition, facts_used);
  if (existing) Object.assign(existing, value);
  else center.sources.unshift(value);
}

function findCenter(data, municipality) {
  const center = data.municipalities.find((item) => item.municipality === municipality);
  if (!center) throw new Error(`Missing municipality: ${municipality}`);
  return center;
}

function applyCommon(data) {
  data.checked_at = checkedAt;
  for (const source of data.official_sources || []) source.checked_at = checkedAt;
  for (const center of data.municipalities) {
    center.checked_at = checkedAt;
    center.needs_reconfirmation = true;
    for (const source of center.sources || []) source.checked_at = checkedAt;
  }
}

const allData = [];
for (const file of files) {
  const data = JSON.parse(await readFile(file, "utf8"));
  applyCommon(data);
  allData.push({ file, data });
}

const north = allData.find(({ file }) => file === "research_official_north.json").data;
const south = allData.find(({ file }) => file === "research_official_south.json").data;

const kumamoto = findCenter(north, "熊本市");
Object.assign(kumamoto, {
  center_status: "開設・活動中",
  recruitment_status: "受付終了（第2期定員到達）・8月24日以降要再確認",
  activity_start_date: "2026-08-16",
  activity_end_date: "2026-08-23",
  activity_dates_text: "第2期（8月16日～23日）は本部センター・南区サテライトとも必要人数到達で締切。8月24日以降はニーズ状況を踏まえ再告知予定。",
  application_method: "第2期は締切。8月24日以降はニーズ状況を踏まえて再告知予定。",
  application_form_status: "第2期締切（必要人数到達）",
  official_source_name: sourceDefinitions["熊本市"].publisher,
  official_source_title: sourceDefinitions["熊本市"].title,
  official_source_url: sourceDefinitions["熊本市"].url,
  source_published_at: sourceDefinitions["熊本市"].published_at,
  source_updated_at: sourceDefinitions["熊本市"].updated_at,
  recheck_status: "差分あり",
  recheck_note: "8月14日掲載の公式告知で、第2期8月16～23日は本部・南区とも必要人数到達による締切を確認。8月24日以降は再告知予定。",
  change_status: "第2期募集締切",
  previous_known_state: "定員到達（第1期）",
  change_from_previous: "第2期8月16～23日も両拠点が必要人数到達で締切。8月24日以降はニーズ状況を踏まえ再告知予定。",
  remarks: "第2期の受付終了は公式告知に基づく。8月24日以降の再募集は未発表のため、募集中とは表示しない。",
  district_capacities: [
    { district: "本部センター", daily_capacity: 20, capacity_unit: "人程度／日" },
    { district: "南区サテライト", daily_capacity: 40, capacity_unit: "人程度／日" },
  ],
  activity_windows: [
    { start_date: "2026-08-16", end_date: "2026-08-23", status: "定員到達", form_status: "必要人数到達・締切" },
  ],
});
upsertSource(kumamoto, sourceDefinitions["熊本市"], "第2期8月16～23日の本部・南区サテライトの必要人数到達と、8月24日以降の再告知予定");

const uto = findCenter(north, "宇土市");
Object.assign(uto, {
  center_status: "開設・活動中",
  recruitment_status: "募集中（第2期・8月13日～19日・70人程度／日・全国）",
  activity_dates_text: "第2期は8月13日～19日。1日70人程度を目安に全国から募集。申込フォームは掲載中だが、定員到達時は受付終了となるため、公式ページとFacebookを申込前に再確認する。",
  application_method: "公式活動申込フォーム。定員到達時は受付終了となる場合があるため、公式ページ・Facebookで最新状況を確認。",
  application_form_status: "公式申込フォーム掲載（定員到達時は受付終了）",
  official_source_name: sourceDefinitions["宇土市"].publisher,
  official_source_title: sourceDefinitions["宇土市"].title,
  official_source_url: sourceDefinitions["宇土市"].url,
  source_published_at: sourceDefinitions["宇土市"].published_at,
  source_updated_at: sourceDefinitions["宇土市"].updated_at,
  recheck_status: "差分あり",
  recheck_note: "公式ページを8月17日に再確認。第2期8月13～19日、70人程度／日、全国募集、申込フォーム掲載を確認。実際の残席はフォーム・Facebookで要確認。",
  change_status: "募集状況更新",
  previous_known_state: "受付終了・詳細要確認",
  change_from_previous: "公式ページ上の第2期募集と申込フォーム掲載を現況表示へ更新。定員到達とは断定しない。",
  remarks: "申込フォーム掲載は参加確定を意味しない。定員到達時は受付終了となる場合があるため、参加前に公式ページ・Facebookを再確認する。",
  activity_windows: [
    { start_date: "2026-08-13", end_date: "2026-08-19", status: "募集中", form_status: "公式申込フォーム掲載" },
  ],
});
upsertSource(uto, sourceDefinitions["宇土市"], "第2期8月13～19日、1日70人程度、全国募集、申込フォーム掲載");

const uki = findCenter(north, "宇城市");
Object.assign(uki, {
  center_status: "開設・活動中",
  recruitment_status: "募集中（8月17日～24日・26日～31日・事前申込）",
  activity_start_date: "2026-08-17",
  activity_end_date: "2026-08-31",
  activity_dates_text: "8月17日～24日、26日～31日は日別の事前申込を受付。8月25日は災害ごみ仮置場の受入中止・ニーズ整理のため活動なし。団体フォームへの申込だけでは参加確定ではない。",
  application_method: "日別の公式事前申込フォーム。団体はページ下部の団体受付フォームで事前申込するが、申込時点では参加確定ではない。",
  application_form_status: "8月17～24日・26～31日の日別フォーム掲載（8月25日は活動なし）",
  group_application_available: true,
  official_source_name: sourceDefinitions["宇城市"].publisher,
  official_source_title: sourceDefinitions["宇城市"].title,
  official_source_url: sourceDefinitions["宇城市"].url,
  source_published_at: sourceDefinitions["宇城市"].published_at,
  source_updated_at: sourceDefinitions["宇城市"].updated_at,
  recheck_status: "差分あり",
  recheck_note: "8月17日掲載の公式告知を確認。8月17～24日・26～31日の日別事前申込、8月25日の活動なし、軽トラック協力依頼、団体申込は参加確定ではない旨を反映。",
  change_status: "募集日程更新",
  previous_known_state: "受付終了・次回日程要確認",
  change_from_previous: "8月17～24日・26～31日の日別事前申込を再開。8月25日は活動なし。団体申込フォームを掲載するが参加確定とは扱わない。",
  remarks: "日別フォームの受付状態は変動するため、申込み前に公式ページの最新フォームを再確認する。",
  activity_windows: [
    { start_date: "2026-08-17", end_date: "2026-08-24", status: "募集中", form_status: "日別事前申込" },
    { start_date: "2026-08-25", end_date: "2026-08-25", status: "活動なし", form_status: "災害ごみ仮置場の受入中止・ニーズ整理" },
    { start_date: "2026-08-26", end_date: "2026-08-31", status: "募集中", form_status: "日別事前申込" },
  ],
});
upsertSource(uki, sourceDefinitions["宇城市"], "8月17～24日・26～31日の日別事前申込、8月25日の活動なし、軽トラック協力、団体申込は参加確定ではない旨");

const misato = findCenter(north, "美里町");
Object.assign(misato, {
  recheck_status: "変更なし・要再確認",
  recheck_note: "公式ページを8月17日に再確認。申込定員到達による募集休止を継続表示しており、再開日は公表されていない。",
  remarks: "募集休止は公式ページの記載に基づく。再開日・受入人数は不明のため、再開を推測しない。",
});

const mifune = findCenter(north, "御船町");
Object.assign(mifune, {
  recruitment_status: "情報未確認（前回募集ページ・申込状況を保持）",
  recheck_status: "確認できず",
  recheck_note: "8月17日時点で追加の公式告知を確認できず。前回ページは8月16～22日の事前登録と人数上限を掲載する一方、申込フォームは公表日程の上限到達表示だったため、現行募集とは断定しない。",
  change_status: "現行受付確認できず",
  previous_known_state: "募集中（8月16日～22日・人数上限あり）",
  change_from_previous: "追加の現行告知を確認できないため、前回募集情報を履歴として保持し、現在募集中とは判定しない。",
  remarks: "公式情報を取得できないことは募集なしを意味しない。現行の受入可否・残席・団体条件は御船町災害ボランティアセンターへ照会する。",
});

const kashima = findCenter(north, "嘉島町");
Object.assign(kashima, {
  recheck_status: "確認できず",
  recheck_note: "8月17日時点で公式サイトの現行募集情報を取得できず。8月11～16日休止、8月17日以降未確認という前回値を保持し、募集なしとは判定しない。",
  remarks: "公式サイトの再取得不能。募集再開・団体・県外・大型バス・保険条件は要照会。募集なしとは判定していない。",
});

const mashiki = findCenter(south, "益城町");
Object.assign(mashiki, {
  recruitment_status: "情報未確認（8月17日以降の再開条件要確認）",
  recheck_status: "確認できず",
  recheck_note: "8月11～16日休止後の8月17日以降の再開条件・申込方法・人数を公式に確認できず。前回の休止情報を保持し、現行募集とは判定しない。",
  change_status: "再開条件確認できず",
  previous_known_state: "活動休止・8月17日以降要再確認",
  change_from_previous: "8月17日以降の募集詳細を確認できないため、休止後の現行受付を推測しない。",
  remarks: "8月17日以降に再開予定とされたが、募集日・申込方法・人数の公式確認がないため、募集中とは表示しない。",
});

const kosa = findCenter(south, "甲佐町");
Object.assign(kosa, {
  recheck_status: "確認できず",
  recheck_note: "8月17日時点で、個人フォームの最新受付状態と団体調整の現行可否を公式ページ本文から確定できず。前回の活動日・地域条件を保持する。",
  remarks: "九州圏内募集・団体個別調整の前回情報を保持。現行の個人枠・団体枠は申込前に公式ページへ照会する。",
});

const yatsushiro = findCenter(south, "八代市");
Object.assign(yatsushiro, {
  center_status: "開設・活動中",
  recruitment_status: "限定募集（団体・個別照会／8月17日以降の一般枠は要確認）",
  activity_start_date: "2026-08-17",
  activity_end_date: null,
  activity_dates_text: "8月15日時点で個人第1弾終了後の専用電話・団体申込ルートを確認。8月17日以降の一般枠・日別人数は追加の公式公表を確認できないため、団体・個別照会の受付だけを現行経路として表示する。",
  application_method: "団体申込フォーム又は災害ボランティアセンター専用電話で事前照会。一般個人枠の日程・人数は要確認。",
  application_form_status: "団体申込・専用電話による個別照会を確認。一般個人枠は要確認",
  recheck_status: "差分あり",
  recheck_note: "8月17日時点で、個人第1弾終了後も団体申込・専用電話による個別照会ルートを保持。一般個人枠の現行日程・人数は公表確認できず。",
  change_status: "募集経路更新",
  previous_known_state: "募集中（団体申込フォーム掲載・個人第1弾フォーム受付終了）",
  change_from_previous: "個人第1弾終了後の現行表示を団体・個別照会に限定し、一般個人枠は要確認に分離。",
  remarks: "団体・個別照会の経路があることと参加確定は別。一般個人枠の日程・人数は八代市災害ボランティアセンターへ照会する。",
});

const hikawa = findCenter(south, "氷川町");
Object.assign(hikawa, {
  center_status: "開設・活動中",
  recruitment_status: "募集中（8月14日～20日・8月17日休止）",
  activity_start_date: "2026-08-14",
  activity_end_date: "2026-08-31",
  activity_dates_text: "8月14日～20日の公式募集を継続。8月17日・24日・31日は仮置場休業のため活動休止。それ以外の日は通常どおり活動予定。",
  application_method: "公式Googleフォームによる事前登録。中学生以上。中学生は保護者同伴、高校生は同意書が必要。",
  application_form_status: "公式フォーム掲載（8月17日・24日・31日は活動休止）",
  official_source_name: sourceDefinitions["氷川町"].publisher,
  official_source_title: sourceDefinitions["氷川町"].title,
  official_source_url: sourceDefinitions["氷川町"].url,
  source_published_at: sourceDefinitions["氷川町"].published_at,
  source_updated_at: sourceDefinitions["氷川町"].updated_at,
  recheck_status: "差分あり",
  recheck_note: "8月16日掲載の休所日告知と8月9日掲載の募集告知を再確認。8月17・24・31日は休止、それ以外は通常活動予定。募集フォームは公式ページに掲載されている。",
  change_status: "休所日更新",
  previous_known_state: "受付終了・活動状況要確認",
  change_from_previous: "フォーム受付終了との前回表示を、公式ページ本文の募集フォーム掲載と休所日（8月17・24・31日）に更新。",
  remarks: "8月17・24・31日は活動休止。通常活動予定は実働完了を意味しない。熱中症警戒アラート時の変更・中止にも注意する。",
  activity_windows: [
    { start_date: "2026-08-14", end_date: "2026-08-16", status: "募集中", form_status: "公式フォーム掲載" },
    { start_date: "2026-08-17", end_date: "2026-08-17", status: "活動休止", form_status: "仮置場休業" },
    { start_date: "2026-08-18", end_date: "2026-08-23", status: "募集中", form_status: "通常活動予定" },
    { start_date: "2026-08-24", end_date: "2026-08-24", status: "活動休止", form_status: "仮置場休業" },
    { start_date: "2026-08-25", end_date: "2026-08-30", status: "募集中", form_status: "通常活動予定" },
    { start_date: "2026-08-31", end_date: "2026-08-31", status: "活動休止", form_status: "仮置場休業" },
  ],
});
upsertSource(hikawa, sourceDefinitions["氷川町"], "8月17・24・31日の活動休止と、それ以外は通常活動予定という8月16日告知");
upsertSource(hikawa, {
  publisher: "氷川町社会福祉協議会",
  title: "災害ボランティア募集のお知らせ【8/14～20】",
  url: "https://hikawa-syakyo.jp/news/%E7%81%BD%E5%AE%B3%E3%83%9C%E3%83%A9%E3%83%B3%E3%83%86%E3%82%A3%E3%82%A2%E5%8B%9F%E9%9B%86%E3%81%AE%E3%81%8A%E7%9F%A5%E3%82%89%E3%81%9B%E3%80%90%EF%BC%98-%EF%BC%91%EF%BC%94%EF%BD%9E%EF%BC%92%EF%BC%90%E3%80%91/",
  published_at: "2026-08-09",
  updated_at: "2026-08-09",
}, "8月14～20日の募集フォーム、中学生以上等の参加条件");

const ashikita = findCenter(south, "芦北町");
Object.assign(ashikita, {
  recruitment_status: "情報未確認（8月17日以降の通常VC移行条件要確認）",
  recheck_status: "確認できず",
  recheck_note: "一般募集終了、8月17日通常VC移行予定という前回告知以降の現行条件を確認できず。移行予定を実績・募集中とは扱わない。",
  change_status: "移行条件確認できず",
  previous_known_state: "募集終了・8月17日以降要再確認",
  change_from_previous: "8月17日通常VC移行予定の後続条件を確認できないため、現行募集を推測しない。",
  remarks: "一般募集終了は過去の公式告知。通常VC移行予定は実績・受入可能を意味しないため、現行条件は要照会。",
});

const statewidePath = "research_official_statewide.json";
const statewide = JSON.parse(await readFile(statewidePath, "utf8"));
statewide.checked_at = checkedAt;
for (const source of statewide.sources || []) source.checked_at = checkedAt;
if (statewide.statewide_facts) {
  statewide.statewide_facts.checked_at = checkedAt;
  statewide.statewide_facts.latest_checked_at = checkedAt;
}

for (const { file, data } of allData) await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
await writeFile(statewidePath, `${JSON.stringify(statewide, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  checkedAt,
  files: [...files, statewidePath],
  currentStatus: ["熊本市", "宇土市", "宇城市", "美里町", "御船町", "嘉島町", "益城町", "甲佐町", "八代市", "氷川町", "芦北町"].map((municipality) => {
    const center = [...north.municipalities, ...south.municipalities].find((item) => item.municipality === municipality);
    return { municipality, recruitment_status: center.recruitment_status, recheck_status: center.recheck_status };
  }),
}));

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIT_PATH = resolve(ROOT, "national-support-audit.json");
const SYNC_PATH = resolve(ROOT, "scripts/sync-national-support-audit.mjs");
const VALIDATOR_PATH = resolve(ROOT, "scripts/validate-national-support-audit.mjs");
const TEST_PATH = resolve(ROOT, "scripts/test-release-gate.mjs");
const LEDGER_PATH = resolve(ROOT, "operations/ledgers/refresh-20260824-2358.json");
const REFERENCE_AT = "2026-08-24T22:38:32+09:00";
const RECHECK_AT = "2026-08-24T23:58:00+09:00";
const RELEASE_ID = "20260824-2238";
const BASE_MAIN_SHA = "2e56e97623d309336be3d21b411fcfa848b37967";

const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8"));
if (audit.reference_at !== REFERENCE_AT || audit.release_id !== RELEASE_ID) {
  throw new Error(`unexpected audit base: ${audit.reference_at}/${audit.release_id}`);
}
audit.checked_at = RECHECK_AT;

function upsertSource(source) {
  const index = audit.sources.findIndex((item) => item.source_id === source.source_id);
  if (index >= 0) audit.sources[index] = source;
  else audit.sources.push(source);
}
function source(source_id, publisher, url, extra = {}) {
  return {
    source_id,
    publisher,
    kind: "official_web",
    url,
    source_as_of: extra.source_as_of ?? null,
    source_published_at: extra.source_published_at ?? null,
    source_updated_at: extra.source_updated_at ?? null,
    fetched_at: RECHECK_AT,
    checked_at: RECHECK_AT,
    primary: true,
    notes: extra.notes ?? "",
  };
}

upsertSource(source(
  "kitakyushu-support-current",
  "北九州市",
  "https://ssl.city.kitakyushu.lg.jp/contents/90000638_00003.html",
  {
    source_updated_at: "2026-08-21T00:00:00+09:00",
    notes: "現行支援ページを追加再確認。緊急消防援助隊第6次派遣は陸上隊2隊9名（8月12日から）、保健師第5班4名（8月21日から26日）、家屋被害認定調査第4班10名（8月22日から）を掲載。",
  },
));
upsertSource(source(
  "kantei-0812-health",
  "首相官邸",
  "https://www.kantei.go.jp/jp/105/actions/202608/12hijoukaigi.html",
  {
    source_as_of: "2026-08-12T00:00:00+09:00",
    source_published_at: "2026-08-12T00:00:00+09:00",
    notes: "8月12日時点の保健関係47チーム・医療関係150チーム・福祉関係15チームの活動実績をHISTORICAL指標として確認。",
  },
));
upsertSource(source(
  "kantei-0818-support",
  "首相官邸",
  "https://www.kantei.go.jp/jp/105/actions/202608/18hijoukaigi_chibagouu.html",
  {
    source_as_of: "2026-08-18T15:00:00+09:00",
    source_published_at: "2026-08-18T15:00:00+09:00",
    notes: "介護職員等の応援派遣・物資支援を実施中と確認。プッシュ型物資支援24億円を含む予備費242億円の使用決定と支援強化を確認。",
  },
));
upsertSource(source(
  "jwa-purifier-current",
  "独立行政法人水資源機構",
  "https://www.water.go.jp/honsya/honsya/bousai/r807kumamotojishin/index.html",
  {
    notes: "氷川町竜翔センター付近の可搬式浄水装置について、8月4日から給水支援活動を行っており、引き続き支援に取り組む旨を現行公式ページで確認。",
  },
));
upsertSource(source(
  "kumagyou-0814-current",
  "熊本県行政書士会",
  "https://www.kumagyou.jp/news/%E4%BB%A4%E5%92%8C8%E5%B9%B4%E7%86%8A%E6%9C%AC%E5%9C%B0%E9%9C%87%E3%81%AB%E4%BF%82%E3%82%8B%E3%80%8C%E7%BD%B9%E7%81%BD%E8%A8%BC%E6%98%8E%E6%9B%B8%E7%94%B3%E8%AB%8B%E6%94%AF%E6%8F%B4%E3%80%8D%E3%81%AB/",
  {
    source_as_of: "2026-08-14T00:00:00+09:00",
    source_published_at: "2026-08-14T00:00:00+09:00",
    notes: "電話相談を土日祝含め受付中、宇土市・宇城市で罹災証明書申請支援を継続実施。8月25日からの追加申請支援はPLANNEDとして分離。",
  },
));
upsertSource(source(
  "kantei-0803-finance",
  "首相官邸",
  "https://www.kantei.go.jp/jp/105/statement/2026/0803kaiken.html",
  {
    source_as_of: "2026-08-03T00:00:00+09:00",
    source_published_at: "2026-08-03T00:00:00+09:00",
    notes: "総額616億円の普通交付税の繰上げ交付を決定済みと公式確認。8月3日の現金交付完了そのものを示す一次記録は今回確認できず。",
  },
));
upsertSource(source(
  "tokushima-toilet-0824",
  "徳島県",
  "https://www.pref.tokushima.lg.jp/anshin/kinkyu/saigai-info/7315847/",
  {
    source_as_of: "2026-08-24T00:00:00+09:00",
    source_published_at: "2026-08-24T00:00:00+09:00",
    notes: "8月24日にリエゾン・避難所支援チーム計8名を派遣し、宇土市でトイレカー管理運営業務等に従事すると公式確認。",
  },
));
upsertSource(source(
  "moe-toilet-current",
  "環境省",
  "https://www.env.go.jp/saigai/kumamoto_earthquake_202607/sns/202608.html",
  {
    notes: "避難所の仮設トイレ・トイレカーを巡回し、良好な状態とし尿回収状況を確認しながら支援を継続する旨を公式災害対応ページで確認。",
  },
));
upsertSource(source(
  "yatsushiro-cert-0823",
  "八代市",
  "https://www.city.yatsushiro.lg.jp/kiji00326973/index.html",
  {
    source_as_of: "2026-08-18T00:00:00+09:00",
    source_updated_at: "2026-08-23T00:00:00+09:00",
    notes: "8月23日更新ページで、8月18日時点の申請11,207件、現地調査済1,608件、証明書交付済1,705件を公表し、調査を現在進めていると確認。県全体の8月18日累計とは定義・範囲を分離。",
  },
));

function record(id) {
  const found = audit.records.find((item) => item.record_id === id);
  if (!found) throw new Error(`missing record: ${id}`);
  return found;
}

Object.assign(record("national-rescue"), {
  provider: "消防庁・緊急消防援助隊等",
  adjudications: [
    {
      state: "CURRENT",
      scope: "緊急消防援助隊の現行派遣",
      value: "北九州市第6次派遣 陸上隊2隊9名",
      source_ids: ["kitakyushu-support-current"],
      notes: "現行公式支援ページで第6次派遣2隊9名を8月12日からの派遣として掲載。旧全国複合値とは別指標としてCURRENT表示する。",
    },
    {
      state: "HISTORICAL",
      scope: "8月2日全国複合人数・機数",
      source_ids: ["fdma-report60"],
      notes: "約100人・4機は8月2日実績としてのみ保持。",
    },
    {
      state: "HISTORICAL",
      scope: "鹿児島県大隊",
      source_ids: ["kagoshima-fire-end"],
      notes: "8月14日活動終了を公式確認。",
    },
  ],
  state: "CURRENT",
  source_ids: ["kitakyushu-support-current", "fdma-report60", "kagoshima-fire-end"],
  display: {
    status: "CURRENT",
    scale: "緊急消防援助隊：2隊9名（北九州市第6次）",
    period: "北九州市公式の現行支援ページで確認",
    detail: "北九州市の緊急消防援助隊第6次派遣は陸上隊2隊9名を現行掲載。8月2日の救急部隊約100人・航空4機はHISTORICALであり、全国を束ねた同一定義の現在総数には流用しない。",
    asOf: "8月24日23:58追加再監査",
    sourceLabel: "北九州市 令和8年熊本地震への支援",
    sourceUrl: "https://ssl.city.kitakyushu.lg.jp/contents/90000638_00003.html",
  },
  notes: "現行活動の実在と全国複合総数を分離。",
});

Object.assign(record("national-medical"), {
  adjudications: [
    {
      state: "CURRENT",
      scope: "保健医療福祉支援の現行活動",
      source_ids: ["kitakyushu-support-current", "kantei-0818-support", "mhlw-disaster-recheck"],
      notes: "北九州市の保健師第5班4名を8月21日から26日の現行派遣として掲載。政府も8月18日に介護職員等の応援派遣・物資支援を実施中と確認。",
    },
    {
      state: "HISTORICAL",
      scope: "8月12日時点の全国チーム数",
      value: "保健47チーム・医療150チーム・福祉15チーム",
      source_ids: ["kantei-0812-health"],
      notes: "8月12日時点の過去実績であり、8月24日の現在総数としては表示しない。",
    },
  ],
  state: "CURRENT",
  source_ids: ["kitakyushu-support-current", "kantei-0818-support", "mhlw-disaster-recheck", "kantei-0812-health"],
  display: {
    status: "CURRENT",
    scale: "保健医療福祉支援：活動継続を確認",
    period: "現行派遣例：保健師4名（北九州市第5班）",
    detail: "保健医療福祉支援の活動継続を一次情報で確認。北九州市は保健師第5班4名を8月21日から26日の現行派遣として掲載。8月12日の保健47・医療150・福祉15チームはHISTORICALで、基準日時点の全国同一定義総数は別途未確定。",
    asOf: "8月24日23:58追加再監査",
    sourceLabel: "北九州市支援状況・首相官邸・厚生労働省",
    sourceUrl: "https://ssl.city.kitakyushu.lg.jp/contents/90000638_00003.html",
  },
  notes: "活動継続と全国総数を分離。",
});

Object.assign(record("national-purifier"), {
  adjudications: [
    {
      state: "CURRENT",
      scope: "氷川町竜翔センター可搬式浄水装置",
      source_ids: ["jwa-purifier-current"],
      notes: "水資源機構の現行公式ページで、8月4日から給水支援活動を行い、引き続き支援に取り組む旨を確認。",
    },
  ],
  state: "CURRENT",
  source_ids: ["jwa-purifier-current", "mlit-report48"],
  display: {
    status: "CURRENT",
    scale: "氷川町竜翔センターで給水支援継続",
    period: "水資源機構 現行公式ページを追加確認",
    detail: "水資源機構は氷川町竜翔センター付近に可搬式浄水装置を設置し、8月4日から給水支援活動を実施。飲料水・生活用水や入浴支援に活用し、引き続き支援に取り組む旨を確認した。",
    asOf: "8月24日23:58追加再監査",
    sourceLabel: "水資源機構 令和8年熊本地震被災地への給水支援活動",
    sourceUrl: "https://www.water.go.jp/honsya/honsya/bousai/r807kumamotojishin/index.html",
  },
  notes: "装置単体の現行支援を公式ページの現在形記載で確認。",
});

Object.assign(record("national-push"), {
  adjudications: [
    {
      state: "HISTORICAL",
      scope: "8月18日時点のプッシュ型物資支援強化",
      value: "予備費24億円",
      source_ids: ["kantei-0818-support"],
      notes: "政府は8月18日にプッシュ型物資支援24億円を含む予備費使用を決定し、支援の迅速化・強化を表明。",
    },
    {
      state: "UNKNOWN",
      scope: "8月24日基準の同一プッシュ型物資スキーム継続状態",
      source_ids: ["kantei-0818-support", "cao-status-0823"],
      notes: "8月18日以降、同一定義のプッシュ型物資スキームが基準日時点で継続中かを直接示す一次情報を確認できない。無発表を終了・継続の根拠にしない。",
    },
  ],
  state: "UNKNOWN",
  source_ids: ["kantei-0818-support", "cao-status-0823", "kumamoto-hq-0802"],
  display: {
    status: "UNKNOWN",
    scale: "8/18：プッシュ型物資支援24億円・強化／8/24継続：UNKNOWN",
    period: "最新の同一スキーム明示は8月18日",
    detail: "8月18日に水・食料、段ボールベッド、スポットクーラー等のプッシュ型物資支援へ24億円を計上し支援強化を確認。一方、8月24日基準で同一スキームが継続中かを直接示す一次情報は確認できず、CURRENTには推定昇格しない。",
    asOf: "8月24日23:58追加再監査",
    sourceLabel: "首相官邸 8月18日非常災害対策本部会議",
    sourceUrl: "https://www.kantei.go.jp/jp/105/actions/202608/18hijoukaigi_chibagouu.html",
  },
  notes: "最新確認済み活動時点と基準時点の継続確認を分離。",
});

Object.assign(record("national-cert"), {
  adjudications: [
    {
      state: "CURRENT",
      scope: "住家被害認定調査支援",
      value: "北九州市第4班10名",
      source_ids: ["kitakyushu-support-current"],
      notes: "現行公式支援ページで家屋被害認定調査第4班10名を8月22日からの派遣として掲載。",
    },
    {
      state: "HISTORICAL",
      scope: "県全体8月18日累計",
      value: "申請50,932件／調査27,818件／証明書12,496件",
      source_ids: ["kumamoto-gov-0819"],
      notes: "県全体同一定義の8月18日累計はHISTORICAL。",
    },
    {
      state: "CURRENT",
      scope: "八代市の罹災証明事務",
      value: "申請・現地調査・交付を継続",
      source_ids: ["yatsushiro-cert-0823"],
      notes: "8月23日更新の八代市公式ページで調査を現在進めていると確認。掲載数値自体は8月18日時点。",
    },
  ],
  state: "CURRENT",
  source_ids: ["kitakyushu-support-current", "yatsushiro-cert-0823", "kumamoto-gov-0819"],
  display: {
    status: "CURRENT",
    scale: "住家被害認定調査支援：10名（北九州市第4班）",
    period: "第4班は8月22日から現行掲載",
    detail: "罹災証明に直結する住家被害認定調査は継続中。北九州市第4班10名を8月22日からの現行派遣として確認。県全体の申請50,932件・調査27,818件・交付12,496件は8月18日HISTORICALで、それ以後の県全体同一定義集計は未確定。",
    asOf: "8月24日23:58追加再監査",
    sourceLabel: "北九州市 家屋被害認定調査員派遣・八代市進捗",
    sourceUrl: "https://ssl.city.kitakyushu.lg.jp/contents/90000638_00003.html",
  },
  notes: "現在の業務継続と県全体累計の時点を分離。",
});

Object.assign(record("national-scrivener"), {
  adjudications: [
    {
      state: "CURRENT",
      scope: "宇土市・宇城市の罹災証明書申請支援・電話相談",
      source_ids: ["kumagyou-0814-current"],
      notes: "熊本県行政書士会の現行ページで宇土市・宇城市の申請支援を継続実施、電話相談を土日祝含め受付と確認。",
    },
    {
      state: "PLANNED",
      scope: "8月25日からの追加申請支援",
      source_ids: ["kumagyou-0814-current"],
      notes: "8月25日開始予定の支援は基準日時点ではPLANNED。",
    },
  ],
  state: "CURRENT",
  source_ids: ["kumagyou-0814-current", "cao-scrivener-0731"],
  display: {
    status: "CURRENT",
    scale: "宇土市・宇城市で申請支援継続／電話相談受付中",
    period: "電話相談8月14日から・8月25日追加支援はPLANNED",
    detail: "熊本県行政書士会は宇土市・宇城市で罹災証明書申請支援を継続実施し、土日祝を含む電話相談も受付中。8月25日からの追加申請支援は基準日時点ではPLANNEDとして分離する。",
    asOf: "8月24日23:58追加再監査",
    sourceLabel: "熊本県行政書士会 罹災証明書申請支援",
    sourceUrl: "https://www.kumagyou.jp/news/%E4%BB%A4%E5%92%8C8%E5%B9%B4%E7%86%8A%E6%9C%AC%E5%9C%B0%E9%9C%87%E3%81%AB%E4%BF%82%E3%82%8B%E3%80%8C%E7%BD%B9%E7%81%BD%E8%A8%BC%E6%98%8E%E6%9B%B8%E7%94%B3%E8%AB%8B%E6%94%AF%E6%8F%B4%E3%80%8D%E3%81%AB/",
  },
  notes: "旧7月31日値ではなく現行支援ページへ更新。",
});

Object.assign(record("national-finance"), {
  adjudications: [
    {
      state: "HISTORICAL",
      scope: "普通交付税繰上げ交付の決定",
      value: "総額616億円",
      source_ids: ["kantei-0803-finance", "kantei-0818-support"],
      notes: "首相官邸で総額616億円の繰上げ交付決定を確認。",
    },
    {
      state: "UNKNOWN",
      scope: "8月3日現金交付完了の一次確認",
      source_ids: ["kantei-0803-finance", "kantei-0818-support", "kumamoto-hq-0802"],
      notes: "一次情報は『決定』までは確認できるが、8月3日の現金交付完了を直接確認できる一次記録は今回見つからない。二次情報だけで実施済みに昇格しない。",
    },
  ],
  state: "UNKNOWN",
  source_ids: ["kantei-0803-finance", "kantei-0818-support", "kumamoto-hq-0802"],
  display: {
    status: "UNKNOWN",
    scale: "616億円の繰上げ交付決定：確認済／現金交付完了：UNKNOWN",
    period: "8/3決定を一次確認・実施完了は未確認",
    detail: "政府一次情報で普通交付税総額616億円の繰上げ交付決定は確認済み。一方、旧県資料の『8月3日現金交付予定』が実際に完了したことを直接示す一次記録は確認できず、実施完了はUNKNOWNのままとする。",
    asOf: "8月24日23:58追加再監査",
    sourceLabel: "首相官邸 8月3日会見・8月18日非常災害対策本部会議",
    sourceUrl: "https://www.kantei.go.jp/jp/105/statement/2026/0803kaiken.html",
  },
  notes: "決定と現金交付完了を分離。",
});

Object.assign(record("national-toilets"), {
  adjudications: [
    {
      state: "CURRENT",
      scope: "トイレカー管理運営・避難所トイレ環境支援",
      source_ids: ["tokushima-toilet-0824", "moe-toilet-current"],
      notes: "徳島県が8月24日に宇土市へ派遣し、トイレカー管理運営業務等に従事すると確認。環境省も仮設トイレ・トイレカー巡回を継続。",
    },
    {
      state: "HISTORICAL",
      scope: "8月19日設備数",
      value: "トイレカー26台、仮設トイレ120基等・計296設備",
      source_ids: ["kumamoto-gov-0819"],
      notes: "8月19日設備数はHISTORICALであり、現在総数には流用しない。",
    },
  ],
  state: "CURRENT",
  source_ids: ["tokushima-toilet-0824", "moe-toilet-current", "kumamoto-gov-0819"],
  display: {
    status: "CURRENT",
    scale: "トイレカー管理運営・巡回支援を継続確認",
    period: "徳島県8月24日派遣／環境省現行巡回",
    detail: "徳島県は8月24日にリエゾン・避難所支援チーム計8名を派遣し、宇土市でトイレカー管理運営業務等に従事。環境省も避難所の仮設トイレ・トイレカーを巡回し、状態・し尿回収を確認しながら支援を継続している。8月19日の計296設備はHISTORICAL。",
    asOf: "8月24日23:58追加再監査",
    sourceLabel: "徳島県派遣情報・環境省災害対応",
    sourceUrl: "https://www.pref.tokushima.lg.jp/anshin/kinkyu/saigai-info/7315847/",
  },
  notes: "現在の活動継続と過去設備総数を分離。",
});

for (const item of audit.agency_coverage) {
  if (item.agency.includes("消防庁")) {
    item.status = "rechecked_current";
    item.source_ids = ["fdma-report60", "kitakyushu-support-current", "kagoshima-fire-end"];
    item.notes = "全国複合総数は未集計だが、緊急消防援助隊の現行活動を派遣元公式ページで確認。";
  } else if (item.agency.includes("厚生労働省")) {
    item.status = "rechecked_current";
    item.source_ids = ["mhlw-disaster-recheck", "kantei-0818-support", "kitakyushu-support-current"];
    item.notes = "保健医療福祉支援の活動継続を確認。全国同一定義総数は別途未確定。";
  } else if (item.agency.includes("総務省（財政措置）")) {
    item.status = "unknown_needs_recheck";
    item.source_ids = ["kantei-0803-finance", "kantei-0818-support", "kumamoto-hq-0802"];
    item.notes = "616億円の繰上げ交付決定は確認済み。8月3日現金交付完了の一次確認のみ残る。";
  } else if (item.agency.includes("全国医療・福祉")) {
    item.status = "rechecked_current";
    item.source_ids = ["kantei-0818-support", "mhlw-disaster-recheck", "kitakyushu-support-current"];
    item.notes = "活動継続を確認。全国複合総数は時点・定義を分離。";
  } else if (item.agency.includes("水資源機構")) {
    item.status = "rechecked_current";
    item.source_ids = ["jwa-purifier-current", "mlit-report48"];
    item.notes = "可搬式浄水装置による氷川町での給水支援継続を現行公式ページで確認。";
  }
}
if (!audit.agency_coverage.some((item) => item.agency.includes("環境省"))) {
  audit.agency_coverage.push({
    agency: "環境省・避難所トイレ環境支援",
    status: "rechecked_current",
    source_ids: ["moe-toilet-current", "tokushima-toilet-0824"],
    notes: "仮設トイレ・トイレカー巡回と8月24日のトイレカー管理運営業務派遣を確認。",
  });
}

audit.summary = {
  existing_records_audited: 12,
  records_total: 13,
  CURRENT: 10,
  HISTORICAL: 0,
  PLANNED: 1,
  UNKNOWN: 2,
  CONFLICT: 0,
  accepted_unresolved_count: 6,
  blocking_unresolved_count: 0,
};

writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

let sync = readFileSync(SYNC_PATH, "utf8");
sync = sync.replace(
  "8月24日22:38に既存12レコードを全件再監査（監査レコード計13件）",
  "8月24日22:38基準・23:58追加再監査（既存12件＋追加1件）",
);
sync = sync.replace(
  "消防・医療等の同一定義現況を確定できない項目はUNKNOWN、8月26日TEC-FORCE第5陣はPLANNED",
  "旧UNKNOWN 8件を追加再裁定：6件CURRENT、2件UNKNOWN。全国同一定義総数等は詳細で時点分離、8月26日TEC-FORCE第5陣はPLANNED",
);
sync = sync.replace(
  'source = replaceOverviewResource(source, "national-rescue", "救急・航空支援", "UNKNOWN", "8/2 約100人・4機はHISTORICAL");',
  'source = replaceOverviewResource(source, "national-rescue", "救急・消防支援", "2隊9名", "8/2 約100人・4機はHISTORICAL／北九州市第6次を現行掲載");',
);
sync = sync.replace(
  'source = source.replaceAll("8月2日公表値・継続要確認", "8/2実績はHISTORICAL・現況UNKNOWN");',
  'source = source.replaceAll("8月2日公表値・継続要確認", "8/2実績はHISTORICAL・現行の緊急消防援助隊活動を別表示");',
);
sync = sync.replace(
  'source: "内閣府8/23・消防庁第60報・国交省第48報・防衛省8/23ほか",',
  'source: "内閣府8/23・消防庁第60報・国交省第48報・防衛省8/23・追加一次情報8/24ほか",',
);
writeFileSync(SYNC_PATH, sync, "utf8");

let validator = readFileSync(VALIDATOR_PATH, "utf8");
validator = validator.replace(
  'if (audit.reference_at !== audit.checked_at) fail("今回の全件監査ではchecked_atをreference_atへ固定してください。");',
  'if (Date.parse(audit.checked_at) < Date.parse(audit.reference_at)) fail("checked_atはreference_at以後で必要です。");',
);
validator = validator.replace(
  '  if (item.checked_at !== audit.reference_at) fail(`source.checked_atがreference_atと不一致: ${item.source_id}`);',
  '  if (Number.isNaN(Date.parse(item.checked_at)) || Date.parse(item.checked_at) < Date.parse(audit.reference_at) || Date.parse(item.checked_at) > Date.parse(audit.checked_at)) fail(`source.checked_atはreference_at以上かつaudit.checked_at以下で必要です: ${item.source_id}`);',
);
validator = validator.replace(
  'if (!resourceRegion.includes("119台") || !resourceRegion.includes("4,507人日") || !resourceRegion.includes("UNKNOWN")) fail("主要投入資源がnational auditの裁定表示へ更新されていません。");',
  'if (!resourceRegion.includes("119台") || !resourceRegion.includes("4,507人日") || !resourceRegion.includes("2隊9名")) fail("主要投入資源がnational auditの裁定表示へ更新されていません。");',
);
validator = validator.replace(
  'if (!rescueCard.includes(\'<div class="overview-resource-value">UNKNOWN</div>\')) fail("救急・航空支援の現況値がUNKNOWNになっていません。");',
  'if (!rescueCard.includes(\'<div class="overview-resource-value">2隊9名</div>\')) fail("救急・消防支援の現行確認値が2隊9名になっていません。");',
);
writeFileSync(VALIDATOR_PATH, validator, "utf8");

let tests = readFileSync(TEST_PATH, "utf8");
const oldFault = `    const target = audit.records.find((item) => item.record_id === "national-rescue");\n    target.display.scale = target.previous_snapshot.value;`;
const newFault = `    const target = audit.records.find((item) => item.record_id === "national-finance");\n    target.display.scale = target.previous_snapshot.value;`;
if (!tests.includes(oldFault)) throw new Error("release-gate UNKNOWN fault injection anchor missing");
tests = tests.replace(oldFault, newFault);
writeFileSync(TEST_PATH, tests, "utf8");

const accepted = [
  {
    issue_id: "national-rescue-current-composite-total",
    state: "UNKNOWN",
    reason: "緊急消防援助隊の現行活動は確認できたが、消防・警察・自衛隊・航空を束ねた旧定義の全国総数は基準日時点で一次情報により確定できない。",
    owner: "national-support-audit",
    source_ids: ["fdma-report60", "kitakyushu-support-current"],
    next_review_at: "2026-08-25T09:00:00+09:00",
  },
  {
    issue_id: "national-medical-current-composite-total",
    state: "UNKNOWN",
    reason: "保健医療福祉支援の活動継続は確認できたが、DHEAT・DMAT・DPAT・日赤等を束ねた同一定義の全国現況総数は確定できない。",
    owner: "national-support-audit",
    source_ids: ["mhlw-disaster-recheck", "kitakyushu-support-current", "kantei-0818-support"],
    next_review_at: "2026-08-25T09:00:00+09:00",
  },
  {
    issue_id: "national-push-current-state",
    state: "UNKNOWN",
    reason: "8月18日のプッシュ型物資支援24億円・支援強化までは一次確認できるが、8月24日基準で同一スキームが継続中かを直接示す一次情報を確認できない。",
    owner: "national-support-audit",
    source_ids: ["kantei-0818-support", "cao-status-0823"],
    next_review_at: "2026-08-25T09:00:00+09:00",
  },
  {
    issue_id: "national-cert-statewide-latest-aggregate",
    state: "UNKNOWN",
    reason: "罹災証明関連業務の現行活動は確認できたが、県全体の8月18日累計より新しい同一定義の申請・調査・交付総数を一次情報で確定できない。",
    owner: "national-support-audit",
    source_ids: ["kitakyushu-support-current", "yatsushiro-cert-0823"],
    next_review_at: "2026-08-25T09:00:00+09:00",
  },
  {
    issue_id: "national-finance-execution",
    state: "UNKNOWN",
    reason: "普通交付税616億円の繰上げ交付決定は一次確認済みだが、8月3日の現金交付完了を直接示す一次記録を確認できない。",
    owner: "national-support-audit",
    source_ids: ["kantei-0803-finance", "kantei-0818-support"],
    next_review_at: "2026-08-25T09:00:00+09:00",
  },
  {
    issue_id: "national-toilets-current-aggregate",
    state: "UNKNOWN",
    reason: "トイレカー管理運営・環境省巡回の現行活動は確認できたが、8月19日の296設備より新しい同一定義の全国設備総数は確定できない。",
    owner: "national-support-audit",
    source_ids: ["tokushima-toilet-0824", "moe-toilet-current"],
    next_review_at: "2026-08-25T09:00:00+09:00",
  },
];

const ledgerSources = [
  ["fdma-report60", "https://www.fdma.go.jp/disaster/info/2026/"],
  ["mhlw-disaster-recheck", "https://www.mhlw.go.jp/stf/newpage_73935.html"],
  ["cao-status-0823", "https://www.bousai.go.jp/updates/r8kumamoto_jishin/status/index.html"],
  ["kitakyushu-support-current", "https://ssl.city.kitakyushu.lg.jp/contents/90000638_00003.html"],
  ["kantei-0818-support", "https://www.kantei.go.jp/jp/105/actions/202608/18hijoukaigi_chibagouu.html"],
  ["jwa-purifier-current", "https://www.water.go.jp/honsya/honsya/bousai/r807kumamotojishin/index.html"],
  ["kumagyou-0814-current", "https://www.kumagyou.jp/news/%E4%BB%A4%E5%92%8C8%E5%B9%B4%E7%86%8A%E6%9C%AC%E5%9C%B0%E9%9C%87%E3%81%AB%E4%BF%82%E3%82%8B%E3%80%8C%E7%BD%B9%E7%81%BD%E8%A8%BC%E6%98%8E%E6%9B%B8%E7%94%B3%E8%AB%8B%E6%94%AF%E6%8F%B4%E3%80%8D%E3%81%AB/"],
  ["kantei-0803-finance", "https://www.kantei.go.jp/jp/105/statement/2026/0803kaiken.html"],
  ["tokushima-toilet-0824", "https://www.pref.tokushima.lg.jp/anshin/kinkyu/saigai-info/7315847/"],
  ["moe-toilet-current", "https://www.env.go.jp/saigai/kumamoto_earthquake_202607/sns/202608.html"],
  ["yatsushiro-cert-0823", "https://www.city.yatsushiro.lg.jp/kiji00326973/index.html"],
].map(([source_id, url]) => ({ source_id, url }));

const ledger = {
  schema_version: 2,
  repository: "ryotamatsuki/kumamotoshienmap",
  update_type: "timepoint_refresh",
  gate_phase: "pre_merge",
  update_id: "refresh-20260824-2358",
  release_id: RELEASE_ID,
  reference_at: REFERENCE_AT,
  page_checked_at: null,
  base_main_sha: BASE_MAIN_SHA,
  expected_changed_files: [
    ".github/workflows/post-deploy-pages-smoke.yml",
    "ehime_kumamoto_support_geocoded_shelters_20260802.html",
    "national-support-audit.json",
    "operations/ledgers/refresh-20260824-2358.json",
    "public/dashboard.html",
    "scripts/sync-national-support-audit.mjs",
    "scripts/test-release-gate.mjs",
    "scripts/validate-national-support-audit.mjs"
  ],
  sources: ledgerSources,
  coverage: {
    current_count: 67,
    unresolved_count: 0,
    conflict_count: 0,
    municipal_support: "audited",
    national_support: "audited",
    national_support_records: 13,
    national_support_states: { CURRENT: 10, HISTORICAL: 0, PLANNED: 1, UNKNOWN: 2, CONFLICT: 0 },
    institution_coverage: "same-reference national re-adjudication; existing entity inventory retained",
    previous_unknown_records: 8,
    resolved_record_states: 6,
    remaining_unknown_records: ["national-push", "national-finance"]
  },
  snapshots: {
    national_previous_states: { CURRENT: 4, HISTORICAL: 0, PLANNED: 1, UNKNOWN: 8, CONFLICT: 0 },
    national_rechecked_states: { CURRENT: 10, HISTORICAL: 0, PLANNED: 1, UNKNOWN: 2, CONFLICT: 0 },
    reference_at: REFERENCE_AT,
    rechecked_at: RECHECK_AT
  },
  blocking_unresolved: [],
  accepted_unresolved: accepted
};
mkdirSync(dirname(LEDGER_PATH), { recursive: true });
writeFileSync(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  status: "PASS",
  reference_at: REFERENCE_AT,
  rechecked_at: RECHECK_AT,
  states: audit.summary,
  remaining_record_unknowns: ["national-push", "national-finance"],
}));

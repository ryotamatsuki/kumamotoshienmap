import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const north = JSON.parse(readFileSync(join(root, "research_official_north.json"), "utf8"));
const south = JSON.parse(readFileSync(join(root, "research_official_south.json"), "utf8"));
const statewideResearch = JSON.parse(readFileSync(join(root, "research_official_statewide.json"), "utf8"));

const requiredFields = [
  "municipality","district","center_status","recruitment_status","activity_start_date","activity_end_date",
  "activity_dates_text","daily_capacity","total_capacity","capacity_unit","capacity_disclosed","remaining_capacity",
  "recruitment_area","outside_prefecture_allowed","individual_allowed","group_allowed","group_application_available",
  "minimum_age","age_conditions","activity_types","activity_description","application_required","application_method",
  "application_url","application_deadline","meeting_place","address","reception_time","activity_time","parking",
  "vehicle_access","vehicle_need","equipment_required","insurance_requirement","accommodation_information",
  "meal_information","water_information","toilet_information","transport_information","toll_exemption_information",
  "contact","email","group_dispatch_assessment","ehime_dispatch_status","official_source_name",
  "official_source_title","official_source_url","source_published_at","source_updated_at","checked_at",
  "change_status","remarks"
];
const optionalFields = [
  "outside_kyushu_allowed","ehime_participation_allowed","outside_prefecture_note","application_form_status",
  "safety_note","infrastructure_note","priority_note","needs_reconfirmation","information_confidence",
  "change_from_previous","changes_from_previous","previous_known_state","application_urls","activity_windows","sources",
  "district_capacities","official_information_conflict","portal_coverage_checked_at","recheck_status","recheck_note",
  "eligibility_currently_applicable"
];
const activityAliases = new Map([
  ["災害ごみの運搬","災害ごみの分別・運搬"],["災害ごみの分別","災害ごみの分別・運搬"],
  ["瓦等の撤去","瓦・がれき等の撤去"],["瓦の撤去","瓦・がれき等の撤去"],["瓦の片付け","瓦・がれき等の撤去"],
  ["物資の仕分け","物資の仕分け・運搬"],["物資の運搬","物資の仕分け・運搬"],
  ["支援物資の仕分け","物資の仕分け・運搬"],["支援物資の運搬","物資の仕分け・運搬"]
]);
function normalizeCenter(center){
  const normalized = {};
  for(const field of requiredFields) normalized[field] = center[field] ?? null;
  for(const field of optionalFields) normalized[field] = center[field] ?? null;
  if(!normalized.change_from_previous && Array.isArray(center.changes_from_previous)){
    normalized.change_from_previous = center.changes_from_previous.join("。");
  }
  if(typeof normalized.remarks === "string"){
    normalized.remarks = normalized.remarks.split("。").filter((sentence)=>
      !/過去|予算資料|内部資料|添付資料|参考資料/.test(sentence)
    ).filter(Boolean).join("。");
  }
  normalized.activity_types = [...new Set((center.activity_types || []).map((value)=>activityAliases.get(value) || value))];
  normalized.capacity_disclosed = center.capacity_disclosed === true ? true : null;
  normalized.researched = true;
  normalized.activity_dates_confirmed = Boolean(
    normalized.activity_start_date && normalized.activity_end_date &&
    !String(normalized.recruitment_status || "").includes("準備")
  );
  return normalized;
}

const order = ["熊本市","宇土市","宇城市","美里町","御船町","嘉島町","益城町","甲佐町","八代市","氷川町","芦北町"];
const merged = [...north.municipalities, ...south.municipalities];
const centers = order.map((name)=>{
  const center = merged.find((item)=>item.municipality === name);
  if(!center) throw new Error("Missing researched municipality: "+name);
  return normalizeCenter(center);
});
const calendarOverrides = {
  "熊本市":{
    "2026-08-09":{key:"full",label:"第1期定員到達",countable:false},
    "2026-08-10":{key:"full",label:"本部・南区とも定員到達",countable:false},
    "2026-08-11":{key:"full",label:"本部・南区とも定員到達",countable:false},
    "2026-08-12":{key:"full",label:"本部・南区とも定員到達",countable:false},
    "2026-08-13":{key:"full",label:"本部・南区とも定員到達",countable:false},
    "2026-08-14":{key:"full",label:"本部・南区とも定員到達",countable:false},
    "2026-08-15":{key:"unknown",label:"以降は再告知待ち",countable:false}
  },
  "八代市":{
    "2026-08-09":{key:"planned",label:"募集受付中・活動開始前",countable:false},
    "2026-08-10":{key:"recruiting",label:"募集中",countable:true},
    "2026-08-11":{key:"recruiting",label:"募集中",countable:true},
    "2026-08-12":{key:"recruiting",label:"募集中",countable:true},
    "2026-08-13":{key:"recruiting",label:"募集中",countable:true},
    "2026-08-14":{key:"recruiting",label:"募集中",countable:true},
    "2026-08-15":{key:"recruiting",label:"募集中",countable:true},
    "2026-08-16":{key:"recruiting",label:"募集中",countable:true}
  },
  "宇土市":{
    "2026-08-09":{key:"unknown",label:"第1期の現行受付状況要確認",countable:false},
    "2026-08-10":{key:"unknown",label:"第1期の現行受付状況要確認",countable:false},
    "2026-08-11":{key:"unknown",label:"第1期の現行受付状況要確認",countable:false},
    "2026-08-12":{key:"none",label:"活動なし",countable:false},
    "2026-08-13":{key:"recruiting",label:"第2期募集中・50人程度",capacity:"50人程度／日",countable:true},
    "2026-08-14":{key:"recruiting",label:"第2期募集中・50人程度",capacity:"50人程度／日",countable:true},
    "2026-08-15":{key:"recruiting",label:"第2期募集中・50人程度",capacity:"50人程度／日",countable:true},
    "2026-08-16":{key:"recruiting",label:"第2期募集中・50人程度",capacity:"50人程度／日",countable:true},
    "2026-08-17":{key:"recruiting",label:"第2期募集中・50人程度",capacity:"50人程度／日",countable:true},
    "2026-08-18":{key:"recruiting",label:"第2期募集中・50人程度",capacity:"50人程度／日",countable:true},
    "2026-08-19":{key:"recruiting",label:"第2期募集中・50人程度",capacity:"50人程度／日",countable:true}
  },
  "宇城市":{
    "2026-08-09":{key:"unknown",label:"現行受付可否を確認できず",countable:false},
    "2026-08-10":{key:"unknown",label:"現行受付可否を確認できず",countable:false},
    "2026-08-11":{key:"unknown",label:"現行受付可否を確認できず",countable:false},
    "2026-08-12":{key:"unknown",label:"現行受付可否を確認できず",countable:false},
    "2026-08-13":{key:"unknown",label:"現行受付可否を確認できず",countable:false},
    "2026-08-14":{key:"unknown",label:"現行受付可否を確認できず",countable:false},
    "2026-08-15":{key:"full",label:"受付終了",countable:false},
    "2026-08-16":{key:"recruiting",label:"受付中",countable:true},
    "2026-08-17":{key:"unknown",label:"日別フォーム要確認",countable:false},
    "2026-08-18":{key:"unknown",label:"日別フォーム要確認",countable:false},
    "2026-08-19":{key:"unknown",label:"日別フォーム要確認",countable:false},
    "2026-08-20":{key:"unknown",label:"日別フォーム要確認",countable:false},
    "2026-08-21":{key:"unknown",label:"日別フォーム要確認",countable:false},
    "2026-08-22":{key:"unknown",label:"日別フォーム要確認",countable:false}
  },
  "美里町":{
    "2026-08-09":{key:"paused",label:"募集休止・再開日未公表",countable:false}
  },
  "御船町":{
    "2026-08-09":{key:"unknown",label:"追加日程を確認できず",countable:false}
  },
  "嘉島町":{
    "2026-08-09":{key:"full",label:"受付終了・30人程度",capacity:"30人程度／日",countable:false},
    "2026-08-10":{key:"full",label:"受付終了・30人程度",capacity:"30人程度／日",countable:false},
    "2026-08-11":{key:"paused",label:"活動休止",countable:false},
    "2026-08-12":{key:"paused",label:"活動休止",countable:false},
    "2026-08-13":{key:"paused",label:"活動休止",countable:false},
    "2026-08-14":{key:"paused",label:"活動休止",countable:false},
    "2026-08-15":{key:"paused",label:"活動休止",countable:false},
    "2026-08-16":{key:"paused",label:"活動休止",countable:false}
  },
  "益城町":{
    "2026-08-09":{key:"recruiting",label:"募集中・70人程度",capacity:"70人程度／日",countable:true},
    "2026-08-10":{key:"recruiting",label:"募集中・70人程度",capacity:"70人程度／日",countable:true},
    "2026-08-11":{key:"paused",label:"活動休止",countable:false},
    "2026-08-12":{key:"paused",label:"活動休止",countable:false},
    "2026-08-13":{key:"paused",label:"活動休止",countable:false},
    "2026-08-14":{key:"paused",label:"活動休止",countable:false},
    "2026-08-15":{key:"paused",label:"活動休止",countable:false},
    "2026-08-16":{key:"paused",label:"活動休止",countable:false},
    "2026-08-17":{key:"unknown",label:"以降は再告知待ち",countable:false}
  },
  "甲佐町":{
    "2026-08-09":{key:"full",label:"定員到達",countable:false},
    "2026-08-10":{key:"full",label:"定員到達",countable:false},
    "2026-08-11":{key:"full",label:"定員到達",countable:false},
    "2026-08-12":{key:"full",label:"定員到達",countable:false},
    "2026-08-13":{key:"planned",label:"近日募集予定・日程要確認",countable:false}
  },
  "氷川町":{
    "2026-08-09":{key:"recruiting",label:"全国募集中",countable:true},
    "2026-08-10":{key:"recruiting",label:"全国募集中",countable:true},
    "2026-08-11":{key:"recruiting",label:"全国募集中",countable:true},
    "2026-08-12":{key:"recruiting",label:"全国募集中",countable:true}
  },
  "芦北町":{
    "2026-08-09":{key:"recruiting",label:"地域限定・受付中",countable:true},
    "2026-08-10":{key:"recruiting",label:"地域限定・受付中",countable:true},
    "2026-08-11":{key:"recruiting",label:"地域限定・受付中",countable:true},
    "2026-08-12":{key:"recruiting",label:"地域限定・受付中",countable:true},
    "2026-08-13":{key:"recruiting",label:"地域限定・受付中",countable:true},
    "2026-08-14":{key:"recruiting",label:"地域限定・受付中",countable:true},
    "2026-08-15":{key:"unknown",label:"以降は未公表",countable:false}
  }
};
// Current-date overrides are kept separately from the original snapshot rules.
// They are intentionally conservative: a closed form is not treated as a
// capacity reached state unless the official page says so, and planned dates
// are never counted as activity dates.
const currentCalendarOverrides = {
  "熊本市": {
    "2026-08-11": {key:"full",label:"第1期募集締切",countable:false},
    "2026-08-12": {key:"full",label:"第1期募集締切",countable:false},
    "2026-08-13": {key:"full",label:"第1期募集締切",countable:false},
    "2026-08-14": {key:"full",label:"第1期募集締切",countable:false},
    "2026-08-15": {key:"full",label:"第1期募集締切・第2期情報確認",countable:false},
    "2026-08-16": {key:"full",label:"第2期必要人数到達・締切",countable:false},
    "2026-08-17": {key:"full",label:"第2期必要人数到達・締切",countable:false},
    "2026-08-18": {key:"full",label:"第2期必要人数到達・締切",countable:false},
    "2026-08-19": {key:"full",label:"第2期必要人数到達・締切",countable:false},
    "2026-08-20": {key:"full",label:"第2期必要人数到達・締切",countable:false},
    "2026-08-21": {key:"full",label:"第2期必要人数到達・締切",countable:false},
    "2026-08-22": {key:"full",label:"第2期必要人数到達・締切",countable:false},
    "2026-08-23": {key:"full",label:"第2期必要人数到達・締切",countable:false},
    "2026-08-24": {key:"unknown",label:"再告知予定・現況未確認",countable:false},
    "2026-08-25": {key:"unknown",label:"再告知予定・現況未確認",countable:false},
    "2026-08-26": {key:"unknown",label:"再告知予定・現況未確認",countable:false},
    "2026-08-27": {key:"unknown",label:"再告知予定・現況未確認",countable:false},
    "2026-08-28": {key:"unknown",label:"再告知予定・現況未確認",countable:false},
    "2026-08-29": {key:"unknown",label:"再告知予定・現況未確認",countable:false},
    "2026-08-30": {key:"unknown",label:"再告知予定・現況未確認",countable:false},
    "2026-08-31": {key:"unknown",label:"再告知予定・現況未確認",countable:false}
  },
  "八代市": {
    "2026-08-11": {key:"recruiting",label:"団体申込フォームで事前調整",countable:true},
    "2026-08-12": {key:"recruiting",label:"団体申込フォームで事前調整",countable:true},
    "2026-08-13": {key:"recruiting",label:"団体申込フォームで事前調整",countable:true},
    "2026-08-14": {key:"recruiting",label:"団体申込フォームで事前調整",countable:true},
    "2026-08-15": {key:"recruiting",label:"団体申込フォームで事前調整",countable:true},
    "2026-08-16": {key:"recruiting",label:"団体申込フォームで事前調整",countable:true},
    "2026-08-17": {key:"unknown",label:"第1弾終了後の日程は要確認",countable:false},
    "2026-08-18": {key:"unknown",label:"第1弾終了後の日程は要確認",countable:false},
    "2026-08-19": {key:"unknown",label:"第1弾終了後の日程は要確認",countable:false},
    "2026-08-20": {key:"unknown",label:"第1弾終了後の日程は要確認",countable:false},
    "2026-08-21": {key:"unknown",label:"第1弾終了後の日程は要確認",countable:false},
    "2026-08-22": {key:"unknown",label:"第1弾終了後の日程は要確認",countable:false},
    "2026-08-23": {key:"unknown",label:"第1弾終了後の日程は要確認",countable:false},
    "2026-08-24": {key:"unknown",label:"第1弾終了後の日程は要確認",countable:false}
  },
  "宇土市": {
    "2026-08-11": {key:"unknown",label:"申込フォーム受付終了・理由未公表",countable:false},
    "2026-08-12": {key:"none",label:"ニーズ整理・調整のため活動なし",countable:false},
    "2026-08-13": {key:"unknown",label:"フォーム受付終了・理由未公表",capacity:"70人程度／日",countable:false},
    "2026-08-14": {key:"unknown",label:"フォーム受付終了・理由未公表",capacity:"70人程度／日",countable:false},
    "2026-08-15": {key:"unknown",label:"フォーム受付終了・理由未公表",capacity:"70人程度／日",countable:false},
    "2026-08-16": {key:"unknown",label:"フォーム受付終了・理由未公表",capacity:"70人程度／日",countable:false},
    "2026-08-17": {key:"unknown",label:"フォーム受付終了・理由未公表",capacity:"70人程度／日",countable:false},
    "2026-08-18": {key:"unknown",label:"フォーム受付終了・理由未公表",capacity:"70人程度／日",countable:false},
    "2026-08-19": {key:"unknown",label:"フォーム受付終了・理由未公表",capacity:"70人程度／日",countable:false},
    "2026-08-20": {key:"unknown",label:"第2期後の日程は要確認",countable:false},
    "2026-08-21": {key:"unknown",label:"第2期後の日程は要確認",countable:false},
    "2026-08-22": {key:"unknown",label:"第2期後の日程は要確認",countable:false},
    "2026-08-23": {key:"unknown",label:"第2期後の日程は要確認",countable:false},
    "2026-08-24": {key:"unknown",label:"第2期後の日程は要確認",countable:false}
  },
  "宇城市": {
    "2026-08-11": {key:"unknown",label:"日別受付状況を要確認",countable:false},
    "2026-08-12": {key:"unknown",label:"日別受付状況を要確認",countable:false},
    "2026-08-13": {key:"unknown",label:"日別受付状況を要確認",countable:false},
    "2026-08-14": {key:"unknown",label:"日別受付状況を要確認",countable:false},
    "2026-08-15": {key:"full",label:"定数到達",countable:false},
    "2026-08-16": {key:"full",label:"定員到達・締切",countable:false},
    "2026-08-17": {key:"full",label:"定員到達・締切",countable:false},
    "2026-08-18": {key:"full",label:"定員到達・締切",countable:false},
    "2026-08-19": {key:"full",label:"定員到達・締切",countable:false},
    "2026-08-20": {key:"full",label:"定員到達・締切",countable:false},
    "2026-08-21": {key:"full",label:"定員到達・締切",countable:false},
    "2026-08-22": {key:"full",label:"定員到達・締切",countable:false},
    "2026-08-23": {key:"full",label:"定員到達・締切",countable:false},
    "2026-08-24": {key:"unknown",label:"8月24日以降は要確認",countable:false}
  },
  "美里町": {
    "2026-08-11": {key:"paused",label:"募集休止（定員到達）",countable:false},
    "2026-08-12": {key:"paused",label:"募集休止（定員到達）",countable:false},
    "2026-08-13": {key:"paused",label:"募集休止（定員到達）",countable:false},
    "2026-08-14": {key:"paused",label:"募集休止（定員到達）",countable:false},
    "2026-08-15": {key:"paused",label:"募集休止（定員到達）",countable:false},
    "2026-08-16": {key:"paused",label:"募集休止（定員到達）",countable:false},
    "2026-08-17": {key:"unknown",label:"再開日未公表",countable:false},
    "2026-08-18": {key:"unknown",label:"再開日未公表",countable:false},
    "2026-08-19": {key:"unknown",label:"再開日未公表",countable:false},
    "2026-08-20": {key:"unknown",label:"再開日未公表",countable:false},
    "2026-08-21": {key:"unknown",label:"再開日未公表",countable:false},
    "2026-08-22": {key:"unknown",label:"再開日未公表",countable:false},
    "2026-08-23": {key:"unknown",label:"再開日未公表",countable:false},
    "2026-08-24": {key:"unknown",label:"再開日未公表",countable:false}
  },
  "御船町": {
    "2026-08-11": {key:"full",label:"定員到達",countable:false},
    "2026-08-12": {key:"full",label:"定員到達",countable:false},
    "2026-08-13": {key:"full",label:"定員到達",countable:false},
    "2026-08-14": {key:"paused",label:"活動休止",countable:false},
    "2026-08-15": {key:"paused",label:"活動休止",countable:false},
    "2026-08-16": {key:"unknown",label:"事前登録受付・人数上限あり",countable:false},
    "2026-08-17": {key:"unknown",label:"事前登録受付・人数上限あり",countable:false},
    "2026-08-18": {key:"unknown",label:"事前登録受付・人数上限あり",countable:false},
    "2026-08-19": {key:"unknown",label:"事前登録受付・人数上限あり",countable:false},
    "2026-08-20": {key:"unknown",label:"事前登録受付・人数上限あり",countable:false},
    "2026-08-21": {key:"unknown",label:"事前登録受付・人数上限あり",countable:false},
    "2026-08-22": {key:"unknown",label:"事前登録受付・人数上限あり",countable:false},
    "2026-08-23": {key:"unknown",label:"8月23日以降は要確認",countable:false},
    "2026-08-24": {key:"unknown",label:"8月23日以降は要確認",countable:false}
  },
  "嘉島町": {
    "2026-08-11": {key:"paused",label:"活動休止",countable:false},
    "2026-08-12": {key:"paused",label:"活動休止",countable:false},
    "2026-08-13": {key:"paused",label:"活動休止",countable:false},
    "2026-08-14": {key:"paused",label:"活動休止",countable:false},
    "2026-08-15": {key:"paused",label:"活動休止",countable:false},
    "2026-08-16": {key:"paused",label:"活動休止",countable:false},
    "2026-08-17": {key:"unknown",label:"8月17日以降は要確認",countable:false},
    "2026-08-18": {key:"unknown",label:"8月17日以降は要確認",countable:false},
    "2026-08-19": {key:"unknown",label:"8月17日以降は要確認",countable:false},
    "2026-08-20": {key:"unknown",label:"8月17日以降は要確認",countable:false},
    "2026-08-21": {key:"unknown",label:"8月17日以降は要確認",countable:false},
    "2026-08-22": {key:"unknown",label:"8月17日以降は要確認",countable:false},
    "2026-08-23": {key:"unknown",label:"8月17日以降は要確認",countable:false},
    "2026-08-24": {key:"unknown",label:"8月17日以降は要確認",countable:false}
  },
  "益城町": {
    "2026-08-11": {key:"paused",label:"活動休止",countable:false},
    "2026-08-12": {key:"paused",label:"活動休止",countable:false},
    "2026-08-13": {key:"paused",label:"活動休止",countable:false},
    "2026-08-14": {key:"paused",label:"活動休止",countable:false},
    "2026-08-15": {key:"paused",label:"活動休止",countable:false},
    "2026-08-16": {key:"paused",label:"活動休止",countable:false},
    "2026-08-17": {key:"planned",label:"再開予定・募集詳細未公表",countable:false},
    "2026-08-18": {key:"planned",label:"再開予定・募集詳細未公表",countable:false},
    "2026-08-19": {key:"planned",label:"再開予定・募集詳細未公表",countable:false},
    "2026-08-20": {key:"planned",label:"再開予定・募集詳細未公表",countable:false},
    "2026-08-21": {key:"planned",label:"再開予定・募集詳細未公表",countable:false},
    "2026-08-22": {key:"planned",label:"再開予定・募集詳細未公表",countable:false},
    "2026-08-23": {key:"planned",label:"再開予定・募集詳細未公表",countable:false},
    "2026-08-24": {key:"planned",label:"再開予定・募集詳細未公表",countable:false}
  },
  "甲佐町": {
    "2026-08-11": {key:"unknown",label:"8月13日以降の募集日を確認",countable:false},
    "2026-08-12": {key:"unknown",label:"8月13日以降の募集日を確認",countable:false},
    "2026-08-13": {key:"unknown",label:"個人受付終了・団体は要調整",countable:false},
    "2026-08-14": {key:"unknown",label:"個人受付終了・団体は要調整",countable:false},
    "2026-08-15": {key:"none",label:"活動日なし",countable:false},
    "2026-08-16": {key:"none",label:"活動日なし",countable:false},
    "2026-08-17": {key:"unknown",label:"個人受付終了・団体は要調整",countable:false},
    "2026-08-18": {key:"unknown",label:"個人受付終了・団体は要調整",countable:false},
    "2026-08-19": {key:"unknown",label:"個人受付終了・団体は要調整",capacity:"30人／日",countable:false},
    "2026-08-20": {key:"unknown",label:"個人受付終了・団体は要調整",capacity:"30人／日",countable:false},
    "2026-08-21": {key:"unknown",label:"個人受付終了・団体は要調整",capacity:"30人／日",countable:false},
    "2026-08-22": {key:"unknown",label:"活動日なし・要確認",countable:false},
    "2026-08-23": {key:"unknown",label:"活動日なし・要確認",countable:false},
    "2026-08-24": {key:"unknown",label:"8月24日以降は要確認",countable:false}
  },
  "氷川町": {
    "2026-08-11": {key:"unknown",label:"フォーム受付終了・理由未公表",countable:false},
    "2026-08-12": {key:"unknown",label:"フォーム受付終了・理由未公表",countable:false},
    "2026-08-13": {key:"none",label:"活動日なし",countable:false},
    "2026-08-14": {key:"unknown",label:"フォーム受付終了・理由未公表",countable:false},
    "2026-08-15": {key:"unknown",label:"フォーム受付終了・理由未公表",countable:false},
    "2026-08-16": {key:"unknown",label:"フォーム受付終了・理由未公表",countable:false},
    "2026-08-17": {key:"none",label:"活動休止",countable:false},
    "2026-08-18": {key:"unknown",label:"フォーム受付終了・理由未公表",countable:false},
    "2026-08-19": {key:"unknown",label:"フォーム受付終了・理由未公表",countable:false},
    "2026-08-20": {key:"unknown",label:"フォーム受付終了・理由未公表",countable:false},
    "2026-08-21": {key:"unknown",label:"8月21日以降は要確認",countable:false},
    "2026-08-22": {key:"unknown",label:"8月21日以降は要確認",countable:false},
    "2026-08-23": {key:"unknown",label:"8月21日以降は要確認",countable:false},
    "2026-08-24": {key:"unknown",label:"8月21日以降は要確認",countable:false}
  },
  "芦北町": {
    "2026-08-11": {key:"paused",label:"事前登録団体のみ",countable:false},
    "2026-08-12": {key:"paused",label:"事前登録団体のみ",countable:false},
    "2026-08-13": {key:"paused",label:"活動休止",countable:false},
    "2026-08-14": {key:"paused",label:"活動休止",countable:false},
    "2026-08-15": {key:"paused",label:"活動休止",countable:false},
    "2026-08-16": {key:"paused",label:"活動休止",countable:false},
    "2026-08-17": {key:"planned",label:"通常VC移行予定",countable:false},
    "2026-08-18": {key:"planned",label:"通常VC移行後の条件要確認",countable:false},
    "2026-08-19": {key:"planned",label:"通常VC移行後の条件要確認",countable:false},
    "2026-08-20": {key:"planned",label:"通常VC移行後の条件要確認",countable:false},
    "2026-08-21": {key:"planned",label:"通常VC移行後の条件要確認",countable:false},
    "2026-08-22": {key:"planned",label:"通常VC移行後の条件要確認",countable:false},
    "2026-08-23": {key:"planned",label:"通常VC移行後の条件要確認",countable:false},
    "2026-08-24": {key:"planned",label:"通常VC移行後の条件要確認",countable:false}
  }
};
const currentCalendarOverrides20260821 = {
  "宇土市": {
    "2026-08-20": {key:"recruiting",label:"第3期募集中・60人目安",capacity:"60人目安／日",countable:true},
    "2026-08-21": {key:"recruiting",label:"第3期募集中・20人目安",capacity:"20人目安／日",countable:true},
    "2026-08-22": {key:"recruiting",label:"第3期募集中・30人目安",capacity:"30人目安／日",countable:true},
    "2026-08-23": {key:"recruiting",label:"第3期募集中・40人目安",capacity:"40人目安／日",countable:true},
    "2026-08-24": {key:"recruiting",label:"第3期募集中・60人目安",capacity:"60人目安／日",countable:true},
    "2026-08-25": {key:"none",label:"活動なし",countable:false},
    "2026-08-26": {key:"none",label:"活動なし",countable:false},
    "2026-08-27": {key:"recruiting",label:"第3期募集中・60人目安",capacity:"60人目安／日",countable:true},
    "2026-08-28": {key:"recruiting",label:"団体5人以上受付",countable:true},
    "2026-08-29": {key:"recruiting",label:"団体5人以上受付",countable:true},
    "2026-08-30": {key:"recruiting",label:"団体5人以上受付",countable:true},
    "2026-08-31": {key:"recruiting",label:"団体5人以上受付",countable:true},
    "2026-09-01": {key:"recruiting",label:"団体5人以上受付",countable:true},
    "2026-09-02": {key:"recruiting",label:"団体5人以上受付",countable:true},
    "2026-09-03": {key:"recruiting",label:"団体5人以上受付",countable:true},
    "2026-09-04": {key:"recruiting",label:"団体5人以上受付",countable:true},
    "2026-09-05": {key:"recruiting",label:"団体5人以上受付",countable:true},
    "2026-09-06": {key:"recruiting",label:"団体5人以上受付",countable:true}
  },
  "宇城市": {
    "2026-08-20": {key:"recruiting",label:"個人日別受付",countable:true},
    "2026-08-21": {key:"recruiting",label:"個人日別受付",countable:true},
    "2026-08-22": {key:"recruiting",label:"個人日別受付",countable:true},
    "2026-08-23": {key:"recruiting",label:"個人日別受付",countable:true},
    "2026-08-24": {key:"recruiting",label:"個人日別受付",countable:true},
    "2026-08-25": {key:"none",label:"活動なし",countable:false},
    "2026-08-26": {key:"recruiting",label:"個人日別受付",countable:true},
    "2026-08-27": {key:"recruiting",label:"個人日別受付",countable:true},
    "2026-08-28": {key:"recruiting",label:"個人日別受付",countable:true},
    "2026-08-29": {key:"recruiting",label:"個人日別受付",countable:true},
    "2026-08-30": {key:"recruiting",label:"個人日別受付",countable:true},
    "2026-08-31": {key:"recruiting",label:"個人日別受付",countable:true}
  },
  "美里町": Object.fromEntries(Array.from({length:9}, (_, index) => {
    const day = String(22 + index).padStart(2, "0");
    return [`2026-08-${day}`, {key:"unknown",label:"現行フォーム受付終了・要再確認",capacity:"約40人／日",countable:false}];
  })),
  "御船町": {
    "2026-08-24": {key:"recruiting",label:"団体のみ",countable:true},
    "2026-08-25": {key:"recruiting",label:"募集中",countable:true},
    "2026-08-26": {key:"none",label:"活動なし",countable:false},
    "2026-08-27": {key:"recruiting",label:"募集中",countable:true},
    "2026-08-28": {key:"recruiting",label:"募集中",countable:true},
    "2026-08-29": {key:"recruiting",label:"募集中",countable:true},
    "2026-08-30": {key:"none",label:"活動なし",countable:false},
    "2026-08-31": {key:"none",label:"活動なし",countable:false}
  },
  "嘉島町": {
    "2026-08-21": {key:"unknown",label:"現行フォーム受付終了・要再確認",countable:false},
    "2026-08-22": {key:"unknown",label:"現行フォーム受付終了・要再確認",countable:false}
  },
  "益城町": Object.fromEntries(Array.from({length:5}, (_, index) => {
    const day = String(24 + index).padStart(2, "0");
    return [`2026-08-${day}`, {key:"recruiting",label:"第3期募集中・30人／日",capacity:"30人／日",countable:true}];
  })),
  "甲佐町": Object.fromEntries(Array.from({length:10}, (_, index) => {
    const day = String(22 + index).padStart(2, "0");
    return [`2026-08-${day}`, index < 8
      ? {key:"full",label:"必要人数到達・受付終了",countable:false}
      : {key:"unknown",label:"8月30日以降は未定",countable:false}];
  })),
  "八代市": Object.fromEntries(Array.from({length:8}, (_, index) => {
    const day = String(24 + index).padStart(2, "0");
    return [`2026-08-${day}`, {key:"recruiting",label:"個人・団体受付",countable:true}];
  })),
  "氷川町": {
    "2026-08-21": {key:"recruiting",label:"募集中",countable:true},
    "2026-08-22": {key:"recruiting",label:"募集中",countable:true},
    "2026-08-23": {key:"recruiting",label:"募集中",countable:true},
    "2026-08-24": {key:"none",label:"活動休止",countable:false},
    "2026-08-25": {key:"recruiting",label:"募集中",countable:true},
    "2026-08-26": {key:"recruiting",label:"募集中",countable:true},
    "2026-08-27": {key:"recruiting",label:"募集中",countable:true}
  },
  "芦北町": Object.fromEntries(Array.from({length:11}, (_, index) => {
    const day = String(21 + index).padStart(2, "0");
    return [`2026-08-${day}`, {key:"unknown",label:"事前登録者へ個別依頼",countable:false}];
  }))
};
Object.assign(currentCalendarOverrides, currentCalendarOverrides20260821);
for(const center of centers){
  const override = currentCalendarOverrides[center.municipality] || calendarOverrides[center.municipality];
  if(override) center.calendar_overrides = override;
}

const allMunicipalities = ["熊本市","八代市","人吉市","荒尾市","水俣市","玉名市","山鹿市","菊池市","宇土市","上天草市","宇城市","阿蘇市","天草市","合志市","美里町","玉東町","南関町","長洲町","和水町","大津町","菊陽町","南小国町","小国町","産山村","高森町","西原村","南阿蘇村","御船町","嘉島町","益城町","甲佐町","山都町","氷川町","芦北町","津奈木町","錦町","多良木町","湯前町","水上村","相良村","五木村","山江村","球磨村","あさぎり町","苓北町"];
function sourceGroup(publisher){
  if(publisher.includes("全国社会福祉協議会")) return "全国社会福祉協議会";
  if(publisher.includes("熊本県社会福祉協議会")) return "熊本県社会福祉協議会";
  if(publisher === "熊本県") return "熊本県";
  if(publisher.includes("社会福祉協議会")) return "市町村社会福祉協議会";
  return "市町村";
}
const formSources = merged.flatMap((center)=>{
  const entries = [];
  const add = (url,label,status=null)=>{
    if(!url || entries.some((entry)=>entry.url === url)) return;
    entries.push({url,label,status});
  };
  if(center.application_urls && !Array.isArray(center.application_urls) && typeof center.application_urls === "object"){
    for(const [key,url] of Object.entries(center.application_urls)) add(url,key === "individual" ? "個人申込フォーム" : key === "group" ? "団体申込フォーム" : `申込フォーム（${key}）`);
  }else if(Array.isArray(center.application_urls)) center.application_urls.forEach((url,index)=>add(url,`申込フォーム ${index+1}`));
  for(const windowItem of center.activity_windows || []){
    const range = [windowItem.start_date,windowItem.end_date && windowItem.end_date !== windowItem.start_date ? windowItem.end_date : null].filter(Boolean).join("～");
    const status = windowItem.form_status || windowItem.status || null;
    add(windowItem.application_url,`${range} 申込ページ`,status);
    (windowItem.application_urls || []).forEach((url,index)=>add(url,`${range} 日別申込ページ ${index+1}`,status));
  }
  add(center.application_url,"申込・受付案内",center.application_form_status);
  return entries.map((entry)=>({
    publisher:(center.official_source_name || center.municipality)+"（公式申込・受付）",
    title:center.municipality+" "+entry.label+(entry.status ? "（"+entry.status+"）" : ""),
    url:entry.url,published_at:null,updated_at:null,checked_at:center.checked_at
  }));
});
const rawSources = [...statewideResearch.sources,...(north.official_sources || []),...merged.flatMap((center)=>center.sources || []),...formSources];
const sourceMap = new Map();
for(const source of rawSources){
  if(!source.url || sourceMap.has(source.url)) continue;
  sourceMap.set(source.url,{
    group:sourceGroup(source.publisher),publisher:source.publisher,title:source.title,url:source.url,
    published_at:source.published_at ?? null,updated_at:source.updated_at ?? null,
    checked_at:source.checked_at,used_for_this_event:true
  });
}
const sources = [...sourceMap.values()];
const sourceByTitle = (fragment)=>sources.find((source)=>source.title.includes(fragment));
const checkedTimes = [
  north.checked_at,south.checked_at,statewideResearch.checked_at,...centers.map((center)=>center.checked_at),
  ...sources.map((source)=>source.checked_at)
].filter(Boolean).sort();
const checkedAt = checkedTimes.at(-1);
const oldestCheckedAt = checkedTimes.at(0);
function unknownCenter(name){
  const center = Object.fromEntries(requiredFields.map((field)=>[field,null]));
  for(const field of optionalFields) center[field] = null;
  return Object.assign(center,{
    municipality:name,center_status:"情報未確認",recruitment_status:"情報未確認",
    activity_types:[],capacity_disclosed:null,checked_at:null,portal_coverage_checked_at:checkedAt,change_status:"初回登録",
    group_dispatch_assessment:"公式の市町別募集情報を確認できないため要照会",
    ehime_dispatch_status:"情報未確認",
    remarks:"公式の市町別募集情報を確認できず。募集していない又は活動を終了したとは判定していません。",
    researched:false,activity_dates_confirmed:false
  });
}
const researchedByName = new Map(centers.map((center)=>[center.municipality,center]));
const allCenters = allMunicipalities.map((name)=>researchedByName.get(name) || unknownCenter(name));
const rechecks = centers.map((center)=>({
  municipality:center.municipality,
  status:center.recheck_status || (center.change_from_previous ? "差分あり" : "変更なし"),
  note:center.recheck_note || (center.change_from_previous || "今回確認した公式情報で新たな変更を確認できず。既存状態を維持"),
  checked_at:center.checked_at,
  source_updated_at:center.source_updated_at,
  publisher:center.official_source_name,
  url:center.official_source_url,
  before:center.previous_known_state ?? null,
  after:center.recruitment_status
}));
const changes = centers.filter((center)=>
  center.recheck_status === "差分あり" && center.change_from_previous && center.change_status
).map((center)=>({
  municipality:center.municipality,category:center.change_status,description:center.change_from_previous,
  before:center.previous_known_state ?? null,after:center.recruitment_status,
  checked_at:center.checked_at,source_updated_at:center.source_updated_at,publisher:center.official_source_name,
  url:center.official_source_url
})).sort((a,b)=>String(b.source_updated_at || b.checked_at).localeCompare(String(a.source_updated_at || a.checked_at)));
const currentCheckHistory = centers.map((center)=>({
  changed_at:center.checked_at,municipality:center.municipality,
  before:center.recheck_status === "差分あり" ? (center.previous_known_state ?? null) : center.recruitment_status,
  after:center.recruitment_status,
  change_type:center.recheck_status === "差分あり" ? (center.change_status || "差分あり") : center.recheck_status === "確認できず" ? "再確認・確認できず" : "再確認・変更なし",
  publisher:center.official_source_name || "公式情報を確認できず",
  official_updated_at:center.source_updated_at,official_url:center.official_source_url
}));
const historicalChangeHistory = centers.filter((center)=>
  center.change_from_previous && center.recheck_status !== "差分あり"
).map((center)=>({
  changed_at:center.source_updated_at || center.checked_at,municipality:center.municipality,
  before:center.previous_known_state ?? null,after:center.recruitment_status,
  change_type:center.change_status || "過去の差分",
  publisher:center.official_source_name || "公式情報を確認できず",
  official_updated_at:center.source_updated_at,official_url:center.official_source_url
}));
const registrationHistory = centers.map((center)=>({
  changed_at:center.checked_at,municipality:center.municipality,before:null,after:center.recruitment_status,
  change_type:"初回登録",publisher:center.official_source_name || "公式情報を確認できず",
  official_updated_at:center.source_updated_at,official_url:center.official_source_url
}));
const updateHistory = [...currentCheckHistory,...historicalChangeHistory,...registrationHistory].sort((a,b)=>
  String(b.changed_at).localeCompare(String(a.changed_at)) || (a.change_type === "初回登録" ? 1 : -1)
);

const planningItems = [
  ["destination","派遣先市町","熊本県社会福祉協議会に確認"],
  ["district","活動地区","市町災害ボランティアセンターに確認"],
  ["activity","活動内容","市町災害ボランティアセンターに確認"],
  ["required_people","必要人数","市町災害ボランティアセンターに確認"],
  ["accepted_people","受入可能人数","市町災害ボランティアセンターに確認"],
  ["activity_date","活動可能日","市町災害ボランティアセンターに確認"],
  ["activity_period","活動期間","市町災害ボランティアセンターに確認"],
  ["group_size","1回当たり適正人数","市町災害ボランティアセンターに確認"],
  ["dispatch_count","必要派遣回数を判断できる情報","熊本県社会福祉協議会に確認"],
  ["activity_days","活動日数","市町災害ボランティアセンターに確認"],
  ["itinerary","移動日を含む行程","旅行会社に行程案を依頼"],
  ["daytrip_lodging","日帰り又は宿泊","市町災害ボランティアセンターと宿泊施設に照会"],
  ["meeting_time","集合時間","市町災害ボランティアセンターに確認"],
  ["finish_time","活動終了時間","市町災害ボランティアセンターに確認"],
  ["bus_access","貸切バス乗入れ","市町災害ボランティアセンターに確認"],
  ["bus_parking","バス駐車場","市町災害ボランティアセンターに確認"],
  ["local_vehicle","現地移動車両","市町災害ボランティアセンターに確認"],
  ["light_truck","軽トラック等","市町災害ボランティアセンターに確認"],
  ["toll","高速道路無料措置","高速道路会社の制度と受入承諾書類を確認"],
  ["ferry","フェリー等の交通条件","フェリー会社又は旅行会社に照会"],
  ["lodging","宿泊先","宿泊施設又は旅行会社に照会"],
  ["meal","食事","市町災害ボランティアセンターと旅行会社に確認"],
  ["water","飲料水","市町災害ボランティアセンターに確認"],
  ["toilet","トイレ","市町災害ボランティアセンターに確認"],
  ["rest","休憩場所","市町災害ボランティアセンターに確認"],
  ["equipment","活動用品","市町災害ボランティアセンターに確認"],
  ["helmet","ヘルメット","市町災害ボランティアセンターに確認"],
  ["mask","マスク","市町災害ボランティアセンターに確認"],
  ["boots","長靴","市町災害ボランティアセンターに確認"],
  ["gloves","手袋","市町災害ボランティアセンターに確認"],
  ["insurance","ボランティア保険","愛媛県社会福祉協議会と派遣先センターに確認"],
  ["escort","随行職員","愛媛県内で派遣体制を決定"],
  ["coordination","現地連絡調整","熊本県社会福祉協議会と派遣先センターに確認"],
  ["participant_cost","参加者負担","愛媛県内で負担方針を決定"],
  ["cancellation","活動中止条件","市町災害ボランティアセンターに確認"],
  ["cancellation_fee","キャンセル条件","バス事業者、旅行会社、宿泊施設に確認"]
].map(([key,label,inquiry_to])=>({key,label,inquiry_to}));
const costItems = [
  ["貸切バス代"],["乗務員経費"],["高速道路料金"],["フェリー料金"],["駐車場代"],
  ["現地移動車両費"],["軽トラック等の輸送費"],["宿泊費"],["旅行会社等の手配料"],
  ["現地活動用品"],["ヘルメット"],["マスク"],["長靴"],["手袋"],["防じん用品"],
  ["熱中症対策用品"],["ボランティア保険"],["随行職員旅費"],["現地連絡調整費"],
  ["募集・事前説明経費"],["食事"],["飲料"],["参加者負担金","offset"],["他団体助成","offset"],
  ["キャンセル料"],["予備費"]
].map(([label,direction])=>({label,direction:direction || "expense"}));

const data = {
  meta:{
    reference_at:checkedAt,reference_date:checkedAt.slice(0,10),checked_at:checkedAt,
    oldest_checked_at:oldestCheckedAt,
    initial_snapshot:false,next_review_required:true,
    caution:"災害ボランティアの募集条件は随時変更されます。活動前には必ず各災害ボランティアセンターの最新の公式情報を確認してください。"
  },
  all_municipalities:allMunicipalities,all_centers:allCenters,
  activity_categories:[
    "家屋内の片付け","家財の搬出","清掃","災害ごみの分別・運搬","瓦・がれき等の撤去",
    "物資の仕分け・運搬","避難所支援","仮設住宅関連","被災者訪問・ニーズ調査",
    "高齢者・福祉施設等の支援","災害ボランティアセンター運営支援","交流活動","その他"
  ],
  centers,changes,rechecks,
  statewide:{
    linked_center_count:statewideResearch.statewide_facts.linked_municipal_centers.length,
    toll:{confirmed:true,end_date:statewideResearch.statewide_facts.toll_exemption_end_date},
    cards:[
      {
        title:"県全体の災害ボランティア情報・事前登録",
        items:[
          ["運営","熊本県社会福祉協議会（熊本県災害ボランティアセンター）"],
          ["事前登録","2026年8月1日受付開始"],["重要","登録だけでは活動日・活動先・参加は確定しない"],
          ["市町別確認","募集範囲、日程、申込手続を別途確認"]
        ],source:sourceByTitle("事前登録を開始")
      },
      {
        title:"ボランティア活動保険",
        items:[
          ["対象","今回の地震で市町センターを通じて行う活動"],["加入","居住地の社会福祉協議会又は専用Web"],
          ["Web決済","本人名義のクレジットカード"],["注意","即時適用後は取消・返金不可"]
        ],source:sourceByTitle("ボランティア活動保険加入のお申込み")
      },
      {
        title:"災害ボランティア車両の高速道路無料措置",
        items:[
          ["適用期限","2026年10月31日まで"],["対象","被災自治体等の要請又は受入承諾を受けた活動車両"],
          ["手続","ボランティア車両証明書等の事前手続が必要"],["注意","被災地へ向かう全車両が一律無料ではない"]
        ],source:sourceByTitle("高速道路の無料措置")
      },
      {
        title:"活動前の安全確認",
        items:[
          ["募集条件","各市町の最新ページ・申込フォームを再確認"],
          ["中止条件","余震、降雨、暑熱等の基準を派遣先に確認"],
          ["自己完結","飲料、食事、装備、保険、移動手段を確認"],
          ["現地条件","断水、トイレ、休憩場所、危険箇所を確認"]
        ],source:sourceByTitle("各市町災害ボランティアセンターの設置状況")
      }
    ]
  },
  dispatch_questions:[
    "愛媛県からの団体受入れが可能か","受入可能日","1回当たり受入可能人数","活動者の年齢条件",
    "連続2日間の活動が可能か","大型バスの乗入れが可能か","バスの駐車場所","活動先までの現地移動手段",
    "軽トラック等を同行させる必要があるか","宿泊を伴う派遣が必要か","宿泊地として利用可能な地域",
    "食事、飲料及び休憩場所","現地の断水及びトイレ状況","必要な活動用品","ボランティア保険",
    "高速道路無料措置の適用手続","荒天又は余震による中止条件","キャンセル料の負担","現地連絡担当者"
  ],
  planning_items:planningItems,cost_items:costItems,update_history:updateHistory,sources
};
const output = "globalThis.VOLUNTEER_DATA = Object.freeze("+JSON.stringify(data,null,2)+");\n";
writeFileSync(join(root, "volunteer-data.js"), output, "utf8");
console.log("Generated volunteer-data.js with "+centers.length+" researched municipalities and "+sources.length+" official sources.");

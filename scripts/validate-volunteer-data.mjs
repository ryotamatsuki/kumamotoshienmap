import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "volunteer-data.js"), "utf8");
const uiSource = readFileSync(join(root, "volunteer.js"), "utf8");
const match = source.match(/^globalThis\.VOLUNTEER_DATA = Object\.freeze\(([\s\S]+)\);\s*$/);
if(!match) throw new Error("volunteer-data.js の形式が不正です");
const data = JSON.parse(match[1]);

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
function assert(condition,message){ if(!condition) throw new Error(message); }
function unique(values){ return new Set(values).size === values.length; }
function isIso(value){ return typeof value === "string" && !Number.isNaN(Date.parse(value)); }

assert(Array.isArray(data.centers) && data.centers.length === 11,"再探索済み市町は11件である必要があります");
assert(Array.isArray(data.all_municipalities) && data.all_municipalities.length === 45,"熊本県内45市町村が必要です");
assert(Array.isArray(data.all_centers) && data.all_centers.length === 45,"共通表示用の45市町村データが必要です");
assert(unique(data.centers.map((center)=>center.municipality)),"再探索済み市町に重複があります");
assert(unique(data.all_municipalities),"全市町村一覧に重複があります");
assert(unique(data.all_centers.map((center)=>center.municipality)),"共通表示用データに重複があります");
assert(data.all_centers.every((center)=>data.all_municipalities.includes(center.municipality)),"県内市町村一覧と共通表示用データが一致しません");
assert(isIso(data.meta.checked_at) && isIso(data.meta.reference_at),"情報基準日時がISO形式ではありません");
assert(data.meta.reference_at.startsWith("2026-08-21"),"ボランティア情報の基準日が2026-08-21ではありません");

for(const center of data.all_centers){
  for(const field of requiredFields){
    assert(Object.hasOwn(center,field),`${center.municipality}: 必須フィールド ${field} がありません`);
  }
  assert(center.capacity_disclosed === true || center.capacity_disclosed === null,`${center.municipality}: 人数公表状態は true/null のみです`);
  if(center.capacity_disclosed !== true){
    assert(center.daily_capacity === null && center.total_capacity === null,`${center.municipality}: 非公表人数に数値があります`);
  }
  for(const field of ["daily_capacity","total_capacity","remaining_capacity"]){
    assert(center[field] === null || (Number.isFinite(center[field]) && center[field] >= 0),`${center.municipality}: ${field} が不正です`);
  }
  if(center.official_source_url !== null){
    assert(/^https?:\/\//.test(center.official_source_url),`${center.municipality}: 公式URLが不正です`);
  }
}

const dailyCapacity = Object.fromEntries(data.centers.filter((center)=>center.daily_capacity !== null).map((center)=>[center.municipality,center.daily_capacity]));
assert(JSON.stringify(dailyCapacity) === JSON.stringify({"美里町":40,"益城町":30}),"公表済み市町別日別人数が検証値と一致しません");
const disclosedCapacityMunicipalities = data.centers.filter((center)=>center.capacity_disclosed === true).map((center)=>center.municipality);
assert(JSON.stringify(disclosedCapacityMunicipalities) === JSON.stringify(["熊本市","宇土市","美里町","益城町"]),"人数公表市町が検証値と一致しません");
const kumamotoDistricts = data.centers.find((center)=>center.municipality === "熊本市")?.district_capacities;
assert(kumamotoDistricts === null,"熊本市の第1期地区別人数を現況フィールドに残してはいけません");
const kumamoto = data.centers.find((center)=>center.municipality === "熊本市");
assert(kumamoto?.recruitment_status === "受付終了（第2期定員到達）・8月24日以降要再確認","熊本市の現況募集状態が一致しません");
assert(kumamoto?.application_url === kumamoto?.official_source_url,"熊本市の申込案内URLが最新公式告知と一致しません");
assert(!String(kumamoto?.application_url || "").includes("第1期"),"熊本市の第1期URLを現況申込URLに残しています");
assert(String(kumamoto?.application_deadline || "").includes("第2期（8月16日～23日）は必要人数到達で締切"),"熊本市の第2期締切がapplication_deadlineに反映されていません");
assert(String(kumamoto?.application_deadline || "").includes("8月24日以降は再告知予定"),"熊本市の8月24日以降の未確定扱いがapplication_deadlineにありません");
assert(String(kumamoto?.group_dispatch_assessment || "").includes("第2期は両拠点とも必要人数到達・締切"),"熊本市の団体派遣評価が第2期締切と整合しません");
assert(Array.isArray(kumamoto?.changes_from_previous) && kumamoto.changes_from_previous.length === 1 && kumamoto.changes_from_previous[0].includes("第2期8月16～23日"),"熊本市のchanges_from_previousが現況差分に整理されていません");
assert(kumamoto?.activity_windows?.length === 1 && kumamoto.activity_windows[0].start_date === "2026-08-16" && kumamoto.activity_windows[0].end_date === "2026-08-23" && kumamoto.activity_windows[0].status === "定員到達","熊本市の第2期activity_windowsが締切状態と一致しません");
const kumamotoWindow = kumamoto.activity_windows[0];
assert(kumamoto.activity_start_date === kumamotoWindow.start_date && kumamoto.activity_end_date === kumamotoWindow.end_date,"熊本市のactivity_datesとactivity_windowsの期間が一致しません");
assert(kumamotoWindow.form_status === "必要人数到達・締切" && String(kumamoto.application_form_status || "").includes("第2期締切"),"熊本市の申込フォーム状態とactivity_windowsが一致しません");
assert(String(kumamoto.application_deadline || "").includes("8月16日～23日") && String(kumamoto.changes_from_previous?.[0] || "").includes("8月16～23日"),"熊本市のapplication_deadlineとchanges_from_previousの期間が一致しません");
const kumamotoCalendar = kumamoto?.calendar_overrides || {};
for(const date of ["2026-08-16","2026-08-17","2026-08-18","2026-08-19","2026-08-20","2026-08-21","2026-08-22","2026-08-23"]){
  assert(kumamotoCalendar[date]?.key === "full" && kumamotoCalendar[date]?.countable === false && /第2期必要人数到達・締切/.test(kumamotoCalendar[date]?.label || ""),`熊本市の${date}が第2期締切として扱われていません`);
}
assert(kumamotoCalendar["2026-08-24"]?.key === "unknown" && kumamotoCalendar["2026-08-24"]?.countable === false,"熊本市の8月24日以降が未確定扱いになっていません");
assert(kumamoto?.sources?.some((item)=>{
  const title = String(item.title || "");
  let url = String(item.url || "");
  try { url = decodeURIComponent(url); } catch {}
  return title.includes("第1期") && url.includes("第1期");
}),"熊本市の第1期情報が履歴/sourceに分離保存されていません");
assert(data.centers.filter((center)=>center.ehime_dispatch_status === "団体派遣可能と公式確認").length === 0,"愛媛県からの団体受入れを過大判定しています");
assert(data.centers.find((center)=>center.municipality === "宇土市")?.ehime_participation_allowed === true,"宇土市の全国募集が欠落しています");
assert(data.centers.find((center)=>center.municipality === "甲佐町")?.ehime_participation_allowed === null,"甲佐町の現行参加条件を過去情報から断定しています");
assert(data.centers.find((center)=>center.municipality === "甲佐町")?.application_form_status === "8月29日まで受付終了・以降未定","甲佐町の申込状態が最新確認と一致しません");
assert(data.centers.find((center)=>center.municipality === "芦北町")?.recruitment_area === null,"芦北町の現況募集地域を未確認のまま断定しています");
const regionalLimits = data.centers.filter((center)=>
  center.outside_prefecture_allowed === false ||
  center.outside_kyushu_allowed === false ||
  center.ehime_participation_allowed === false ||
  (typeof center.recruitment_area === "string" && center.recruitment_area.length > 0 && !/全国/.test(center.recruitment_area))
).map((center)=>center.municipality);
assert(regionalLimits.length === 0,"現行の地域限定市町を過去情報から断定しています");
assert(data.centers.find((center)=>center.municipality === "宇城市")?.recruitment_status === "募集中（8月20日～24日・26日～31日・事前申込）","宇城市の最新の日別募集状態が反映されていません");
const isCurrentAccepting = (center)=>["募集中","限定募集"].some((prefix)=>String(center.recruitment_status || "").startsWith(prefix)) && center.eligibility_currently_applicable !== false;
assert(data.centers.filter((center)=>isCurrentAccepting(center)).length === 6,"基準日時点で現行募集として扱う6市町が一致しません");
assert(data.centers.filter((center)=>center.outside_prefecture_allowed === true).length === 1,"現行の県外参加条件を明示した1市町が一致しません");
assert(data.centers.filter((center)=>center.group_allowed === true).length === 3,"団体参加経路を明示した3市町が一致しません");
assert(data.centers.filter((center)=>isCurrentAccepting(center) && center.group_allowed === true).length === 3,"基準日時点で団体参加経路を確認できる3市町が一致しません");
assert(data.centers.filter((center)=>center.group_application_available === true).length === 3,"団体申込フォーム掲載3市町が一致しません");
assert(data.centers.filter((center)=>typeof center.vehicle_need === "string" && center.vehicle_need.length > 0).length === 7,"車両ニーズ7市町が一致しません");
assert(data.centers.filter((center)=>isCurrentAccepting(center) && typeof center.vehicle_need === "string" && center.vehicle_need.length > 0).length === 5,"基準日時点の車両ニーズ5市町が一致しません");
assert(data.centers.filter((center)=>isCurrentAccepting(center) && center.capacity_disclosed === true).length === 2,"基準日時点の人数公表2市町が一致しません");
assert(data.centers.filter((center)=>isCurrentAccepting(center) && center.outside_prefecture_allowed === true).length === 1,"基準日時点の県外参加明示1市町が一致しません");
assert(data.centers.every((center)=>center.eligibility_currently_applicable === true || center.eligibility_currently_applicable === false || center.eligibility_currently_applicable === null),"参加可否判定の値が不正です");
for(const center of data.centers.filter((item)=>String(item.application_form_status || "").includes("受付終了"))){
  assert(center.application_urls === null,"受付終了フォームを現行申込導線に残しています: "+center.municipality);
}
assert(data.centers.every((center)=>typeof center.recheck_status === "string"),"全市町の再確認状態がありません");
assert(!/予算資料|内部資料|添付資料|参考資料|過去災害/.test(source),"公開データに禁止表現があります");
assert(Array.isArray(data.sources) && data.sources.length > 0,"公式情報源がありません");
assert(uiSource.includes("function capacitySortValue(center)"),"地区別人数を含む人数順の判定がありません");
assert(uiSource.includes("function capacityMarkerLabel(center)"),"地区別人数を含む地図人数バッジがありません");
assert(uiSource.includes("県外可（地域限定）・愛媛県は要確認"),"地域限定の県外募集を愛媛県参加可と誤読させる表示です");
assert(uiSource.includes("present(center.recruitment_area) && !/全国/.test(center.recruitment_area)"),"地域限定の募集対象判定が不十分です");
for(const item of data.sources){
  assert(/^https?:\/\//.test(item.url),`出典URLが不正です: ${item.url}`);
  assert(item.used_for_this_event === true,"今回使用していない出典が混在しています");
}

const summary = {
  researchedMunicipalities:data.centers.length,
  allMunicipalities:data.all_municipalities.length,
  sources:data.sources.length,
  disclosedCapacityMunicipalities,
  currentlyAccepting:data.centers.filter((center)=>isCurrentAccepting(center)).length,
  outsideParticipationExplicit:data.centers.filter((center)=>isCurrentAccepting(center) && center.outside_prefecture_allowed === true).length,
  groupParticipationPath:data.centers.filter((center)=>isCurrentAccepting(center) && center.group_allowed === true).length,
  vehicleNeeds:data.centers.filter((center)=>isCurrentAccepting(center) && typeof center.vehicle_need === "string" && center.vehicle_need.length > 0).length,
  ehimeGroupAcceptanceConfirmed:0
};
console.log(JSON.stringify(summary));

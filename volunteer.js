(function(){
"use strict";

var app = document.getElementById("volunteerApp");
var sourceData = globalThis.VOLUNTEER_DATA;
var initialized = false;
var volunteerMap = null;
var volunteerMapLayer = null;
var volunteerMainLayer = null;
var volunteerMainLegend = null;

window.hideVolunteerMainLayer = function(){
  if(typeof map !== "undefined" && volunteerMainLayer && map.hasLayer(volunteerMainLayer)){
    map.removeLayer(volunteerMainLayer);
  }
  if(volunteerMainLegend) volunteerMainLegend.remove();
  var button = document.getElementById("volunteerLayerToggle");
  if(button){
    button.classList.remove("active");
    button.setAttribute("aria-pressed","false");
  }
};
var selectedMunicipality = null;
var searchTimer = null;
var state = {
  query: "",
  activity: "all",
  sort: "updated",
  filters: {
    today: false,
    week: false,
    recruiting: false,
    preparing: false,
    capacity: false,
    outside: false,
    regional: false,
    individual: false,
    group: false,
    groupForm: false,
    vehicle: false,
    junior: false,
    highschool: false,
    preregistration: false,
    walkin: false,
    includeUnknown: true,
    includeEnded: false
  }
};

function esc(value){
  return String(value == null ? "" : value).replace(/[&<>"']/g,function(character){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character];
  });
}

function attr(value){ return esc(value).replace(/\n/g," "); }
function present(value){ return value !== null && value !== undefined && value !== ""; }
function yesNoUnknown(value,yes,no){
  if(value === true) return '<span class="vol-value-known">'+esc(yes || "可（公式明示）")+"</span>";
  if(value === false) return '<span class="vol-value-no">'+esc(no || "不可（公式明示）")+"</span>";
  return '<span class="vol-value-unknown">要確認</span>';
}
function outsideParticipationMarkup(center){
  if(center.outside_prefecture_allowed === true){
    if(center.ehime_participation_allowed === false){
      return '<span class="vol-value-partial">県外可（地域限定）・愛媛県は一般募集対象外</span>';
    }
    return '<span class="vol-value-known">県外可（公式明示）</span>';
  }
  if(center.outside_prefecture_allowed === false){
    return '<span class="vol-value-no">県外不可（公式明示）</span>';
  }
  return '<span class="vol-value-unknown">要確認</span>';
}
function display(value,fallback){ return present(value) ? esc(value) : '<span class="vol-value-missing">'+esc(fallback || "公表なし・要確認")+"</span>"; }
function formatDate(iso){
  if(!iso) return null;
  var parts = String(iso).slice(0,10).split("-");
  if(parts.length !== 3) return iso;
  return Number(parts[0])+"年"+Number(parts[1])+"月"+Number(parts[2])+"日";
}
function formatDateTime(iso){
  if(!iso) return "要確認";
  if(/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return formatDate(iso);
  var date = new Date(iso);
  if(Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(date);
}
function addDays(iso,days){
  var date = new Date(iso+"T12:00:00+09:00");
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}
function daysBetween(later,earlier){
  var a = new Date(later);
  var b = new Date(earlier);
  return (a.getTime()-b.getTime())/3600000;
}

var STATUS_LABELS = {
  recruiting:"募集中",
  limited:"限定募集",
  planned:"募集予定",
  preparing:"募集準備中",
  pending:"活動受付中・詳細要確認",
  full:"定員到達",
  paused:"一時休止",
  cancelled:"活動中止",
  ended:"活動終了",
  unknown:"情報未確認"
};

function statusKey(center){
  var status = String(center.recruitment_status || center.center_status || "");
  if(/^募集中/.test(status) || /^募集受付中/.test(status)) return "recruiting";
  if(status.indexOf("定員") >= 0) return "full";
  if(status.indexOf("一時休止") >= 0 || status.indexOf("休止") >= 0) return "paused";
  if(status.indexOf("中止") >= 0) return "cancelled";
  if(status.indexOf("終了") >= 0) return "ended";
  if(status.indexOf("限定") >= 0) return "limited";
  if(status.indexOf("準備") >= 0) return "preparing";
  if(status.indexOf("予定") >= 0) return "planned";
  if(status.indexOf("活動受付") >= 0 || status.indexOf("詳細要確認") >= 0) return "pending";
  if(status.indexOf("募集中") >= 0 || status.indexOf("募集受付中") >= 0) return "recruiting";
  return "unknown";
}
function statusMarkup(center){
  var key = statusKey(center);
  var label = center.recruitment_status || STATUS_LABELS[key];
  return '<span class="vol-status '+key+'" aria-label="現在の状態 '+attr(label)+'">'+esc(label)+"</span>";
}
function isRecruiting(center){
  return ["recruiting","limited","pending"].indexOf(statusKey(center)) >= 0;
}
function isPreparing(center){
  return ["preparing","planned"].indexOf(statusKey(center)) >= 0;
}
function isEnded(center){
  return ["paused","cancelled","ended"].indexOf(statusKey(center)) >= 0;
}
function hasRegionalLimit(center){
  if(center.outside_prefecture_allowed === false || center.outside_kyushu_allowed === false || center.ehime_participation_allowed === false) return true;
  return present(center.recruitment_area) && /九州|熊本県内|在住|居住/.test(center.recruitment_area);
}
function highSchoolAllowed(center){
  var value = String(center.minimum_age || "")+" "+String(center.age_conditions || "");
  return center.minimum_age !== null && (/高校/.test(value) || /中学/.test(value) || /[0-9]{1,2}歳/.test(value));
}
function juniorAllowed(center){
  var value = String(center.minimum_age || "")+" "+String(center.age_conditions || "");
  return center.minimum_age !== null && /中学/.test(value);
}
function walkInAllowed(center){
  return center.application_required === false || /当日受付|来所/.test(String(center.application_method || ""));
}
function capacityText(center){
  if(center.researched === false || statusKey(center) === "unknown") return '<span class="vol-value-unknown">情報未確認</span>';
  if(center.capacity_disclosed !== true) return '<span class="vol-value-missing">非公表</span>';
  if(present(center.daily_capacity)) return '<span class="vol-value-known">'+Number(center.daily_capacity).toLocaleString("ja-JP")+esc(center.capacity_unit || "人／日")+"</span>";
  if(present(center.total_capacity)) return '<span class="vol-value-known">'+Number(center.total_capacity).toLocaleString("ja-JP")+esc(center.capacity_unit || "人")+"</span>";
  return '<span class="vol-value-partial">人数公表あり・数値要確認</span>';
}
function activityText(center){
  return Array.isArray(center.activity_types) && center.activity_types.length ? center.activity_types.map(esc).join("・") : '<span class="vol-value-missing">公表なし・要確認</span>';
}
function targetAreaText(center){
  if(present(center.recruitment_area)) return esc(center.recruitment_area);
  if(center.outside_prefecture_allowed === true) return "県外を含む（公式明示）";
  if(center.outside_prefecture_allowed === false) return "県外は一般募集対象外";
  return '<span class="vol-value-unknown">対象地域は要確認</span>';
}
function dispatchBadges(center){
  var badges = [];
  if(center.capacity_disclosed === true) badges.push("人数公表");
  if(center.outside_prefecture_allowed === true) badges.push("県外可");
  if(center.group_allowed === true) badges.push("団体可");
  if(center.group_application_available === true) badges.push("団体申込");
  if(present(center.vehicle_need)) badges.push("車両");
  if(hasRegionalLimit(center)) badges.push("地域制限");
  if(isPreparing(center)) badges.push("準備中");
  if(center.needs_reconfirmation === true) badges.push("要再確認");
  return badges.length ? '<div class="vol-icon-list">'+badges.map(function(label){return '<span class="vol-mini-badge">'+esc(label)+"</span>";}).join("")+"</div>" : "";
}

function allCenters(){
  return Array.isArray(sourceData.all_centers) ? sourceData.all_centers.slice() : sourceData.centers.slice();
}
function calendarCenters(){
  return sourceData.centers.slice().sort(function(a,b){ return a.municipality.localeCompare(b.municipality,"ja"); });
}
function dayInfo(center,date){
  if(center.calendar_overrides && center.calendar_overrides[date]) return center.calendar_overrides[date];
  var key = statusKey(center);
  if(key === "unknown") return {key:"unknown",label:"要確認",countable:false};
  if(!center.activity_start_date){
    if(key === "preparing" || key === "planned") return {key:key,label:STATUS_LABELS[key],countable:false};
    return {key:"unknown",label:"日別条件は要確認",countable:false};
  }
  if(date < center.activity_start_date) {
    if(["preparing","planned","recruiting","limited"].indexOf(key)>=0) return {key:"planned",label:"募集・活動予定",countable:false};
    return null;
  }
  if(center.activity_end_date && date > center.activity_end_date) return {key:"unknown",label:"以後は要確認",countable:false};
  if(key === "preparing" || key === "planned") return {key:key,label:STATUS_LABELS[key],countable:false};
  if(center.activity_end_date || center.activity_dates_confirmed === true){
    if(["recruiting","limited"].indexOf(key)>=0){
      return {key:key,label:key === "limited" ? "限定募集" : "募集中",capacity:center.capacity_disclosed === true ? capacityText(center).replace(/<[^>]+>/g,"") : null,countable:true};
    }
    if(key === "pending") return {key:"unknown",label:"日別条件は要確認",countable:false};
    if(key === "preparing" || key === "planned") return {key:key,label:STATUS_LABELS[key],countable:false};
    return {key:key,label:STATUS_LABELS[key],countable:false};
  }
  if(date === sourceData.meta.reference_date && isRecruiting(center)) return {key:"unknown",label:"当日条件は要確認",countable:false};
  return {key:"unknown",label:"要確認",countable:false};
}
function todayActive(center){
  var info = dayInfo(center,sourceData.meta.reference_date);
  return Boolean(info && info.countable === true);
}
function weekActive(center){
  for(var index=0;index<7;index+=1){
    var info = dayInfo(center,addDays(sourceData.meta.reference_date,index));
    if(info && info.countable === true) return true;
  }
  return false;
}

function filteredCenters(){
  var result = allCenters().filter(function(center){
    var unknown = statusKey(center) === "unknown";
    if(unknown && !state.filters.includeUnknown) return false;
    if(isEnded(center) && !state.filters.includeEnded) return false;
    if(state.filters.today && !todayActive(center)) return false;
    if(state.filters.week && !weekActive(center)) return false;
    if(state.filters.recruiting && !isRecruiting(center)) return false;
    if(state.filters.preparing && !isPreparing(center)) return false;
    if(state.filters.capacity && center.capacity_disclosed !== true) return false;
    if(state.filters.outside && center.outside_prefecture_allowed !== true) return false;
    if(state.filters.regional && !hasRegionalLimit(center)) return false;
    if(state.filters.individual && center.individual_allowed !== true) return false;
    if(state.filters.group && center.group_allowed !== true) return false;
    if(state.filters.groupForm && center.group_application_available !== true) return false;
    if(state.filters.vehicle && !present(center.vehicle_need)) return false;
    if(state.filters.junior && !juniorAllowed(center)) return false;
    if(state.filters.highschool && !highSchoolAllowed(center)) return false;
    if(state.filters.preregistration && center.application_required !== true) return false;
    if(state.filters.walkin && !walkInAllowed(center)) return false;
    if(state.activity !== "all" && (!Array.isArray(center.activity_types) || center.activity_types.indexOf(state.activity) < 0)) return false;
    if(state.query){
      var haystack = [
        center.municipality,center.district,center.recruitment_status,center.activity_dates_text,
        center.recruitment_area,center.minimum_age,center.activity_description,center.application_method,
        center.vehicle_need,center.remarks
      ].concat(center.activity_types || []).join(" ").toLowerCase();
      if(haystack.indexOf(state.query.toLowerCase()) < 0) return false;
    }
    return true;
  });
  result.sort(function(a,b){
    if(state.sort === "municipality") return a.municipality.localeCompare(b.municipality,"ja");
    if(state.sort === "capacity"){
      var av = a.capacity_disclosed === true ? (a.daily_capacity == null ? a.total_capacity : a.daily_capacity) : null;
      var bv = b.capacity_disclosed === true ? (b.daily_capacity == null ? b.total_capacity : b.daily_capacity) : null;
      if(av === null && bv !== null) return 1;
      if(av !== null && bv === null) return -1;
      return (bv || 0)-(av || 0);
    }
    if(state.sort === "activity"){
      var ad = a.activity_start_date || "9999-12-31";
      var bd = b.activity_start_date || "9999-12-31";
      return ad.localeCompare(bd) || a.municipality.localeCompare(b.municipality,"ja");
    }
    if(a.researched === false && b.researched !== false) return 1;
    if(a.researched !== false && b.researched === false) return -1;
    return String(b.checked_at || "").localeCompare(String(a.checked_at || "")) || a.municipality.localeCompare(b.municipality,"ja");
  });
  return result;
}
function plainBoolean(value){ return value === true ? "可（公式明示）" : value === false ? "不可（公式明示）" : "要確認"; }
function plainOutsideParticipation(center){
  if(center.outside_prefecture_allowed === true && center.ehime_participation_allowed === false) return "県外可（地域限定）・愛媛県は一般募集対象外";
  return plainBoolean(center.outside_prefecture_allowed);
}
window.exportVolunteerCsv = function(){
  var header = ["市町","地区","現在の状態","活動日・募集期間","募集人数","対象地域","県外参加","個人参加","団体参加","年齢条件","主な活動","申込方法","車両ニーズ","保険","愛媛県からの派遣判断","公式URL","確認日時"];
  var rows = filteredCenters().map(function(center){
    var capacity = center.capacity_disclosed === true && present(center.daily_capacity) ? String(center.daily_capacity)+(center.capacity_unit || "人／日") : center.capacity_disclosed === true && present(center.total_capacity) ? String(center.total_capacity)+(center.capacity_unit || "人") : center.researched === false ? "情報未確認" : "非公表";
    return [center.municipality,center.district,center.recruitment_status,center.activity_dates_text,capacity,center.recruitment_area,plainOutsideParticipation(center),plainBoolean(center.individual_allowed),plainBoolean(center.group_allowed),[center.minimum_age,center.age_conditions].filter(Boolean).join(" / "),(center.activity_types || []).join("・"),center.application_method,center.vehicle_need,center.insurance_requirement,center.ehime_dispatch_status,center.official_source_url,center.checked_at ? formatDateTime(center.checked_at) : "情報未確認"];
  });
  function quote(value){ return '"'+String(value == null ? "" : value).replace(/"/g,'""')+'"'; }
  var csv = "\ufeff"+[header].concat(rows).map(function(row){return row.map(quote).join(",");}).join("\r\n");
  var blob = new Blob([csv],{type:"text/csv;charset=utf-8"});
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "kumamoto_disaster_volunteer_"+sourceData.meta.reference_date.replace(/-/g,"")+".csv";
  link.click();
  window.setTimeout(function(){URL.revokeObjectURL(link.href);},1000);
};

function detailItems(center){
  return [
    ["地区",center.district],
    ["対象地域",center.recruitment_area],
    ["年齢条件",[center.minimum_age,center.age_conditions].filter(Boolean).join(" / ") || null],
    ["申込方法",center.application_method],
    ["集合場所",center.meeting_place],
    ["住所",center.address],
    ["受付時間",center.reception_time],
    ["活動時間",center.activity_time],
    ["申込期限",center.application_deadline],
    ["必要装備",center.equipment_required],
    ["駐車場",center.parking],
    ["現地移動方法",center.vehicle_access],
    ["車両ニーズ",center.vehicle_need],
    ["ボランティア保険",center.insurance_requirement],
    ["宿泊情報",center.accommodation_information],
    ["食事",center.meal_information],
    ["飲料",center.water_information],
    ["トイレ",center.toilet_information],
    ["交通条件",center.transport_information],
    ["連絡先",[center.contact,center.email].filter(Boolean).join(" / ") || null],
    ["公式情報間の相違",center.official_information_conflict],
    ["注意事項",center.remarks],
    ["具体的な活動内容",center.activity_description],
    ["出典の公表・更新日時",[center.source_published_at ? "公表 "+formatDateTime(center.source_published_at) : null,center.source_updated_at ? "更新 "+formatDateTime(center.source_updated_at) : null].filter(Boolean).join(" / ") || null],
    ["サイト確認日時",center.checked_at ? formatDateTime(center.checked_at) : null]
  ];
}
function centerDetailMarkup(center){
  var links = applicationLinksMarkup(center);
  return '<div class="vol-detail-grid">'+detailItems(center).map(function(item){
    return '<dl class="vol-detail-item"><dt>'+esc(item[0])+'</dt><dd>'+display(item[1])+"</dd></dl>";
  }).join("")+"</div>"+(links ? '<div class="vol-application-links"><strong>申込・受付ページ</strong>'+links+"</div>" : "");
}
function applicationEntries(center){
  var entries = [];
  function add(url,label,status){
    if(!url || entries.some(function(entry){return entry.url === url;})) return;
    entries.push({url:url,label:label,status:status || null,closed:/終了|締切|定員|停止/.test(String(status || ""))});
  }
  if(center.application_urls && !Array.isArray(center.application_urls) && typeof center.application_urls === "object"){
    Object.keys(center.application_urls).forEach(function(key){
      add(center.application_urls[key],key === "individual" ? "個人申込フォーム" : key === "group" ? "団体申込フォーム" : "申込フォーム（"+key+"）");
    });
  }
  if(Array.isArray(center.application_urls)) center.application_urls.forEach(function(url,index){add(url,"申込フォーム "+(index+1));});
  (center.activity_windows || []).forEach(function(windowItem){
    var range = [formatDate(windowItem.start_date),windowItem.end_date && windowItem.end_date !== windowItem.start_date ? formatDate(windowItem.end_date) : null].filter(Boolean).join("～");
    var status = windowItem.form_status || windowItem.status || null;
    if(windowItem.application_url) add(windowItem.application_url,range+" 申込ページ",status);
    (windowItem.application_urls || []).forEach(function(url,index){add(url,range+" 日別申込ページ "+(index+1),status);});
  });
  add(center.application_url,"申込・受付案内",center.application_form_status);
  return entries;
}
function applicationLinksMarkup(center){
  return applicationEntries(center).map(function(entry){
    var stateText = entry.closed ? "受付終了（参照のみ）" : (entry.status || "受付状態は公式ページで要確認");
    return '<span class="vol-application-entry'+(entry.closed ? " closed" : "")+'"><a class="vol-link" href="'+attr(entry.url)+'" target="_blank" rel="noopener noreferrer">'+esc(entry.label)+' ↗</a><small>'+esc(stateText)+"</small></span>";
  }).join("");
}
function officialLink(center){
  return center.official_source_url ? '<a class="vol-link" href="'+attr(center.official_source_url)+'" target="_blank" rel="noopener noreferrer">'+esc(center.official_source_name || "公式情報")+" ↗</a>" : '<span class="vol-value-unknown">公式の今回募集情報を確認できず</span>';
}
function tableRows(centers){
  return centers.map(function(center){
    return '<tr data-vol-row="'+attr(center.municipality)+'">'+
      '<td><button class="vol-municipality-button" data-vol-select="'+attr(center.municipality)+'" type="button">'+esc(center.municipality)+"</button>"+dispatchBadges(center)+"</td>"+
      "<td>"+display(center.district,"要確認")+"</td>"+
      "<td>"+statusMarkup(center)+"</td>"+
      "<td>"+display(center.activity_dates_text,"日程要確認")+"</td>"+
      "<td>"+capacityText(center)+"</td>"+
      "<td>"+targetAreaText(center)+"</td>"+
      "<td>"+outsideParticipationMarkup(center)+"</td>"+
      "<td>"+yesNoUnknown(center.individual_allowed)+"</td>"+
      "<td>"+yesNoUnknown(center.group_allowed)+"</td>"+
      "<td>"+display(center.minimum_age,"要確認")+"</td>"+
      "<td>"+activityText(center)+"</td>"+
      "<td>"+display(center.application_method,"要確認")+"</td>"+
      "<td>"+display(center.vehicle_need,"公表なし・要確認")+"</td>"+
      "<td>"+display(center.insurance_requirement,"公表なし・要確認")+"</td>"+
      "<td>"+display(center.ehime_dispatch_status,"要確認")+"</td>"+
      "<td>"+officialLink(center)+"</td>"+
      "<td>"+display(center.checked_at ? formatDateTime(center.checked_at) : null,"要確認")+"</td>"+
      "</tr>"+
      '<tr class="vol-detail-row"><td colspan="17"><details class="vol-row-details"><summary>'+esc(center.municipality)+"の詳細情報を開く</summary><div class=\"vol-row-detail-body\">"+centerDetailMarkup(center)+"</div></details></td></tr>";
  }).join("");
}
function cardsMarkup(centers){
  return centers.map(function(center){
    return '<article class="vol-card"><div class="vol-card-top"><div><h4><button class="vol-municipality-button" data-vol-select="'+attr(center.municipality)+'" type="button">'+esc(center.municipality)+"</button></h4>"+dispatchBadges(center)+"</div>"+statusMarkup(center)+"</div>"+
      '<div class="vol-card-grid">'+
      '<div class="vol-card-field"><b>地区</b>'+display(center.district,"要確認")+"</div>"+
      '<div class="vol-card-field"><b>活動日・募集期間</b>'+display(center.activity_dates_text,"要確認")+"</div>"+
      '<div class="vol-card-field"><b>募集人数</b>'+capacityText(center)+"</div>"+
      '<div class="vol-card-field"><b>対象地域・県外</b>'+targetAreaText(center)+"</div>"+
      '<div class="vol-card-field"><b>個人／団体</b>'+yesNoUnknown(center.individual_allowed,"個人可","個人不可")+" / "+yesNoUnknown(center.group_allowed,"団体可","団体不可")+"</div>"+
      '<div class="vol-card-field"><b>年齢条件</b>'+display([center.minimum_age,center.age_conditions].filter(Boolean).join(" / ") || null,"要確認")+"</div>"+
      '<div class="vol-card-field"><b>主な活動</b>'+activityText(center)+"</div>"+
      '<div class="vol-card-field"><b>申込方法</b>'+display(center.application_method,"要確認")+applicationLinksMarkup(center)+"</div>"+
      '<div class="vol-card-field"><b>車両ニーズ</b>'+display(center.vehicle_need,"公表なし・要確認")+"</div>"+
      '<div class="vol-card-field"><b>保険</b>'+display(center.insurance_requirement,"公表なし・要確認")+"</div>"+
      '<div class="vol-card-field"><b>愛媛県からの派遣判断</b>'+display(center.ehime_dispatch_status,"要確認")+"</div>"+
      "</div><details class=\"vol-row-details\"><summary>詳細情報</summary><div class=\"vol-row-detail-body\">"+centerDetailMarkup(center)+"<div>"+officialLink(center)+"</div></div></details></article>";
  }).join("");
}

function summaryData(){
  var researched = sourceData.centers;
  var checks = researched.map(function(center){return center.checked_at;}).filter(Boolean).sort();
  return [
    ["災害VC開設市町",researched.filter(function(c){return c.center_status && !/準備中|情報未確認/.test(c.center_status) && /開設|活動|受付/.test(c.center_status);}).length,"市町","公式情報で開設又は活動・受付を確認した市町を集計。設置準備中は含めない"],
    ["現在募集中",researched.filter(isRecruiting).length,"市町","募集中、限定募集、活動受付中を集計。日別条件の要確認を含む"],
    ["募集準備中",researched.filter(isPreparing).length,"市町","募集予定又は募集準備中を集計"],
    ["募集人数公表",researched.filter(function(c){return c.capacity_disclosed === true;}).length,"市町","具体的な募集定員・目安人数の公表を確認した市町のみ"],
    ["県外参加可（地域限定含む）",researched.filter(function(c){return c.outside_prefecture_allowed === true;}).length,"市町","熊本県外から参加可能と公式に明示された市町。九州限定を含み、愛媛県からの参加可を意味しない"],
    ["団体参加可を明示",researched.filter(function(c){return c.group_allowed === true;}).length,"市町","団体参加可能と公式に明示された市町のみ。申込フォームだけでは判定しない"],
    ["愛媛団体受入確認済み",researched.filter(function(c){return c.ehime_dispatch_status === "団体派遣可能と公式確認";}).length,"市町","愛媛県からの団体派遣受入れが公式に確認できた市町のみ"],
    ["車両ニーズあり",researched.filter(function(c){return present(c.vehicle_need);}).length,"市町","軽トラック等の車両協力を公式情報で確認した市町"],
    ["最終確認",checks.length ? formatDateTime(checks[checks.length-1]) : "要確認","","市町別公式情報をサイト側で最後に確認した日時"]
  ];
}
function summaryMarkup(){
  return summaryData().map(function(item,index){
    var tipId = "volSummaryTip"+index;
    return '<article class="vol-summary-card"><button class="vol-summary-help" type="button" aria-describedby="'+tipId+'" aria-label="'+attr(item[0]+"の集計条件")+'">?</button><span class="vol-summary-tooltip" id="'+tipId+'" role="tooltip">'+esc(item[3])+'</span><div class="vol-summary-label">'+esc(item[0])+'</div><div class="vol-summary-value">'+esc(item[1])+(item[2] ? '<span class="vol-summary-unit">'+esc(item[2])+"</span>" : "")+"</div></article>";
  }).join("");
}
function alertMarkup(){
  var restricted = sourceData.centers.filter(hasRegionalLimit).map(function(c){return c.municipality;});
  var confirmed = sourceData.centers.filter(function(c){return c.ehime_dispatch_status === "団体派遣可能と公式確認";}).length;
  var alerts = [
    ["info","i","県全体の事前登録を行っても、活動日、活動先又は参加が確定するものではありません。各市町の申込み又は受入調整が別途必要です。"],
    ["critical","!","公表情報で愛媛県からの団体受入れを確認できた市町は"+confirmed+"市町です。団体バスは県社協及び派遣先センターとの事前調整が必要です。"]
  ];
  if(restricted.length) alerts.push(["","!","地域限定の一般募集："+restricted.join("、")+"。愛媛県からの参加又は団体派遣は個別調整が必要です。"]);
  return alerts.map(function(alert,index){
    return '<div class="vol-alert '+alert[0]+'" data-vol-alert="'+index+'"><span class="vol-alert-icon" aria-hidden="true">'+esc(alert[1])+'</span><span>'+esc(alert[2])+'</span><button class="vol-alert-close" data-vol-dismiss="'+index+'" type="button" aria-label="この注意を閉じる">×</button></div>';
  }).join("");
}
function sourceLinkMarkup(source,label){
  if(!source || !source.url) return "";
  return '<a class="vol-link" href="'+attr(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(label || source.title || "公式情報")+" ↗</a>";
}
function commonMarkup(){
  return sourceData.statewide.cards.map(function(card){
    return '<article class="vol-common-card"><h4>'+esc(card.title)+'</h4><dl>'+card.items.map(function(item){return "<dt>"+esc(item[0])+"</dt><dd>"+display(item[1])+"</dd>";}).join("")+"</dl>"+sourceLinkMarkup(card.source,"公式情報")+"</article>";
  }).join("");
}
function changesMarkup(){
  if(sourceData.meta.initial_snapshot === true) return '<div class="vol-empty"><strong>初回確認のため比較履歴なし</strong><br>次回更新から、募集開始・日程追加・対象地域変更・休止・終了等を差分表示します。</div>';
  if(!sourceData.changes || !sourceData.changes.length) return '<div class="vol-empty">前回確認時からの変更はありません。</div>';
  return '<div class="vol-history">'+sourceData.changes.map(function(change){
    var officialTime = change.source_updated_at ? "公式更新 "+formatDateTime(change.source_updated_at) : "公式更新日時：記載確認できず";
    return '<div class="vol-history-item"><span class="vol-history-time">確認 '+esc(formatDateTime(change.checked_at))+'<br>'+esc(officialTime)+'</span><span class="vol-history-place">'+esc(change.municipality)+'</span><span class="vol-history-change"><b>'+esc(change.category)+'</b>'+esc(change.description)+"</span><span class=\"vol-history-source\">"+sourceLinkMarkup({url:change.url},change.publisher)+"</span></div>";
  }).join("")+"</div>";
}

function toolsMarkup(){
  var referenceDay = formatDate(sourceData.meta.reference_date);
  var filters = [
    ["today","基準日（"+referenceDay+"）活動可能"],["week","基準日から7日間に活動可能"],["recruiting","基準日時点で募集中"],["preparing","募集準備中"],
    ["capacity","募集人数公表あり"],["outside","県外参加可能"],["regional","地域限定あり"],["individual","個人参加可能"],
    ["group","団体参加可能"],["groupForm","団体申込フォームあり"],["vehicle","軽トラック等のニーズあり"],
    ["junior","中学生参加可能"],["highschool","高校生参加可能"],["preregistration","事前申込が必要"],
    ["walkin","当日受付可能"],["includeUnknown","情報未確認を含む"],["includeEnded","終了・休止を含む"]
  ];
  return '<div class="vol-tools"><div class="vol-field"><label for="volSearch">市町・活動・条件を検索</label><input id="volSearch" type="search" placeholder="例：団体、片付け、軽トラック" value="'+attr(state.query)+'"></div>'+
    '<div class="vol-field"><label for="volActivity">活動内容</label><select id="volActivity"><option value="all">すべての活動</option>'+sourceData.activity_categories.map(function(category){return '<option value="'+attr(category)+'"'+(state.activity===category?" selected":"")+">"+esc(category)+"</option>";}).join("")+"</select></div>"+
    '<div class="vol-field"><label for="volSort">並べ替え</label><select id="volSort"><option value="updated"'+(state.sort==="updated"?" selected":"")+'>更新が新しい順</option><option value="activity"'+(state.sort==="activity"?" selected":"")+'>活動日が近い順</option><option value="capacity"'+(state.sort==="capacity"?" selected":"")+'>募集人数が多い順</option><option value="municipality"'+(state.sort==="municipality"?" selected":"")+'>市町名順</option></select></div>'+
    '<button class="btn" id="volReset" type="button">条件をリセット</button></div>'+
    '<fieldset class="vol-filter-set"><legend>表示条件</legend><div class="vol-filter-chips">'+filters.map(function(filter){
      return '<label class="vol-check"><input type="checkbox" data-vol-filter="'+filter[0]+'"'+(state.filters[filter[0]]?" checked":"")+">"+esc(filter[1])+"</label>";
    }).join("")+"</div></fieldset>";
}
function comparisonMarkup(){
  var centers = filteredCenters();
  return toolsMarkup()+'<div class="vol-result-meta"><span id="volResultCount">表示 '+centers.length+"／県内 "+sourceData.all_municipalities.length+' 市町村</span><span>不明値は0人又は不可として扱いません。</span></div>'+
    '<div class="vol-table-wrap"><table class="vol-table"><thead><tr><th>市町</th><th>地区</th><th>現在の状態</th><th>活動日・募集期間</th><th>募集人数</th><th>対象地域</th><th>県外参加</th><th>個人</th><th>団体</th><th>年齢条件</th><th>主な活動</th><th>申込方法</th><th>車両ニーズ</th><th>保険</th><th>愛媛県からの派遣判断</th><th>公式情報</th><th>確認日時</th></tr></thead><tbody>'+tableRows(centers)+"</tbody></table></div>"+
    '<div class="vol-cards">'+cardsMarkup(centers)+"</div>"+
    '<div aria-live="polite" class="vol-selected" id="volSelectedDetail"></div>';
}

function calendarMarkup(){
  var dates = [];
  for(var index=0;index<14;index+=1) dates.push(addDays(sourceData.meta.reference_date,index));
  return '<div class="vol-calendar-wrap"><table class="vol-calendar"><thead><tr><th>市町</th>'+dates.map(function(date){
    var d = new Date(date+"T12:00:00+09:00");
    return "<th>"+(d.getMonth()+1)+"/"+d.getDate()+"<br>"+["日","月","火","水","木","金","土"][d.getDay()]+"</th>";
  }).join("")+"</tr></thead><tbody>"+calendarCenters().map(function(center){
    return "<tr><td>"+esc(center.municipality)+"</td>"+dates.map(function(date){
      var info = dayInfo(center,date);
      if(!info) return '<td><button class="vol-cal-cell none" type="button" disabled>活動なし</button></td>';
      return '<td><button class="vol-cal-cell '+attr(info.key)+'" data-vol-select="'+attr(center.municipality)+'" type="button"><strong>'+esc(info.label)+"</strong>"+(info.capacity ? "<br>"+esc(info.capacity) : "")+"</button></td>";
    }).join("")+"</tr>";
  }).join("")+"</tbody></table></div>"+
  '<div class="vol-calendar-legend">'+[
    ["recruiting","募集中"],["limited","限定募集"],["planned","募集予定"],["full","定員・休止"],["unknown","要確認"],["none","活動なし"]
  ].map(function(item){return '<span class="vol-legend-item"><i class="vol-legend-swatch" style="background:var(--vol-'+(item[0]==="recruiting"?"green":item[0]==="limited"?"blue":item[0]==="planned"?"orange":item[0]==="full"?"red":"gray")+')"></i>'+esc(item[1])+"</span>";}).join("")+'<span>「要確認」は活動可能日数・人数に集計しません。</span></div>';
}

function existingCoordinate(name){
  if(typeof NEED_MUNICIPALITIES !== "undefined"){
    var need = NEED_MUNICIPALITIES.find(function(item){return item.name === name;});
    if(need && need.coords) return need.coords;
  }
  if(typeof IMPACTS !== "undefined"){
    var impact = IMPACTS.find(function(item){return item.name === name;});
    if(impact) return [impact.lat,impact.lng];
  }
  if(typeof HUBS !== "undefined"){
    var hub = HUBS.find(function(item){return item.name === name || item.short === name;});
    if(hub) return [hub.lat,hub.lng];
  }
  return null;
}
function centerPopup(center){
  var todayInfo = dayInfo(center,sourceData.meta.reference_date);
  var todayLabel = todayInfo ? todayInfo.label : "活動可否は要確認";
  return '<div class="vol-map-popup"><h4>'+esc(center.municipality)+'</h4>'+statusMarkup(center)+
    "<dl><dt>基準日（"+esc(formatDate(sourceData.meta.reference_date))+"）の活動</dt><dd>"+esc(todayLabel)+"</dd>"+
    "<dt>募集人数</dt><dd>"+capacityText(center)+"</dd>"+
    "<dt>対象地域</dt><dd>"+targetAreaText(center)+"</dd>"+
    "<dt>県外参加</dt><dd>"+outsideParticipationMarkup(center)+"</dd>"+
    "<dt>団体参加</dt><dd>"+yesNoUnknown(center.group_allowed)+"</dd>"+
    "<dt>主な活動</dt><dd>"+activityText(center)+"</dd>"+
    "<dt>申込方法</dt><dd>"+display(center.application_method,"要確認")+"</dd></dl>"+
    officialLink(center)+'<br><button data-vol-select="'+attr(center.municipality)+'" type="button">詳細を表示</button></div>';
}
function mapMarkerIcon(center){
  var key = statusKey(center);
  var extras = (center.group_allowed === true ? "複" : "")+(present(center.vehicle_need) ? "車" : "")+(hasRegionalLimit(center) ? "限" : "");
  var label = center.capacity_disclosed === true && present(center.daily_capacity) ? String(center.daily_capacity) : "●";
  return L.divIcon({className:"",html:'<div class="vol-map-marker '+key+(center.outside_prefecture_allowed===true?" outside":"")+'" title="'+attr(center.municipality+" "+(center.recruitment_status || "情報未確認"))+'"><span>'+esc(label)+'</span>'+(extras ? '<small>'+esc(extras)+'</small>' : '')+"</div>",iconSize:[46,46],iconAnchor:[23,23],popupAnchor:[0,-19]});
}
function clusterIcon(centers){
  var names = centers.map(function(item){return item.center.municipality;}).join("、");
  return L.divIcon({className:"",html:'<div class="vol-map-cluster" title="'+attr(names)+'"><strong>'+centers.length+'</strong><small>市町</small></div>',iconSize:[48,48],iconAnchor:[24,24]});
}
function clusterPopup(items){
  return '<div class="vol-map-cluster-popup"><strong>近接する市町</strong><p>地図を拡大するか、市町を選択してください。</p>'+items.map(function(item){
    return '<button data-vol-select="'+attr(item.center.municipality)+'" type="button"><span>'+esc(item.center.municipality)+'</span><small>'+esc(item.center.recruitment_status || "情報未確認")+'</small></button>';
  }).join("")+"</div>";
}
function mapItems(){
  return allCenters().map(function(center){
    var coordinate = existingCoordinate(center.municipality);
    return coordinate ? {center:center,coordinate:coordinate} : null;
  }).filter(Boolean);
}
function drawVolunteerMapLayer(targetLayer,targetMap){
  targetLayer.clearLayers();
  var items = mapItems();
  var groups = [];
  var threshold = targetMap && targetMap.getZoom() >= 12 ? 22 : 48;
  items.forEach(function(item){
    var point = targetMap ? targetMap.latLngToLayerPoint(item.coordinate) : null;
    var group = point ? groups.find(function(candidate){return candidate.point.distanceTo(point) < threshold;}) : null;
    if(group){
      group.items.push(item);
      group.point = L.point((group.point.x*(group.items.length-1)+point.x)/group.items.length,(group.point.y*(group.items.length-1)+point.y)/group.items.length);
    }else groups.push({items:[item],point:point});
  });
  groups.forEach(function(group){
    if(group.items.length === 1){
      var item = group.items[0];
      L.marker(item.coordinate,{icon:mapMarkerIcon(item.center),keyboard:true,title:item.center.municipality+" "+(item.center.recruitment_status || "情報未確認")}).bindPopup(centerPopup(item.center)).addTo(targetLayer);
      return;
    }
    var latitude = group.items.reduce(function(sum,item){return sum+item.coordinate[0];},0)/group.items.length;
    var longitude = group.items.reduce(function(sum,item){return sum+item.coordinate[1];},0)/group.items.length;
    var marker = L.marker([latitude,longitude],{icon:clusterIcon(group.items),keyboard:true,title:group.items.length+"市町が近接"}).addTo(targetLayer);
    marker.bindPopup(clusterPopup(group.items));
    marker.on("click",function(){
      if(targetMap && targetMap.getZoom() < 13){
        marker.closePopup();
        targetMap.setView([latitude,longitude],Math.min(13,targetMap.getZoom()+2));
      }
    });
  });
}
function renderVolunteerMapLayer(targetLayer,targetMap){
  drawVolunteerMapLayer(targetLayer,targetMap);
  if(targetMap && !targetLayer._volunteerZoomHandler){
    targetLayer._volunteerZoomHandler = function(){ if(targetMap.hasLayer(targetLayer)) drawVolunteerMapLayer(targetLayer,targetMap); };
    targetMap.on("zoomend",targetLayer._volunteerZoomHandler);
  }
}
function bindMapPopupNavigation(targetMap){
  if(!targetMap || targetMap._volunteerPopupNavigationBound) return;
  targetMap._volunteerPopupNavigationBound = true;
  targetMap.on("popupopen",function(event){
    var popupElement = event.popup && event.popup.getElement ? event.popup.getElement() : null;
    if(!popupElement) return;
    popupElement.querySelectorAll("[data-vol-select]").forEach(function(button){
      button.addEventListener("click",function(){
        var name = button.dataset.volSelect;
        if(typeof setPrimaryView === "function") setPrimaryView("volunteer");
        window.setTimeout(function(){selectMunicipality(name,true);},80);
      });
    });
  });
}
function initVolunteerMap(){
  if(volunteerMap){
    volunteerMap.invalidateSize();
    return;
  }
  var container = document.getElementById("volunteerMap");
  if(!container || typeof L === "undefined") return;
  volunteerMap = L.map(container,{zoomControl:true,preferCanvas:true}).setView(KUMAMOTO_PREF_OFFICE,KUMAMOTO_DEFAULT_ZOOM);
  L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",{maxZoom:18,attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル（淡色地図）</a>'}).addTo(volunteerMap);
  volunteerMapLayer = L.layerGroup().addTo(volunteerMap);
  renderVolunteerMapLayer(volunteerMapLayer,volunteerMap);
  bindMapPopupNavigation(volunteerMap);
}
function setupMainMapLayer(){
  var button = document.getElementById("volunteerLayerToggle");
  if(!button || typeof L === "undefined" || typeof map === "undefined") return;
  if(!volunteerMainLayer){
    volunteerMainLayer = L.layerGroup();
    renderVolunteerMapLayer(volunteerMainLayer,map);
    volunteerMainLegend = L.control({position:"bottomright"});
    volunteerMainLegend.onAdd = function(){
      var element = L.DomUtil.create("div","vol-map-main-legend active");
      element.setAttribute("role","note");
      element.innerHTML = '<strong>災害ボランティア</strong><span>緑 募集中</span><span>青 限定</span><span>橙 準備中</span><span>赤 定員・休止</span><span>灰 情報未確認</span><small>数字=人数／複=団体／車=車両／限=地域制限</small>';
      L.DomEvent.disableClickPropagation(element);
      return element;
    };
    bindMapPopupNavigation(map);
  }
  if(button.dataset.bound === "true") return;
  button.dataset.bound = "true";
  button.addEventListener("click",function(){
    var active = map.hasLayer(volunteerMainLayer);
    if(active){
      window.hideVolunteerMainLayer();
    }else {
      hideShelterLayer();
      volunteerMainLayer.addTo(map);
      drawVolunteerMapLayer(volunteerMainLayer,map);
      if(volunteerMainLegend) volunteerMainLegend.addTo(map);
      map.setView(KUMAMOTO_PREF_OFFICE,KUMAMOTO_DEFAULT_ZOOM);
      button.classList.add("active");
      button.setAttribute("aria-pressed","true");
    }
  });
}
function mapSideMarkup(){
  var center = allCenters().find(function(item){return item.municipality === selectedMunicipality;}) || sourceData.centers[0];
  if(!center) return '<div class="vol-map-note">市町別情報がありません。</div>';
  return '<h4>'+esc(center.municipality)+'</h4>'+statusMarkup(center)+dispatchBadges(center)+'<p class="vol-map-note">'+display(center.group_dispatch_assessment)+"</p>"+centerDetailMarkup(center)+"<div>"+officialLink(center)+"</div>";
}
function mapMarkup(){
  var plotted = mapItems().map(function(item){return item.center.municipality;});
  var unplotted = sourceData.all_municipalities.filter(function(name){return plotted.indexOf(name) < 0;});
  return '<div class="vol-map-layout"><div><div aria-label="災害ボランティア募集状況地図" id="volunteerMap"></div><div class="vol-map-legend"><span class="vol-legend-item">緑：募集中</span><span class="vol-legend-item">青：限定募集</span><span class="vol-legend-item">橙：予定・準備中</span><span class="vol-legend-item">赤：定員・休止</span><span class="vol-legend-item">灰：情報未確認</span><span>数字＝公表人数、複＝団体、車＝車両、限＝地域制限</span></div><p class="vol-map-note">既存地図で保持している市町代表点だけを再利用しています（表示 '+plotted.length+'／県内 '+sourceData.all_municipalities.length+' 市町村）。ピンは活動先や大型バスの乗入口を示すものではありません。既存「地図」タブでは「災害ボランティア」ボタンで同じ状態レイヤーを重ねられます。</p>'+(unplotted.length ? '<details class="vol-unmapped"><summary>代表点がなく地図未表示の'+unplotted.length+'市町村</summary><p>'+esc(unplotted.join("、"))+'。比較表では「情報未確認」として表示しています。</p></details>' : '')+'</div><aside class="vol-map-side" id="volMapSide">'+mapSideMarkup()+"</aside></div>";
}

function dispatchConclusion(){
  var confirmed = sourceData.centers.filter(function(center){return center.ehime_dispatch_status === "団体派遣可能と公式確認";});
  if(confirmed.length) return "公表情報で愛媛県からの団体派遣受入れを確認できた市町："+confirmed.map(function(c){return c.municipality;}).join("、")+"。ただし、派遣日、人数及び大型バス条件は各センターと最終調整してください。";
  return "個人向けの募集は確認できますが、愛媛県からの団体派遣、大型バスの受入れ及び1団体当たりの人数については、熊本県社会福祉協議会及び派遣先市町の災害ボランティアセンターとの事前調整が必要です。";
}
function dispatchMarkup(){
  return '<div class="vol-dispatch-conclusion"><strong>結論</strong><br>'+esc(dispatchConclusion())+"</div>"+
    '<div class="vol-dispatch-grid">'+sourceData.centers.filter(function(center){return center.researched !== false;}).map(function(center){
      return '<article class="vol-dispatch-card"><h4><span>'+esc(center.municipality)+'</span><span class="vol-mini-badge">'+esc(center.ehime_dispatch_status || "要確認")+"</span></h4><p>"+display(center.group_dispatch_assessment)+"</p></article>";
    }).join("")+"</div>"+
    '<h4>次に確認すべき事項</h4><ul class="vol-check-list">'+sourceData.dispatch_questions.map(function(question){return "<li>"+esc(question)+"</li>";}).join("")+"</ul>";
}

function planningValue(center,key){
  var commonToll = sourceData.statewide.toll && sourceData.statewide.toll.confirmed;
  var values = {
    destination:center.municipality,
    district:center.district,
    activity:center.activity_description,
    required_people:null,
    accepted_people:null,
    activity_date:center.activity_end_date ? center.activity_dates_text : null,
    activity_period:center.activity_start_date && center.activity_end_date ? center.activity_dates_text : null,
    group_size:null,
    dispatch_count:null,
    activity_days:null,
    itinerary:center.transport_information,
    daytrip_lodging:center.accommodation_information,
    meeting_time:center.reception_time,
    finish_time:center.activity_time,
    bus_access:/大型バス|貸切バス/.test(String(center.vehicle_access || "")) ? center.vehicle_access : null,
    bus_parking:null,
    local_vehicle:center.vehicle_access,
    light_truck:center.vehicle_need,
    toll:commonToll ? "制度あり。派遣車両への適用可否と書類は個別確認" : null,
    ferry:/フェリー/.test(String(center.transport_information || "")) ? center.transport_information : null,
    lodging:center.accommodation_information,
    meal:center.meal_information || (/昼食|食事/.test(String(center.equipment_required || "")) ? center.equipment_required : null),
    water:center.water_information || (/飲料|水分/.test(String(center.equipment_required || "")) ? center.equipment_required : null),
    toilet:center.toilet_information,
    rest:null,
    equipment:center.equipment_required,
    helmet:/ヘルメット/.test(String(center.equipment_required || "")) ? center.equipment_required : null,
    mask:/マスク/.test(String(center.equipment_required || "")) ? center.equipment_required : null,
    boots:/長靴/.test(String(center.equipment_required || "")) ? center.equipment_required : null,
    gloves:/手袋|軍手/.test(String(center.equipment_required || "")) ? center.equipment_required : null,
    insurance:center.insurance_requirement,
    escort:null,
    coordination:center.contact || center.email,
    participant_cost:null,
    cancellation:center.safety_note,
    cancellation_fee:null
  };
  return values[key];
}
function planningStatus(center,item){
  var value = planningValue(center,item.key);
  if(item.key === "destination") return {key:"partial",label:"一部確認済み",note:"画面で選択した派遣先候補："+center.municipality+"。派遣先としての決定・受入承諾は要確認"};
  if(present(value)){
    var partialKeys = ["activity_date","activity_period","itinerary","daytrip_lodging","local_vehicle","toll","meal","water","coordination","cancellation"];
    return {key:partialKeys.indexOf(item.key)>=0 ? "partial" : "confirmed",label:partialKeys.indexOf(item.key)>=0 ? "一部確認済み" : "確認済み",note:String(value)};
  }
  if(item.key === "bus_access" && /不可/.test(String(center.vehicle_access || ""))) return {key:"na",label:"対象外",note:String(center.vehicle_access)};
  return {key:"missing",label:"公表なし・要照会",note:item.inquiry_to};
}
function planningMarkup(){
  var centers = allCenters();
  var center = centers.find(function(item){return item.municipality === selectedMunicipality;}) || centers[0];
  if(center) selectedMunicipality = center.municipality;
  var rows = sourceData.planning_items.map(function(item){
    var status = planningStatus(center,item);
    return '<article class="vol-matrix-item"><div class="vol-matrix-top"><span class="vol-matrix-label">'+esc(item.label)+'</span><span class="vol-matrix-status '+status.key+'">'+esc(status.label)+'</span></div><div class="vol-matrix-note">'+esc(status.note)+"</div></article>";
  });
  var counts = rows.length;
  return '<div class="vol-planning-head"><div class="vol-field"><label for="volPlanningMunicipality">市町を選択</label><select class="vol-planning-select" id="volPlanningMunicipality">'+centers.map(function(item){return '<option value="'+attr(item.municipality)+'"'+(item.municipality===selectedMunicipality?" selected":"")+">"+esc(item.municipality)+"</option>";}).join("")+'</select></div><div class="vol-planning-summary">全'+counts+"項目。未確認値は推測で補いません。</div></div><div class=\"vol-matrix\" id=\"volPlanningMatrix\">"+rows.join("")+"</div>";
}
function costMarkup(){
  return '<details class="vol-cost-panel"><summary>派遣経費の検討項目を開く</summary><div class="vol-cost-body"><p class="vol-map-note">初期金額はすべて空欄です。入力額だけを暫定集計し、未入力が残る間は確定額として扱いません。</p><div class="vol-cost-grid">'+sourceData.cost_items.map(function(item,index){
    return '<div class="vol-cost-row"><div class="vol-cost-name">'+esc(item.label)+(item.direction === "offset" ? "（控除）" : "")+'</div><div><label for="volCostStatus'+index+'">状況</label><select id="volCostStatus'+index+'" data-vol-cost-status="'+index+'"><option value="要確認">要確認</option><option value="見積取得済み">見積取得済み</option><option value="見積依頼中">見積依頼中</option><option value="金額未確認">金額未確認</option><option value="対象外">対象外</option></select></div><div><label for="volCostAmount'+index+'">金額（円）</label><input id="volCostAmount'+index+'" data-vol-cost-amount="'+index+'" data-direction="'+attr(item.direction || "expense")+'" type="number" min="0" step="1" inputmode="numeric" placeholder="未入力"></div></div>';
  }).join("")+'</div><div class="vol-cost-total"><strong id="volCostTotal">未算定</strong><span id="volCostNote">全項目未入力</span></div></div></details>';
}
function historyMarkup(){
  var history = sourceData.update_history || [];
  var first = history.slice(0,10);
  var rest = history.slice(10);
  function rows(items){
    return '<div class="vol-history">'+items.map(function(item){
      var officialTime = item.official_updated_at ? "公式更新 "+formatDateTime(item.official_updated_at) : "公式更新日時：記載確認できず";
      return '<div class="vol-history-item"><span class="vol-history-time">'+esc(formatDateTime(item.changed_at))+'<br>'+esc(officialTime)+'</span><span class="vol-history-place">'+esc(item.municipality)+'</span><span class="vol-history-change"><b>'+esc(item.change_type)+'</b>'+esc(item.before == null ? "変更前：なし" : "変更前："+item.before)+"<br>"+esc("変更後："+item.after)+"</span><span class=\"vol-history-source\">"+sourceLinkMarkup({url:item.official_url},item.publisher)+"</span></div>";
    }).join("")+"</div>";
  }
  return rows(first)+(rest.length ? '<details class="vol-row-details"><summary>それ以前の'+rest.length+'件を表示</summary>'+rows(rest)+"</details>" : "");
}
function sourcesMarkup(){
  var groups = {};
  sourceData.sources.filter(function(source){return source.used_for_this_event !== false;}).forEach(function(source){
    if(!groups[source.group]) groups[source.group] = [];
    groups[source.group].push(source);
  });
  return '<div class="vol-source-groups">'+Object.keys(groups).map(function(group){
    return '<section class="vol-source-group"><h4>'+esc(group)+'</h4>'+groups[group].map(function(source){
      var dates = [
        source.published_at ? "公表 "+formatDateTime(source.published_at) : "公表日：記載確認できず",
        source.updated_at ? "更新 "+formatDateTime(source.updated_at) : "更新日時：記載確認できず",
        source.checked_at ? "確認 "+formatDateTime(source.checked_at) : "確認日時：要確認"
      ].join(" / ");
      return '<div class="vol-source-item"><div><b>'+esc(source.publisher)+'</b><br><span class="vol-source-meta">'+esc(source.group)+'</span></div><div class="vol-source-title">'+esc(source.title)+"<br>"+sourceLinkMarkup(source,"公式ページ")+'</div><div class="vol-source-meta">'+esc(dates)+"</div></div>";
    }).join("")+"</section>";
  }).join("")+"</div>";
}
function freshnessMarkup(){
  var checked = new Date(sourceData.meta.oldest_checked_at || sourceData.meta.checked_at);
  var now = new Date();
  if(Number.isNaN(checked.getTime()) || checked.getTime() > now.getTime()+300000){
    return '<span class="vol-stale">要再確認（確認日時不明）</span>';
  }
  var hours = (now.getTime()-checked.getTime())/3600000;
  if(hours >= 48) return '<span class="vol-stale">要再確認（48時間以上）</span>';
  return '<span class="vol-current">48時間以内に確認</span>';
}
function section(title,description,tag,body,id){
  return '<section class="vol-section"'+(id ? ' id="'+attr(id)+'"' : "")+'><div class="vol-section-head"><div><h3>'+esc(title)+'</h3><p>'+esc(description || "")+'</p></div>'+(tag ? '<span class="vol-section-tag">'+esc(tag)+"</span>" : "")+"</div>"+body+"</section>";
}
function shellMarkup(){
  return '<div class="vol-hero"><div class="vol-title"><h2>災害ボランティア</h2><p>一般参加の条件と、愛媛県・愛媛県社会福祉協議会が団体派遣を判断するための未確認事項を、同じ市町別データから表示します。</p></div><div class="vol-meta"><strong>情報管理</strong><div class="vol-meta-line"><span>情報基準日時</span><span>'+esc(formatDateTime(sourceData.meta.reference_at))+'</span></div><div class="vol-meta-line"><span>サイト最終確認</span><span>'+esc(formatDateTime(sourceData.meta.checked_at))+'</span></div><div class="vol-meta-line"><span>次回確認</span><span>'+(sourceData.meta.next_review_required ? "必要" : "現時点なし")+"</span></div>"+freshnessMarkup()+"</div></div>"+
    '<div class="vol-caution">'+esc(sourceData.meta.caution)+"</div>"+
    '<div class="vol-summary">'+summaryMarkup()+"</div>"+
    '<div class="vol-alerts" id="volAlerts">'+alertMarkup()+"</div>"+
    section("重要な変更","前回確認時からの募集条件・日程・受付方法等の差分","差分管理",changesMarkup(),"volChanges")+
    section("熊本県全体の共通案内","事前登録、保険、高速道路無料措置及び安全確認","公式情報",'<div class="vol-common-grid">'+commonMarkup()+"</div>","volCommon")+
    section("市町別比較表","募集条件を比較し、詳細をアコーディオンで確認","中心コンテンツ",comparisonMarkup(),"volComparison")+
    section("基準日から14日間の募集カレンダー","情報基準日から14日間。明確な活動日だけを活動可能として表示","14日間",calendarMarkup(),"volCalendarSection")+
    section("市町別募集状況地図","既存の地図・市町代表点を再利用した位置関係の補助","地理院淡色",mapMarkup(),"volMapSection")+
    section("愛媛県からの団体派遣","団体バス、受入人数、車両及び現地条件を過大判定せず整理","意思決定",dispatchMarkup(),"volDispatch")+
    section("派遣計画に必要な情報","市町を選ぶと確認状況と照会先が切り替わります","確認マトリクス",planningMarkup(),"volPlanning")+
    section("派遣経費の検討項目","金額は見積取得又は入力後にのみ設定","初期値なし",costMarkup(),"volCosts")+
    section("更新履歴","初回登録を含む状態データの履歴","直近10件",historyMarkup(),"volHistory")+
    section("公式情報源","今回の地震について実際に確認した公式情報のみ","一次資料",sourcesMarkup(),"volSources");
}

function renderComparison(){
  var container = document.getElementById("volComparison");
  if(!container) return;
  var visibleCenters = filteredCenters();
  if(!visibleCenters.some(function(center){return center.municipality === selectedMunicipality;})){
    selectedMunicipality = visibleCenters.length ? visibleCenters[0].municipality : null;
  }
  var head = container.querySelector(".vol-section-head");
  var next = head ? head.nextElementSibling : null;
  while(next){ var remove = next; next = next.nextElementSibling; remove.remove(); }
  container.insertAdjacentHTML("beforeend",comparisonMarkup());
  renderSelectedDetail();
  renderPlanning();
}
function renderPlanning(){
  var sectionElement = document.getElementById("volPlanning");
  if(!sectionElement) return;
  var head = sectionElement.querySelector(".vol-section-head");
  var next = head ? head.nextElementSibling : null;
  while(next){ var remove = next; next = next.nextElementSibling; remove.remove(); }
  sectionElement.insertAdjacentHTML("beforeend",planningMarkup());
}
function renderSelectedDetail(){
  var target = document.getElementById("volSelectedDetail");
  if(!target) return;
  var center = allCenters().find(function(item){return item.municipality === selectedMunicipality;});
  if(!center){ target.innerHTML = '<div class="vol-empty">表示結果から市町を選択してください。</div>'; return; }
  target.innerHTML = "<h4>"+esc(center.municipality)+"｜詳細・公式情報</h4>"+statusMarkup(center)+dispatchBadges(center)+centerDetailMarkup(center)+"<div>"+officialLink(center)+"</div>";
  var mapSide = document.getElementById("volMapSide");
  if(mapSide) mapSide.innerHTML = mapSideMarkup();
}
function selectMunicipality(name,scroll){
  selectedMunicipality = name;
  renderSelectedDetail();
  renderPlanning();
  if(scroll){
    var target = document.getElementById("volSelectedDetail");
    if(target) target.scrollIntoView({behavior:"smooth",block:"start"});
  }
}
function updateCostTotal(){
  var inputs = Array.from(document.querySelectorAll("[data-vol-cost-amount]"));
  var entered = 0;
  var total = 0;
  inputs.forEach(function(input){
    if(input.value === "") return;
    var value = Number(input.value);
    if(!Number.isFinite(value)) return;
    entered += 1;
    total += input.dataset.direction === "offset" ? -value : value;
  });
  var totalElement = document.getElementById("volCostTotal");
  var noteElement = document.getElementById("volCostNote");
  if(totalElement) totalElement.textContent = "暫定 "+total.toLocaleString("ja-JP")+"円";
  if(entered === 0){
    if(totalElement) totalElement.textContent = "未算定";
    if(noteElement) noteElement.textContent = "全項目未入力";
  }else if(noteElement) noteElement.textContent = entered+"項目入力／"+(inputs.length-entered)+"項目未入力。暫定額であり確定額ではありません。";
}
function bindEvents(){
  app.addEventListener("input",function(event){
    if(event.target.id === "volSearch"){
      state.query = event.target.value;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function(){
        renderComparison();
        var search = document.getElementById("volSearch");
        if(search){ search.focus(); search.setSelectionRange(search.value.length,search.value.length); }
      },220);
    }
    if(event.target.matches("[data-vol-cost-amount]")) updateCostTotal();
  });
  app.addEventListener("change",function(event){
    if(event.target.id === "volActivity"){ state.activity = event.target.value; renderComparison(); return; }
    if(event.target.id === "volSort"){ state.sort = event.target.value; renderComparison(); return; }
    if(event.target.matches("[data-vol-filter]")){ state.filters[event.target.dataset.volFilter] = event.target.checked; renderComparison(); return; }
    if(event.target.id === "volPlanningMunicipality"){ selectedMunicipality = event.target.value; renderPlanning(); renderSelectedDetail(); return; }
  });
  app.addEventListener("click",function(event){
    var dismiss = event.target.closest("[data-vol-dismiss]");
    if(dismiss){ var alert = dismiss.closest("[data-vol-alert]"); if(alert) alert.remove(); return; }
    var select = event.target.closest("[data-vol-select]");
    if(select){ selectMunicipality(select.dataset.volSelect,true); return; }
    if(event.target.id === "volReset"){
      state.query = ""; state.activity = "all"; state.sort = "updated";
      Object.keys(state.filters).forEach(function(key){state.filters[key] = key === "includeUnknown";});
      renderComparison();
    }
  });
}

function fail(message){
  if(app){
    app.setAttribute("aria-busy","false");
    app.innerHTML = '<div class="vol-fatal" role="alert"><strong>災害ボランティア情報を表示できませんでした。</strong><br>'+esc(message)+"<br>既存の各タブは引き続き利用できます。</div>";
  }
}
function init(){
  if(initialized){
    setTimeout(function(){ if(volunteerMap) volunteerMap.invalidateSize(); },80);
    return;
  }
  if(!app || !sourceData || !Array.isArray(sourceData.centers)) return fail("構造化データの読み込みに失敗しました。");
  try{
    selectedMunicipality = sourceData.centers[0] ? sourceData.centers[0].municipality : null;
    app.innerHTML = shellMarkup();
    app.setAttribute("aria-busy","false");
    bindEvents();
    setupMainMapLayer();
    initialized = true;
    setTimeout(initVolunteerMap,80);
  }catch(error){
    fail(error && error.message ? error.message : "初期化エラー");
  }
}

globalThis.initVolunteerView = init;
if(sourceData && Array.isArray(sourceData.centers) && Array.isArray(sourceData.all_centers)) setupMainMapLayer();
})();

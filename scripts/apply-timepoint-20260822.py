import json, re, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = "2026-08-22T15:16:00+09:00"
RELEASE = "20260822-1516"
BASE_SHA = "c18527ff3c38b17206f3323a929ddf89865e7572"


def load(name):
    return json.loads((ROOT / name).read_text())


def dump(name, value):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def jst_label(value):
    # 2026-08-22T13:30:50+09:00 -> 8月22日13時30分
    m = re.match(r"\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})", value or "")
    if not m:
        return value
    mo, day, hour, minute = map(int, m.groups())
    return f"{mo}月{day}日{hour}時{minute:02d}分"


# candidate has already passed validate-current-shelters; promote without mutating it.
candidate = ROOT / "candidate-current-shelters.json"
if not candidate.exists():
    raise SystemExit("candidate-current-shelters.json is missing")
shutil.copyfile(candidate, ROOT / "current-shelters.json")
shelter = load("current-shelters.json")
meta = shelter["meta"]
if meta["current_count"] != 68 or len(shelter["shelters"]) != 68:
    raise SystemExit(f"unexpected current shelter count: {meta['current_count']}/{len(shelter['shelters'])}")
if any(row.get("coordinate_status") != "confirmed" for row in shelter["shelters"]):
    raise SystemExit("candidate contains non-confirmed current shelter coordinates")
source_time_label = jst_label(meta["source_last_modified"])

# Recheck the 11 detailed municipal VC records. Only verified new facts change values.
for filename in ["research_official_north.json", "research_official_south.json"]:
    data = load(filename)
    data["checked_at"] = REF
    for key in ["scope", "research_scope"]:
        if isinstance(data.get(key), str):
            data[key] = data[key].replace("2026年8月21日", "2026年8月22日")
    for municipality in data.get("municipalities", []):
        municipality["checked_at"] = REF
        if municipality["municipality"] != "熊本市":
            if municipality.get("recheck_status") == "差分あり":
                municipality["recheck_status"] = "変更なし"
            municipality["recheck_note"] = "8月22日15:16時点で公式一次情報を再確認。前回確認済みの現行状態を変更する新たな一次情報は確認できず、既存状態を保持。"
        if municipality.get("sources"):
            municipality["sources"][0]["checked_at"] = REF

    if filename == "research_official_north.json":
        km = next(item for item in data["municipalities"] if item["municipality"] == "熊本市")
        new_url = "https://www.kumamoto-city-csw.or.jp/%E3%80%90%E7%AC%AC%EF%BC%93%E6%9C%9F%E3%80%80%E3%83%9C%E3%83%A9%E3%83%B3%E3%83%86%E3%82%A3%E3%82%A2%E5%8B%9F%E9%9B%86%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6%E3%80%91/"
        km.update({
            "center_status": "開設・活動中",
            "recruitment_status": "募集中（第3期・8月26日～30日）",
            "activity_start_date": "2026-08-26",
            "activity_end_date": "2026-08-30",
            "activity_dates_text": "8月24日・25日はニーズ調整のため活動休止。第3期は8月26日～30日に南区サテライトで活動するボランティアを募集。",
            "activity_windows": [
                {"start_date": "2026-08-24", "end_date": "2026-08-25", "status": "活動休止", "form_status": "ニーズ調整"},
                {"start_date": "2026-08-26", "end_date": "2026-08-30", "status": "募集中", "form_status": "第3期公式受付"},
            ],
            "daily_capacity": None,
            "total_capacity": None,
            "capacity_unit": None,
            "capacity_disclosed": None,
            "remaining_capacity": None,
            "recruitment_area": None,
            "outside_prefecture_allowed": None,
            "individual_allowed": True,
            "group_allowed": None,
            "group_application_available": None,
            "minimum_age": "高校生以上",
            "age_conditions": "高校生以上の健康な方",
            "activity_types": ["家屋内の片付け", "家財の搬出", "清掃", "物資の仕分け・運搬"],
            "activity_description": "家屋内外の片付け、清掃、家具等の搬出、支援物資等の仕分け。軽トラック提供者を歓迎。",
            "application_required": True,
            "application_method": "南区サテライト第3期の公式活動申込フォームから事前申込。",
            "application_url": "https://forms.gle/rG5KfreSdwx7gsJr9",
            "application_deadline": "第3期8月26日～30日。募集状況は公式ページ・フォームで確認。",
            "application_form_status": "第3期公式受付",
            "meeting_place": "熊本市城南福祉センター 1階（南区サテライト）",
            "address": "熊本市南区城南町宮地1050番地",
            "reception_time": "9:00～",
            "activity_time": "9:00～16:00",
            "parking": "第1駐車場：城南まちづくりセンター西側砂利駐車場／第2駐車場：旧熊本市城南老人福祉センター跡地",
            "vehicle_need": "軽トラック提供可能者を歓迎",
            "equipment_required": "軍手又はゴム手袋、熱中症対策、作業しやすい服装",
            "contact": "080-1545-0531",
            "group_dispatch_assessment": "第3期は8月26～30日に募集。団体受入人数・大型バス条件は公式告知に明記がないため要照会。",
            "ehime_dispatch_status": "第3期募集中・団体条件要照会",
            "official_source_name": "熊本市社会福祉協議会",
            "official_source_title": "第3期 ボランティア募集について",
            "official_source_url": new_url,
            "source_published_at": "2026-08-21",
            "source_updated_at": "2026-08-21",
            "checked_at": REF,
            "recheck_status": "差分あり",
            "recheck_note": "8月22日に公式第3期告知を確認。8月24・25日は活動休止、8月26～30日の募集へ更新。",
            "change_status": "第3期募集へ更新",
            "change_from_previous": "第2期締切・8月24日以降未発表から、第3期8月26～30日の公式募集へ更新。",
            "previous_known_state": "受付終了（第2期定員到達）・8月24日以降要再確認",
            "needs_reconfirmation": True,
            "information_confidence": "高（公式一次情報を確認）",
            "remarks": "8月24・25日はニーズ調整のため活動休止。第3期は8月26～30日。県外・団体の詳細条件は明記がないため推測しない。",
        })
        if not any(str(src.get("title", "")).startswith("第3期") for src in km.get("sources", [])):
            km.setdefault("sources", []).insert(0, {
                "publisher": "熊本市社会福祉協議会",
                "title": "第3期 ボランティア募集について",
                "url": new_url,
                "published_at": "2026-08-21",
                "updated_at": "2026-08-21",
                "checked_at": REF,
                "facts_used": "8月24・25日活動休止、第3期8月26～30日、南区サテライト、高校生以上、活動内容、申込フォーム",
            })
    dump(filename, data)

statewide = load("research_official_statewide.json")
statewide["checked_at"] = REF
if isinstance(statewide.get("statewide_facts"), dict):
    statewide["statewide_facts"]["latest_checked_at"] = REF
observations = statewide.setdefault("additional_official_observations", [])
if not any(item.get("subject") == "玉東町" for item in observations if isinstance(item, dict)):
    observations.append({
        "subject": "玉東町",
        "state": "UNKNOWN",
        "observation": "熊本市の連携中枢都市圏公式情報に『令和8年熊本地震災害ボランティア募集（玉東町）』の掲載を確認。活動日・対象地域・申込条件の詳細は今回の確認では特定できないため、募集条件を推測しない。",
        "url": "https://www.city.kumamoto.jp/toshiken/",
        "checked_at": REF,
    })
dump("research_official_statewide.json", statewide)

# Keep historical calendar snapshots; layer only the new current correction.
generator_path = ROOT / "scripts/generate-volunteer-data.mjs"
generator = generator_path.read_text()
anchor = "Object.assign(currentCalendarOverrides, currentCalendarOverrides20260821);"
if "currentCalendarOverrides20260822" not in generator:
    generator = generator.replace(anchor, anchor + '''\nconst currentCalendarOverrides20260822 = {\n  "熊本市": {\n    "2026-08-24": {key:"paused",label:"ニーズ調整のため活動休止",countable:false},\n    "2026-08-25": {key:"paused",label:"ニーズ調整のため活動休止",countable:false},\n    "2026-08-26": {key:"recruiting",label:"第3期募集中",countable:true},\n    "2026-08-27": {key:"recruiting",label:"第3期募集中",countable:true},\n    "2026-08-28": {key:"recruiting",label:"第3期募集中",countable:true},\n    "2026-08-29": {key:"recruiting",label:"第3期募集中",countable:true},\n    "2026-08-30": {key:"recruiting",label:"第3期募集中",countable:true}\n  }\n};\nObject.assign(currentCalendarOverrides, currentCalendarOverrides20260822);''')
generator_path.write_text(generator)

# Page-level timepoint metadata. Underlying source_as_of values are not falsified.
html_path = ROOT / "ehime_kumamoto_support_geocoded_shelters_20260802.html"
html = html_path.read_text()
html = html.replace("D+24", "D+25")
html = html.replace("2026年8月21日確認", "2026年8月22日確認")
html = html.replace("volunteer-data.js?v=20260821-1500", f"volunteer-data.js?v={RELEASE}")
html = html.replace("現行公式JSONの71施設", "現行公式JSONの68施設")
html = html.replace("公式JSON現在71施設", "公式JSON現在68施設")
html = html.replace("8月21日14時25分更新の71施設", f"{source_time_label}更新の68施設")
html = html.replace("公式JSONは8月21日14時25分更新の現在開設一覧", f"公式JSONは{source_time_label}更新の現在開設一覧")

match = re.search(r"const PAGE_RECHECK_META=(\{[^\n]*\});", html)
if not match:
    raise SystemExit("PAGE_RECHECK_META not found")
page = json.loads(match.group(1))
page["checkedAt"] = REF
page["volunteerCheckedAt"] = REF
rows = {row["section"]: row for row in page["rows"]}
rows["被害・支援"].update(status="変更なし", current="8月20日14時の熊本県第36報を最新確認値として保持", previous="8月21日確認時と同じ", difference="8月22日確認時点で、県計を更新する新しい被害速報を確認できず。対象時点は8月20日14時のまま。")
rows["愛媛県支援"].update(status="要再確認", current="8月20日12時の支援状況を最新確認値として保持", previous="8月20日12時資料", difference="愛媛県公式ページの更新を再確認したが、数値を更新できる新しい時点資料を特定できないため前回値を保持。")
rows["避難所"].update(status="差分あり", current="県第36報69か所／公式JSON現在68施設／位置履歴206点", previous="公式JSON現在71施設（8月21日14時25分更新）", difference=f"公式ライブJSONは{source_time_label}更新で68施設。candidate 68件を検証し、全68件が公式座標confirmed、conflict/unresolved 0。県第36報69か所、位置履歴206点とは別定義。")
rows["支援ニーズ見通し"].update(status="変更なし", current="避難・人的・住家は第36報、断水等は直近確認済み国交省資料を保持", previous="8月21日確認時と同じ", difference="新しい一次資料で上書きできる値を確認できず、対象時点を明示した前回値を保持。")
rows["発災後タイムライン"].update(status="変更なし", current="8月20日第36報・8月21日までの確認済み国交省情報を保持", previous="8月21日確認時と同じ", difference="新しい公式一次情報で確定できたタイムライン値はなく、履歴を維持。")
rows["支援ダッシュボード"].update(status="変更なし", current="給水・TEC-FORCE・行政応援は直近確認済み値を保持", previous="8月21日確認時と同じ", difference="8月22日時点で、既存値を更新する新しい一次資料を確認できず。対象時点を維持して表示。")
rows["災害ボランティア"].update(status="差分あり", current="8月22日に公式一次情報を再確認し、熊本市第3期を反映", previous="8月21日確認", difference="熊本市は8月24・25日休止、8月26～30日の第3期募集へ更新。御船町など既報日程は維持。玉東町は公式集約に募集掲載を確認したが詳細条件未確定のためUNKNOWN扱い。", source="市町社会福祉協議会・熊本市公式集約", url="https://www.kumamoto-city-csw.or.jp/news/saigai.php")
page_json = json.dumps(page, ensure_ascii=False, separators=(",", ":"))
html = html[:match.start(1)] + page_json + html[match.end(1):]

cleanup_end = "/* CURRENT_STATE_CLEANUP_20260821_END */"
if "CURRENT_STATE_RECHECK_20260822_START" not in html:
    block = f'''\n/* CURRENT_STATE_RECHECK_20260822_START */\nif(typeof currentSnapshot20260821!=="undefined")currentSnapshot20260821.checkedAt="{REF}";\nconst currentStateRecheckShelterNeed20260822=PROVINCE_NEEDS.find(item=>item.id==="p-shelter");\nif(currentStateRecheckShelterNeed20260822)currentStateRecheckShelterNeed20260822.observed="熊本県第36報（8月20日14時）では11市町村69か所の避難所に2,925人。現行公式JSONは{source_time_label}更新の68施設で、定義と時点が異なる。";\nconst currentStateRecheckTimeline20260822=TIMELINE_EVENTS.find(event=>event.id==="t-current-status");\nif(currentStateRecheckTimeline20260822)currentStateRecheckTimeline20260822.detail="熊本県第36報（8月20日14時現在）。市町別内訳は県合計と分け、推計を含む住家被害は今後変動し得る。現行公式JSONの68施設は別定義で表示。";\nconst currentStateRecheckPageRows20260822={page_json}.rows;\nfor(const update of currentStateRecheckPageRows20260822){{const row=PAGE_RECHECK_META.rows.find(item=>item.section===update.section);if(row)Object.assign(row,update);}}\nPAGE_RECHECK_META.checkedAt="{REF}";PAGE_RECHECK_META.volunteerCheckedAt="{REF}";\n/* CURRENT_STATE_RECHECK_20260822_END */'''
    html = html.replace(cleanup_end, cleanup_end + block)
html_path.write_text(html)
shutil.copyfile(html_path, ROOT / "public/dashboard.html")

# Validators: change expected values, never remove the gates.
validator = ROOT / "scripts/validate-volunteer-data.mjs"
text = validator.read_text()
text = text.replace('assert(data.meta.reference_at.startsWith("2026-08-21"),"ボランティア情報の基準日が2026-08-21ではありません");', 'assert(data.meta.reference_at.startsWith("2026-08-22"),"ボランティア情報の基準日が2026-08-22ではありません");')
text = text.replace('assert(data.meta.checked_at === "2026-08-21T15:00:00+09:00", "ボランティア情報の最終確認時刻がページ全体の確認時刻と一致しません");', f'assert(data.meta.checked_at === "{REF}", "ボランティア情報の最終確認時刻がページ全体の確認時刻と一致しません");')
text = text.replace('assert(JSON.stringify(disclosedCapacityMunicipalities) === JSON.stringify(["熊本市","宇土市","美里町","益城町"]),"人数公表市町が検証値と一致しません");', 'assert(JSON.stringify(disclosedCapacityMunicipalities) === JSON.stringify(["宇土市","美里町","益城町"]),"人数公表市町が検証値と一致しません");')
start = text.index('const kumamoto = data.centers.find((center)=>center.municipality === "熊本市");')
end = text.index('assert(data.centers.filter((center)=>center.ehime_dispatch_status', start)
new_checks = '''const kumamoto = data.centers.find((center)=>center.municipality === "熊本市");
assert(kumamoto?.recruitment_status === "募集中（第3期・8月26日～30日）","熊本市の現況募集状態が一致しません");
assert(kumamoto?.official_source_title === "第3期 ボランティア募集について","熊本市の第3期公式告知が現況ソースではありません");
assert(kumamoto?.application_url === "https://forms.gle/rG5KfreSdwx7gsJr9","熊本市の第3期申込フォームが一致しません");
assert(kumamoto?.activity_start_date === "2026-08-26" && kumamoto?.activity_end_date === "2026-08-30","熊本市の第3期活動期間が一致しません");
assert(Array.isArray(kumamoto?.activity_windows) && kumamoto.activity_windows.length === 2,"熊本市の休止・第3期活動期間が分離されていません");
assert(kumamoto.activity_windows[0].status === "活動休止" && kumamoto.activity_windows[1].status === "募集中","熊本市の休止・募集状態が一致しません");
assert(kumamoto?.meeting_place?.includes("熊本市城南福祉センター"),"熊本市の南区サテライト集約が反映されていません");
assert(kumamoto?.capacity_disclosed === null && kumamoto?.daily_capacity === null,"熊本市第3期に非公表人数を持ち込んでいます");
const kumamotoCalendar = kumamoto?.calendar_overrides || {};
for(const date of ["2026-08-24","2026-08-25"]){assert(kumamotoCalendar[date]?.key === "paused" && kumamotoCalendar[date]?.countable === false,`熊本市の${date}が活動休止として扱われていません`);}
for(const date of ["2026-08-26","2026-08-27","2026-08-28","2026-08-29","2026-08-30"]){assert(kumamotoCalendar[date]?.key === "recruiting" && kumamotoCalendar[date]?.countable === true,`熊本市の${date}が第3期募集中として扱われていません`);}
assert(kumamoto?.sources?.some((item)=>String(item.title || "").includes("第3期")),"熊本市の第3期一次情報がsourceにありません");
assert(kumamoto?.sources?.some((item)=>String(item.title || "").includes("第1期")),"熊本市の第1期情報が履歴/sourceにありません");
'''
text = text[:start] + new_checks + text[end:]
text = text.replace('assert(data.centers.filter((center)=>isCurrentAccepting(center)).length === 6,"基準日時点で現行募集として扱う6市町が一致しません");', 'assert(data.centers.filter((center)=>isCurrentAccepting(center)).length === 7,"基準日時点で現行募集として扱う7市町が一致しません");')
text = text.replace('assert(data.centers.filter((center)=>isCurrentAccepting(center) && typeof center.vehicle_need === "string" && center.vehicle_need.length > 0).length === 5,"基準日時点の車両ニーズ5市町が一致しません");', 'assert(data.centers.filter((center)=>isCurrentAccepting(center) && typeof center.vehicle_need === "string" && center.vehicle_need.length > 0).length === 6,"基準日時点の車両ニーズ6市町が一致しません");')
validator.write_text(text)

path = ROOT / "scripts/validate-dashboard-current.mjs"
text = path.read_text().replace("D+24", "D+25").replace("2026年8月21日確認", "2026年8月22日確認").replace("2026-08-21T15:00:00+09:00", REF)
path.write_text(text)

path = ROOT / "scripts/validate-current-state-audit.mjs"
text = path.read_text()
text = text.replace("volunteer-data.js?v=20260821-1500", f"volunteer-data.js?v={RELEASE}")
text = text.replace("2026-08-21T15:00:00+09:00", REF).replace('"D+24"', '"D+25"')
text = text.replace("8月21日14時25分更新", f"{source_time_label}更新")
text = text.replace("2026-08-21T14:30:05+09:00", meta["fetched_at"])
text = text.replace("2026-08-21T14:25:44+09:00", meta["source_last_modified"])
text = text.replace("assert.equal(shelterData.meta.current_count, 71);", "assert.equal(shelterData.meta.current_count, 68);")
text = text.replace("assert.equal(shelterData.shelters.length, 71);", "assert.equal(shelterData.shelters.length, 68);")
text = text.replace('assert.ok(pageMeta.rows.find((row) => row.section === "支援ダッシュボード").difference.includes("971人"));', 'assert.ok(pageMeta.rows.find((row) => row.section === "支援ダッシュボード").status === "変更なし");')
path.write_text(text)

# Machine-readable release ledger, including all 45 municipalities.
gen = generator_path.read_text()
all_municipalities = json.loads(re.search(r"const allMunicipalities = (\[[^;]+\]);", gen).group(1))
researched = {"熊本市", "八代市", "宇土市", "宇城市", "美里町", "御船町", "嘉島町", "益城町", "甲佐町", "氷川町", "芦北町"}
coverage = {name: ("rechecked_current" if name in researched else "official_not_found") for name in all_municipalities}
coverage["玉東町"] = "unknown_needs_recheck"
expected = [
    "operations/ledgers/refresh-20260822-1516.json",
    "current-shelters.json",
    "ehime_kumamoto_support_geocoded_shelters_20260802.html",
    "public/dashboard.html",
    "research_official_north.json",
    "research_official_south.json",
    "research_official_statewide.json",
    "scripts/generate-volunteer-data.mjs",
    "scripts/validate-current-state-audit.mjs",
    "scripts/validate-dashboard-current.mjs",
    "scripts/validate-volunteer-data.mjs",
    "volunteer-data.js",
]
ledger = {
    "schema_version": 2,
    "repository": "ryotamatsuki/kumamotoshienmap",
    "update_type": "timepoint_refresh",
    "gate_phase": "pre_merge",
    "update_id": "refresh-20260822-1516",
    "release_id": RELEASE,
    "reference_at": REF,
    "page_checked_at": None,
    "base_main_sha": BASE_SHA,
    "expected_changed_files": expected,
    "sources": [
        {"source_id": "kumamoto-live-shelter", "url": meta["source_url"], "source_as_of": meta["source_last_modified"], "checked_at": meta["fetched_at"], "fetched_at": meta["fetched_at"]},
        {"source_id": "kumamoto-city-vc-third", "url": "https://www.kumamoto-city-csw.or.jp/%E3%80%90%E7%AC%AC%EF%BC%93%E6%9C%9F%E3%80%80%E3%83%9C%E3%83%A9%E3%83%B3%E3%83%86%E3%82%A3%E3%82%A2%E5%8B%9F%E9%9B%86%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6%E3%80%91/", "source_as_of": "2026-08-21T00:00:00+09:00", "checked_at": REF, "fetched_at": None},
        {"source_id": "mifune-vc", "url": "https://mifune-shakyo.jp/pages/51/detail%3D1/b_id%3D269/r_id%3D56", "source_as_of": None, "checked_at": REF, "fetched_at": None},
        {"source_id": "kumamoto-city-volunteer-app", "url": "https://www.city.kumamoto.jp/toshiken/", "source_as_of": "2026-08-22T00:00:00+09:00", "checked_at": REF, "fetched_at": None},
        {"source_id": "kumamoto-prefecture-report36", "url": "https://www.pref.kumamoto.jp/uploaded/life/277838_875456_misc.pdf", "source_as_of": "2026-08-20T14:00:00+09:00", "checked_at": REF, "fetched_at": None},
        {"source_id": "mlit-earthquake-status", "url": "https://www.mlit.go.jp/saigai/saigai_260728.html", "source_as_of": None, "checked_at": REF, "fetched_at": None},
        {"source_id": "ehime-support-page", "url": "https://www.pref.ehime.jp/page/154856.html", "source_as_of": None, "checked_at": REF, "fetched_at": None},
        {"source_id": "ehime-support-20260820", "url": "https://www.pref.ehime.jp/uploaded/attachment/188363.pdf", "source_as_of": "2026-08-20T12:00:00+09:00", "checked_at": REF, "fetched_at": None},
    ],
    "coverage": {
        "statewide": "rechecked_no_newer_confirmed_snapshot",
        "municipalities": coverage,
        "researched_centers": 11,
        "current_shelters": {"current_count": 68, "unresolved": 0, "conflicts": 0},
        "historical_coordinate_master": 206,
        "source_public_parity": "required",
        "notes": "official_not_foundは今回確認した公式集約・既存公式一次情報で新規の募集詳細を確認できなかったことのみを表し、募集なし・活動終了を意味しない。",
    },
    "snapshots": {
        "prefecture_report": {"report": "第36報", "source_as_of": "2026-08-20T14:00:00+09:00", "shelters": 69, "evacuees": 2925},
        "current_shelters": {"source_last_modified": meta["source_last_modified"], "fetched_at": meta["fetched_at"], "current_count": 68, "confirmed": 68, "unresolved": 0, "conflicts": 0},
        "coordinate_history": {"source_as_of": "2026-08-02T23:21:09+09:00", "count": 206},
    },
    "blocking_unresolved": [],
    "accepted_unresolved": [
        {"issue_id": "gyokuto-volunteer-detail", "state": "UNKNOWN", "reason": "熊本市の連携中枢都市圏公式情報で『令和8年熊本地震災害ボランティア募集（玉東町）』の掲載を確認したが、今回の確認では活動日・募集地域・申込条件の詳細を一次情報で確定できない。募集ありの詳細条件を推測せずUNKNOWNを維持する。", "owner": "更新担当", "source_ids": ["kumamoto-city-volunteer-app"], "next_review_at": "2026-08-23T15:16:00+09:00"},
        {"issue_id": "ehime-support-latest-detail", "state": "UNKNOWN", "reason": "愛媛県公式の支援ページ更新を再確認したが、8月20日12時資料を上回る数値入り時点資料を今回特定できないため、支援人数等は8月20日12時の検証済み値を保持する。", "owner": "更新担当", "source_ids": ["ehime-support-page", "ehime-support-20260820"], "next_review_at": "2026-08-23T15:16:00+09:00"},
    ],
}
dump("operations/ledgers/refresh-20260822-1516.json", ledger)
print(json.dumps({"status": "APPLIED", "current_shelters": 68, "source_last_modified": meta["source_last_modified"], "fetched_at": meta["fetched_at"], "reference_at": REF}, ensure_ascii=False))

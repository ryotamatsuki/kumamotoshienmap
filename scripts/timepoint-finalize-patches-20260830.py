from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REF = "2026-08-30T14:20:00+09:00"
DAMAGE_URL = "https://www.pref.kumamoto.jp/soshiki/222/276831.html"


def pre() -> None:
    p = Path("scripts/timepoint-refresh-core-20260830.mjs")
    s = p.read_text()
    bad = "  html=html.replace(/熊本県第45報（8月26日8時）（?:（2026年8月24日8時）)?の避難所65か所/u,'熊本県第49報（8月28日8時）の避難所61か所');"
    good = "  html=html.split('熊本県第45報（8月26日8時）（2026年8月24日8時）の避難所65か所').join('熊本県第49報（8月28日8時）の避難所61か所');\n  html=html.split('熊本県第45報（8月26日8時）の避難所65か所').join('熊本県第49報（8月28日8時）の避難所61か所');"
    if bad not in s:
        raise SystemExit("target regex line not found")
    p.write_text(s.replace(bad, good))


def update_json_const(h: str, name: str, mutator) -> str:
    m = re.search(rf"const {name}=(\[[^\n]*\]);", h)
    if not m:
        raise SystemExit(f"{name} base constant not found")
    value = json.loads(m.group(1))
    mutator(value)
    return h[: m.start(1)] + json.dumps(value, ensure_ascii=False, separators=(",", ":")) + h[m.end(1) :]


def mutate_needs(rows: list[dict]) -> None:
    item = next((x for x in rows if x.get("id") == "p-shelter"), None)
    if not item:
        raise SystemExit("p-shelter missing")
    item["observed"] = "熊本県第49報（8月28日8時）では避難所61か所、避難者2,442人。現行公式避難所JSONは取得時点の開設施設を別定義で表示する。"
    item = next((x for x in rows if x.get("id") == "p-admin"), None)
    if item:
        item["observed"] = "熊本県第49報では住家被害43,292棟。市町別旧スナップショットとは時点が異なるため、県計と旧内訳を分離して表示する。"
    item = next((x for x in rows if x.get("id") == "p-housing"), None)
    if item:
        item["observed"] = "熊本県第49報では住家被害43,292棟。被害区分別の現況は確認できた県計の範囲を超えて推測せず、旧区分値を現況として流用しない。"


def mutate_timeline(rows: list[dict]) -> None:
    item = next((x for x in rows if x.get("id") == "t-current-status"), None)
    if not item:
        raise SystemExit("t-current-status missing")
    item.update(
        {
            "date": "2026-08-28",
            "dateLabel": "8月28日",
            "weekday": "金",
            "time": "08:00",
            "phase": "recovery",
            "actor": "kumamoto",
            "title": "熊本県第49報で被害・避難状況を更新",
            "summary": "避難者2,442人、開設避難所61か所、人的被害402人、住家被害43,292棟。",
            "detail": "熊本県第49報（8月28日8時現在）の県全体値。市町別旧スナップショットは時点が異なるため、第49報の県計へ機械的に再配分しない。現行公式避難所JSONは別定義・別時点で表示。",
            "place": "熊本県内",
            "sourceLabel": "熊本県 被害情報 第49報",
            "sourceUrl": DAMAGE_URL,
            "tags": ["熊本県第49報", "8月28日8時", "最新確認"],
        }
    )


def post() -> None:
    p = Path("operations/audits/institution-coverage-20260830-1420.json")
    d = json.loads(p.read_text())
    d["operation_version"] = "2.5"
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")

    shelters = json.loads(Path("current-shelters.json").read_text())
    count = shelters["meta"]["current_count"]
    note = (shelters["meta"].get("source_last_modified") or shelters["meta"]["fetched_at"]).replace("T", " ").split("+")[0]
    for name in ["ehime_kumamoto_support_geocoded_shelters_20260802.html", "public/dashboard.html"]:
        q = Path(name)
        h = q.read_text()
        pat = r'<button class="overview-kpi" data-overview-impact="shelters"[\s\S]*?</button>'
        repl = f'<button class="overview-kpi" data-overview-impact="shelters" type="button"><div class="overview-kpi-label">避難所</div><div class="overview-kpi-value">{count}<span class="overview-kpi-unit">か所</span></div><div class="overview-kpi-note">公式JSON現在・{note}</div></button>'
        h, n = re.subn(pat, repl, h, count=1)
        if n != 1:
            raise SystemExit(f"shelter KPI patch failed: {name}")
        h = update_json_const(h, "PROVINCE_NEEDS", mutate_needs)
        h = update_json_const(h, "TIMELINE_EVENTS", mutate_timeline)
        h = h.replace("24市町の人的被害表内合計396人。県第45報の人的被害合計は402人", "24市町の人的被害表内合計396人。県第49報の人的被害合計は402人")
        h = h.replace("住家被害の市町別旧スナップショット38,498棟と県第45報39,567棟は時点が異なるため単純差分を現況差と扱わない", "住家被害の市町別旧スナップショット38,498棟と県第49報43,292棟は時点が異なるため単純差分を現況差と扱わない")
        h = h.replace("8月26日19:26までに確認できた一次情報", "8月30日14:20までに確認できた一次情報")
        q.write_text(h)

    sn = Path("scripts/sync-national-support-audit.mjs")
    sn.write_text(sn.read_text().replace('tags:["熊本県第45報","8月26日8時","最新確認"]', 'tags:["熊本県第49報","8月28日8時","最新確認"]'))

    v = Path("scripts/validate-dashboard-current.mjs")
    s = v.read_text()
    replacements = {
        "国交省第49報8/25値はHISTORICALスナップショット。8/26は佐伯市給水継続をCURRENT、TEC-FORCE第5陣・はくおう2宿泊は実働未確認のためUNKNOWN": "国交省第50報（8/27）を最新インフラ履歴として確認。8/30ははくおう2宿泊支援をCURRENT、同一定義の実働を直接確認できない項目はUNKNOWN",
        "8月25日閣議の災害融資特別措置を保持し、8月30日実働主体を再監査": "8月27日支援パッケージ・8月28日予備費使用決定を確認し、8月30日実働主体を再監査",
        "2026年8月26日 19:26": "2026年8月30日 14:20",
    }
    for old, new in replacements.items():
        s = s.replace(old, new)
    v.write_text(s)

    v = Path("scripts/validate-current-state-audit.mjs")
    s = v.read_text()
    replacements = {
        "2026-08-26T19:26:53+09:00": REF,
        'assert.ok(need("p-shelter").observed.includes("熊本県第45報"));': 'assert.ok(need("p-shelter").observed.includes("熊本県第49報"));',
        'assert.ok(event("t-current-status").tags.includes("熊本県第45報"));': 'assert.ok(event("t-current-status").tags.includes("熊本県第49報"));',
        'assert.equal(event("t-current-status").summary, "避難者2,589人、開設避難所64か所、人的被害402人、住家被害39,567棟。");': 'assert.equal(event("t-current-status").summary, "避難者2,442人、開設避難所61か所、人的被害402人、住家被害43,292棟。");',
        '["D+29", "行政応援971人", "8月26日19:26までに確認できた一次情報", "8月26日19:26基準で全件再監査"]': '["D+33", "行政応援971人", "8月30日14:20までに確認できた一次情報", "8月30日14:20基準で全件再監査"]',
    }
    for old, new in replacements.items():
        s = s.replace(old, new)
    v.write_text(s)

    v = Path("scripts/validate-volunteer-data.mjs")
    s = v.read_text().replace('data.meta.reference_at.startsWith("2026-08-26")', 'data.meta.reference_at.startsWith("2026-08-30")').replace("ボランティア情報の基準日が2026-08-26ではありません", "ボランティア情報の基準日が2026-08-30ではありません")
    v.write_text(s)


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"pre", "post"}:
        raise SystemExit("usage: timepoint-finalize-patches-20260830.py pre|post")
    pre() if sys.argv[1] == "pre" else post()

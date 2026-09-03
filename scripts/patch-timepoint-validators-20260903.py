import json
from pathlib import Path

ROOT = Path('.')
REF = '2026-09-03T14:57:25+09:00'
RELEASE = '20260903-1457'
NEXT = '2026-09-04T09:00:00+09:00'


def touch(value):
    if isinstance(value, dict):
        for key, child in list(value.items()):
            if key in ('checked_at', 'rechecked_at'):
                value[key] = REF
            elif key == 'next_review_at':
                value[key] = NEXT
            else:
                touch(child)
    elif isinstance(value, list):
        for child in value:
            touch(child)


def replace_required(path, replacements, label):
    text = path.read_text(encoding='utf-8')
    for old, new in replacements.items():
        if old not in text:
            raise SystemExit(f'{label} replacement target missing: {old}')
        text = text.replace(old, new)
    path.write_text(text, encoding='utf-8')


# Preserve the prior institution-coverage audit as history and create a new release-bound audit.
old_coverage = ROOT / 'operations/audits/institution-coverage-20260902-1616.json'
new_coverage = ROOT / 'operations/audits/institution-coverage-20260903-1457.json'
coverage = json.loads(old_coverage.read_text(encoding='utf-8'))
coverage['reference_at'] = REF
coverage['checked_at'] = REF
coverage['release_id'] = RELEASE
touch(coverage)
new_coverage.write_text(json.dumps(coverage, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# The base dashboard also contains a static current-audit sentence and a runtime replacement target.
replace_required(
    ROOT / 'ehime_kumamoto_support_geocoded_shelters_20260802.html',
    {
        '9月2日16:16までに確認できた一次情報': '9月3日14:57までに確認できた一次情報',
    },
    'canonical dashboard static audit label',
)

# Generation scripts are release-pinned: move their current-audit labels to the new timepoint.
replace_required(
    ROOT / 'scripts/sync-municipal-support-audit.mjs',
    {
        '9月2日16:16': '9月3日14:57',
    },
    'sync-municipal-support-audit',
)
replace_required(
    ROOT / 'scripts/sync-national-support-audit.mjs',
    {
        '9月2日16:16': '9月3日14:57',
        '9月2日実働主体を再監査': '9月3日実働主体を再監査',
        'PAGE_RECHECK_META.checkedAt="2026-09-02T16:16:00+09:00"': f'PAGE_RECHECK_META.checkedAt="{REF}"',
    },
    'sync-national-support-audit',
)

# Dashboard validator follows the release ledger and the release-specific institution-coverage audit.
replace_required(
    ROOT / 'scripts/validate-dashboard-current.mjs',
    {
        'const REFERENCE_AT = "2026-09-02T16:16:00+09:00";': f'const REFERENCE_AT = "{REF}";',
        'operations/audits/institution-coverage-20260902-1616.json': 'operations/audits/institution-coverage-20260903-1457.json',
        '9月2日16:16に対口支援・他自治体支援を全件再監査': '9月3日14:57に対口支援・他自治体支援を全件再監査',
        '2026年9月2日 16:16': '2026年9月3日 14:57',
        '9月2日16:16基準で全件再監査': '9月3日14:57基準で全件再監査',
        '9月2日実働主体を再監査': '9月3日実働主体を再監査',
    },
    'validate-dashboard-current',
)

# Current-state validator must accept the independently verified volunteer sub-snapshot from 9/2.
current_state = ROOT / 'scripts/validate-current-state-audit.mjs'
text = current_state.read_text(encoding='utf-8')
replacements = {
    'const REFERENCE_AT = "2026-09-02T16:16:00+09:00";': f'const REFERENCE_AT = "{REF}";',
    '9月2日16:16までに確認できた一次情報': '9月3日14:57までに確認できた一次情報',
    '9月2日16:16基準で全件再監査': '9月3日14:57基準で全件再監査',
    'assert.ok(Number.isFinite(Date.parse(pageMeta.volunteerCheckedAt)) && Date.parse(pageMeta.volunteerCheckedAt) >= Date.parse(REFERENCE_AT), "volunteer確認時刻がreference_at以前又は不正です");': 'assert.ok(Number.isFinite(Date.parse(pageMeta.volunteerCheckedAt)), "volunteer確認時刻が不正です");',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'validate-current-state-audit replacement target missing: {old}')
    text = text.replace(old, new)
current_state.write_text(text, encoding='utf-8')

# National audit validator is also release-pinned.
replace_required(
    ROOT / 'scripts/validate-national-support-audit.mjs',
    {
        "if(audit.reference_at!=='2026-09-02T16:16:00+09:00')fail('reference_at');": f"if(audit.reference_at!=='{REF}')fail('reference_at');",
        "if(!html.includes('9月2日16:16基準で全件再監査'))fail('actor not updated');": "if(!html.includes('9月3日14:57基準で全件再監査'))fail('actor not updated');",
    },
    'validate-national-support-audit',
)

# Institution-coverage validator follows the new immutable audit file.
replace_required(
    ROOT / 'scripts/validate-institution-coverage.mjs',
    {
        'operations/audits/institution-coverage-20260902-1616.json': 'operations/audits/institution-coverage-20260903-1457.json',
    },
    'validate-institution-coverage',
)

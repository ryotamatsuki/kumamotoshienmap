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


old_coverage = ROOT / 'operations/audits/institution-coverage-20260902-1616.json'
new_coverage = ROOT / 'operations/audits/institution-coverage-20260903-1457.json'
coverage = json.loads(old_coverage.read_text(encoding='utf-8'))
coverage['reference_at'] = REF
coverage['checked_at'] = REF
coverage['release_id'] = RELEASE
touch(coverage)
new_coverage.write_text(json.dumps(coverage, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

validator = ROOT / 'scripts/validate-dashboard-current.mjs'
text = validator.read_text(encoding='utf-8')
replacements = {
    'const REFERENCE_AT = "2026-09-02T16:16:00+09:00";': f'const REFERENCE_AT = "{REF}";',
    'operations/audits/institution-coverage-20260902-1616.json': 'operations/audits/institution-coverage-20260903-1457.json',
    '9月2日16:16に対口支援・他自治体支援を全件再監査': '9月3日14:57に対口支援・他自治体支援を全件再監査',
    '2026年9月2日 16:16': '2026年9月3日 14:57',
    '9月2日16:16基準で全件再監査': '9月3日14:57基準で全件再監査',
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'validate-dashboard-current replacement target missing: {old}')
    text = text.replace(old, new)
validator.write_text(text, encoding='utf-8')

institution_validator = ROOT / 'scripts/validate-institution-coverage.mjs'
text = institution_validator.read_text(encoding='utf-8')
old = 'operations/audits/institution-coverage-20260902-1616.json'
new = 'operations/audits/institution-coverage-20260903-1457.json'
if old not in text:
    raise SystemExit('validate-institution-coverage coverage path target missing')
institution_validator.write_text(text.replace(old, new), encoding='utf-8')

import json
import pathlib
import re

root = pathlib.Path('.')
REF = '2026-09-03T14:57:25+09:00'
NEXT = '2026-09-04T09:00:00+09:00'
RELEASE = '20260903-1457'
BASE = 'cca0eb8fbbcc293d515eb99570ade50b8af660f6'


def load(path):
    return json.loads((root / path).read_text(encoding='utf-8'))


def dump(path, obj):
    (root / path).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def touch(obj):
    if isinstance(obj, dict):
        for key, value in list(obj.items()):
            if key in ('checked_at', 'rechecked_at'):
                obj[key] = REF
            elif key == 'next_review_at':
                obj[key] = NEXT
            else:
                touch(value)
    elif isinstance(obj, list):
        for value in obj:
            touch(value)


# Receiver-side and national audits: full recheck timestamp. Factual source_as_of/state is retained.
for path in ['municipal-support-audit.json', 'national-support-audit.json']:
    data = load(path)
    data['reference_at'] = REF
    data['checked_at'] = REF
    data['release_id'] = RELEASE
    touch(data)
    dump(path, data)

manifest = load('sender-municipality-audit.json')
manifest['reference_at'] = REF
manifest['checked_at'] = REF
manifest['rechecked_at'] = REF
manifest['base_main_sha'] = BASE
manifest['release_id'] = RELEASE
entity_files = list(manifest['entity_files'])
for path in entity_files:
    data = load(path)
    data['reference_at'] = REF
    data['checked_at'] = REF
    data['rechecked_at'] = REF
    touch(data)
    dump(path, data)

# Tier-1 sources discovered in the 2026-09-03 nationwide sender re-audit.
source_path = 'sender-audit/sources-additions.json'
sources = load(source_path)
sources['reference_at'] = REF
sources['checked_at'] = REF
sources['rechecked_at'] = REF
touch(sources)
by_id = {item['source_id']: item for item in sources['sources']}
new_sources = [
    {
        'source_id': 'tokushima-housing-wave3-0903',
        'publisher': '徳島県',
        'title': '令和8年熊本地震に係る熊本県への「住家被害認定調査チーム(第3陣)」の派遣について',
        'url': 'https://www.pref.tokushima.lg.jp/anshin/kinkyu/saigai-info/7316123/',
        'tier': 1,
        'source_as_of': '2026-09-03T00:00:00+09:00',
        'checked_at': REF,
        'rechecked_at': REF,
        'note': '県公式が県職員3名、小松島市1名、阿南市1名、石井町1名を9月3日に宇土市へ派遣したと明示。',
    },
    {
        'source_id': 'tokushima-liaison-wave10-0901',
        'publisher': '徳島県',
        'title': '令和8年熊本地震に係る熊本県への「リエゾン（第10陣）」及び「避難所支援チーム（第9陣）」の派遣について',
        'url': 'https://www.pref.tokushima.lg.jp/anshin/kinkyu/saigai-info/7316047/',
        'tier': 1,
        'source_as_of': '2026-09-01T00:00:00+09:00',
        'checked_at': REF,
        'rechecked_at': REF,
        'note': '県公式が阿南市1名・佐那河内村1名を含む計8名を9月1日に被災地へ派遣したと明示。派遣期間は9月1日～7日。',
    },
    {
        'source_id': 'taketa-cert-wave-0903',
        'publisher': '竹田市',
        'title': '令和8年熊本地震の被災地に職員を派遣します（証明発行事務支援）',
        'url': 'https://www.city.taketa.oita.jp/kurashi_tetsuzuki/bosai_kyukyu/reiwa8nenkumamotojishin/13115.html',
        'tier': 1,
        'source_as_of': '2026-09-03T00:00:00+09:00',
        'checked_at': REF,
        'rechecked_at': REF,
        'note': '市公式が八代市への罹災証明発行事務支援を9月3日～9日に2名派遣すると公表。実出発確認ではないためCURRENTへ推定しない。',
    },
]
for item in new_sources:
    by_id[item['source_id']] = item
sources['sources'] = list(by_id.values())
dump(source_path, sources)

# Promote existing Komatsushima adjudication from UNKNOWN to CURRENT on explicit dispatch evidence.
updated = False
for path in entity_files:
    data = load(path)
    rows = data.get('entities', [])
    for entity in rows:
        if entity.get('prefecture') == '徳島県' and entity.get('entity') == '小松島市':
            entity['state'] = 'CURRENT'
            entity['support_types'] = sorted(set(entity.get('support_types', []) + ['住家被害認定調査']))
            entity['destinations'] = sorted(set(entity.get('destinations', []) + ['宇土市']))
            entity['source_ids'] = list(dict.fromkeys(entity.get('source_ids', []) + ['tokushima-housing-wave3-0903']))
            entity['sources_checked'] = list(dict.fromkeys(entity.get('sources_checked', []) + ['tokushima-housing-wave3-0903']))
            entity['evidence_note'] = '徳島県公式が2026年9月3日に小松島市職員1名を含む住家被害認定調査チームを宇土市へ派遣したと明示。'
            entity['current_evidence_type'] = 'actual_dispatch_confirmed'
            entity['source_as_of'] = '2026-09-03T00:00:00+09:00'
            entity['checked_at'] = REF
            entity['rechecked_at'] = REF
            entity['next_review_at'] = NEXT
            entity.pop('reason', None)
            updated = True
    if rows:
        dump(path, data)
if not updated:
    raise SystemExit('existing 小松島市 adjudication not found')

new_path = 'sender-audit/timepoint-20260903-additions.json'
new_entities = [
    {
        'entity': '阿南市', 'prefecture': '徳島県', 'municipality_type': 'city', 'kind': 'basic_municipality_sender',
        'required': False, 'state': 'CURRENT', 'support_types': ['住家被害認定調査', '避難所支援'], 'destinations': ['宇土市'],
        'source_ids': ['tokushima-housing-wave3-0903', 'tokushima-liaison-wave10-0901'],
        'evidence_note': '徳島県公式が9月1日の派遣に続き、9月3日にも阿南市職員1名を含む住家被害認定調査チームを実際に派遣したと明示。',
        'checked_at': REF, 'rechecked_at': REF, 'next_review_at': NEXT, 'current_evidence_type': 'actual_dispatch_confirmed',
        'source_as_of': '2026-09-03T00:00:00+09:00', 'sources_checked': ['tokushima-housing-wave3-0903', 'tokushima-liaison-wave10-0901'],
    },
    {
        'entity': '佐那河内村', 'prefecture': '徳島県', 'municipality_type': 'village', 'kind': 'basic_municipality_sender',
        'required': False, 'state': 'CURRENT', 'support_types': ['避難所支援'], 'destinations': ['宇土市'],
        'source_ids': ['tokushima-liaison-wave10-0901'],
        'evidence_note': '徳島県公式が佐那河内村職員1名を含む避難所支援チームを9月1日に実際に派遣し、派遣期間を9月1日～7日と明示。',
        'checked_at': REF, 'rechecked_at': REF, 'next_review_at': NEXT, 'current_evidence_type': 'actual_dispatch_confirmed',
        'source_as_of': '2026-09-01T00:00:00+09:00', 'sources_checked': ['tokushima-liaison-wave10-0901'],
    },
    {
        'entity': '石井町', 'prefecture': '徳島県', 'municipality_type': 'town', 'kind': 'basic_municipality_sender',
        'required': False, 'state': 'CURRENT', 'support_types': ['住家被害認定調査'], 'destinations': ['宇土市'],
        'source_ids': ['tokushima-housing-wave3-0903'],
        'evidence_note': '徳島県公式が2026年9月3日に石井町職員1名を含む住家被害認定調査チームを宇土市へ派遣したと明示。',
        'checked_at': REF, 'rechecked_at': REF, 'next_review_at': NEXT, 'current_evidence_type': 'actual_dispatch_confirmed',
        'source_as_of': '2026-09-03T00:00:00+09:00', 'sources_checked': ['tokushima-housing-wave3-0903'],
    },
    {
        'entity': '竹田市', 'prefecture': '大分県', 'municipality_type': 'city', 'kind': 'basic_municipality_sender',
        'required': False, 'state': 'PLANNED', 'support_types': ['罹災証明発行事務支援'], 'destinations': ['八代市'],
        'source_ids': ['taketa-cert-wave-0903'],
        'evidence_note': '竹田市公式が9月3日～9日に八代市へ2名を派遣すると公表。基準時点で実出発・実活動を直接確認できないため予定期間開始のみでCURRENTへ昇格しない。',
        'checked_at': REF, 'rechecked_at': REF, 'next_review_at': NEXT,
        'reason': '「派遣します」という予定公表であり、実出発・実活動の直接根拠ではないためPLANNED。',
        'source_as_of': '2026-09-03T00:00:00+09:00', 'sources_checked': ['taketa-cert-wave-0903'],
    },
]
dump(new_path, {'region': 'timepoint-20260903-additions', 'reference_at': REF, 'entities': new_entities, 'checked_at': REF, 'rechecked_at': REF})
if new_path not in manifest['entity_files']:
    manifest['entity_files'].append(new_path)

# Refresh all 47 prefecture discovery timestamps and insert new candidates.
discovery_path = 'sender-audit/discovery.json'
discovery = load(discovery_path)
discovery['reference_at'] = REF
discovery['checked_at'] = REF
discovery['rechecked_at'] = REF
for row in discovery['prefecture_discovery']:
    row['checked_at'] = REF
    row['rechecked_at'] = REF
    row['discovery_state'] = 'CHECKED'
    if row['prefecture'] == '徳島県':
        row['sender_candidates_found'] = sorted(set(row.get('sender_candidates_found', []) + ['小松島市', '阿南市', '佐那河内村', '石井町']))
        row['sources_checked'] = list(dict.fromkeys(row.get('sources_checked', []) + ['tokushima-housing-wave3-0903', 'tokushima-liaison-wave10-0901']))
    if row['prefecture'] == '大分県':
        row['sender_candidates_found'] = sorted(set(row.get('sender_candidates_found', []) + ['竹田市']))
        row['sources_checked'] = list(dict.fromkeys(row.get('sources_checked', []) + ['taketa-cert-wave-0903']))
dump(discovery_path, discovery)

additions_path = 'sender-audit/discovery-additions.json'
discovery_additions = load(additions_path)
discovery_additions['reference_at'] = REF
discovery_additions['checked_at'] = REF
discovery_additions['rechecked_at'] = REF
existing = {(row[0], row[1]) for row in discovery_additions.get('source_mentions', []) if isinstance(row, list) and len(row) >= 2}
for row in [
    ('徳島県', '阿南市', 'tokushima-housing-wave3-0903'),
    ('徳島県', '佐那河内村', 'tokushima-liaison-wave10-0901'),
    ('徳島県', '石井町', 'tokushima-housing-wave3-0903'),
    ('大分県', '竹田市', 'taketa-cert-wave-0903'),
]:
    if row[:2] not in existing:
        discovery_additions.setdefault('source_mentions', []).append(list(row))
        existing.add(row[:2])
dump(additions_path, discovery_additions)

# Recompute sender summary from canonical entity files.
rows = []
for path in manifest['entity_files']:
    data = load(path)
    if isinstance(data.get('entities'), list):
        rows += data['entities']
    elif isinstance(data.get('compact_entities'), list):
        for row in data['compact_entities']:
            rows.append({'prefecture': row[0], 'entity': row[1], 'state': row[6], 'required': False})
states = {key: 0 for key in ['CURRENT', 'PLANNED', 'HISTORICAL', 'UNKNOWN', 'NO_EVIDENCE', 'CONFLICT']}
for entity in rows:
    states[entity['state']] = states.get(entity['state'], 0) + 1
ehime = [entity for entity in rows if entity.get('prefecture') == '愛媛県' and entity.get('required') is True]
ehime_states = {key: 0 for key in states}
for entity in ehime:
    ehime_states[entity['state']] = ehime_states.get(entity['state'], 0) + 1
manifest['summary']['ehime'].update({
    'required_count': 20, 'adjudicated_count': 20, 'missing_required': [], 'unadjudicated_source_mentions': [],
    'blocking_unresolved': 0, 'states': ehime_states, 'blocking_conflicts': 0,
})
mention_count = len(manifest.get('source_mentions', [])) + len(discovery_additions.get('source_mentions', []))
manifest['summary']['nationwide'].update({
    'prefecture_discovery_checked': 47,
    'discovered_basic_municipality_senders': len(rows),
    'adjudicated_basic_municipality_senders': len(rows),
    'unadjudicated_discovered_senders': [],
    'source_mentions': mention_count,
    'orphan_source_mentions': [],
    'invalid_current': [],
    'blocking_conflicts': 0,
    'states': states,
})
manifest['blocking_unresolved'] = []
manifest['timepoint_note'] = '2026年9月3日14:57基準。愛媛20市町と全国47都道府県discoveryを再監査。徳島県9月3日一次情報で小松島市・阿南市・石井町の実派遣をCURRENT、9月1日実派遣が継続期間内の佐那河内村をCURRENT追加。竹田市は「派遣します」の予定公表のみのためPLANNED。予定期間到来だけではCURRENTにしない。'
dump('sender-municipality-audit.json', manifest)

# Generated review timestamp must be future relative to this refresh.
lib_path = root / 'scripts/sender-coverage-lib.mjs'
text = lib_path.read_text(encoding='utf-8')
text = text.replace('const NEXT_REVIEW_AT = "2026-09-03T09:00:00+09:00";', 'const NEXT_REVIEW_AT = "2026-09-04T09:00:00+09:00";')
lib_path.write_text(text, encoding='utf-8')

# Canonical page metadata. Volunteer is an independently verified 9/2 sub-snapshot.
html_path = root / 'ehime_kumamoto_support_geocoded_shelters_20260802.html'
html = html_path.read_text(encoding='utf-8')
match = re.search(r'const PAGE_RECHECK_META=(\{[^\n]*\});', html)
if not match:
    raise SystemExit('PAGE_RECHECK_META not found')
meta = json.loads(match.group(1))
meta['checkedAt'] = REF
for row in meta.get('rows', []):
    section = row.get('section')
    if section == '被害・支援':
        row.update(status='再確認', current='9月3日14:57再確認：熊本県最新県報は9月2日14時の第51報', previous='9月2日14時の第51報', difference='9月3日再確認で県報は第51報が最新。避難者2,035人、避難所38か所、人的被害404人、住家被害61,996棟を維持。現在避難所は公式ライブJSONを別定義で更新。')
    elif section == '愛媛県支援':
        row.update(status='差分あり', current='9月3日再確認：県総括の最新掲載は9月1日12時版', previous='8月28日12時資料', difference='愛媛県公式ページで9月1日12時版の県総括掲載を確認。個別senderは9月3日基準で別監査。')
    elif section == '避難所':
        row.update(status='再確認', current='熊本県第51報：38か所・避難者2,035人／公式JSON現在40施設／位置履歴206点', previous='熊本県第51報38か所／公式JSON 9月2日取得40施設', difference='県報は第51報を維持。公式ライブJSONは9月3日14:51更新で現在40施設、座標40/40 confirmed。県報38か所とは時点・定義を分離。')
    elif section == '支援ニーズ見通し':
        row.update(status='再確認', current='県全体最新は熊本県第51報を維持。市町別内訳は旧スナップショットとして分離', difference='9月3日再確認でも県全体の最新県報は第51報。市町別旧内訳を最新県計へ機械的に再配分しない。')
    elif section == '発災後タイムライン':
        row.update(status='差分あり', current='9月3日の徳島県・竹田市sender情報を追加。熊本県被害県報は第51報を維持', difference='9月3日実派遣・派遣予定のsender情報を追加し、CURRENT/PLANNEDを直接根拠に沿って区別。')
    elif section == '支援ダッシュボード':
        row.update(status='差分あり', current='熊本県第51報を維持／他自治体支援・全国senderは9月3日14:57全件再監査', difference='被害・避難は第51報を維持。全国senderは徳島県・竹田市の新規一次情報を反映し、予定のみはCURRENTにしない。')
    elif section == '災害ボランティア':
        row.update(status='再確認', current='9月3日サイト全体再確認。ボランティア個別監査は9月2日確認値を維持', difference='ボランティア実績・募集条件は独立スナップショットとして9月2日確認値を維持し、未確認の9月3日値を推測で補完しない。')
    elif section == '地図・境界':
        row.update(status='再確認', current='公式JSON現在40施設・40/40公式座標 confirmed', difference='9月3日14:51更新のライブ避難所JSONを再取得。件数40は不変、conflict 0・unresolved 0。')
    elif section == '他自治体等':
        row.update(status='差分あり', current='9月3日14:57に対口支援・他自治体支援を全件再監査', difference='既存割当履歴と現況を分離したまま、全国sender新規一次情報を追加し全件再裁定。')
html = html[:match.start(1)] + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + html[match.end(1):]
html = re.sub(r'volunteer-data\.js\?v=[A-Za-z0-9._-]+', f'volunteer-data.js?v={RELEASE}', html)
html_path.write_text(html, encoding='utf-8')

# Keep release-id-pinning validators synchronized.
for path in [root / 'scripts/validate-current-state-audit.mjs', root / 'scripts/validate-built-site.mjs']:
    text = path.read_text(encoding='utf-8')
    text = re.sub(r'volunteer-data\.js\?v=[A-Za-z0-9._-]+', f'volunteer-data.js?v={RELEASE}', text)
    path.write_text(text, encoding='utf-8')

# Pre-merge ledger. expected_changed_files is populated after generators/build run.
shelter = load('current-shelters.json')
ledger = {
    'schema_version': 2,
    'repository': 'ryotamatsuki/kumamotoshienmap',
    'update_type': 'timepoint_refresh',
    'gate_phase': 'pre_merge',
    'update_id': 'refresh-20260903-1457',
    'release_id': RELEASE,
    'reference_at': REF,
    'rechecked_at': REF,
    'page_checked_at': None,
    'base_main_sha': BASE,
    'expected_changed_files': [],
    'sources': [
        {'source_id': 'kumamoto-damage51-0902', 'publisher': '熊本県', 'url': 'https://www.pref.kumamoto.jp/soshiki/222/276831.html', 'source_as_of': '2026-09-02T14:00:00+09:00', 'checked_at': REF},
        {'source_id': 'kumamoto-current-shelters-0903', 'publisher': '熊本県 防災情報ポータル', 'url': 'https://portal.bousai.pref.kumamoto.jp/data/shelter/shelter.json', 'source_as_of': shelter['meta']['source_last_modified'], 'checked_at': REF},
        {'source_id': 'kumamoto-volunteer-activity-0902', 'publisher': '熊本県社会福祉協議会', 'url': 'https://www.fukushi-kumamoto.or.jp/files/libs/8662/202609021133091423.pdf', 'source_as_of': '2026-09-02', 'checked_at': '2026-09-02T16:35:00+09:00'},
        {'source_id': 'ehime-support-0901', 'publisher': '愛媛県', 'url': 'https://www.pref.ehime.jp/page/154856.html', 'source_as_of': '2026-09-01T12:00:00+09:00', 'checked_at': REF},
        {'source_id': 'mlit-report51-0831', 'publisher': '国土交通省', 'url': 'https://www.mlit.go.jp/saigai/saigai_260728.html', 'source_as_of': '2026-08-31T17:00:00+09:00', 'checked_at': REF},
        {'source_id': 'mod-hakuo2-0901-reservation', 'publisher': '防衛省・自衛隊', 'url': 'https://www.mod.go.jp/j/approach/defense/saigai/index.html', 'source_as_of': '2026-09-01T09:00:00+09:00', 'checked_at': REF},
        {'source_id': 'tokushima-housing-wave3-0903', 'publisher': '徳島県', 'url': 'https://www.pref.tokushima.lg.jp/anshin/kinkyu/saigai-info/7316123/', 'source_as_of': '2026-09-03', 'checked_at': REF},
        {'source_id': 'tokushima-liaison-wave10-0901', 'publisher': '徳島県', 'url': 'https://www.pref.tokushima.lg.jp/anshin/kinkyu/saigai-info/7316047/', 'source_as_of': '2026-09-01', 'checked_at': REF},
        {'source_id': 'taketa-cert-wave-0903', 'publisher': '竹田市', 'url': 'https://www.city.taketa.oita.jp/kurashi_tetsuzuki/bosai_kyukyu/reiwa8nenkumamotojishin/13115.html', 'source_as_of': '2026-09-03', 'checked_at': REF},
    ],
    'coverage': {
        'recipient_municipalities': 45,
        'institution_missing': 0,
        'institution_orphan_source_mentions': 0,
        'current_shelters': len(shelter['shelters']),
        'current_shelter_coordinates_confirmed': sum(1 for item in shelter['shelters'] if item.get('coordinate_status') == 'confirmed'),
        'current_shelter_unresolved': sum(1 for item in shelter['shelters'] if item.get('coordinate_status') == 'unresolved'),
        'ehime_required': 20,
        'ehime_adjudicated': 20,
        'ehime_missing': 0,
        'prefecture_discovery_checked': 47,
        'sender_entities_discovered': len(rows),
        'sender_entities_adjudicated': len(rows),
        'sender_orphan_source_mentions': 0,
        'sender_blocking_conflicts': 0,
        'sender_states': states,
        'municipal_support': 'audited',
        'national_support': 'audited',
        'current_count': len(shelter['shelters']),
        'unresolved_count': 0,
        'conflict_count': 0,
    },
    'snapshots': {
        'page_reference_at': REF,
        'damage_source_as_of': '2026-09-02T14:00:00+09:00',
        'damage_report': 51,
        'current_shelters': len(shelter['shelters']),
        'shelter_source_last_modified': shelter['meta']['source_last_modified'],
        'sender_reference_at': REF,
        'volunteer_activity_0902': {'participants': 108, 'new_requests': 60, 'activities': 24, 'completed': 24},
    },
    'blocking_unresolved': [],
    'accepted_unresolved': [
        {'issue_id': 'national-same-definition-continuity', 'state': 'UNKNOWN', 'reason': '国・関係機関の一部は9月3日14:57基準の同一定義実働を直接確認できず、過去値をCURRENTへ流用しない。', 'owner': 'timepoint-audit', 'source_ids': ['mlit-report51-0831'], 'next_review_at': NEXT},
        {'issue_id': 'hakuo2-actual-operation', 'state': 'PLANNED', 'reason': '9月3日13時の宿泊受付予定は確認できるが、予定時刻経過だけでは実運用開始をCURRENTと推定しない。', 'owner': 'national-support-audit', 'source_ids': ['mod-hakuo2-0901-reservation'], 'next_review_at': NEXT},
        {'issue_id': 'taketa-direct-activity', 'state': 'PLANNED', 'reason': '竹田市は派遣期間を9月3日開始と公表したが、表現は「派遣します」で実出発を直接確認できないためPLANNED。', 'owner': 'sender-audit', 'source_ids': ['taketa-cert-wave-0903'], 'next_review_at': NEXT},
    ],
}
dump('operations/ledgers/refresh-20260903-1457.json', ledger)

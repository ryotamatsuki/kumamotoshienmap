import pathlib
import subprocess
import textwrap

root = pathlib.Path('.')

# Reapply the last valid audited refresh preparation (report 56, current shelters,
# volunteer data, national/municipal audits, KPI sync, validators and Hakuo II overview).
raw = subprocess.check_output([
    'git', 'show',
    '46d9266576b8b78c31c7581c3ee5d7aa5b5761f4:.github/workflows/finalize-core-refresh-20260915.yml'
], text=True)
start = raw.index("          python3 - <<'PY'\n") + len("          python3 - <<'PY'\n")
end = raw.index("\n          PY\n", start)
body = textwrap.dedent(raw[start:end])
exec(compile(body, 'recovered-hakuo-finalize.py', 'exec'), {'__name__': '__main__'})

# The older cleanup overlay is intentionally retained for history but it was
# overwriting the latest Ehime RECORDS. Insert one final audited overlay before
# MUNICIPAL_SUPPORT_AUDIT_END so the detailed runtime records agree with the
# 2026-09-11 official Ehime source and the overview card.
p = root / 'scripts/sync-current-release.mjs'
s = p.read_text(encoding='utf-8')
write_anchor = "await writeFile(SOURCE,html,'utf8');"
if write_anchor not in s:
    raise SystemExit('sync-current-release write anchor missing')

ehime_overlay = (
    "const ehimeFinal20260915='/* EHIME_CURRENT_20260915_START */\\n"
    "{const U={\"ehime-management\":{status:\"現行派遣（9月11日12時資料）\",scale:\"109人／延534人日\",period:\"9月11日12時資料で継続確認\",detail:\"対口支援109人、延534人日。氷川町への災害応急対策職員等の支援を最新資料で確認。\",asOf:\"愛媛県 9月11日12時\"},"
    "\"ehime-health\":{status:\"派遣継続予定を含む（9月11日12時資料）\",scale:\"33人（延178人日）\",asOf:\"愛媛県 9月11日12時\"},"
    "\"ehime-dwat\":{status:\"派遣継続予定を含む（9月11日12時資料）\",scale:\"34人（延96人日）\",asOf:\"愛媛県 9月11日12時\"}};"
    "for(const [id,v] of Object.entries(U)){const r=RECORDS.find(q=>q.id===id);if(r)Object.assign(r,v,{sourceLabel:\"愛媛県 本県の支援状況（2026年9月11日12時）\",sourceUrl:\"https://www.pref.ehime.jp/page/154856.html\"});}}\\n"
    "/* EHIME_CURRENT_20260915_END */';"
    "const mend3=html.indexOf('/* MUNICIPAL_SUPPORT_AUDIT_END */');"
    "if(mend3<0)throw new Error('municipal audit end missing for final Ehime overlay');"
    "html=html.slice(0,mend3)+'\\n'+ehimeFinal20260915+'\\n'+html.slice(mend3);\n"
)
s = s.replace(write_anchor, ehime_overlay + write_anchor, 1)
p.write_text(s, encoding='utf-8')

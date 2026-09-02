from pathlib import Path

path = Path('volunteer.css')
text = path.read_text(encoding='utf-8')
marker = '/* STAGE2_CASCADE_BRIDGE_START */'
if marker in text:
    print('Stage 2 cascade bridge already applied')
    raise SystemExit(0)

css = r'''

/* STAGE2_CASCADE_BRIDGE_START */
/* Narrow bridge over VF1's prior !important locks. Do not expand beyond properties
   required to realize Stage 2 navigation/hero/card-reduction objectives. */
body header .view-switch{
  border-color:transparent!important;
  border-radius:0!important;
  background:transparent!important;
}
body header .view-tab{
  border-radius:0!important;
  color:#686d72!important;
  background:transparent!important;
  box-shadow:none!important;
}
body header .view-tab.active{
  color:var(--ink)!important;
  background:transparent!important;
  box-shadow:none!important;
}
body .overview-title h2,
body .dashboard-title h2,
body .timeline-title h2,
body .vol-title h2{
  font-size:clamp(26px,3vw,36px)!important;
  font-weight:620!important;
  letter-spacing:-.035em!important;
}
body .overview-title p,
body .dashboard-title p,
body .timeline-title p,
body .vol-title p{
  font-size:13px!important;
  line-height:1.75!important;
}
body .overview-update,
body .dashboard-update,
body .timeline-update,
body .vol-meta{
  font-size:11px!important;
  line-height:1.7!important;
}
body .overview-kpi-value,
body .dashboard-metric-value,
body .timeline-metric-value,
body .vol-summary-value{
  font-weight:680!important;
  letter-spacing:-.035em!important;
}
body .overview-section-tag,
body .dashboard-section-tag,
body .decision-day,
body .vol-section-tag{
  font-weight:600!important;
}
@media(max-width:950px){
  body .overview-title h2,
  body .dashboard-title h2,
  body .timeline-title h2,
  body .vol-title h2{font-size:28px!important}
}
@media(max-width:520px){
  body .overview-title h2,
  body .dashboard-title h2,
  body .timeline-title h2,
  body .vol-title h2{font-size:25px!important}
}
/* STAGE2_CASCADE_BRIDGE_END */
'''
path.write_text(text.rstrip() + css + '\n', encoding='utf-8')
print('Stage 2 cascade bridge appended')

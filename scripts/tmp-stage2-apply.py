from pathlib import Path

path = Path('volunteer.css')
text = path.read_text(encoding='utf-8')
marker = '/* STAGE2_MAJOR_SCREEN_RESTRUCTURE_START */'
if marker in text:
    print('Stage 2 CSS already applied')
    raise SystemExit(0)

css = r'''

/* STAGE2_MAJOR_SCREEN_RESTRUCTURE_START */
/* Major screen restructure: editorial hierarchy, metric strips, document navigation,
   and divider-first sections. Data, audit semantics and interaction logic are unchanged. */

/* Operational masthead */
body header{
  display:grid;
  grid-template-columns:minmax(250px,1fr) auto auto;
  align-items:center;
  gap:22px;
  padding:8px 18px 7px;
  background:#fff;
  border-bottom:1px solid var(--line);
}
body header h1{font-size:18px;font-weight:650;letter-spacing:-.02em}
body header .subtitle{margin-top:3px;font-size:11px;line-height:1.35;color:var(--muted)}
body header .view-switch{
  display:flex;
  align-self:stretch;
  align-items:flex-end;
  gap:20px;
  padding:0;
  border:0;
  border-radius:0;
  background:transparent;
  overflow-x:auto;
  scrollbar-width:none;
}
body header .view-switch::-webkit-scrollbar{display:none}
body header .view-tab{
  position:relative;
  min-height:42px;
  padding:12px 0 9px;
  border:0;
  border-radius:0;
  background:transparent;
  color:#686d72;
  font-size:11px;
  font-weight:600;
  white-space:nowrap;
  box-shadow:none;
}
body header .view-tab::after{
  content:"";
  position:absolute;
  left:0;
  right:0;
  bottom:-7px;
  height:2px;
  background:transparent;
}
body header .view-tab:hover{background:transparent;color:var(--ink)}
body header .view-tab.active{background:transparent;color:var(--ink);box-shadow:none}
body header .view-tab.active::after{background:var(--ink)}
body header .head-actions{gap:6px}
body header .badge{padding:5px 7px;border:0;background:transparent;color:#247052;font-size:10px;font-weight:600}
body header .badge:before{width:6px;height:6px}
body header .btn{min-height:34px;padding:6px 9px;font-size:11px}

/* Shared page canvas / hero rhythm */
body .overview-view,
body .dashboard-view,
body .timeline-view,
body .volunteer-view{background:#fff}
body .overview-shell,
body .dashboard-shell,
body .timeline-shell,
body .vol-shell{max-width:1360px;margin:0 auto;padding:26px 28px 58px}
body .overview-hero,
body .dashboard-hero,
body .timeline-hero,
body .vol-hero{
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(220px,300px);
  gap:42px;
  align-items:end;
  margin:0;
  padding:18px 0 26px;
  border:0;
  border-bottom:1px solid var(--line);
  border-radius:0;
  background:transparent;
  box-shadow:none;
}
body .overview-title h2,
body .dashboard-title h2,
body .timeline-title h2,
body .vol-title h2{
  margin:0;
  font-size:clamp(26px,3vw,36px);
  font-weight:620;
  letter-spacing:-.035em;
  line-height:1.12;
}
body .overview-title p,
body .dashboard-title p,
body .timeline-title p,
body .vol-title p{max-width:820px;margin-top:10px;font-size:13px;line-height:1.75;color:#555b61}
body .overview-update,
body .dashboard-update,
body .timeline-update,
body .vol-meta{
  min-width:0;
  padding:0 0 1px 18px;
  border:0;
  border-left:1px solid var(--line);
  border-radius:0;
  background:transparent;
  color:var(--muted);
  font-size:11px;
  line-height:1.7;
}
body .overview-update strong,
body .dashboard-update strong,
body .timeline-update strong,
body .vol-meta strong{color:var(--ink);font-weight:650}
body .overview-phase{
  display:block;
  margin-top:18px;
  padding:12px 0 0;
  border:0;
  border-top:1px solid var(--line);
  border-radius:0;
  background:transparent;
  color:#42535d;
  font-size:12px;
  font-weight:500;
  line-height:1.65;
}
body .overview-phase span{font-weight:650;color:var(--ink)}

/* KPI / metric strips */
body .overview-kpis,
body .dashboard-metrics,
body .timeline-metrics,
body .vol-summary{
  display:grid;
  gap:0;
  margin:0;
  border-bottom:1px solid var(--line);
}
body .overview-kpis,
body .dashboard-metrics,
body .timeline-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}
body .vol-summary{grid-template-columns:repeat(5,minmax(0,1fr))}
body .overview-kpi,
body .dashboard-metric,
body .timeline-metric,
body .vol-summary-card{
  min-width:0;
  padding:18px 16px 17px;
  border:0;
  border-right:1px solid var(--line);
  border-radius:0!important;
  background:transparent;
  box-shadow:none!important;
}
body .overview-kpi:last-child,
body .dashboard-metric:last-child,
body .timeline-metric:last-child,
body .vol-summary-card:last-child{border-right:0}
body .overview-kpi:hover,
body .overview-kpi:focus-visible,
body .vol-summary-action:hover{background:var(--soft);border-color:var(--line);transform:none}
body .overview-kpi-label,
body .dashboard-metric-label,
body .timeline-metric-label,
body .vol-summary-label{min-height:0;color:var(--muted);font-size:11px;font-weight:600;line-height:1.35}
body .overview-kpi-value,
body .dashboard-metric-value,
body .timeline-metric-value,
body .vol-summary-value{margin-top:7px;font-size:29px;font-weight:680;letter-spacing:-.035em;line-height:1}
body .overview-kpi-note,
body .dashboard-metric-note,
body .timeline-metric-note{margin-top:7px;font-size:10px;line-height:1.45;color:var(--muted)}

/* Divider-first section system */
body .overview-maincol,
body .dashboard-maincol{gap:0}
body .overview-section,
body .dashboard-section,
body .vol-section{
  margin:0;
  padding:26px 0 28px;
  border:0;
  border-top:1px solid var(--line);
  border-radius:0!important;
  background:transparent;
  box-shadow:none!important;
}
body .overview-maincol > .overview-section:first-child,
body .dashboard-maincol > .dashboard-section:first-child{border-top:0}
body .overview-section-head,
body .dashboard-section-head,
body .vol-section-head{margin:0 0 16px;align-items:flex-end}
body .overview-section-head h3,
body .dashboard-section-head h3,
body .decision-board-head h3,
body .vol-section-head h3{font-size:17px;font-weight:620;letter-spacing:-.015em}
body .overview-section-head p,
body .dashboard-section-head p,
body .decision-board-head p,
body .vol-section-head p{margin-top:4px;font-size:11px;line-height:1.55;color:var(--muted)}
body .overview-section-tag,
body .dashboard-section-tag,
body .decision-day,
body .vol-section-tag{
  padding:0;
  border:0;
  border-radius:0;
  background:transparent;
  color:var(--muted);
  font-size:10px;
  font-weight:600;
}

/* Page recheck becomes research metadata rather than a card */
body .page-recheck-section{border-left:0;border-top:0;padding-top:24px}
body .page-recheck-meta{gap:14px;margin:0 0 14px;padding:9px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
body .page-recheck-meta span{padding:0;border:0;border-radius:0;background:transparent;color:var(--muted);font-size:10px;font-weight:600}
body .page-recheck-grid{gap:0}
body .page-recheck-card{
  padding:13px 14px 14px 0;
  border:0;
  border-top:1px solid var(--line);
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
}
body .page-recheck-card + .page-recheck-card{padding-left:14px}
body .page-recheck-card.changed{border-top-color:#b78624}
body .page-recheck-card.review{border-top-color:var(--impact)}
body .page-recheck-status{padding:0;background:transparent!important;border-radius:0;color:var(--muted);font-weight:600}

/* Decision board remains actionable but loses card-on-card chrome */
body .decision-board{
  margin:0;
  padding:26px 0 28px;
  border:0;
  border-top:1px solid var(--line);
  border-radius:0!important;
  background:transparent;
  box-shadow:none!important;
}
body .decision-grid{gap:0}
body .decision-card{
  padding:14px 16px 14px 0;
  border:0;
  border-top:2px solid #8a969d;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
}
body .decision-card + .decision-card{padding-left:16px}
body .decision-card.urgent{border-top-color:var(--impact)}
body .decision-card.high{border-top-color:#b36b00}
body .decision-card.info{border-top-color:var(--national)}
body .decision-card:is(button):hover{background:var(--soft)!important;transform:none}
body .decision-status b{padding:0;border-radius:0;background:transparent!important}
body .decision-title{font-weight:650}
body .decision-next{font-weight:600}

/* Actor summaries are editorial rows */
body .overview-actor-grid{display:block}
body .overview-actor{
  display:grid;
  grid-template-columns:170px minmax(0,1fr) 140px;
  gap:20px;
  align-items:start;
  width:100%;
  padding:17px 0;
  border:0;
  border-top:1px solid var(--line);
  border-radius:0;
  background:transparent;
  text-align:left;
}
body .overview-actor:last-child{border-bottom:1px solid var(--line)}
body .overview-actor:hover{background:transparent;border-color:var(--line)}
body .overview-actor-head{font-size:13px;font-weight:650}
body .overview-actor ul{margin:0;padding-left:18px;font-size:11px;line-height:1.65;color:#4f555a}
body .overview-more{margin:1px 0 0;text-align:right;font-size:10px;font-weight:600;color:#185b8e}

/* Secondary overview grids become lightweight editorial matrices */
body .overview-resource-grid,
body .overview-role-grid,
body .overview-region-grid,
body .block-grid{gap:0}
body .overview-resource,
body .overview-role,
body .overview-region,
body .block-card{
  padding:14px 12px;
  border:0;
  border-top:1px solid var(--line);
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
}
body .overview-resource:hover,
body .overview-role:hover,
body .overview-region:hover,
body .block-card:hover{background:var(--soft)!important;transform:none;border-color:var(--line)}
body .overview-resource-label,
body .overview-role-label{font-size:10px;font-weight:600;color:var(--muted)}
body .overview-resource-value{font-weight:650}
body .overview-role-value{font-weight:650}
body .block-stat{border-radius:0;background:transparent;padding:4px 0}
body .block-card-ehime{border-radius:0;background:transparent;padding-left:8px}

/* Main support dashboard: strip KPIs, functional filter, divider sections */
body .dashboard-filterbar{
  margin:0;
  padding:15px 0;
  border:0!important;
  border-bottom:1px solid var(--line)!important;
  border-radius:0!important;
  background:#fff!important;
  box-shadow:none!important;
}
body .dashboard-provider-grid{gap:0;margin:0;border-bottom:1px solid var(--line)}
body .dashboard-provider{
  padding:15px 14px;
  border:0;
  border-right:1px solid var(--line);
  border-radius:0;
  background:transparent;
}
body .dashboard-provider:last-child{border-right:0}
body .dashboard-provider:hover,
body .dashboard-provider.selected{background:var(--soft);border-color:var(--line)}
body .dashboard-provider-name{font-weight:650}
body .dashboard-provider-count{font-weight:680}
body .dashboard-provider-bar{height:3px;border-radius:0}
body .dashboard-detail{
  border-color:var(--line);
  border-radius:6px!important;
  background:#fff;
  box-shadow:none!important;
}

/* Timeline: document chronology rather than stacked event cards */
body .timeline-view{padding:0}
body .timeline-origin{padding:0;border-radius:0;background:transparent;font-weight:600}
body .timeline-filterbar{
  margin:0;
  padding:15px 0;
  border:0!important;
  border-bottom:1px solid var(--line)!important;
  border-radius:0!important;
  background:#fff!important;
  box-shadow:none!important;
  backdrop-filter:none!important;
}
body .timeline-layout{gap:22px;margin-top:0}
body .timeline-stream{
  padding:10px 0 28px;
  border:0;
  border-radius:0!important;
  background:transparent;
  box-shadow:none!important;
}
body .timeline-event{
  margin:0;
  padding:12px 0 13px;
  border:0;
  border-bottom:1px solid var(--line);
  border-radius:0!important;
  background:transparent;
  box-shadow:none!important;
}
body .timeline-event:hover{background:var(--soft);transform:none;box-shadow:none}
body .timeline-event.selected{background:#f7f9fa;box-shadow:none!important}
body .timeline-day-label{border-radius:0;background:transparent;border-top:1px solid var(--line);font-weight:650}
body .timeline-detail{border-radius:6px!important;box-shadow:none!important}
body .timeline-event-title{font-weight:650}

/* Volunteer: retain complex controls, remove routine outer cards */
body .vol-caution{margin:0;padding:14px 0;border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent}
body .vol-section{margin-bottom:0}
body .vol-common-grid{gap:0}
body .vol-common-card{padding:14px 12px;border:0;border-top:1px solid var(--line);border-radius:0!important;background:transparent;box-shadow:none!important}
body .vol-filter-set{border-radius:6px!important;background:#fafafa}
body .vol-summary-detail{border-radius:6px!important}
body .vol-summary-action.selected{background:var(--soft)}

/* Mobile composition */
@media(max-width:950px){
  body header{
    grid-template-columns:minmax(0,1fr) auto;
    grid-template-areas:"identity actions" "nav nav";
    gap:5px 14px;
    padding:8px 10px 0;
  }
  body header>div:first-child{grid-area:identity}
  body header .head-actions{grid-area:actions;align-self:start}
  body header .view-switch{grid-area:nav;width:100%;order:initial;gap:18px;align-items:flex-end}
  body header .view-tab{min-height:39px;padding:9px 0 8px}
  body header .view-tab::after{bottom:0}
  body header h1{font-size:16px}
  body header .subtitle{max-width:72vw;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  body .overview-shell,
  body .dashboard-shell,
  body .timeline-shell,
  body .vol-shell{padding:18px 14px 42px}
  body .overview-hero,
  body .dashboard-hero,
  body .timeline-hero,
  body .vol-hero{grid-template-columns:1fr;gap:20px;padding:14px 0 22px}
  body .overview-update,
  body .dashboard-update,
  body .timeline-update,
  body .vol-meta{padding:14px 0 0;border-left:0;border-top:1px solid var(--line)}
  body .overview-kpis,
  body .dashboard-metrics,
  body .timeline-metrics{grid-template-columns:repeat(2,minmax(0,1fr));min-width:0}
  body .vol-summary{grid-template-columns:repeat(2,minmax(0,1fr))}
  body .overview-kpi:nth-child(2n),
  body .dashboard-metric:nth-child(2n),
  body .timeline-metric:nth-child(2n),
  body .vol-summary-card:nth-child(2n){border-right:0}
  body .overview-kpi:nth-child(-n+2),
  body .dashboard-metric:nth-child(-n+2),
  body .timeline-metric:nth-child(-n+2){border-bottom:1px solid var(--line)}
  body .vol-summary-card{border-bottom:1px solid var(--line)}
  body .vol-summary-card:last-child{grid-column:1/-1;border-bottom:0}
  body .overview-layout,
  body .dashboard-layout{gap:20px}
  body .overview-actor{grid-template-columns:1fr;gap:9px;padding:16px 0}
  body .overview-more{text-align:left;margin-top:1px}
  body .page-recheck-grid{grid-template-columns:1fr}
  body .page-recheck-card + .page-recheck-card{padding-left:0}
  body .decision-grid{grid-template-columns:1fr}
  body .decision-card + .decision-card{padding-left:0}
  body .overview-resource-grid,
  body .overview-role-grid,
  body .overview-region-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  body .timeline-layout{grid-template-columns:1fr;gap:18px}
}

@media(max-width:520px){
  body .overview-title h2,
  body .dashboard-title h2,
  body .timeline-title h2,
  body .vol-title h2{font-size:25px}
  body .overview-resource-grid,
  body .overview-role-grid,
  body .overview-region-grid{grid-template-columns:1fr}
  body .overview-kpi,
  body .dashboard-metric,
  body .timeline-metric,
  body .vol-summary-card{padding:15px 10px}
  body .overview-kpi-value,
  body .dashboard-metric-value,
  body .timeline-metric-value,
  body .vol-summary-value{font-size:25px}
}
/* STAGE2_MAJOR_SCREEN_RESTRUCTURE_END */
'''

path.write_text(text.rstrip() + css + '\n', encoding='utf-8')
print('Stage 2 CSS appended')

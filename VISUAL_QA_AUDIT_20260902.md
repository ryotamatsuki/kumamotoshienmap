# Final Visual QA / Pixel-level Consistency Audit

- Baseline main: `d7b1e07711cd71b4ce37cff9a5f91bf641e9625f`
- Public target: `https://ryotamatsuki.github.io/kumamotoshienmap/`
- Audit date: 2026-09-02
- Viewports: Desktop `1440×1000`, Mobile `390×844`
- Scope: landing / overview / needs / timeline / dashboard / volunteer / map / sender
- Method: public GitHub Pages browser render + computed CSS / bounding-box audit + full-page screenshot review
- Main was not changed by this audit.

## Overall verdict

`PASS WITH LOCAL VISUAL CLEANUP`

No horizontal page overflow was detected in any audited page/view. Section heading anchors in the Stage 2/3 main views were aligned with zero measured x-spread. Landing, Overview, Timeline, Dashboard and Sender have substantially converged on the intended editorial / research-dashboard visual system.

The remaining legacy visual debt is concentrated in **Needs**, then **Volunteer**, with smaller cleanup items in **Dashboard**, **Map**, **Overview**, and **Timeline**.

## Priority findings

### V1 — HIGH — Needs still reads as the pre-redesign UI

This is the clearest remaining visual inconsistency.

Measured / observed:
- Needs page H2: `22px` desktop / `19px` mobile, versus `36px` desktop / `25px` mobile in the main redesigned views.
- Needs H3: `15px`, versus mostly `17px` in Overview / Dashboard.
- Very dense microtext remains: the rendered leaf-text histogram contains `558` visible `8px` text nodes plus `33` at `9px` on desktop; mobile is essentially the same.
- KPI labels/notes remain `9px`.
- Severity / municipality tags include many `8px` labels.
- Primary phase buttons render around `27px` high; search/filter controls around `29–31px`; municipality chip buttons can be about `11px` high.
- Legacy surfaces remain: `needs-intro` / `needs-caution` around `15px` radius, `needs-kpi` around `11px` radius, and multiple `0 6–7px 20–22px` card shadows.
- Screenshot review confirms the page still looks like a card-heavy operational SaaS panel while adjacent views are editorial / divider-first.

Recommended cleanup:
- raise H2/H3 hierarchy to the shared shell scale;
- make normal explanatory/status text at least `11–12px`;
- reserve `9–10px` only for truly exceptional metadata;
- make interactive phase/filter/municipality controls conform to desktop `40–42px` / mobile `44px` target height;
- remove non-floating shadows;
- reduce radii to the shared `6–10px` system;
- flatten the major Needs sections from card islands toward whitespace + hairline separation.

### V2 — HIGH — Volunteer still has undersized interactive affordances

The Stage 3 surface cleanup helped, but interaction density remains visibly legacy in the detail layer.

Measured / observed:
- `vol-summary-open` text is `9px`.
- `vol-summary-jump` controls render about `25px` high.
- municipality buttons render about `30px` high.
- the summary help control renders about `21px` high.
- on mobile, many visible select/input controls are around `42px`, slightly below the intended `44px` touch target.
- the full mobile Volunteer page is about `48,050px` high, roughly `57` viewport-heights. This is primarily an information-architecture/content-volume issue rather than a CSS defect, but it amplifies the perception of visual density.

Recommended cleanup:
- normalize link/button text to `11–12px` minimum;
- increase actionable row/button hit areas to the shared target;
- keep the current divider-first structure, but reduce the number of tiny secondary controls competing with the primary status text;
- do not solve the 57-screen page length in this visual-only pass unless content collapsing / virtualization is explicitly approved.

### V3 — MEDIUM — Dashboard still contains a microtext island

The overall Dashboard composition is good, but its matrix / category detail layer remains denser than the rest of the page.

Measured / observed:
- `matrix-label` appears at `8px`.
- several table headers / helper lines remain `9px`.
- region chips include `8px` labels.
- category-row buttons can render around `16px` high.

Recommended cleanup:
- raise matrix labels and table headers to `10–11px` minimum, preferably `11px` for normal labels;
- enlarge clickable category rows without changing data or matrix structure;
- preserve the current provider bars and semantic colors.

### V4 — MEDIUM — Map navigation remains visually pill-heavy and too short on mobile

Map density is allowed to be higher than normal reading views, so this is not a structural problem. The issue is the legacy tab treatment.

Measured / observed:
- seven map tabs render about `28px` high on desktop and mobile.
- their radius remains `999px`, creating a pill-control cluster unlike the editorial navigation used elsewhere.
- desktop map note remains `9px`.

Recommended cleanup:
- make map tab hit areas larger, especially `44px` on mobile;
- reduce pill dependence or use a restrained segmented/underline treatment;
- raise map note to `10–11px` where space allows;
- retain marker circles, marker shadows, cluster dots and floating map-control elevation: these are intentional map affordances, not legacy debt.

### V5 — MEDIUM — Overview verification/recheck microcopy is still too small

Overview itself is visually strong, but the latest-check / diff area still contains old microtype.

Measured / observed:
- `page-recheck-status`: `8px`;
- recheck labels/source links: frequently `9px`.

Recommended cleanup:
- move ordinary recheck labels/source metadata to `10–11px` or `11px`;
- keep the current flat divider structure and `VERIFICATION` trust-interface treatment.

### V6 — LOW — Timeline has one undersized action

Timeline is otherwise one of the most consistent views.

Measured / observed:
- `地図で地域を確認` button renders around `33px` high.

Recommended cleanup:
- bring it up to the common control height.
- keep the selected-event inset line; it is a state indicator, not an unwanted shadow.

### V7 — LOW / OPTIONAL — Sender status text could move from 10px to 11px

Sender is structurally clean: white table headers, hairlines, flat status dot + text, no overflow, and no residual card/shadow system.

Measured / observed:
- status labels are `10px` across the table.

Recommended cleanup:
- consider `11px` for status text to align with the stated metadata target, especially on mobile.
- this is lower priority because the current table remains readable and consistent.

## Confirmed non-issues / false positives removed

The automated detector also saw large radii or shadows on items that should **not** be removed:
- semantic dots and timeline legend circles;
- map markers and cluster dots;
- provider progress/fill bars;
- floating map controls / legend / popup elevation;
- selected timeline-event inset line;
- volunteer selected-state outline and sticky first-column separator.

These are functional state/navigation affordances rather than decorative legacy surfaces.

## What is already consistent

- Landing: clean editorial hierarchy, no tiny text, no unnecessary shadow/radius system.
- Overview: section heading x-alignment is consistent; no general card/shadow regression.
- Timeline: major hierarchy and chronology are consistent.
- Dashboard: hero/KPI/filter/provider composition is aligned and flat; only detail microtype remains.
- Sender: strong consistency on desktop/mobile, no overflow.
- Across all audited pages/views: no horizontal document overflow detected at `1440px` or `390px`.

## Recommended final polish scope

A final visual-polish PR should be **strictly presentation-only** and limited to these buckets, in this order:

1. Needs typography / control size / card-shadow cleanup.
2. Volunteer tap-target and secondary-control typography cleanup.
3. Dashboard matrix microtype / category-row hit-area cleanup.
4. Map tabs / map-note cleanup.
5. Overview recheck metadata cleanup.
6. Timeline single-button cleanup.
7. Optional Sender status 10→11px adjustment.

Do not change JSON, JavaScript logic, adjudication status, counts, coordinates, source data, timepoint semantics, or update pipelines in that PR.

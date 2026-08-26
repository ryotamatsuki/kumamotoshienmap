# Sender-side Municipality Coverage Pre-merge Audit

- Reference at: `2026-08-27T06:34:00+09:00`
- Base main SHA: `c3a216faa48062d14cb88b07a36a4c23e705a43a`
- Policy: `時点修正更新オペレーション.md` Version 2.6

## Ehime

- required: 20
- adjudicated: 20
- missing: 0
- states: CURRENT 9 / HISTORICAL 1 / UNKNOWN 10 / PLANNED 0 / NO_EVIDENCE 0 / CONFLICT 0
- aggregate municipal personnel are not allocated to individual municipalities by inference.

## Nationwide sender discovery

- prefectures checked: 47 / 47
- discovered basic-municipality sender entities: 258
- adjudicated: 258
- source mention target count: 258
- orphan source mentions: 0
- blocking conflicts: 0
- states: CURRENT 15 / PLANNED 1 / HISTORICAL 10 / UNKNOWN 232 / NO_EVIDENCE 0 / CONFLICT 0

The nationwide denominator is the discovered sender universe after systematic 47-prefecture discovery plus adopted cross-cutting discovery sources. It is not a claim that all roughly 1,700 municipalities were individually crawled or proven not to support.

## Important conservative adjudications

- Scheduled dispatch windows alone are not treated as CURRENT.
- Cross-cutting proxy-donation registries are discovery evidence only unless an eligible primary/official source directly supports CURRENT.
- UNKNOWN is retained when support is identified but the reference-time status cannot be directly confirmed.
- Municipality identity is `prefecture + municipality_name`; same-name municipalities are not collapsed.

## Hard Gates

The PR must pass:

- `validate:ehime-sender-coverage`
- `validate:nationwide-sender-coverage`
- `validate:sender-source-mentions`
- `validate:sender-coverage`
- 10 destructive sender gate tests
- existing Version 2.5-era Release Gate tests
- build / dist validation
- final Release Gate
- `git diff --check`

The CI result used for merge approval must belong to the exact final PR head SHA. Any subsequent audit, documentation or code correction invalidates an earlier PASS and requires a new final-head run.

After squash merge, Pages smoke must verify the main dashboard plus `sender-municipalities.html` and all canonical sender audit assets on Desktop 1440×1000 and Mobile 390×844 with zero page/console errors and zero document-level horizontal overflow.

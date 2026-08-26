# Sender-side Municipality Coverage Gate

> Detailed specification under `時点修正更新オペレーション.md` Version 2.6.
>
> This document does not weaken the existing Version 2.5-era shelter, municipal-support, national-support, Institution Coverage, Source Mention Closure or Release Gate checks. Version 2.6 makes the sender-side gates additional mandatory checks.

## 1. Scope

Sender-side municipality coverage is maintained separately from recipient-side 熊本県45市町村 coverage.

- **Ehime Hard Gate**: all 20 municipalities in 愛媛県 are a fixed required universe and must be adjudicated every audit.
- **Nationwide discovery gate**: all 47 prefectures must have a `CHECKED` discovery row.
- **Discovered sender closure**: every basic municipality or Tokyo special ward discovered in required/adopted discovery sources must be adjudicated.
- **Source mention closure**: every municipality mentioned as a sender/cooperating municipality in adopted discovery material must resolve to an adjudicated entity.

The nationwide denominator is not all roughly 1,700 municipalities. The gate guarantees systematic 47-prefecture discovery and complete closure of the discovered sender universe.

## 2. State policy

Allowed states:

- `CURRENT`
- `PLANNED`
- `HISTORICAL`
- `UNKNOWN`
- `NO_EVIDENCE`
- `CONFLICT`

A scheduled period reaching the reference time never promotes a record to `CURRENT` by itself. `CURRENT` requires direct evidence such as explicit current activity, actual dispatch/presence, explicit continuation, or an explicitly active collection/support window.

Secondary/cross-cutting sources such as disaster proxy-donation registries are candidate-discovery sources only. They may create a required sender candidate, but they do not by themselves justify `CURRENT`.

`UNKNOWN` does not mean no support. `NO_EVIDENCE` means that the defined primary-source search was conducted and no sender support statement was found; it is not an assertion that support did not occur.

## 3. Entity identity

Nationwide entities are uniquely identified by the pair:

```text
prefecture + municipality_name
```

This is required because municipality names can repeat across prefectures, for example `美里町`.

Tokyo special wards are included as basic-municipality sender entities. Designated-city wards are not municipalities and are not included in the municipality denominator unless retained separately as a sub-actor.

Inter-municipal associations, fire-service unions, water authorities and similar organizations must use a separate `kind`; they are not municipality denominator entries.

## 4. Canonical files

- `sender-municipality-audit.json`: manifest, policy, required universe and summary.
- `sender-audit/ehime.json`: fixed Ehime 20-municipality audit.
- `sender-audit/*.json`: regional sender adjudication files.
- `sender-audit/sources.json`: primary and previously adopted source catalog.
- `sender-audit/sources-additions.json`: cross-cutting discovery source catalog.
- `sender-audit/discovery.json`: 47-prefecture base discovery log.
- `sender-audit/discovery-additions.json`: additional source mentions discovered through cross-cutting registries and focused follow-up.
- `sender-municipalities.html`: public sender coverage UI.

The sender audit may use an independent `reference_at` when only sender coverage is refreshed. Do not move the page-wide reference time unless the other time-sensitive domains were also re-audited.

## 5. Hard Gate commands

```sh
npm run validate:ehime-sender-coverage
npm run validate:nationwide-sender-coverage
npm run validate:sender-source-mentions
npm run validate:sender-coverage
npm run test:release-gate
npm run build
npm run validate:release -- --base=<BASE_SHA> [--ledger=<LEDGER>]
```

`validate:release` first executes the existing Version 2.5-era Release Gate and only then executes the sender coverage gate. Passing sender coverage can never bypass an existing release check.

Normal merge policy is final-head PR CI. The validation workflow also runs on `main` pushes as defense in depth so a missing PR-event/check-suite cannot make a merged revision invisible to build and Release Gate validation. A post-merge push PASS is not a policy substitute for PR CI when PR CI is available; it is an additional validation surface and a recovery path when the platform does not create the expected PR workflow run.

## 6. Ehime Hard Gate

Exactly these 20 municipalities are required:

松山市、今治市、宇和島市、八幡浜市、新居浜市、西条市、大洲市、伊予市、四国中央市、西予市、東温市、上島町、久万高原町、松前町、砥部町、内子町、伊方町、松野町、鬼北町、愛南町。

Release fails if any required entity is missing, unadjudicated, invalid, or has unresolved source-mention closure.

Aggregate prefectural statements such as `市町40人` must not be allocated to individual municipalities by inference. Keep the aggregate as an aggregate unless primary evidence supports municipality-level assignment.

## 7. Nationwide discovery gate

All 47 prefectures require a `CHECKED` discovery record with a search record and timestamp. Candidate count may be zero.

When a candidate is found in a prefectural/national/municipal official source or adopted cross-cutting discovery source, that candidate must be represented as a sender entity. The gate compares the prefecture-qualified discovered key with the adjudicated entity keys.

Cross-cutting registries may expand the discovered universe materially after the first prefectural sweep. Their discovered candidates must be merged into the same closure before release.

## 8. Source Mention Closure

Every sender/cooperating municipality in adopted source material must resolve to a prefecture-qualified entity key.

Recipient names, facility locations and designated-city administrative wards must not be false-positive sender mentions.

If the same municipality name exists in more than one prefecture, an unqualified legacy mention must be converted to or supplemented by a prefecture-qualified mention before the gate can safely close.

## 9. Regression self-tests

Destructive tests intentionally verify failure for at least:

1. removal from the Ehime required universe;
2. null sender state;
3. a source-mentioned sender without an entity;
4. a known general city without an entity;
5. one prefecture missing from discovery;
6. schedule-only `CURRENT`;
7. `UNKNOWN` without a reason;
8. 46/47 discovery completion;
9. an orphan Tokyo special ward;
10. a non-municipal organization counted in the municipality denominator.

## 10. Public UI and Pages QA

`sender-municipalities.html` displays:

- Ehime 20/20 audit;
- nationwide sender count;
- 47/47 discovery status;
- orphan source-mention count;
- state, support type, destination, evidence and source;
- prefecture/state/search filters;
- conservative-state caveats.

The UI is a view of the canonical audit files. Validators operate on the canonical data, not on UI text.

After squash merge, the post-deploy Pages smoke must wait until the root page, legacy dashboard, sender page and sender manifest all match the same main revision before it declares deployment convergence. It then verifies byte parity for every sender audit asset and runs Desktop 1440×1000 and Mobile 390×844 browser checks. Page errors, console errors and document-level horizontal overflow must be zero.

The expected nationwide sender row count is read from the canonical manifest at runtime; the smoke workflow must not hard-code the current denominator because future discovery is expected to increase it.

# Sender Pages Smoke Failure Note

## Run 33020220077 — premature convergence

Main `8c07647297d9c4e5ebf26f13a9426e665a97f126` introduced the sender coverage release. The first post-deploy Pages smoke failed before browser QA because the convergence loop considered deployment complete as soon as the unchanged legacy dashboard matched main. The newly added `sender-municipalities.html` had not yet reached Pages and returned HTTP 404 immediately afterwards.

Root cause: convergence was keyed only to an unchanged legacy asset.

Correction: deployment convergence must require the root page, legacy dashboard, sender page and sender manifest to match the same merged main revision before parity checks continue.

## Run 33020278145 — temporary-file path mismatch

A later push ran after the new Pages assets had deployed. This run successfully reached and byte-compared the sender page and all sender audit JSON assets, and confirmed that the production root exposed both the main dashboard and sender coverage links. It then failed before browser QA with:

```text
ENOENT: no such file or directory, open '/tmp/current-shelters.json'
```

Root cause: the asset loop downloaded every legacy asset to the generic path `/tmp/deployed-asset`, while the subsequent Node assertion correctly expected `/tmp/current-shelters.json`.

Correction: each legacy asset is now downloaded to `/tmp/${asset}`. Sender assets use unique sanitized temporary paths. Sender counts in browser QA are derived from the canonical manifest rather than hard-coded so future sender discoveries do not require changing the smoke test solely because the denominator grew.

## Run 33020510738 — browser selector mismatch

The complete-release convergence, sender asset byte parity, current-shelter checks, Ehime 20/20, nationwide 47/47, 258 adjudicated senders and orphan source mentions 0 all passed. The legacy dashboard Desktop 1440×1000 browser check also passed with all six views, zero page errors, zero console errors and zero page-level horizontal overflow.

The run then timed out while waiting for sender table rows. The sender UI intentionally uses the unique `data-entity-key="prefecture/municipality"` attribute after same-name municipalities were introduced, while the production smoke still queried the former `tr[data-entity]` selector.

Root cause: QA selector compatibility was not preserved when the UI moved from municipality-name-only identity to `prefecture + municipality_name` identity.

Correction: sender rows now keep `data-entity-key` as the canonical unique identifier and also expose `data-entity` as a compatibility/testing attribute. This avoids weakening the unique-key model while allowing the existing smoke selector to observe row rendering.

## Run 33021482833 — sender favicon 404

The final selector-compatible release reached GitHub Pages and passed complete-release convergence, asset byte parity, current shelters 63/63, Ehime 20/20, nationwide 47/47, 258 adjudicated senders and orphan source mentions 0. The sender table rendered and advanced through the browser assertions, but the Desktop sender QA failed because Chrome emitted one console resource error:

```text
Failed to load resource: the server responded with a status of 404 ()
```

All canonical sender JSON resources had already passed byte-parity checks and the sender rows rendered, so the failed request was not a required audit-data resource. The standalone sender page had no favicon declaration, allowing the browser to issue the conventional favicon request against a non-existent Pages resource.

Root cause: missing explicit favicon handling on the standalone sender page caused a non-functional browser resource 404, violating the production requirement of zero console errors.

Correction: `sender-municipalities.html` now declares an empty data-URL favicon (`<link rel="icon" href="data:,">`) so the browser does not make a missing favicon request. This changes no audit data, identity semantics or sender adjudication.

Diagnostic rule for future failures: when complete-release convergence, canonical JSON byte parity and rendered sender row counts have already passed, a remaining browser resource 4xx must be investigated as a separate URL-level production asset failure rather than being conflated with sender-data closure. Required data/resource URLs remain blocking; optional browser chrome should be made explicit so it cannot create unexplained console noise.

## Final requirement

None of these failed runs is treated as a production PASS. A subsequent main revision must complete the full post-deploy workflow including byte parity and Desktop 1440×1000 / Mobile 390×844 browser QA for both dashboards with zero page errors, console errors and document-level horizontal overflow.

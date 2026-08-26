# Sender Pages Smoke Failure Note

Post-deploy run `33020220077` for main `8c07647297d9c4e5ebf26f13a9426e665a97f126` failed before browser QA because the smoke test considered deployment converged as soon as the unchanged legacy dashboard matched main. The newly added `sender-municipalities.html` was not yet present and returned HTTP 404 immediately afterwards.

This is a smoke convergence bug, not evidence that sender data failed validation. The corrective action is to make the convergence loop require both the legacy dashboard and the new sender page/manifest before proceeding to byte-parity and browser checks.

# Run the connected iPad stage controls on Vercel

## Background and previous behavior

The owner deployed the merged iPad app to Vercel, but its page remained a static preview and `/api/exhibition/state` returned 404. The Node bridge was working locally; Vercel had no function entry point or route mapping to run it.

## Implemented changes

1. Extract the existing request handler and reuse it in the local HTTP server and `api/control.mjs`. Backend ownership, confirmation, authentication and error behavior remain shared.
2. Redirect the root to `/stages` to bypass static index precedence, then route the page and two stage endpoints to the function in `vercel.json`; include the built HTML. Connected mode is injected at request time and the native operator login protects the page/API. Assets remain static.
3. Accept Vercel-parsed JSON alongside raw Node streams while preserving the 1 KiB limit and canonical-stage validation. Read the deployed backend's `crop_stage.code`, with existing fallback compatibility.
4. Ignore `.vercel/` and environment files to keep credentials out of source control. No markup, artwork or dependencies changed. The owner subsequently requested transient loading feedback: initial loading uses the existing live-status element, and saving uses the tapped card’s existing badge. The idle design stays unchanged.

5. Show initial-load and card-save indicators, retain the previous confirmed selection while saving, clear indicators after failure, and keep background refresh quiet. Operator-password variables are not overwritten by deployment.

## Contract and configuration

Browser GET `/api/exhibition/state` and PATCH `/api/exhibition/stage` still use the existing owner-authenticated fixed-plot bridge. Production requires server-side `IPAD_BACKEND_URL`, `IPAD_OWNER_SESSION_TOKEN`, and `IPAD_OPERATOR_PASSWORD`; `IPAD_PLOT_ID` is an optional override. Use operator username `exhibition`. An HTTPS backend origin encrypts the upstream hop; the current provided origin is HTTP.

## Time-complexity check

No new unbounded loops, N+1 queries or pagination. Three fixed routes, at most three upstream calls per stage change, one per state read, fixed five-card UI, and bounded request parsing.

## Verification

- Production build passed.
- Seven server HTTP tests passed, including Vercel route rewrites, parsed request bodies, oversized bodies, authentication and missing operator configuration.
- All 28 Chrome/WebKit checks passed, including initial loading, pending-save feedback, quiet background refresh, connected/static geometry and appearance, existing responsive layouts and keyboard use.
- Diff checks passed; markup/CSS/artwork unchanged.
- Separate Vercel production deployment is ready at https://sunrise-ipad-exhibition.vercel.app under `andrian9`. Verified root redirect, native operator challenge (401), authenticated connected HTML with all five cards, asset loading, state read (200), and a hosted stage update on the existing season. Restored the original Flowering stage. The original Gleen deployment remains untouched.
- PR #2 could not be merged: GitHub rejected both saved accounts (`andrian-irisa` and `andrianang`) for insufficient merge permission.

## Rollout

Link the existing Vercel project after sign-in; configure server-only variables and deploy the function alongside the built page. Verify an unauthenticated request gets an operator challenge, then an authenticated state read returns the configured plot/current season. Confirm a stage update and restore the original stage. No physical sensor interval or gate movement is claimed by this hosting change.

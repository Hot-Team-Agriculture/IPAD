# Connect the iPad stage cards to the table plot

## Background and previous behavior

The exhibition operator needs the existing five cards to change the table plot's crop stage through the Go backend. Previously `src/main.js` changed only browser selection and reset on reload. The owner asked to prepare wiring now and configure the plot ID after registration, without changing the design.

## Implemented changes

1. `server.mjs` serves the built page and forwards requests for one configured plot. The owner's session remains server-side. Network access requires an operator password.
2. The page reads the current stage, serializes changes, and selects a card only after backend confirmation. It refreshes every five seconds while visible and restores selection on reload.
3. `src/stages.js` maps the existing cards to `seedling`, `vegetative`, `flowering`, `grain_fill`, and `drain`. No markup, artwork, or CSS changes.

## Contract and configuration

Browser `PATCH /api/exhibition/stage` with `{"stage_code":"flowering"}` → authenticated backend `PATCH /api/v1/crop-cycles/{cycle_id}` with `{"manual_stage_code":"flowering"}`. The cycle is derived from `GET /api/v1/plots/{plot_id}/water-level`; it must belong to the configured plot and remain open. A second read confirms the applied stage.

Set `IPAD_BACKEND_URL`, `IPAD_PLOT_ID`, and `IPAD_OWNER_SESSION_TOKEN` on the server. Network access additionally needs `IPAD_OPERATOR_PASSWORD`, `IPAD_HOST`, and HTTPS or an encrypted access path. Run `npm ci`, `npm run build`, then `npm start`. Static Vite dev/preview remains local-only.

## Time-complexity check

No N+1, pagination, or unbounded collection issue identified. Selection scans five fixed cards. Each stage change makes at most three sequential backend requests (read, patch, confirm); each poll makes one read. Browser requests do not overlap. Request bodies are capped at 1 KiB.

## Verification and rollout

- Server HTTP tests cover all mappings, rejected writes, missing seasons, fixed plot scope, operator authentication, and confirmation mismatches.
- Browser checks cover connected interactions, reload, errors, identical geometry and screenshot appearance, plus existing responsive/keyboard behavior in Chrome and WebKit.
- The staging deployment was reapplied on 24 November 2026 at commit `00f3efee2c703f62904fc6cc20c3c7ea2e14827e`. Readiness returned `ready`; deployed documentation exposes both reused backend routes.
- A local bridge reached deployed staging and propagated its expected 401 for an intentionally invalid owner session. No live stage write was made.

Live success remains unverified. As of 25 November 2026, table plot `0a7d8b58-b085-4a47-9871-bb2e08be6738` exists with paired AWD/gate devices and is the server startup default. It has no active season. Start its season, configure the owner session, then verify on the physical iPad. This PR does not deploy the iPad bridge or create backend records.

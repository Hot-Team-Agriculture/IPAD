# Sawir iPad exhibition

An HTML, Tailwind CSS and vanilla JavaScript crop-stage selector, based on [the iPad Figma design](https://www.figma.com/design/tgzswcXnp7VqLMZMKPOdov/Gleen-Stuff?node-id=680-15776).

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

Open the network address printed by Vite on an iPad connected to the same Wi-Fi. Landscape matches the five-card design. Adding the site to the Home Screen gives it a standalone app window without Safari's toolbar.

```sh
npm run build
npm run preview
```

The `dist` folder is the deployable static website. All photos, styling, icons and artwork are local; the UI has no external runtime dependencies or CDN requests.

## UI behavior

- Seedling is selected initially. Tapping a card moves the blue outline and “Current Stage” banner to that stage.
- Selection is held in the current page only and resets on reload. It makes no backend requests.
- Landscape keeps all five cards visible. The title has 92px top padding; the logo has 32px above and below it. The card row fills the remaining height. Portrait uses a two-column layout with vertical scrolling.
- Safe-area padding and dynamic viewport sizing account for the iPad's screen edges and Safari toolbar changes.
- The operating system's status bar in Figma is not duplicated inside the website.

## Connected exhibition control

Current status: the connected mode is implemented and can be verified against an HTTP test backend. On 24 November 2026 the deployed main database had hub/AWD/gate records but no plots, active crop cycles, water readings or gate commands. The AWD and gate were unpaired. Live table control is not commissioned yet.

The iPad wiring can be prepared before the plot exists. Once the table plot and its season are created, set `IPAD_PLOT_ID` on the server and restart it; no page or design changes are needed. Leave the owner session server-side rather than hardcoding it in the browser.

The static `npm run dev` and `npm run preview` modes retain local-only selection. To control the table, build the same page and run the stage bridge:

```sh
npm ci
npm run build
npm start
```

Configure these **server-side process variables** before starting it. Do not prefix credentials with `VITE_` or commit them:

| Variable | Purpose |
| --- | --- |
| `IPAD_BACKEND_URL` | Backend origin. Use HTTPS or an encrypted tunnel to a loopback HTTP origin. |
| `IPAD_PLOT_ID` | The table's existing, owner-scoped plot UUID. |
| `IPAD_OWNER_SESSION_TOKEN` | An existing owner Bearer session for that plot. Kept on the server. |
| `IPAD_OPERATOR_PASSWORD` | Operator password; required when listening beyond loopback. The browser's native login uses username `exhibition`. |
| `IPAD_HOST` | Defaults to `127.0.0.1`; use an appropriate network bind address for an iPad. |
| `PORT` | Defaults to `4174`. |

For iPad access, place the bridge behind HTTPS (or use a trusted encrypted access path). The native browser login protects both the page and its stage controls. The owner session is never included in page HTML, JavaScript, browser storage or API responses. An expired owner session must be replaced on the server.

The bridge serves the built page with connected mode enabled, preserving its existing artwork and CSS. It loads the configured plot's current stage, restores selection on reload, and refreshes every five seconds while visible. Tapping a card writes its mapped stage to the current open cycle and confirms the backend state before moving the selection. Requests are serialized in the page. A failure uses a native alert and reloads the authoritative state instead of claiming a successful update. Missing plot/season configuration leaves controls unavailable.

| Card | Backend `manual_stage_code` |
| --- | --- |
| Seedling | `seedling` |
| Vegetative | `vegetative` |
| Reproductive | `flowering` |
| Ripening | `grain_fill` |
| Ripe | `drain` |

`drain` does not end or harvest the season. The bridge never creates a plot or season, registers devices, uploads synthetic readings, or directly commands a gate. Normal backend control may respond to stage changes using real readings and its existing safeguards.

### Reused API contract

The backend's authenticated `GET /api/v1/plots/{plot_id}/water-level` provides `crop_cycle.id`, an open `ended_at`, and the applied stage. The bridge accepts only its configured plot and derives the cycle UUID from this response; it does not accept arbitrary plot/cycle IDs from the browser.

The browser calls `GET /api/exhibition/state` and `PATCH /api/exhibition/stage` with `{"stage_code":"flowering"}`. The bridge forwards only `{"manual_stage_code":"flowering"}` to `PATCH /api/v1/crop-cycles/{cycle_id}`, then reads the water summary again. Backend errors and a mismatching applied stage are reported as failure. The separate exhibition-session API is not required.

### Verification

```sh
npm run test:server
npm run build
npm test
```

Server and connected-browser checks use a real local HTTP stand-in for the documented backend paths. They cover all five stage mappings, persisted selection after reload, failed writes, unavailable seasons, operator authentication, fixed plot scope and no optimistic success while saving. They do not prove live gate motion, firmware behavior or a real device registration. Existing layout checks continue to cover the static page.

Verified on 24 November 2026: six server tests, 26 Chrome/WebKit checks, and the production build passed. Connected/static layout geometry matched exactly; screenshots allow up to ten differing pixels at a 0.2 color threshold for fractional image rasterization. The bridge also reached the deployed staging API and received the expected 401 with an intentionally invalid session. This confirms connectivity, not an authorized live stage update. Staging readiness passed after reapplying backend commit `00f3efee2c703f62904fc6cc20c3c7ea2e14827e`.

## Files

- `index.html`: screen markup and stage content.
- `src/style.css`: Tailwind import and exact layout measurements.
- `src/main.js`: local or confirmed backend stage selection.
- `src/stages.js`: shared card-to-backend stage mapping.
- `server.mjs`: static hosting and owner-authenticated stage bridge.
- `public/assets`: original artwork exported from Figma, including the photographs' white fade effects.

## Browser checks

Google Chrome must be installed. Install the WebKit test engine once:

```sh
npx playwright install webkit
npm test
```

The checks cover six viewport sizes in Chrome and WebKit, all five stage selections, keyboard activation, local asset loading, zero backend/external requests, and no clipped cards or landscape scrolling. Screenshots are saved in `qa/` for the reference-size layout and selected state. Real iPad hardware still needs a final visual check.

## Asset sources

All assets come from the linked Figma file:

| Asset | Node |
| --- | --- |
| Seedling | `680:15795` |
| Vegetative | `680:15815` |
| Reproductive | `680:15835` |
| Ripening | `680:15855` |
| Ripe | `680:15875` |
| Heading | `680:15886` |
| Sawir logo | `680:15887` |
| Watering icon | `680:15803` |
| Background pattern | `680:15777` |

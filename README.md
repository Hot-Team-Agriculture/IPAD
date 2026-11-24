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

## Files

- `index.html`: screen markup and stage content.
- `src/style.css`: Tailwind import and exact layout measurements.
- `src/main.js`: viewport fit and local stage selection.
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

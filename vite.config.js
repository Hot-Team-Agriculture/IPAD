import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [tailwindcss(), connectedPage()],
});

// On Vercel, enable connected mode in the built page when the bridge is configured.
// server.mjs adds the same attribute itself for `npm start`.
function connectedPage() {
  const enabled = process.env.VERCEL === '1' && Boolean(process.env.IPAD_BACKEND_URL);
  return {
    name: 'exhibition-connected-page',
    transformIndexHtml: html => (enabled ? html.replace('<main ', '<main data-stage-endpoint="true" ') : html),
  };
}

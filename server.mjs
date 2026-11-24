import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { stageCodes } from './src/stages.js';

const stages = new Set(Object.values(stageCodes));
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

export function createExhibitionServer({ backendURL, plotID, ownerToken, operatorPassword, directory = new URL('./dist/', import.meta.url) } = {}) {
  const upstream = backendURL ? new URL(backendURL) : null;
  if (upstream && (!['http:', 'https:'].includes(upstream.protocol) || upstream.username || upstream.password || upstream.pathname !== '/' || upstream.search || upstream.hash)) {
    throw new Error('IPAD_BACKEND_URL must be a backend origin without credentials or a path.');
  }
  if (plotID && !uuid.test(plotID)) throw new Error('IPAD_PLOT_ID must be a plot UUID.');
  const root = resolve(directory instanceof URL ? fileURLToPath(directory) : directory);
  const expectedAuth = operatorPassword ? Buffer.from('Basic ' + Buffer.from('exhibition:' + operatorPassword).toString('base64')) : null;

  function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }

  async function api(path, method = 'GET', body) {
    const reply = await fetch(new URL('/api/v1/' + path, upstream), {
      method, redirect: 'manual', signal: AbortSignal.timeout(12000),
      headers: { Authorization: 'Bearer ' + ownerToken, Accept: 'application/json', ...(body && { 'Content-Type': 'application/json' }) },
      ...(body && { body: JSON.stringify(body) }),
    });
    if (!reply.ok) {
      const messages = {
        401: 'The configured owner session has expired. Ask the operator to reconnect.',
        403: 'The configured owner cannot change this plot.',
        404: 'The configured table plot or season was not found.',
        409: 'The backend declined this change. Check the active season and gate state.',
        400: 'The backend rejected the stage change.',
      };
      throw Object.assign(new Error(messages[reply.status] ?? 'The backend could not confirm the stage. Try again.'), { status: reply.status >= 500 || reply.status < 400 ? 502 : reply.status });
    }
    return reply.json();
  }

  async function state() {
    const water = await api('plots/' + plotID + '/water-level');
    const cycle = water.crop_cycle;
    const stage = water.crop_stage?.stage_code ?? cycle?.applied_stage_code ?? cycle?.manual_stage_code;
    if (!cycle || cycle.plot_id !== plotID || !uuid.test(cycle.id) || cycle.ended_at != null) {
      throw Object.assign(new Error('The table plot needs an active season before changing stages.'), { status: 409 });
    }
    if (!stages.has(stage)) throw Object.assign(new Error('The backend has not confirmed a supported crop stage.'), { status: 409 });
    return { plot_id: plotID, cycle_id: cycle.id, stage_code: stage };
  }

  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (!expectedAuth && !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host ?? '')) {
      return json(res, 403, { error: 'Open the console using its loopback address.' });
    }
    if (expectedAuth) {
      const supplied = Buffer.from(req.headers.authorization ?? '');
      if (supplied.length !== expectedAuth.length || !timingSafeEqual(supplied, expectedAuth)) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Sawir exhibition", charset="UTF-8"');
        return json(res, 401, { error: 'Exhibition operator access is required.' });
      }
    }
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      const read = req.method === 'GET' && path === '/api/exhibition/state';
      const change = req.method === 'PATCH' && path === '/api/exhibition/stage';
      if (read || change) {
        if (!upstream || !plotID || !ownerToken) return json(res, 503, { error: 'The operator must configure the backend, table plot and owner session.' });
        if (change) {
          if ((req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) ||
              (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) {
            return json(res, 403, { error: 'Open the exhibition page directly.' });
          }
          if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return json(res, 415, { error: 'A JSON stage is required.' });
          const chunks = [];
          let length = 0;
          for await (const chunk of req) {
            length += chunk.length;
            if (length > 1024) return json(res, 413, { error: 'Request too large.' });
            chunks.push(chunk);
          }
          let body;
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
          catch { return json(res, 400, { error: 'Invalid JSON.' }); }
          if (!body || Object.keys(body).length !== 1 || !stages.has(body.stage_code)) return json(res, 400, { error: 'Select one of the five crop stages.' });
          const current = await state();
          if (current.stage_code !== body.stage_code) {
            await api('crop-cycles/' + current.cycle_id, 'PATCH', { manual_stage_code: body.stage_code });
          }
          const confirmed = await state();
          if (confirmed.stage_code !== body.stage_code) return json(res, 409, { error: 'The backend has not applied the selected stage. Refresh before retrying.' });
          return json(res, 200, confirmed);
        }
        return json(res, 200, await state());
      }
      if (req.method !== 'GET' || path.startsWith('/api/')) return json(res, 404, { error: 'Route not found.' });
      const file = resolve(root, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
      if (!file.startsWith(root + sep) || !types[extname(file)]) return json(res, 404, { error: 'File not found.' });
      let contents;
      try { contents = await readFile(file); }
      catch { return json(res, 404, { error: 'Build the exhibition page before starting the server.' }); }
      if (file === resolve(root, 'index.html')) contents = contents.toString().replace('<main ', '<main data-stage-endpoint="true" ');
      res.writeHead(200, { 'Content-Type': types[extname(file)] });
      res.end(contents);
    } catch (error) {
      json(res, error.status ?? 502, { error: error.status ? error.message : 'The backend did not confirm the stage. Check the connection and try again.' });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.IPAD_HOST ?? '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.IPAD_OPERATOR_PASSWORD) throw new Error('Set IPAD_OPERATOR_PASSWORD before allowing network access.');
  createExhibitionServer({ backendURL: process.env.IPAD_BACKEND_URL, plotID: process.env.IPAD_PLOT_ID, ownerToken: process.env.IPAD_OWNER_SESSION_TOKEN, operatorPassword: process.env.IPAD_OPERATOR_PASSWORD })
    .listen(Number(process.env.PORT ?? 4174), host, () => console.log('Sawir exhibition stage control is ready.'));
}

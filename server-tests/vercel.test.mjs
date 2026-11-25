import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import control from '../api/control.mjs';
import { fixture, plotID, cycleID } from './backend.mjs';

test('Vercel rewrites serve connected HTML and forward parsed stage requests through the existing bridge', async t => {
  const f = await fixture();
  t.after(() => f.close());
  const config = { IPAD_BACKEND_URL: f.backendURL, IPAD_OWNER_SESSION_TOKEN: 'test-owner-session', IPAD_PLOT_ID: plotID, IPAD_OPERATOR_PASSWORD: 'test-password' };
  const saved = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const server = createServer(async (req, res) => {
    if (req.method === 'PATCH') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      req.body = JSON.parse(Buffer.concat(chunks).toString());
    }
    await control(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = 'http://127.0.0.1:' + server.address().port + '/api/control?route=';
  const authorization = 'Basic ' + Buffer.from('exhibition:test-password').toString('base64');
  assert.equal((await fetch(url + 'page')).status, 401);
  const page = await fetch(url + 'page', { headers: { authorization } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /data-stage-endpoint="true"/);
  const changed = await fetch(url + 'stage', { method: 'PATCH', headers: { authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_code: 'flowering' }) });
  assert.equal(changed.status, 200);
  assert.deepEqual(await changed.json(), { plot_id: plotID, cycle_id: cycleID, stage_code: 'flowering' });
  const current = await fetch(url + 'state', { headers: { authorization } });
  assert.equal((await current.json()).stage_code, 'flowering');
  const oversized = await fetch(url + 'stage', { method: 'PATCH', headers: { authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_code: 'x'.repeat(1100) }) });
  assert.equal(oversized.status, 413);
  assert.equal((await fetch(url + 'other', { headers: { authorization } })).status, 404);
  delete process.env.IPAD_OPERATOR_PASSWORD;
  assert.equal((await fetch(url + 'state')).status, 503);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { fixture, plotID, cycleID } from './backend.mjs';

// Calls the Vercel Function exports the way Vercel's Node runtime does: a plain (req, res) handler
// reached through a public hostname, configured only by environment variables.
async function vercelFunctions(backendURL) {
  Object.assign(process.env, { IPAD_BACKEND_URL: backendURL, IPAD_PLOT_ID: plotID, IPAD_OWNER_SESSION_TOKEN: 'test-owner-session', IPAD_OPERATOR_PASSWORD: 'test-operator-password' });
  const routes = {
    '/api/exhibition/state': (await import('../api/exhibition/state.js')).default,
    '/api/exhibition/stage': (await import('../api/exhibition/stage.js')).default,
  };
  const server = createServer((req, res) => routes[req.url](req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}

function call(port, path, { method = 'GET', auth = true, body } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { Host: 'ipad-example.vercel.app', ...(auth && { Authorization: 'Basic ' + Buffer.from('exhibition:test-operator-password').toString('base64') }), ...(body && { 'Content-Type': 'application/json', Origin: 'https://ipad-example.vercel.app' }) };
    const req = request({ host: '127.0.0.1', port, path, method, headers }, res => {
      let text = ''; res.on('data', c => (text += c)); res.on('end', () => resolve({ status: res.statusCode, auth: res.headers['www-authenticate'], json: JSON.parse(text) }));
    });
    req.on('error', reject); req.end(body && JSON.stringify(body));
  });
}

test('the Vercel Functions read and change the configured plot behind the operator login', async t => {
  const f = await fixture(); t.after(() => f.close());
  const fn = await vercelFunctions(f.backendURL); t.after(fn.close);

  const anonymous = await call(fn.port, '/api/exhibition/state', { auth: false });
  assert.equal(anonymous.status, 401);
  assert.match(anonymous.auth, /^Basic /);
  assert.equal(f.state.requests.length, 0);

  assert.deepEqual((await call(fn.port, '/api/exhibition/state')).json, { plot_id: plotID, cycle_id: cycleID, stage_code: 'seedling' });
  const changed = await call(fn.port, '/api/exhibition/stage', { method: 'PATCH', body: { stage_code: 'flowering' } });
  assert.equal(changed.status, 200);
  assert.equal(changed.json.stage_code, 'flowering');
  assert.equal(f.state.stage, 'flowering');
  assert.ok(f.state.requests.every(r => r.authorization === 'Bearer test-owner-session'));
});

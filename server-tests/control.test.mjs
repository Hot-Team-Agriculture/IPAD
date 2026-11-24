import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'node:http';
import { fixture, plotID, cycleID } from './backend.mjs';

test('reads the configured plot and confirms all five native stage codes through real HTTP', async t => {
  const f = await fixture(); t.after(() => f.close());
  for (const code of ['seedling', 'vegetative', 'flowering', 'grain_fill', 'drain']) {
    const reply = await fetch(f.url + '/api/exhibition/stage', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_code: code }) });
    assert.equal(reply.status, 200);
    assert.deepEqual(await reply.json(), { plot_id: plotID, cycle_id: cycleID, stage_code: code });
  }
  assert.ok(f.state.requests.every(req => req.authorization === 'Bearer test-owner-session'));
  assert.deepEqual(f.state.requests.filter(req => req.method === 'PATCH').map(req => req.body), ['vegetative', 'flowering', 'grain_fill', 'drain'].map(manual_stage_code => ({ manual_stage_code })));
});

test('rejects alternate plot IDs, noncanonical stages and cross-origin writes without mutating the backend', async t => {
  const f = await fixture(); t.after(() => f.close());
  for (const body of [{ stage_code: 'vegetative', plot_id: plotID }, { stage_code: 'reproductive' }]) {
    const r = await fetch(f.url + '/api/exhibition/stage', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(r.status, 400);
  }
  const r = await fetch(f.url + '/api/exhibition/stage', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: 'https://another-site.example' }, body: JSON.stringify({ stage_code: 'drain' }) });
  assert.equal(r.status, 403);
  assert.equal(f.state.requests.length, 0);
});

test('an absent season blocks writes and never fabricates a cycle', async t => {
  const f = await fixture(); t.after(() => f.close()); f.state.missingCycle = true;
  const r = await fetch(f.url + '/api/exhibition/stage', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_code: 'vegetative' }) });
  assert.equal(r.status, 409);
  assert.equal(f.state.requests.filter(r => r.method === 'PATCH').length, 0);
});

test('requires the operator login and keeps owner credentials server-side', async t => {
  const f = await fixture({ operatorPassword: 'test-operator-password' }); t.after(() => f.close());
  assert.equal((await fetch(f.url + '/api/exhibition/state')).status, 401);
  const r = await fetch(f.url + '/api/exhibition/state', { headers: { Authorization: 'Basic ' + Buffer.from('exhibition:test-operator-password').toString('base64') } });
  assert.equal(r.status, 200);
  assert.ok(!(await r.text()).includes('test-owner-session'));
});

test('a loopback console rejects foreign hostnames', async t => {
  const f = await fixture(); t.after(() => f.close());
  const status = await new Promise((resolve, reject) => {
    get(f.url + '/api/exhibition/state', { headers: { Host: 'another-site.example' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.equal(status, 403);
  assert.equal(f.state.requests.length, 0);
});

test('upstream rejection and unconfirmed changes never return success', async t => {
  const f = await fixture(); t.after(() => f.close());
  for (const status of [401, 404, 409, 500]) {
    f.state.patchStatus = status;
    const r = await fetch(f.url + '/api/exhibition/stage', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_code: 'vegetative' }) });
    assert.equal(r.status, status === 500 ? 502 : status);
    assert.equal(f.state.stage, 'seedling');
  }
  f.state.patchStatus = 200; f.state.ignorePatch = true;
  const r = await fetch(f.url + '/api/exhibition/stage', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_code: 'vegetative' }) });
  assert.equal(r.status, 409);
});

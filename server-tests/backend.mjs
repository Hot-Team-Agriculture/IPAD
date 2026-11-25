import { createServer } from 'node:http';
import { createExhibitionServer } from '../server.mjs';

export const plotID = '11111111-1111-4111-8111-111111111111';
export const cycleID = '22222222-2222-4222-8222-222222222222';

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port;
}

export async function fixture(options = {}) {
  const state = { stage: 'seedling', missingCycle: false, patchStatus: 200, readStatus: 200, ignorePatch: false, delay: 0, requests: [] };
  const backend = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    state.requests.push({ path: req.url, method: req.method, authorization: req.headers.authorization, body });
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET' && req.url === '/api/v1/plots/' + plotID + '/water-level') {
      res.statusCode = state.readStatus;
      return res.end(JSON.stringify({ crop_cycle: state.missingCycle ? null : { id: cycleID, plot_id: plotID, ended_at: null, applied_stage_code: state.stage }, crop_stage: { stage_code: state.stage } }));
    }
    if (req.method === 'PATCH' && req.url === '/api/v1/crop-cycles/' + cycleID) {
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      res.statusCode = state.patchStatus;
      if (state.patchStatus === 200 && !state.ignorePatch) state.stage = body.manual_stage_code;
      return res.end(JSON.stringify({ id: cycleID, applied_stage_code: state.stage }));
    }
    res.statusCode = 501;
    res.end(JSON.stringify({ error: 'Mock route is not part of this contract.' }));
  });
  const backendURL = await listen(backend);
  const page = createExhibitionServer({ backendURL, plotID, ownerToken: 'test-owner-session', ...options });
  const url = await listen(page);
  return { state, url, backendURL, async close() {
    await Promise.all([page, backend].map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); })));
  } };
}

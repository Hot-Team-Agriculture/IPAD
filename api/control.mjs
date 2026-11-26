import { createExhibitionHandler } from '../server.mjs';

const routes = { page: '/', state: '/api/exhibition/state', stage: '/api/exhibition/stage' };

export default function control(req, res) {
  const route = req.query?.route ?? new URL(req.url, 'http://localhost').searchParams.get('route');
  if (!Object.hasOwn(routes, route)) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ error: 'Route not found.' }));
  }
  if (!process.env.IPAD_OPERATOR_PASSWORD) {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ error: 'Configure IPAD_OPERATOR_PASSWORD before enabling the hosted controls.' }));
  }
  req.url = routes[route];
  return createExhibitionHandler({
    backendURL: process.env.IPAD_BACKEND_URL,
    plotID: process.env.IPAD_PLOT_ID ?? '0a7d8b58-b085-4a47-9871-bb2e08be6738',
    ownerToken: process.env.IPAD_OWNER_SESSION_TOKEN,
    operatorPassword: process.env.IPAD_OPERATOR_PASSWORD,
  })(req, res);
}

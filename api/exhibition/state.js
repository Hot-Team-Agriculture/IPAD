// Vercel Function for GET /api/exhibition/state. The logic lives in server.mjs.
import { createExhibitionHandler, exhibitionOptionsFromEnv } from '../../server.mjs';

let handler;
export default function exhibition(req, res) {
  handler ??= createExhibitionHandler(exhibitionOptionsFromEnv());
  return handler(req, res);
}

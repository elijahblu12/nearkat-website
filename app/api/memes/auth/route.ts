import { isAuthorized, json } from '../_store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isAuthorized(request)) return json({ ok: false }, 401);
  return json({ ok: true });
}

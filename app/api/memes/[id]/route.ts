import {
  STATIC_MEMES,
  allMemes,
  getRuntimeEnv,
  isAuthorized,
  json,
  readManifest,
  safeFilename,
  writeManifest,
} from '../_store';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const manifest = await readManifest();
  const meme = allMemes(manifest).find((item) => item.id === id);
  if (!meme) return new Response('Not found', { status: 404 });

  let body: ReadableStream | ArrayBuffer;
  let contentType = meme.contentType;
  if (meme.staticPath) {
    const source = await fetch(new URL(meme.staticPath, request.url));
    if (!source.ok) return new Response('Not found', { status: 404 });
    body = await source.arrayBuffer();
    contentType = source.headers.get('content-type') ?? meme.contentType;
  } else {
    const object = await getRuntimeEnv().MEME_BUCKET.get(meme.key);
    if (!object) return new Response('Not found', { status: 404 });
    body = object.body;
  }

  const download = new URL(request.url).searchParams.has('download');
  const headers = new Headers({
    'content-type': contentType,
    'cache-control': meme.staticPath
      ? 'public, max-age=3600'
      : 'public, max-age=31536000, immutable',
  });
  if (download) {
    headers.set(
      'content-disposition',
      `attachment; filename="${safeFilename(meme.filename)}"`,
    );
  }

  return new Response(body, { headers });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isAuthorized(request)) return json({ error: 'Wrong den password.' }, 401);

  const { id } = await context.params;
  const manifest = await readManifest();
  const storedIndex = manifest.memes.findIndex((item) => item.id === id);

  if (storedIndex >= 0) {
    const [removed] = manifest.memes.splice(storedIndex, 1);
    await getRuntimeEnv().MEME_BUCKET.delete(removed.key);
  } else if (STATIC_MEMES.some((item) => item.id === id)) {
    if (!manifest.hiddenStaticIds.includes(id)) manifest.hiddenStaticIds.push(id);
  } else {
    return json({ error: 'Meme not found.' }, 404);
  }

  await writeManifest(manifest);
  return json({ ok: true });
}

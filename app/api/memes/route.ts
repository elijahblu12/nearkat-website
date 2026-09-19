import {
  allMemes,
  getRuntimeEnv,
  isAuthorized,
  json,
  publicMeme,
  readManifest,
  safeFilename,
  writeManifest,
  type MemeTag,
  type StoredMeme,
} from './_store';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ALLOWED_TAGS = new Set<MemeTag>(['degen', 'mob', 'price', 'vibes']);

export async function GET() {
  const manifest = await readManifest();
  const memes = allMemes(manifest).map(publicMeme);
  return json({ memes, totalDownloads: memes.reduce((sum, m) => sum + m.downloads, 0) });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return json({ error: 'Wrong den password.' }, 401);

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'Choose an image first.' }, 400);
  if (!ALLOWED_TYPES.has(file.type)) {
    return json({ error: 'Use a JPG, PNG, GIF, or WebP image.' }, 415);
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return json({ error: 'Images must be under 15 MB.' }, 413);
  }

  const nameField = form.get('name');
  const tagField = form.get('tag');
  const rawName = typeof nameField === 'string' ? nameField.trim() : '';
  const rawTag = (typeof tagField === 'string' ? tagField : 'mob') as MemeTag;
  const tag: MemeTag = ALLOWED_TAGS.has(rawTag) ? rawTag : 'mob';
  const originalBase = file.name.replace(/\.[^.]+$/, '');
  const name = (rawName || originalBase || 'Untitled').slice(0, 100);
  const extension =
    file.type === 'image/jpeg'
      ? 'jpg'
      : file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'gif';
  const id = crypto.randomUUID();
  const key = `memes/${id}.${extension}`;
  const filename = `${safeFilename(name)}.${extension}`;

  await getRuntimeEnv().MEME_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalFilename: safeFilename(file.name) },
  });

  const manifest = await readManifest();
  const meme: StoredMeme = {
    id,
    name,
    tag,
    key,
    contentType: file.type,
    filename,
    createdAt: new Date().toISOString(),
    downloads: 0,
  };
  manifest.memes.push(meme);
  await writeManifest(manifest);

  return json({ meme: publicMeme(meme) }, 201);
}

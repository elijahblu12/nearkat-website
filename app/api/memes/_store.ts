import { env } from 'cloudflare:workers';

export type MemeTag = 'degen' | 'mob' | 'price' | 'vibes';

export interface StoredMeme {
  id: string;
  name: string;
  tag: MemeTag;
  key: string;
  contentType: string;
  filename: string;
  createdAt: string;
  downloads: number;
  staticPath?: string;
}

interface MemeManifest {
  version: 1;
  memes: StoredMeme[];
  hiddenStaticIds: string[];
}

interface RuntimeEnv {
  MEME_BUCKET: R2Bucket;
  MEME_ADMIN_PASSWORD?: string;
}

const MANIFEST_KEY = '_nearkat/gallery.json';

export const STATIC_MEMES: StoredMeme[] = [
  {
    id: 'starter-mob-wall',
    name: 'The Mob',
    tag: 'mob',
    key: '',
    contentType: 'image/png',
    filename: 'nearkat-the-mob.png',
    createdAt: '2026-09-09T00:00:03.000Z',
    downloads: 0,
    staticPath: '/gallery/community-001.png',
  },
  {
    id: 'starter-mob-detail',
    name: 'Mob Detail',
    tag: 'mob',
    key: '',
    contentType: 'image/png',
    filename: 'nearkat-mob-detail.png',
    createdAt: '2026-09-09T00:00:02.000Z',
    downloads: 0,
    staticPath: '/gallery/community-002.png',
  },
  {
    id: 'starter-fishing-void',
    name: 'Fishing the Void',
    tag: 'vibes',
    key: '',
    contentType: 'image/png',
    filename: 'nearkat-fishing-the-void.png',
    createdAt: '2026-09-09T00:00:01.000Z',
    downloads: 0,
    staticPath: '/gallery/community-003.png',
  },
];

export function getRuntimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

export async function readManifest(): Promise<MemeManifest> {
  const object = await getRuntimeEnv().MEME_BUCKET.get(MANIFEST_KEY);
  if (!object) return { version: 1, memes: [], hiddenStaticIds: [] };

  try {
    const parsed = await object.json<MemeManifest>();
    return {
      version: 1,
      memes: Array.isArray(parsed.memes) ? parsed.memes : [],
      hiddenStaticIds: Array.isArray(parsed.hiddenStaticIds)
        ? parsed.hiddenStaticIds
        : [],
    };
  } catch {
    return { version: 1, memes: [], hiddenStaticIds: [] };
  }
}

export async function writeManifest(manifest: MemeManifest) {
  await getRuntimeEnv().MEME_BUCKET.put(
    MANIFEST_KEY,
    JSON.stringify(manifest),
    { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
  );
}

export function allMemes(manifest: MemeManifest) {
  const starters = STATIC_MEMES.filter(
    (meme) => !manifest.hiddenStaticIds.includes(meme.id),
  );
  return [...manifest.memes, ...starters].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function publicMeme(meme: StoredMeme) {
  return {
    id: meme.id,
    name: meme.name,
    tag: meme.tag,
    filename: meme.filename,
    createdAt: meme.createdAt,
    downloads: meme.downloads,
    imageUrl: `/api/memes/${encodeURIComponent(meme.id)}`,
    downloadUrl: `/api/memes/${encodeURIComponent(meme.id)}?download=1`,
  };
}

export function isAuthorized(request: Request) {
  const expected = getRuntimeEnv().MEME_ADMIN_PASSWORD ?? '';
  const supplied = request.headers.get('x-admin-password') ?? '';
  if (!expected || expected.length !== supplied.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  }
  return mismatch === 0;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export function safeFilename(value: string) {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return cleaned || 'nearkat-meme';
}

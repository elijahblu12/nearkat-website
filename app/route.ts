import homeHtml from '../site/index.html?raw';
import memesHtml from '../site/memes.html?raw';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = (forwardedHost ?? request.headers.get('host') ?? requestUrl.host)
    .split(',')[0]
    .trim()
    .split(':')[0]
    .toLowerCase();
  const html = host === 'memes.nearkat.xyz' ? memesHtml : homeHtml;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}

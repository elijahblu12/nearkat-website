import memeDenHtml from '../../site/gen/index.html?raw';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(memeDenHtml, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}

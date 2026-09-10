import homeHtml from "../../../site/index.html?raw";

export async function GET() {
  return new Response(homeHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

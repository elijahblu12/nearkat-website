const UPSTREAM = "https://nearkat.app/api/nearkat/rewards";

export async function GET() {
  try {
    const upstream = await fetch(UPSTREAM, {
      headers: { accept: "application/json" },
    });

    const headers = new Headers({
      "cache-control": "public, max-age=30",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    return Response.json(
      { error: "Live NEARKAT reward data is temporarily unavailable." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}

const IMAGE_ENDPOINT = "https://image.pollinations.ai/prompt/";

const STYLES: Record<string, string> = {
  den: "dark underground tunnel, earthy textures, green signal light",
  kalahari: "Kalahari sunset, warm sand, wide African sky",
  neon: "neon green night, wet reflections, underground signal station",
  pixel: "clean 16-bit pixel art environment, crisp block shading",
  anime: "hand-painted 1990s anime background, cinematic light",
  oil: "dramatic oil-painted environment, visible brush texture",
};

function cleanText(value: unknown, limit: number) {
  return typeof value === "string"
    ? value.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim().slice(0, limit)
    : "";
}

export async function POST(request: Request) {
  let body: { prompt?: unknown; style?: unknown; seed?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "give the tunnel a direction." }, { status: 400 });
  }

  const prompt = cleanText(body.prompt, 220);
  const styleKey = cleanText(body.style, 20);
  const seed = Math.abs(Number(body.seed) || 0) % 2147483647;
  if (prompt.length < 3) {
    return Response.json({ error: "give the tunnel a direction." }, { status: 400 });
  }

  const scene = [
    "square profile-picture background only",
    "no character, no person, no animal, no mascot, no face",
    "no words, no letters, no logo, no watermark",
    STYLES[styleKey] || STYLES.den,
    `the scene requested is: ${prompt}`,
    "strong central lighting and clear negative space in the middle for a fixed foreground mascot",
    "polished digital art, high contrast, social avatar composition",
  ].join(". ");

  const url = new URL(`${IMAGE_ENDPOINT}${encodeURIComponent(scene)}`);
  url.searchParams.set("width", "1024");
  url.searchParams.set("height", "1024");
  url.searchParams.set("seed", String(seed));
  url.searchParams.set("nologo", "true");
  url.searchParams.set("safe", "true");
  url.searchParams.set("enhance", "false");

  try {
    const upstream = await fetch(url, { headers: { accept: "image/*" } });
    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.startsWith("image/")) throw new Error("background failed");

    return new Response(upstream.body, {
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "the surface went quiet. building a local tunnel." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}

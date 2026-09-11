import backFull from "./references/back-full.jpg?inline";
import dynamicPose from "./references/dynamic-pose.jpg?inline";
import faceClose from "./references/face-close.jpg?inline";
import frontFull from "./references/front-full.jpg?inline";
import sideProfile from "./references/side-profile.jpg?inline";

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/edits";
const MODEL = "gpt-image-2.5-sunburst";
const COOLDOWN_MS = 20_000;
const recentRequests = new Map<string, number>();

const PRIVATE_REFERENCES = [frontFull, faceClose, sideProfile, backFull, dynamicPose];

function cleanText(value: unknown, limit: number) {
  return typeof value === "string"
    ? value.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim().slice(0, limit)
    : "";
}

function dataUrlToBlob(dataUrl: string) {
  const match = /^data:(image\/[^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid private reference");
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}

function visitorKey(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
}

function isCoolingDown(request: Request) {
  const key = visitorKey(request);
  const now = Date.now();
  const last = recentRequests.get(key) || 0;
  if (now - last < COOLDOWN_MS) return true;
  recentRequests.set(key, now);

  if (recentRequests.size > 500) {
    for (const [visitor, time] of recentRequests) {
      if (now - time > COOLDOWN_MS * 3) recentRequests.delete(visitor);
    }
  }
  return false;
}

function generationPrompt(userPrompt: string) {
  return [
    "Create one polished square profile picture featuring the exact same original NEARKAT mascot shown across all five private reference images.",
    "Treat the references as a turnaround sheet of one character, not five different characters.",
    "IDENTITY LOCK: preserve the warm tan 3D-animated fur, cream muzzle and chest, very large vivid green irises, dark brown eye patches and round ears, thick expressive eyebrows, small dark brown nose, swept spiky head tuft, slim upright meerkat proportions, dark hands and feet, five dark back stripes, and bushy dark-brown striped tail.",
    "Keep the recognizable face, eye shape, fur colors, markings, proportions, rendering style, and species consistent with the references.",
    "The user's direction may change the pose, gesture, facial expression, clothing, accessories, props, camera angle, lighting, and environment.",
    "Show one mascot. Compose for a circular social avatar crop with the face readable at thumbnail size. No watermark or accidental text.",
    `USER DIRECTION: ${userPrompt}`,
  ].join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "the private forge needs its image key." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  let body: { prompt?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "give the kat a direction." }, { status: 400 });
  }

  const prompt = cleanText(body.prompt, 500);
  if (prompt.length < 3) {
    return Response.json({ error: "give the kat a direction." }, { status: 400 });
  }
  if (isCoolingDown(request)) {
    return Response.json(
      { error: "the forge is cooling. give it a few breaths." },
      { status: 429, headers: { "cache-control": "no-store", "retry-after": "20" } },
    );
  }

  const form = new FormData();
  form.set("model", MODEL);
  form.set("prompt", generationPrompt(prompt));
  form.set("size", "1024x1024");
  form.set("quality", "high");
  form.set("output_format", "png");
  PRIVATE_REFERENCES.forEach((reference, index) => {
    form.append("image[]", dataUrlToBlob(reference), `nearkat-reference-${index + 1}.jpg`);
  });

  try {
    const upstream = await fetch(OPENAI_IMAGES_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
    const payload = (await upstream.json()) as {
      data?: Array<{ b64_json?: string }>;
      error?: { message?: string; code?: string };
    };
    const encoded = payload.data?.[0]?.b64_json;
    if (!upstream.ok || !encoded) {
      const status = upstream.status === 429 ? 429 : upstream.status === 400 ? 400 : 502;
      return Response.json(
        {
          error:
            status === 429
              ? "too many paws at the forge. try again shortly."
              : status === 400
                ? "the forge could not use that direction. try different words."
                : "the forge lost the trail. try again.",
        },
        { status, headers: { "cache-control": "no-store" } },
      );
    }

    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    return new Response(bytes, {
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store, private",
        "content-disposition": "inline; filename=nearkat-pfp.png",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "the forge lost the trail. try again." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}

import type { APIRoute } from "astro";
import { fetchOpenGraphImageUrl } from "../../lib/server/og-image-from-url";

export const prerender = false;

/** Redirige a la imagen og:image (o 404). Uso: <img src="/api/evidence-thumb?url=…" loading="lazy" /> */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!url) {
    return new Response(null, { status: 400 });
  }

  let imageUrl: string | null;
  try {
    imageUrl = await fetchOpenGraphImageUrl(url);
  } catch {
    imageUrl = null;
  }

  if (!imageUrl) {
    return new Response(null, { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: imageUrl,
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
};

import { createFileRoute } from "@tanstack/react-router";

// Finds a pack photo of a medicine brand from an Indian online pharmacy search page.
export const Route = createFileRoute("/api/medimage")({ staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
        if (!q) return Response.json({ url: null });
        try {
          const r = await fetch(`https://pharmeasy.in/search/all?name=${encodeURIComponent(q)}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
          });
          if (!r.ok) return Response.json({ url: null });
          const html = await r.text();
          const m = html.match(/https:\/\/cdn01\.pharmeasy\.in\/dam\/products[^"\\\s?]*\.(?:jpg|jpeg|png|webp)/i);
          return Response.json({ url: m ? `${m[0]}?dim=400x400&q=75` : null });
        } catch {
          return Response.json({ url: null });
        }
      },
    },
  },
});

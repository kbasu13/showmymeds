import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const MAX_BYTES = 3 * 1024 * 1024;

async function askGemini(name: string, composition: string, apiKey: string): Promise<string[]> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: "You find product photos of medicines. Reply ONLY with a JSON array of up to 5 direct image URLs (ending in .jpg/.jpeg/.png/.webp) showing the medicine pack or tablets. Prefer Wikimedia Commons (upload.wikimedia.org), the manufacturer's website, or large pharmacy product pages (pharmeasy, apollopharmacy, netmeds, 1mg). Only include URLs you are confident exist. Reply [] if unsure." },
          { role: "user", content: `${name}${composition ? ` (${composition})` : ""}` },
        ],
      }),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const txt = j.choices?.[0]?.message?.content ?? "";
    const arr = JSON.parse(txt.slice(txt.indexOf("["), txt.lastIndexOf("]") + 1) || "[]") as unknown[];
    return arr.filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u)).slice(0, 5);
  } catch { return []; }
}

async function pharmeasy(q: string): Promise<string[]> {
  try {
    const r = await fetch(`https://pharmeasy.in/search/all?name=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA } });
    if (!r.ok) return [];
    const m = (await r.text()).match(/https:\/\/cdn01\.pharmeasy\.in\/dam\/products[^"\\\s?]*\.(?:jpg|jpeg|png|webp)/i);
    return m ? [`${m[0]}?dim=400x400&q=75`] : [];
  } catch { return []; }
}

async function commons(q: string): Promise<string[]> {
  try {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=3&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url&iiurlwidth=400`;
    const r = await fetch(u, { headers: { "User-Agent": "ShowMyMeds/1.0" } });
    const j = (await r.json()) as { query?: { pages?: Record<string, { imageinfo?: { thumburl?: string }[] }> } };
    return Object.values(j.query?.pages ?? {}).map((p) => p.imageinfo?.[0]?.thumburl).filter((x): x is string => !!x);
  } catch { return []; }
}

async function download(url: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/*" }, redirect: "follow" });
    const type = (r.headers.get("content-type") ?? "").split(";")[0]!.trim();
    if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
    const bytes = await r.arrayBuffer();
    if (bytes.byteLength < 2000 || bytes.byteLength > MAX_BYTES) return null;
    return { bytes, type };
  } catch { return null; }
}

// Finds a medicine photo online (Gemini suggestions, then pharmacy, then Wikimedia Commons),
// copies the first working image into the user's own storage folder, and returns its path.
export const Route = createFileRoute("/api/medphoto")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Please sign in." }, { status: 401 });
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const db = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}`, apikey: key } },
        });
        const { data: u } = await db.auth.getUser(token);
        if (!u.user) return Response.json({ error: "Please sign in." }, { status: 401 });

        const body = (await request.json().catch(() => null)) as { name?: string; composition?: string } | null;
        const name = (body?.name ?? "").trim().slice(0, 80);
        const composition = (body?.composition ?? "").trim().slice(0, 200);
        if (!name) return Response.json({ path: null });
        const ingredient = composition.split("+")[0]?.replace(/[\d.]+\s*(mg|mcg|g|ml|iu|%).*$/i, "").trim() ?? "";

        const apiKey = process.env["LOVABLE_API_KEY"];
        const [ai, ph] = await Promise.all([apiKey ? askGemini(name, composition, apiKey) : [], pharmeasy(name)]);
        const sources: (() => Promise<string[]>)[] = [
          async () => ai, async () => ph,
          () => commons(`${name} tablets`),
          () => (ingredient ? commons(`${ingredient} tablets`) : Promise.resolve([])),
        ];
        for (const src of sources) {
          for (const url of await src()) {
            const img = await download(url);
            if (!img) continue;
            const ext = img.type.split("/")[1] === "jpeg" ? "jpg" : img.type.split("/")[1];
            const path = `${u.user.id}/image-${crypto.randomUUID()}.${ext}`;
            const { error } = await db.storage.from("prescriptions").upload(path, img.bytes, { contentType: img.type });
            if (error) { console.error("photo upload failed", error); return Response.json({ path: null }); }
            return Response.json({ path });
          }
        }
        return Response.json({ path: null });
      },
    },
  },
});

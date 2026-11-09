import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { isValidatedAccountActive } from "@/lib/account-access.server";

export type RxItem = {
  name: string; composition: string | null; manufacturer: string | null; form: string;
  dose_qty: number; times: string[]; days: number | null; notes: string | null;
};

const FORMS = ["tablet", "capsule", "syrup", "drops", "injection", "inhaler", "cream"];

// Reads a prescription photo (incl. handwriting) stored in the user's own folder and lists the medicines on it.
export const Route = createFileRoute("/api/rxscan")({ staticData: { sitemap: false },
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
        if (!await isValidatedAccountActive(u.user.id)) return Response.json({ error: "Account access is suspended." }, { status: 403 });
        const body = (await request.json().catch(() => null)) as { path?: string } | null;
        const path = body?.path ?? "";
        if (!path.startsWith(`${u.user.id}/`)) return Response.json({ error: "Not allowed." }, { status: 403 });
        const { data: file, error } = await db.storage.from("prescriptions").download(path);
        if (error || !file) return Response.json({ error: "Could not open the photo." }, { status: 400 });
        const type = file.type || "image/jpeg";
        if (!/^image\//.test(type)) return Response.json({ error: "Please use a photo (JPG or PNG) of the prescription." }, { status: 400 });
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        const dataUrl = `data:${type};base64,${btoa(bin)}`;
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ error: "Scanning is not set up." }, { status: 500 });

        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "google/gemini-3.8-flash",
            messages: [
              { role: "system", content: "You are an expert Indian pharmacist who reads handwritten and printed doctor prescriptions. Read every medicine on the prescription carefully, correcting handwriting to real brand/generic names. Decode dosing shorthand: OD=once daily, BD/BID=twice, TDS/TID=three times, QID=four times, HS=at bedtime, 1-0-1 = morning and night, 1-1-1 = morning, afternoon, night, SOS=as needed. Reply ONLY with a JSON array; each item: {\"name\": brand name with strength, \"composition\": active ingredients with strength joined by ' + ' or null, \"manufacturer\": company short name or null, \"form\": one of tablet|capsule|syrup|drops|injection|inhaler|cream, \"dose_qty\": number per dose (ml for syrup), \"times\": array of 24h 'HH:MM' times (morning 08:00, afternoon 14:00, night 21:00, bedtime 22:00), \"days\": course length in days or null, \"notes\": e.g. 'after food' or null}. Reply [] if no medicines can be read." },
              { role: "user", content: [{ type: "text", text: "List all medicines on this prescription." }, { type: "image_url", image_url: { url: dataUrl } }] },
            ],
          }),
        });
        if (!r.ok) {
          const status = r.status === 429 || r.status === 402 ? r.status : 502;
          return Response.json({ error: r.status === 429 ? "Too many requests, please try again shortly." : r.status === 402 ? "AI credits have run out." : "Could not read the prescription." }, { status });
        }
        const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
        const txt = j.choices?.[0]?.message?.content ?? "";
        let raw: unknown[] = [];
        try { raw = JSON.parse(txt.slice(txt.indexOf("["), txt.lastIndexOf("]") + 1) || "[]"); } catch { raw = []; }
        const items: RxItem[] = raw.flatMap((x) => {
          const o = x as Record<string, unknown>;
          const name = typeof o["name"] === "string" ? o["name"].trim().slice(0, 120) : "";
          if (!name) return [];
          const s = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
          const times = Array.isArray(o["times"]) ? (o["times"] as unknown[]).filter((t): t is string => typeof t === "string" && /^\d{2}:\d{2}$/.test(t)).slice(0, 6) : [];
          return [{
            name, composition: s(o["composition"], 300), manufacturer: s(o["manufacturer"], 80),
            form: FORMS.includes(String(o["form"])) ? String(o["form"]) : "tablet",
            dose_qty: Number(o["dose_qty"]) > 0 ? Number(o["dose_qty"]) : 1,
            times: times.length ? times : ["08:00"],
            days: Number(o["days"]) > 0 ? Math.round(Number(o["days"])) : null,
            notes: s(o["notes"], 200),
          }];
        });
        return Response.json({ items });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export const Route = createFileRoute("/api/composition")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Please sign in." }, { status: 401 });
        const db = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u } = await db.auth.getUser(token);
        if (!u.user) return Response.json({ error: "Please sign in." }, { status: 401 });

        const body = (await request.json().catch(() => null)) as { name?: string } | null;
        const name = (body?.name ?? "").trim().slice(0, 120);
        if (!name) return Response.json({ error: "Enter a name first." }, { status: 400 });
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ error: "Lookup is not set up." }, { status: 500 });

        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });
        try {
          const result = streamText({
            model: provider.responses("openai/gpt-6-astra"),
            providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
            system:
              "You are a pharmacist database. Given a medicine brand or generic name (any country, including India), reply with ONLY its full active composition: every active ingredient with strength, separated by ' + ', e.g. 'Paracetamol 500mg + Caffeine 30mg'. If several strengths exist, give the most common one. If you do not recognise it, reply exactly UNKNOWN.",
            prompt: name,
          });
          const text = await result.text;
          const c = text.trim().replace(/^["']|["']$/g, "");
          return Response.json({ composition: !c || /^UNKNOWN/i.test(c) ? null : c.slice(0, 300) });
        } catch (e) {
          console.error("composition lookup failed", e);
          return Response.json({ error: "Lookup failed, please try again." }, { status: 502 });
        }
      },
    },
  },
});

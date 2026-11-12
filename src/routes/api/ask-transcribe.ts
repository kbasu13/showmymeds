import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isValidatedAccountActive } from "@/lib/account-access.server";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai/run-id.server";

const MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = {
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/aac": "aac", "audio/flac": "flac",
};

export const Route = createFileRoute("/api/ask-transcribe")({ staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Please sign in." }, { status: 401 });
        const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
        const db = createClient<Database>(process.env['SUPABASE_URL']!, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              h.set("apikey", key);
              h.set("Authorization", `Bearer ${token}`);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data: u } = await db.auth.getUser(token);
        if (!u.user) return Response.json({ error: "Please sign in." }, { status: 401 });
        if (!await isValidatedAccountActive(u.user.id)) return Response.json({ error: "Account access is suspended." }, { status: 403 });
        const { data: prem } = await db.from("premium_users").select("user_id, expires_at").eq("user_id", u.user.id).maybeSingle();
        if (!prem || (prem.expires_at && new Date(prem.expires_at) <= new Date())) return Response.json({ error: "Ask is a Premium feature." }, { status: 403 });

        const fd = await request.formData().catch(() => null);
        const file = fd?.get("file");
        if (!(file instanceof Blob)) return Response.json({ error: "No recording was received. Please try again." }, { status: 400 });
        if (file.size === 0) return Response.json({ error: "The recording was empty. Please try again." }, { status: 400 });
        if (file.size > MAX_BYTES) return Response.json({ error: "That recording is too long. Please keep it under a minute." }, { status: 400 });
        const mime = (file.type || "audio/webm").split(";")[0]!.trim().toLowerCase();
        if (!mime.startsWith("audio/")) return Response.json({ error: "That file is not a recording." }, { status: 400 });

        const apiKey = process.env['LOVABLE_API_KEY'];
        if (!apiKey) return Response.json({ error: "The assistant is not set up yet." }, { status: 500 });

        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const form = new FormData();
        form.append("file", new Blob([await file.arrayBuffer()], { type: mime }), `voice.${EXT[mime] ?? "webm"}`);
        form.append("model", "openai/gpt-transcribe");

        let r: Response;
        try {
          r = await runIdFetch.fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
            body: form,
            signal: request.signal,
          });
        } catch {
          return Response.json({ error: "Voice input is not available right now. Please type your question." }, { status: 502 });
        }

        const j = (await r.json().catch(() => ({}))) as { text?: string; message?: string; error?: { message?: string } };
        if (!r.ok) {
          const msg = j.message ?? j.error?.message ?? "Voice input is not available right now. Please type your question.";
          return withLovableAiGatewayRunIdHeader(Response.json({ error: msg }, { status: r.status }), runIdFetch);
        }
        const text = (j.text ?? "").trim();
        if (!text) return Response.json({ error: "I could not hear anything. Please try again." }, { status: 400 });
        return withLovableAiGatewayRunIdHeader(Response.json({ text }), runIdFetch);
      },
    },
  },
});

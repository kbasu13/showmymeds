import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai/run-id.server";

const INSTRUCTIONS = `You are ShowMyMeds' friendly helper for older adults and their families.
Use the user's medicine list and recent dose history below to answer clearly in short, simple sentences.
You may explain common side effects and general information, but never diagnose, never change doses,
and always suggest speaking to a doctor or pharmacist for medical decisions. In an emergency, tell them to call local emergency services.`;

export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Please sign in." }, { status: 401 });
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const db = createClient<Database>(process.env.SUPABASE_URL!, key, {
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
        const { data: prem } = await db.from("premium_users").select("user_id").eq("user_id", u.user.id).maybeSingle();
        if (!prem) return Response.json({ error: "Ask is a Premium feature." }, { status: 403 });

        const body = (await request.json().catch(() => null)) as { messages?: { role: string; text: string }[] } | null;
        const messages: ModelMessage[] = (body?.messages ?? [])
          .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
          .slice(-20)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.text.slice(0, 4000) }));
        if (!messages.length) return Response.json({ error: "Please type a question." }, { status: 400 });

        const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
        const [{ data: meds }, { data: logs }] = await Promise.all([
          db.from("medicines").select("*").eq("user_id", u.user.id),
          db.from("dose_logs").select("*").eq("user_id", u.user.id).gte("scheduled_date", since),
        ]);
        const context = `Today is ${new Date().toISOString().slice(0, 10)}.\nMedicines: ${JSON.stringify(meds ?? [])}\nDoses taken in last 30 days: ${JSON.stringify(logs ?? [])}`;

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return Response.json({ error: "The assistant is not set up yet." }, { status: 500 });
        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });
        let failure: string | undefined;
        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          instructions: `${INSTRUCTIONS}\n\n${context}`,
          messages,
          abortSignal: request.signal,
          onError: ({ error }) => {
            failure = (error as Error)?.message;
            console.error("Ask failed", error);
          },
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });
        void failure;
        return withLovableAiGatewayRunIdHeader(result.toTextStreamResponse(), runIdFetch);
      },
    },
  },
});

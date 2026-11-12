import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import type { Database } from "@/integrations/supabase/types";
import { isValidatedAccountActive } from "@/lib/account-access.server";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai/run-id.server";

const INSTRUCTIONS = `You are ShowMyMeds' friendly helper for older adults and their families.
Use the user's medicine list and recent dose history below to answer clearly in short, simple sentences.
You may explain common side effects and general information, but never diagnose, never change doses,
and always suggest speaking to a doctor or pharmacist for medical decisions. In an emergency, tell them to call local emergency services.
Users may also ask you to check medicines a doctor has prescribed before they take them: explain what each is usually for, common side effects, and any obvious interactions or duplicates with their current list, then advise confirming with the doctor or pharmacist.
Users may attach a photo (a prescription, medicine strip, pack or report) or a PDF document. Read what is attached,
say briefly what you can see, then answer their question. If an attachment is unclear or unreadable, say so and ask for a clearer photo.
Medicines can be allopathic, homeopathic, Ayurvedic or Unani.
If the user asks to ADD a medicine to their list, collect name, how many each time, and times (ask briefly for anything missing; assume form "tablet" unless said). Then, after a short confirmation sentence, append EXACTLY one fenced block per medicine like:
\`\`\`add-medicine
{"name":"Dolo 650","form":"tablet","dose_qty":1,"times":["08:00","20:00"],"composition":"Paracetamol 650mg","manufacturer":"Micro Labs","stock":0,"start_date":"YYYY-MM-DD","end_date":null,"notes":null}
\`\`\`
form must be one of tablet, capsule, syrup, drops, injection, inhaler, cream; times are 24-hour HH:MM. You cannot save it yourself — the app shows an "Add" button to the user.
Format every answer in Markdown so it is easy to read: a short bold one-line summary first, then "###" headings for sections, bullet points for lists, short paragraphs with blank lines between them. Keep it concise.`;

const IMG_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", heic: "image/heic", heif: "image/heif", bmp: "image/bmp",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function base64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/** Only the user's own freshly attached files, never anyone else's. */
function safePath(path: unknown, userId: string) {
  if (typeof path !== "string" || path.includes("..") || path.includes("\\")) return null;
  return path.startsWith(`${userId}/`) ? path : null;
}

export const Route = createFileRoute("/api/ask")({ staticData: { sitemap: false },
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

        const body = (await request.json().catch(() => null)) as
          | { messages?: { role: string; text: string }[]; attachment?: { path?: string } }
          | null;
        const messages: ModelMessage[] = (body?.messages ?? [])
          .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
          .slice(-20)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.text.slice(0, 4000) }));

        const attachPath = safePath(body?.attachment?.path, u.user.id);
        if (attachPath) {
          const { data: blob, error } = await db.storage.from("prescriptions").download(attachPath);
          if (error || !blob) return Response.json({ error: "I could not open that attachment. Please attach it again." }, { status: 400 });
          const ext = (attachPath.split(".").pop() ?? "").toLowerCase();
          const isPdf = ext === "pdf" || blob.type === "application/pdf";
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const last = messages[messages.length - 1];
          if (last && isPdf) {
            let doc = "";
            try {
              const { extractText, getDocumentProxy } = await import("unpdf");
              const parsed = await extractText(await getDocumentProxy(bytes), { mergePages: true });
              doc = (typeof parsed.text === "string" ? parsed.text : String(parsed.text)).trim();
            } catch {
              doc = "";
            }
            const note = doc
              ? `\n\n[Text from the attached PDF]\n${doc.slice(0, 12000)}`
              : "\n\n[The attached PDF had no readable text — it may be a scanned picture. Ask for a clearer photo.]";
            last.content = `${typeof last.content === "string" ? last.content : ""}${note}`;
          } else if (last) {
            const mime = blob.type || IMG_EXT[ext] || "image/jpeg";
            if (!mime.startsWith("image/")) return Response.json({ error: "That attachment is not a photo or PDF." }, { status: 400 });
            if (bytes.length > MAX_IMAGE_BYTES) return Response.json({ error: "That photo is too large. Please attach a smaller one." }, { status: 400 });
            last.content = [
              { type: "text", text: typeof last.content === "string" ? last.content : "" },
              { type: "image", image: `data:${mime};base64,${base64(bytes)}`, mediaType: mime },
            ];
          }
        }

        if (!messages.length) return Response.json({ error: "Please type a question." }, { status: 400 });

        const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
        const [{ data: meds }, { data: logs }] = await Promise.all([
          db.from("medicines").select("*").eq("user_id", u.user.id),
          db.from("dose_logs").select("*").eq("user_id", u.user.id).gte("scheduled_date", since),
        ]);
        const context = `Today is ${new Date().toISOString().slice(0, 10)}.\nMedicines: ${JSON.stringify(meds ?? [])}\nDoses taken in last 30 days: ${JSON.stringify(logs ?? [])}`;

        const apiKey = process.env['LOVABLE_API_KEY'];
        if (!apiKey) return Response.json({ error: "The assistant is not set up yet." }, { status: 500 });
        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });
        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          instructions: `${INSTRUCTIONS}\n\n${context}`,
          messages,
          abortSignal: request.signal,
          onError: ({ error }) => {
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
        return withLovableAiGatewayRunIdHeader(result.toTextStreamResponse(), runIdFetch);
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/meds";
import { usePremium, UpgradeCard } from "@/components/Premium";

export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({ meta: [{ title: "Ask — ShowMyMeds" }, { name: "description", content: "Ask questions about your doses and side effects." }] }),
  component: AskPage,
});

type Msg = { role: "user" | "assistant"; text: string };

function AskPage() {
  const { data: user } = useUser();
  const { data: premium, isLoading } = usePremium(user?.id);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Hello! Ask me about your dose history, possible side effects, or check medicines your doctor has prescribed before you take them." },
  ]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading) return <p>Loading…</p>;
  if (!premium) {
    return <UpgradeCard feature="Ask" text="Chat about your medicines, dose history and side effects." />;
  }

  const send = async () => {
    if (!q.trim() || busy) return;
    const history = [...msgs.slice(1), { role: "user" as const, text: q }];
    setMsgs((m) => [...m, { role: "user", text: q }, { role: "assistant", text: "…" }]);
    setQ("");
    setBusy(true);
    const put = (text: string) => setMsgs((m) => [...m.slice(0, -1), { role: "assistant", text }]);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ messages: history }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        put(j.error ?? j.message ?? "Sorry, something went wrong. Please try again later.");
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        put(text);
      }
      if (!text) put("Sorry, I couldn't answer that right now. Please try again later.");
    } catch {
      put("Sorry, something went wrong. Please try again later.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[70vh] flex-col gap-3">
      <h1 className="text-2xl font-semibold text-primary">Ask</h1>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border bg-card p-4">
        {msgs.map((m, i) => (
          m.role === "user"
            ? <p key={i} className="ml-auto max-w-[85%] rounded-xl bg-primary p-3 text-lg text-primary-foreground">{m.text}</p>
            : <div key={i} className="max-w-[90%] space-y-2 rounded-xl bg-secondary p-3 text-base leading-relaxed [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-primary [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1"><ReactMarkdown>{m.text}</ReactMarkdown></div>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <Input className="h-12 text-lg" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type your question" />
        <Button type="submit" size="icon" aria-label="Send" disabled={busy}><Send /></Button>
      </form>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUser, FORMS, lookupMedicineImage } from "@/lib/meds";
import { joinTimes, doseText } from "@/lib/schedule";
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
            : <div key={i} className="max-w-[90%] space-y-2"><div className=" space-y-2 rounded-xl bg-secondary p-3 text-base leading-relaxed [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-primary [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1"><ReactMarkdown>{stripBlocks(m.text)}</ReactMarkdown></div>
                {user && parseBlocks(m.text).map((d, j) => <AddCard key={j} med={d} userId={user.id} />)}</div>
        ))}
      </div>
      <form className="relative" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <Input className="h-12 pr-14 text-lg" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you want to know today?" />
        <Button type="submit" size="icon" aria-label="Send" disabled={busy} className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2"><Send /></Button>
      </form>
    </div>
  );
}

type Draft = { name: string; form?: string; dose_qty?: number; times?: string[]; composition?: string | null; manufacturer?: string | null; stock?: number; start_date?: string; end_date?: string | null; notes?: string | null };
const BLOCK = /```add-medicine\s*([\s\S]*?)```/g;
function stripBlocks(t: string) { return t.replace(BLOCK, "").replace(/```add-medicine[\s\S]*$/, ""); }
function parseBlocks(t: string): Draft[] {
  const out: Draft[] = [];
  for (const m of t.matchAll(BLOCK)) { try { const d = JSON.parse(m[1]!); if (d?.name) out.push(d); } catch { /* partial */ } }
  return out;
}

function AddCard({ med, userId }: { med: Draft; userId: string }) {
  const qc = useQueryClient();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const form = FORMS.some((f) => f.id === med.form) ? med.form! : "tablet";
  const times = (med.times ?? []).filter((t) => /^\d{2}:\d{2}$/.test(t));
  const add = async () => {
    setState("busy");
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from("medicines").insert({
      user_id: userId, name: med.name.slice(0, 120), form, dose_qty: Math.max(1, Number(med.dose_qty) || 1),
      times: times.length ? times : ["08:00"], composition: med.composition ?? null, manufacturer: med.manufacturer ?? null,
      stock: Math.max(0, Number(med.stock) || 0), start_date: /^\d{4}-\d{2}-\d{2}$/.test(med.start_date ?? "") ? med.start_date! : today,
      end_date: /^\d{4}-\d{2}-\d{2}$/.test(med.end_date ?? "") ? med.end_date! : null, notes: med.notes ?? null,
    }).select("id").single();
    if (error) { toast.error("Could not add the medicine. Please try again."); setState("idle"); return; }
    setState("done");
    toast.success(`${med.name} added to your medicines`);
    qc.invalidateQueries({ queryKey: ["meds"] });
    lookupMedicineImage(med.name, med.composition, form).then(async (img) => {
      if (img && data) { await supabase.from("medicines").update({ image_url: img }).eq("id", data.id); qc.invalidateQueries({ queryKey: ["meds"] }); }
    }).catch(() => {});
  };
  return (
    <div className="rounded-xl border bg-card p-3 text-base">
      <p className="font-semibold text-primary">{med.name}</p>
      {med.composition && <p className="text-sm text-muted-foreground">{med.composition}</p>}
      <p className="text-sm">{doseText(Math.max(1, Number(med.dose_qty) || 1), form)} at {joinTimes(times.length ? times : ["08:00"])}</p>
      <Button size="sm" className="mt-2" disabled={state !== "idle"} onClick={add}>
        {state === "done" ? <><Check /> Added</> : <><Plus /> Add to my medicines</>}
      </Button>
    </div>
  );
}

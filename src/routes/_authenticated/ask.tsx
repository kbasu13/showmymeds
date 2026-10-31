import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/meds";

export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({ meta: [{ title: "Ask — ShowMyMeds" }, { name: "description", content: "Ask questions about your doses and side effects." }] }),
  component: AskPage,
});

type Msg = { role: "user" | "assistant"; text: string };

function AskPage() {
  const { data: user } = useUser();
  const { data: premium, isLoading } = useQuery({
    queryKey: ["premium", user?.id],
    enabled: !!user,
    queryFn: async () => !!(await supabase.from("premium_users").select("user_id").maybeSingle()).data,
  });
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Hello! Ask me about your dose history or possible side effects." },
  ]);
  const [q, setQ] = useState("");

  if (isLoading) return <p>Loading…</p>;
  if (!premium) {
    return (
      <div className="space-y-4 rounded-2xl bg-hero p-8 text-center">
        <Lock className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-3xl font-bold text-primary">Ask is a Premium feature</h1>
        <p className="text-lg">Chat about your medicines, dose history and side effects. Ask the app administrator to turn on Premium for your account.</p>
      </div>
    );
  }

  const send = () => {
    if (!q.trim()) return;
    setMsgs((m) => [...m, { role: "user", text: q }, {
      role: "assistant",
      text: "Thanks for your question. The assistant is coming soon — for medical advice please speak to your doctor or pharmacist.",
    }]);
    setQ("");
  };

  return (
    <div className="flex h-[70vh] flex-col gap-3">
      <h1 className="text-4xl font-bold text-primary">Ask</h1>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border bg-card p-4">
        {msgs.map((m, i) => (
          <p key={i} className={`max-w-[85%] rounded-2xl p-3 text-lg ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary"}`}>{m.text}</p>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <Input className="h-12 text-lg" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type your question" />
        <Button type="submit" size="icon" aria-label="Send"><Send /></Button>
      </form>
    </div>
  );
}

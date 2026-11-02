import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, MessageSquare, Mail, Share2, Copy, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/meds";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({ meta: [{ title: "Family & caregivers — ShowMyMeds" }, { name: "description", content: "Invite family to help with your medicines." }] }),
  component: FamilyPage,
});

const DEFAULT_MSG =
  "Hi! I'm using ShowMyMeds to keep track of my medicines. Please join as my caregiver so you can see if I've taken them: {link}";

function FamilyPage() {
  const { data: user } = useUser();
  const qc = useQueryClient();
  const [msg, setMsg] = useState(DEFAULT_MSG);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => { const s = localStorage.getItem("smm-invite-msg"); if (s) setMsg(s); }, []);
  useEffect(() => { localStorage.setItem("smm-invite-msg", msg); }, [msg]);

  const { data: links = [] } = useQuery({
    queryKey: ["links", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("caregiver_links").select("*").order("created_at")).data ?? [],
  });
  const caring = links.filter((l) => l.caregiver_id === user?.id && l.status === "accepted");
  const mine = links.filter((l) => l.patient_id === user?.id);

  const { data: names = {} } = useQuery({
    queryKey: ["names", caring.map((c) => c.patient_id).join()],
    enabled: caring.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name").in("id", caring.map((c) => c.patient_id));
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.display_name]));
    },
  });

  const getLink = async () => {
    if (link) return link;
    const { data, error } = await supabase.from("caregiver_links").insert({ patient_id: user!.id }).select().single();
    if (error) { toast.error(error.message); return null; }
    const url = `${window.location.origin}/invite/${data.invite_token}`;
    setLink(url);
    qc.invalidateQueries({ queryKey: ["links"] });
    return url;
  };

  const send = async (via: "whatsapp" | "sms" | "email" | "share" | "copy") => {
    const url = await getLink();
    if (!url) return;
    const text = msg.includes("{link}") ? msg.replace("{link}", url) : `${msg} ${url}`;
    const enc = encodeURIComponent(text);
    if (via === "whatsapp") window.open(`https://wa.me/?text=${enc}`, "_blank");
    if (via === "sms") window.location.href = `sms:?&body=${enc}`;
    if (via === "email") window.location.href = `mailto:?subject=${encodeURIComponent("Be my ShowMyMeds caregiver")}&body=${enc}`;
    if (via === "share") {
      if (navigator.share) await navigator.share({ title: "ShowMyMeds", text }).catch(() => {});
      else { await navigator.clipboard.writeText(text); toast.success("Message copied"); }
    }
    if (via === "copy") { await navigator.clipboard.writeText(text); toast.success("Message copied"); }
  };

  const revoke = async (id: string) => {
    await supabase.from("caregiver_links").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["links"] });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-primary">Family</h1>

      <section className="space-y-3 rounded-xl border bg-card p-4 shadow-soft">
        <h2 className="text-lg font-semibold">Invite a caregiver</h2>
        <p className="text-muted-foreground">They'll only see your medicines and doses — nothing else. You can remove them anytime.</p>
        <label className="block font-bold" htmlFor="msg">Your message (you can change it)</label>
        <Textarea id="msg" rows={4} className="text-lg" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <p className="text-sm text-muted-foreground">{"{link}"} is replaced with your private invite link.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => send("whatsapp")}><MessageCircle /> WhatsApp</Button>
          <Button onClick={() => send("sms")}><MessageSquare /> SMS</Button>
          <Button onClick={() => send("email")}><Mail /> Email</Button>
          <Button variant="outline" onClick={() => send("share")}><Share2 /> More…</Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => send("copy")}><Copy /> Copy message</Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">People who can see my medicines</h2>
        {mine.filter((l) => l.status === "accepted").length === 0 && <p className="text-muted-foreground">No one yet.</p>}
        {mine.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-xl border bg-card p-3">
            <span>{l.status === "accepted" ? "Caregiver connected" : "Invite not yet accepted"} · {new Date(l.created_at).toLocaleDateString()}</span>
            <Button variant="ghost" size="sm" onClick={() => revoke(l.id)}><Trash2 /> Remove</Button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">People I care for</h2>
        {caring.length === 0 && <p className="text-muted-foreground">When someone invites you, they'll appear here.</p>}
        {caring.map((c) => (
          <Link key={c.id} to="/family/$patientId" params={{ patientId: c.patient_id }}
            className="flex min-h-16 items-center justify-between rounded-xl border bg-card p-4 text-xl font-bold">
            {names[c.patient_id] ?? "Family member"} <ChevronRight />
          </Link>
        ))}
      </section>
    </div>
  );
}

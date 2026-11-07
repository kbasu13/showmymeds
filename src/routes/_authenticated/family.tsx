import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InvitationButtons } from "@/components/InvitationButtons";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/meds";
import { usePremium, PremiumBadge, UpgradeCard } from "@/components/Premium";
import { inviteSchema, inviteExpired, invitationText, openInvitation, type SharingMethod } from "@/lib/invitations";
export const Route = createFileRoute("/_authenticated/family")({ head: () => ({ meta: [{ title: "Family & caregivers — ShowMyMeds" }, { name: "description", content: "Invite family to help with your medicines." }, { property: "og:title", content: "Family & caregivers — ShowMyMeds" }, { property: "og:description", content: "Invite family to help with your medicines." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: FamilyPage });
function FamilyPage() {
  const { data: user } = useUser(); const qc = useQueryClient(); const { data: premium } = usePremium(user?.id);
  const [msg, setMsg] = useState("Hi! I'm using ShowMyMeds to keep track of my medicines. Please join as my caregiver so you can see if I've taken them: {link}");
  const [recipient, setRecipient] = useState(""), [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ["links", user?.id], enabled: !!user, queryFn: async () => { const { data, error } = await supabase.rpc("list_named_caregiver_links"); if (error) throw error; return data; } });
  const links = query.data ?? [], caring = links.filter((l) => l.caregiver_id === user?.id && l.status === "accepted"), mine = links.filter((l) => l.patient_id === user?.id);
  const send = async (method: SharingMethod) => {
    if (!user || busy) return; setBusy(true);
    try {
      const details = inviteSchema.parse({ recipient, method, message: msg });
      const { data, error } = await supabase.from("caregiver_links").insert({ patient_id: user.id, recipient_name: details.recipient, share_method: method, invite_message: msg }).select().single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["links"] });
      await openInvitation(method, invitationText(msg, `https://showmymeds.lovable.app/invite/${data.invite_token}`));
      if (method === "copy") toast.success("Invite copied");
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast.error(error instanceof Error ? error.message : "Could not share invite"); }
    finally { setBusy(false); }
  };
  const revoke = async (id: string) => { const { error } = await supabase.from("caregiver_links").delete().eq("id", id); if (error) { toast.error(error.message); return; } await qc.invalidateQueries({ queryKey: ["links"] }); };
  return <div className="space-y-6"><h1 className="flex items-center gap-2 text-2xl font-semibold text-primary">Family <PremiumBadge /></h1>
    {!premium ? <UpgradeCard feature="Family sharing" text="Invite family members to see whether you have taken your medicines." /> : <section className="space-y-3">
      <h2 className="text-lg font-semibold">Invite a caregiver</h2><p className="text-sm text-muted-foreground">They can see your medicines and doses. Unaccepted invites expire in 15 days.</p>
      <label className="block space-y-1 font-medium">Who are you inviting?<Input placeholder="Their name" value={recipient} onChange={(e) => setRecipient(e.target.value)} /></label>
      <label className="block space-y-1 font-medium">Your message<Textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
      <InvitationButtons busy={busy} onSend={send} /><p className="text-xs text-muted-foreground">The selected sharing option is recorded; message delivery cannot be confirmed.</p>
    </section>}
    <section className="space-y-3"><h2 className="text-lg font-semibold">People who can see my medicines</h2>
      {query.isError && <p role="alert" className="text-destructive">Could not load invitations.</p>}
      {!mine.length && <p className="text-muted-foreground">No one yet.</p>}
      {mine.map((l) => { const expired = l.status !== "accepted" && inviteExpired(l.created_at); return <div key={l.id} className="flex items-center gap-2 border-b py-3"><div className="min-w-0 flex-1"><p className="break-words font-semibold">{l.status === "accepted" ? l.caregiver_name : l.recipient_name || "Caregiver invitation"}</p><p className="text-xs text-muted-foreground">{l.status === "accepted" ? "Caregiver connected" : expired ? "Expired · send a new invite" : "Awaiting acceptance"} · {l.share_method?.toUpperCase() || "Method not recorded"}</p><p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}{l.status !== "accepted" && ` · Expires ${new Date(l.expires_at).toLocaleDateString()}`}</p></div><Button variant="ghost" size="icon" aria-label={`Remove invite for ${l.recipient_name || l.caregiver_name}`} onClick={() => revoke(l.id)}><Trash2 /></Button></div>; })}
    </section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">People I care for</h2>{!caring.length && <p className="text-muted-foreground">When someone invites you, they'll appear here.</p>}{caring.map((c) => <Link key={c.id} to="/family/$patientId" params={{ patientId: c.patient_id }} className="flex min-h-12 items-center justify-between border-b py-3 font-semibold">{c.patient_name}<ChevronRight /></Link>)}</section>
  </div>;
}

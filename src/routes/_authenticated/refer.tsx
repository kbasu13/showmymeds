import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InvitationButtons } from "@/components/InvitationButtons";
import { useUser } from "@/lib/meds";
import { createReferral } from "@/lib/invitations.functions";
import { internationalPhone } from "@/lib/contact-phone";
import { openInvitation, type SharingMethod } from "@/lib/invitations";
export const Route = createFileRoute("/_authenticated/refer")({ head: () => ({ meta: [{ title: "Refer a friend — ShowMyMeds" }, { name: "description", content: "Invite someone to ShowMyMeds with your personal referral code." }, { property: "og:title", content: "Refer a friend — ShowMyMeds" }, { property: "og:description", content: "Share ShowMyMeds with someone you care about." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: ReferPage });
function ReferPage() {
  const { data: user } = useUser(); const create = useServerFn(createReferral);
  const [phone, setPhone] = useState<string | null>(null), [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("Hi! I'm using ShowMyMeds to stay on track with my medicines. Join me and make managing your medicines simpler. My referral code is {code}. Get started here: {link}");
  const [busy, setBusy] = useState(false), [code, setCode] = useState("");
  const knownPhone = user?.phone || user?.user_metadata?.['phone'] || user?.user_metadata?.['phone_number'] || "";
  const send = async (method: SharingMethod) => {
    setBusy(true);
    try { const result = await create({ data: { phone: internationalPhone(phone ?? knownPhone), recipient, message, method } }); setCode(result.code); await openInvitation(method, result.text); if (method === "copy") toast.success("Referral message copied"); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast.error(error instanceof Error ? error.message : "Could not share referral"); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5"><h1 className="text-2xl font-semibold text-primary">Refer app</h1>
    <label className="block space-y-1 font-medium">Your mobile number (with country code)<Input type="tel" placeholder="+91 98765 43210" value={phone ?? knownPhone} onChange={(e) => setPhone(e.target.value)} /></label>
    <label className="block space-y-1 font-medium">Who are you inviting?<Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Their name" /></label>
    <label className="block space-y-1 font-medium">Your message<Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
    {code && <p className="text-sm font-semibold text-primary">Your referral code: {code}</p>}<InvitationButtons busy={busy} onSend={send} />
    <p className="text-sm text-muted-foreground">Sharing records the option you choose, not delivery. New accounts are linked to you when they join through your referral link.</p>
  </div>;
}

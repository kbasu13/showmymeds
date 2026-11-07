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
import { openInvitation, referralSchema, invitationFieldErrors, invitationShareError, type InvitationErrors, type SharingMethod } from "@/lib/invitations";
export const Route = createFileRoute("/_authenticated/refer")({ head: () => ({ meta: [{ title: "Refer a friend — ShowMyMeds" }, { name: "description", content: "Invite someone to ShowMyMeds with your personal referral code." }, { property: "og:title", content: "Refer a friend — ShowMyMeds" }, { property: "og:description", content: "Share ShowMyMeds with someone you care about." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: ReferPage });
function ReferPage() {
  const { data: user } = useUser(); const create = useServerFn(createReferral);
  const [phone, setPhone] = useState<string | null>(null), [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("Hi! I'm using ShowMyMeds to stay on track with my medicines. Join me and make managing your medicines simpler. My referral code is {code}. Get started here: {link}");
  const [busy, setBusy] = useState(false), [code, setCode] = useState("");
  const [errors, setErrors] = useState<InvitationErrors>({});
  const knownPhone = user?.phone || user?.user_metadata?.['phone'] || user?.user_metadata?.['phone_number'] || "";
  const send = async (method: SharingMethod) => {
    if (!user || busy) return;
    const parsed = referralSchema.safeParse({ phone: internationalPhone(phone ?? knownPhone), recipient, message, method });
    if (!parsed.success) { setErrors(invitationFieldErrors(parsed.error)); return; }
    setErrors({}); setBusy(true);
    try { const result = await create({ data: parsed.data }); setCode(result.code); await openInvitation(method, result.text); if (method === "copy") toast.success("Referral message copied"); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast.error(invitationShareError(error, "Could not share referral. Please try again.")); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5"><h1 className="text-2xl font-semibold text-primary">Refer app</h1>
    <label className="block space-y-1 font-medium">Your mobile number (with country code)<Input type="tel" placeholder="+91 98765 43210" value={phone ?? knownPhone} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "refer-phone-error" : undefined} onChange={(e) => { setPhone(e.target.value); setErrors((current) => ({ ...current, phone: undefined })); }} /></label>
    {errors.phone && <p id="refer-phone-error" role="alert" className="text-sm text-destructive">{errors.phone}</p>}
    <label className="block space-y-1 font-medium">Who are you inviting?<Input value={recipient} aria-invalid={!!errors.recipient} aria-describedby={errors.recipient ? "refer-recipient-error" : undefined} onChange={(e) => { setRecipient(e.target.value); setErrors((current) => ({ ...current, recipient: undefined })); }} placeholder="Their name" /></label>
    {errors.recipient && <p id="refer-recipient-error" role="alert" className="text-sm text-destructive">{errors.recipient}</p>}
    <label className="block space-y-1 font-medium">Your message<Textarea rows={6} value={message} aria-invalid={!!errors.message} aria-describedby={errors.message ? "refer-message-error" : undefined} onChange={(e) => { setMessage(e.target.value); setErrors((current) => ({ ...current, message: undefined })); }} /></label>
    {errors.message && <p id="refer-message-error" role="alert" className="text-sm text-destructive">{errors.message}</p>}
    {code && <p className="text-sm font-semibold text-primary">Your referral code: {code}</p>}<InvitationButtons busy={busy} onSend={send} />
    <p className="text-sm text-muted-foreground">Sharing records the option you choose, not delivery. New accounts are linked to you when they join through your referral link.</p>
  </div>;
}

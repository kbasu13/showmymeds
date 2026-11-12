import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Gem, LifeBuoy, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/meds";
import { usePayments } from "@/lib/payments";
import { buildInvoice, type Payment } from "@/lib/invoice";
import { isPremiumActive, planLabel } from "@/lib/plans";
import { useProfileName } from "@/lib/user-profile";

export const Route = createFileRoute("/_authenticated/subscription")({ staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Manage subscription — ShowMyMeds" }, { name: "description", content: "Your ShowMyMeds Premium plan, payments and GST invoices." }, { property: "og:title", content: "Manage subscription — ShowMyMeds" }, { property: "og:description", content: "Your ShowMyMeds Premium plan, payments and GST invoices." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: SubscriptionPage,
});

const STATUS: Record<string, { t: string; c: string }> = {
  pending: { t: "Being verified", c: "bg-secondary text-foreground" },
  approved: { t: "Paid", c: "bg-success/15 text-success" },
  rejected: { t: "Not verified", c: "bg-destructive/15 text-destructive" },
};
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

function SubscriptionPage() {
  const { data: user } = useUser();
  const { name } = useProfileName();
  const payments = usePayments();
  const premium = useQuery({
    queryKey: ["premium-row", user?.id], enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      return (await supabase.from("premium_users").select("expires_at, granted_at, source").eq("user_id", user.id).maybeSingle()).data;
    },
  });
  const [share, setShare] = useState<Payment | null>(null);
  const row = premium.data;
  const active = !!row && isPremiumActive(row.expires_at);

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-primary"><Receipt className="h-7 w-7" /> Manage subscription</h1>
      <section className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">Current plan</p>
        {active ? (
          <div><p className="flex items-center gap-2 text-lg font-semibold"><Gem className="h-5 w-5 text-premium" /> Premium {row?.expires_at ? `· valid until ${d(row.expires_at)}` : "· Lifetime"}</p>
          {row?.source === "admin_grant" && <p className="mt-2 inline-block rounded-full bg-premium/15 px-3 py-1 text-sm font-semibold text-premium">🎁 Complimentary Premium — granted by ShowMyMeds</p>}</div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-lg font-semibold">Free{row?.expires_at ? ` · Premium ended ${d(row.expires_at)}` : ""}</p>
            <Button size="sm" asChild><Link to="/premium"><Gem /> Go Premium</Link></Button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payments</h2>
        {payments.data?.length === 0 && <p className="text-muted-foreground">No payments yet.</p>}
        {payments.data?.map((p) => (
          <div key={p.id} className="space-y-2 rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{planLabel(p.plan)} plan · ₹{Number(p.total).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">{d(p.created_at)}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[p.status]?.c ?? ""}`}>{STATUS[p.status]?.t ?? p.status}</span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Transaction ID</dt><dd className="font-mono break-all">{p.txn_no}</dd>
              <dt className="text-muted-foreground">UPI ref (UTR)</dt><dd className="font-mono break-all">{p.utr}</dd>
              <dt className="text-muted-foreground">Fee</dt><dd>₹{Number(p.base_amount).toFixed(2)}{p.discount_code ? ` (${p.discount_percent}% off)` : ""}</dd>
              <dt className="text-muted-foreground">GST {p.gst_percent}%</dt><dd>₹{Number(p.gst_amount).toFixed(2)}</dd>
              {p.user_gstin && <><dt className="text-muted-foreground">Your GSTIN</dt><dd className="font-mono">{p.user_gstin}</dd></>}
              {p.invoice_no && <><dt className="text-muted-foreground">Invoice no.</dt><dd className="font-mono">{p.invoice_no}</dd></>}
              {p.admin_note && <><dt className="text-muted-foreground">Note</dt><dd>{p.admin_note}</dd></>}
              {p.support_shared_at && <><dt className="text-muted-foreground">Shared with admin</dt><dd>{d(p.support_shared_at)}</dd></>}
            </dl>
            <div className="flex flex-wrap gap-2">
              {p.status === "approved" && (
                <Button size="sm" variant="outline" onClick={() => buildInvoice(p, user?.email ?? "", name)}>
                  <Download /> GST invoice
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setShare(p)}><LifeBuoy /> Share with admin</Button>
            </div>
          </div>
        ))}
      </section>
      <p className="text-xs text-muted-foreground">Payments are verified by ShowMyMeds against the UPI transaction ID, usually within a day. See our <Link to="/terms" className="underline">Terms</Link> , <Link to="/privacy" className="underline">Privacy Policy</Link> and <Link to="/refund" className="underline">Refund Policy</Link>.</p>
      {share && <ShareDialog payment={share} onClose={() => setShare(null)} />}
    </div>
  );
}

function ShareDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const [note, setNote] = useState(payment.support_note ?? "");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const send = async () => {
    if (!note.trim()) { toast.error("Please describe the problem."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("share_payment_with_admin", { _id: payment.id, _note: note });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["payments"] });
    toast.success("Shared with admin. We'll look into it.");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Share with admin</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">The admin will see this payment (transaction ID {payment.txn_no}, UTR {payment.utr}, amount and status) with your message.</p>
        <Textarea rows={4} maxLength={1000} placeholder="What went wrong? e.g. money deducted but Premium not on." value={note} onChange={(e) => setNote(e.target.value)} />
        <Button disabled={busy} onClick={send}>{busy ? "Sending…" : "Send to admin"}</Button>
      </DialogContent>
    </Dialog>
  );
}

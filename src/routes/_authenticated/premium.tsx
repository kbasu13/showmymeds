import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, Gem, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PREMIUM_PLANS, discountedPrice, withGst, upiLink, GST_PERCENT, UPI_ID, UPI_NAME } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { savePendingPayment, clearPendingPayment } from "@/components/PendingPayment";

export const Route = createFileRoute("/_authenticated/premium")({ staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Go Premium — ShowMyMeds" }, { name: "description", content: "Unlock the AI helper, doctor PDF reports, family caregivers and WhatsApp reminders." }, { property: "og:title", content: "Go Premium — ShowMyMeds" }, { property: "og:description", content: "Unlock the AI helper, doctor PDF reports, family caregivers and WhatsApp reminders." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PremiumPage,
});

const FEATURES = ["Ask — AI helper for your medicines", "PDF reports for your doctor", "Family & caregiver sharing", "WhatsApp reminders"];

function PremiumPage() {
  const [plan, setPlan] = useState<string>("yearly");
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; percent: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [paying, setPaying] = useState(false);

  async function apply() {
    setChecking(true);
    const { data, error } = await supabase.rpc("check_discount", { _code: code });
    setChecking(false);
    if (error) { toast.error(error.message.includes("not valid") || error.message.includes("expired") || error.message.includes("used") ? error.message : "This code is not valid."); return; }
    setApplied({ code: code.trim().toUpperCase(), percent: data });
    toast.success(`${data}% off applied`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Gem className="h-7 w-7 text-premium" />
        <h1 className="text-2xl font-semibold text-primary">ShowMyMeds Premium</h1>
      </div>
      <ul className="space-y-1.5 rounded-xl border bg-card p-4">
        {FEATURES.map((f) => <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" />{f}</li>)}
      </ul>
      <div className="grid gap-3 sm:grid-cols-3">
        {PREMIUM_PLANS.map((p) => (
          <button key={p.id} onClick={() => setPlan(p.id)}
            className={cn("rounded-xl border-2 bg-card p-4 text-left transition-colors", plan === p.id ? "border-primary" : "border-border")}>
            <p className="font-semibold">{p.label}</p>
            {applied && <p className="text-sm text-muted-foreground line-through">₹{p.price}</p>}
            <p className="text-primary">
              <span className="text-2xl font-bold">₹{applied ? discountedPrice(p.price, applied.percent) : p.price}</span>
              <span className="ml-1 text-sm font-normal text-muted-foreground">+ GST as applicable</span>
            </p>
            <p className="text-sm text-muted-foreground">{p.note}</p>
          </button>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-4">
        {applied ? (
          <div className="flex items-center gap-2 text-sm">
            <Ticket className="h-4 w-4 text-success" />
            <span className="flex-1"><b className="font-mono">{applied.code}</b> — {applied.percent}% off</span>
            <Button size="sm" variant="ghost" onClick={() => { setApplied(null); setCode(""); }}><X /> Remove</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">Have a discount code?</p>
            <div className="flex gap-2">
              <Input placeholder="SMM-XXXXXX" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono uppercase" />
              <Button size="sm" variant="outline" onClick={apply} disabled={!code.trim() || checking}>Apply</Button>
            </div>
            <p className="text-xs text-muted-foreground">One code per payment. Each code can be used once per person.</p>
          </div>
        )}
      </div>
      <Button size="lg" className="w-full" onClick={() => setPaying(true)}>
        Continue to payment
      </Button>
      {paying && (() => {
        const chosen = PREMIUM_PLANS.find((p) => p.id === plan)!;
        const base = applied ? discountedPrice(chosen.price, applied.percent) : chosen.price;
        return <PayDialog plan={chosen.id} label={chosen.label} base={base} code={applied?.code ?? null} onClose={() => setPaying(false)} />;
      })()}
    </div>
  );
}

function PayDialog({ plan, label, base, code, onClose }: { plan: string; label: string; base: number; code: string | null; onClose: () => void }) {
  const total = withGst(base);
  const gst = Math.round((total - base) * 100) / 100;
  const link = upiLink(total, `ShowMyMeds Premium ${label}`);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => data.user && savePendingPayment({ userId: data.user.id, plan, label, code, total, at: Date.now() }));
  }, [plan, label, code, total]);
  useEffect(() => { QRCode.toDataURL(link, { width: 280, margin: 1 }).then(setQr); }, [link]);

  const paid = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("activate_premium_paid", { _plan: plan, _code: code ?? "" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    clearPendingPayment();
    await qc.invalidateQueries({ queryKey: ["premium"] });
    toast.success("Thank you! Premium is now on.");
    navigate({ to: "/today" });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-xl">Pay with UPI</DialogTitle></DialogHeader>
        <div className="space-y-1 rounded-lg bg-secondary/50 p-3 text-base">
          <div className="flex justify-between"><span>{label} plan{code ? ` (code ${code})` : ""}</span><span>₹{base.toFixed(2)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>GST {GST_PERCENT}%</span><span>₹{gst.toFixed(2)}</span></div>
          <div className="flex justify-between border-t pt-1 text-lg font-bold"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
        </div>
        <div className="flex flex-col items-center gap-2">
          {qr ? <img src={qr} alt={`UPI QR code for ₹${total.toFixed(2)}`} className="h-64 w-64 rounded-lg border bg-white p-2" /> : <div className="h-64 w-64 animate-pulse rounded-lg bg-muted" />}
          <p className="text-center text-sm text-muted-foreground">Scan with any UPI app (GPay, PhonePe, Paytm, BHIM…).<br />Paying to <b>EMC (ShowMyMeds)</b> · {UPI_ID}</p>
          <Button variant="outline" className="w-full sm:hidden" asChild><a href={link}>Open my UPI app</a></Button>
        </div>
        <Button size="lg" className="w-full" disabled={busy} onClick={paid}>{busy ? "Please wait…" : "I have paid"}</Button>
      </DialogContent>
    </Dialog>
  );
}

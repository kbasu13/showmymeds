import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Gem, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PREMIUM_PLANS, discountedPrice } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({ meta: [{ title: "Go Premium — ShowMyMeds" }, { name: "description", content: "Unlock the AI helper, doctor PDF reports, family caregivers and WhatsApp reminders." }] }),
  component: PremiumPage,
});

const FEATURES = ["Ask — AI helper for your medicines", "PDF reports for your doctor", "Family & caregiver sharing", "WhatsApp reminders"];

function PremiumPage() {
  const [plan, setPlan] = useState<string>("yearly");
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; percent: number } | null>(null);
  const [checking, setChecking] = useState(false);

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
            {applied ? (
              <p className="text-2xl font-semibold text-primary">
                <span className="mr-2 text-base font-normal text-muted-foreground line-through">₹{p.price}</span>
                ₹{discountedPrice(p.price, applied.percent)}
              </p>
            ) : <p className="text-2xl font-semibold text-primary">₹{p.price}</p>}
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
      <Button size="lg" className="w-full" onClick={() => toast("Online payment is being set up — coming very soon.")}>
        Continue to payment
      </Button>
    </div>
  );
}

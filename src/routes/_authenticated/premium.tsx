import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PREMIUM_PLANS } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({ meta: [{ title: "Go Premium — ShowMyMeds" }, { name: "description", content: "Unlock the AI helper, doctor PDF reports, family caregivers and WhatsApp reminders." }] }),
  component: PremiumPage,
});

const FEATURES = ["Ask — AI helper for your medicines", "PDF reports for your doctor", "Family & caregiver sharing", "WhatsApp reminders"];

function PremiumPage() {
  const [plan, setPlan] = useState<string>("yearly");
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
            <p className="text-2xl font-semibold text-primary">₹{p.price}</p>
            <p className="text-sm text-muted-foreground">{p.note}</p>
          </button>
        ))}
      </div>
      <Button size="lg" className="w-full" onClick={() => toast("Online payment is being set up — coming very soon.")}>
        Continue to payment
      </Button>
    </div>
  );
}

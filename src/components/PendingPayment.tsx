import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const KEY = "smm-pending-payment";
type Pending = { userId: string; plan: string; label: string; code: string | null; total: number; at: number };

export function savePendingPayment(p: Pending) { localStorage.setItem(KEY, JSON.stringify(p)); }
export function clearPendingPayment() { localStorage.removeItem(KEY); }

/** Asks "Did you finish paying?" when a UPI payment was opened but "I have paid" was never pressed. */
export function PendingPayment({ userId, premium }: { userId: string; premium: boolean }) {
  const [p, setP] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Pending | null;
      if (!v || v.userId !== userId || Date.now() - v.at > 14 * 864e5) { clearPendingPayment(); return; }
      if (premium) { clearPendingPayment(); return; }
      // Don't interrupt the payment dialog the user is looking at right now.
      if (Date.now() - v.at < 60_000) return;
      setP(v);
    } catch { clearPendingPayment(); }
  }, [userId, premium]);
  if (!p) return null;

  const yes = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("activate_premium_paid", { _plan: p.plan, _code: p.code ?? "" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    clearPendingPayment(); setP(null);
    await qc.invalidateQueries({ queryKey: ["premium"] });
    toast.success("Thank you! Premium is now on.");
  };
  const no = () => { clearPendingPayment(); setP(null); };

  return (
    <Dialog open onOpenChange={(o) => !o && setP(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle className="text-xl">Did you finish paying?</DialogTitle></DialogHeader>
        <p>You opened a UPI payment of <b>₹{p.total.toFixed(2)}</b> for the {p.label} plan but didn't press "I have paid".</p>
        <div className="grid gap-2">
          <Button size="lg" disabled={busy} onClick={yes}>{busy ? "Please wait…" : "Yes, I paid — turn on Premium"}</Button>
          <Button variant="outline" onClick={no}>No, I didn't pay</Button>
          <Button variant="ghost" onClick={() => setP(null)}>Ask me later</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

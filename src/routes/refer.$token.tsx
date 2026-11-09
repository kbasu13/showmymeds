import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/refer/$token")({ staticData: { sitemap: false }, head: () => ({ meta: [{ title: "You've been invited — ShowMyMeds" }, { name: "description", content: "Join ShowMyMeds for medicine reminders, stock tracking and doctor-ready reports." }, { property: "og:title", content: "You've been invited to ShowMyMeds" }, { property: "og:description", content: "Make managing your medicines simpler with ShowMyMeds." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: ReferralLanding });
function ReferralLanding() {
  const { token } = Route.useParams(); const [state, setState] = useState("loading"), [error, setError] = useState("");
  useEffect(() => { let live = true; (async () => {
    const { data } = await supabase.auth.getUser(); if (!live) return;
    if (!data.user) { setState("signedout"); return; }
    const { data: accepted, error } = await supabase.rpc("claim_referral", { _token: token }); if (!live) return;
    if (error) { setError(error.message); setState("error"); return; } setState(accepted ? "accepted" : "existing");
  })(); return () => { live = false; }; }, [token]);
  return <div className="flex min-h-screen flex-col bg-hero"><main className="mx-auto w-full max-w-md flex-1 space-y-5 px-5 py-12 text-center"><h1 className="text-3xl font-semibold text-primary">You're invited to ShowMyMeds</h1><p>Medicine reminders, stock tracking and doctor-ready reports — all in one place.</p>
    {state === "loading" && <p>Opening your referral…</p>}
    {state === "signedout" && <Button asChild size="lg"><Link to="/auth" search={{ redirect: `/refer/${token}` }}>Get started for free</Link></Button>}
    {state === "error" && <p role="alert" className="text-destructive">{error}</p>}
    {(state === "accepted" || state === "existing") && <><p>{state === "accepted" ? "Your referral has been recorded. Welcome!" : "Welcome back! Referrals apply to new accounts only."}</p><Button asChild><Link to="/today">Check your medicines</Link></Button></>}
  </main><Footer /></div>;
}

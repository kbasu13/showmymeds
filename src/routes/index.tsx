import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BellRing, CalendarCheck, Users, Pill, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { ACCEPT_LINE } from "@/components/LegalPage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({ staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "ShowMyMeds — simple medicine reminders" },
      { name: "description", content: "Stay on track with ShowMyMeds: medicine reminders, dose and stock tracking, family caregiver support, and doctor-ready reports. Start managing your medicines today." },
      { property: "og:title", content: "ShowMyMeds — simple medicine reminders" },
      { property: "og:description", content: "Stay on track with ShowMyMeds: medicine reminders, dose and stock tracking, family caregiver support, and doctor-ready reports. Start managing your medicines today." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // The homepage always opens. Only a sign-in that is already in progress
    // (Google/Apple come back to "/") carries the visitor on to their page.
    const next = sessionStorage.getItem("smm-after-login");
    sessionStorage.removeItem("smm-after-login");
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      if (!next || !data.session) return;
      navigate({ to: next.startsWith("/") ? next : "/today", replace: true });
    });
  }, [navigate]);

  const features = [
    { icon: CalendarCheck, t: "One tap to mark a dose taken" },
    { icon: BellRing, t: "Loud alarm so you never miss one" },
    { icon: Pill, t: "Warns you before medicine runs out" },
    { icon: Users, t: "Family can check in on you" },
    { icon: Share2, t: "Share a doctor-ready report in one tap" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-hero">
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
        <h1 className="text-center text-4xl font-semibold leading-tight text-primary">Your medicines,<br />Made simple</h1>
        <p className="mt-4 text-center text-xl">ShowMyMeds remembers every dose, so you don't have to.</p>
        <ul className="mt-6 space-y-2">
          {features.map(({ icon: Icon, t }) => (
            <li key={t} className="flex items-center justify-center gap-3 rounded-xl bg-card/80 p-3 text-center text-base shadow-soft">
              <Icon className="h-7 w-7 shrink-0 text-primary" /> <span>{t}</span>
            </li>
          ))}
        </ul>
        <Button asChild size="lg" className="mt-6 w-full text-lg">{signedIn ? <Link to="/today" className="flex h-auto flex-col py-2 leading-tight"><span>Welcome back!</span><span>Let's check your medicines</span></Link> : <Link to="/auth">Get started for free</Link>}</Button>
        <p className="mt-5 text-center text-sm text-muted-foreground">{ACCEPT_LINE}</p>
        <nav aria-label="Legal" className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
          <Link to="/terms" className="text-primary underline">EULA</Link>
          <Link to="/privacy" className="text-primary underline">Privacy</Link>
          <Link to="/data-rights" className="text-primary underline">DPDP & GDPR</Link>
        </nav>
      </main>
      <Footer />
    </div>
  );
}

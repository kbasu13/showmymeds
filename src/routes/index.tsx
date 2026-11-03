import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BellRing, CalendarCheck, Users, Pill, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShowMyMeds — simple medicine reminders" },
      { name: "description", content: "Large, easy medicine reminders with loud alarms, low-stock alerts and family caregivers." },
      { property: "og:title", content: "ShowMyMeds — simple medicine reminders" },
      { property: "og:description", content: "Large, easy medicine reminders with loud alarms, low-stock alerts and family caregivers." },
    ],
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
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-brand text-primary"><Pill className="h-9 w-9" /></span>
        <h1 className="mt-6 text-center text-4xl font-semibold leading-tight text-primary">Your medicines,<br />Made simple</h1>
        <p className="mt-4 text-center text-xl">ShowMyMeds remembers every dose, so you don't have to.</p>
        <ul className="mt-8 space-y-3">
          {features.map(({ icon: Icon, t }) => (
            <li key={t} className="flex items-center justify-center gap-3 rounded-xl bg-card/80 p-4 text-center text-lg shadow-soft">
              <Icon className="h-7 w-7 shrink-0 text-primary" /> <span>{t}</span>
            </li>
          ))}
        </ul>
        <Button asChild size="lg" className="mt-8 w-full text-lg">{signedIn ? <Link to="/today">Go to my medicines</Link> : <Link to="/auth">Get started for free</Link>}</Button>
      </main>
      <Footer />
    </div>
  );
}

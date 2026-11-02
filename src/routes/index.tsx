import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BellRing, CalendarCheck, Users, Pill } from "lucide-react";
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
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const next = sessionStorage.getItem("smm-after-login");
        sessionStorage.removeItem("smm-after-login");
        navigate({ to: next && next.startsWith("/") ? next : "/today", replace: true });
      }
    });
  }, [navigate]);

  const features = [
    { icon: CalendarCheck, t: "One tap to mark a dose taken" },
    { icon: BellRing, t: "Loud alarm so you never miss one" },
    { icon: Pill, t: "Warns you before medicine runs out" },
    { icon: Users, t: "Family can check in on you" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-hero">
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12">
        <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand text-primary"><Pill className="h-9 w-9" /></span>
        <h1 className="mt-6 text-4xl font-semibold leading-tight text-primary">Your medicines, made simple.</h1>
        <p className="mt-4 text-xl">ShowMyMeds reminds you when to take each medicine, in big clear letters.</p>
        <ul className="mt-8 space-y-3">
          {features.map(({ icon: Icon, t }) => (
            <li key={t} className="flex items-center gap-4 rounded-xl bg-card p-4 text-lg shadow-soft">
              <Icon className="h-8 w-8 shrink-0 text-primary" /> {t}
            </li>
          ))}
        </ul>
        <Button asChild size="lg" className="mt-8 w-full"><Link to="/auth">Get started — it's free</Link></Button>
      </main>
      <Footer />
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/invite/$token")({ staticData: { sitemap: false },
  ssr: false,
  head: () => ({
    meta: [
      { title: "Caregiver invite — ShowMyMeds" },
      { name: "description", content: "You've been invited to help someone with their medicines." },
      { property: "og:title", content: "You're invited to be a caregiver on ShowMyMeds" },
      { property: "og:description", content: "Help a family member stay on track with their medicines." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "signedout" | "error" | "done">("loading");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setState("signedout");
      const { data: pid, error } = await supabase.rpc("accept_invite", { _token: token });
      if (error) { setErr(error.message); return setState("error"); }
      setState("done");
      navigate({ to: "/family/$patientId", params: { patientId: pid as string } });
    })();
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-hero">
      <main className="mx-auto max-w-md flex-1 space-y-4 px-5 py-16 text-center">
        <h1 className="text-2xl font-semibold text-primary">Caregiver invite</h1>
        {state === "loading" && <p className="text-xl">Opening your invite…</p>}
        {state === "signedout" && (
          <>
            <p className="text-xl">Someone wants your help keeping track of their medicines. Sign in or create a free account to accept.</p>
            <Button asChild size="lg"><Link to="/auth" search={{ redirect: `/invite/${token}` }}>Continue</Link></Button>
          </>
        )}
        {state === "error" && <p className="text-xl text-destructive">This invite couldn't be used: {err}</p>}
      </main>
      <Footer />
    </div>
  );
}

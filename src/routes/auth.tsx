import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Sign in — ShowMyMeds" },
      { name: "description", content: "Sign in or create your free ShowMyMeds account." },
      { property: "og:title", content: "Sign in — ShowMyMeds" },
      { property: "og:description", content: "Sign in or create your free ShowMyMeds account." },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  if (!p) return "/today";
  try {
    const u = new URL(p, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : "/today";
  } catch { return "/today"; }
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [referral, setReferral] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const dest = () => safePath(redirect);

  const submit = async (e: React.FormEvent): Promise<unknown> => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      if (!consent) { setBusy(false); return toast.error("Please agree to how we use your data"); }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin + dest(), data: { full_name: name, referral_code: referral } },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      return toast.success("Check your email to confirm your account");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error(error.message);
      return navigate({ to: dest() });
    }
  };

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const sendCode = async (): Promise<unknown> => {
    const p = phone.replace(/[^\d+]/g, "");
    if (!/^\+\d{8,15}$/.test(p)) return toast.error("Enter your mobile number with country code, e.g. +91 98765 43210");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: p });
    setBusy(false);
    if (error) return toast.error(error.message);
    setCodeSent(true);
    return toast.success("We sent a code to your phone");
  };
  const verifyCode = async (): Promise<unknown> => {
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: phone.replace(/[^\d+]/g, ""), token: code.trim(), type: "sms" });
    setBusy(false);
    if (error) return toast.error(error.message);
    return navigate({ to: dest() });
  };

  const google = (provider: "google" | "apple") => async (): Promise<unknown> => {
    sessionStorage.setItem("smm-after-login", dest());
    if (referral) sessionStorage.setItem("smm-referral", referral);
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (r.error) return toast.error(r.error.message ?? "Sign-in failed");
    if (r.redirected) return;
    return navigate({ to: dest() });
  };

  return (
    <div className="flex min-h-screen flex-col bg-hero">
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand text-primary"><Pill className="h-8 w-8" /></span>
          <h1 className="text-2xl font-semibold text-primary">ShowMyMeds</h1>
        </div>
        <p className="mb-6 text-xl">{mode === "signup" ? "Create your free account" : "Welcome back"}</p>

        <div className="space-y-3">
          <Button variant="outline" size="lg" className="w-full" onClick={google("google")}>Continue with Google</Button>
          <Button variant="outline" size="lg" className="w-full" onClick={google("apple")}>Continue with Apple</Button>
        </div>
        <div className="my-5 text-center text-muted-foreground">or use your mobile number</div>
        <div className="space-y-3">
          <Label className="text-base font-bold" htmlFor="ph">Mobile number</Label>
          <Input id="ph" type="tel" inputMode="tel" placeholder="+91 98765 43210" className="h-12 text-lg" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {codeSent && (
            <Input aria-label="Code from text message" inputMode="numeric" placeholder="6-digit code" className="h-12 text-lg" value={code} onChange={(e) => setCode(e.target.value)} />
          )}
          <Button size="lg" variant="secondary" className="w-full" disabled={busy} onClick={codeSent ? verifyCode : sendCode}>
            {codeSent ? "Sign in with code" : "Send me a code"}
          </Button>
        </div>
        <div className="my-5 text-center text-muted-foreground">or use your email</div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5"><Label className="text-base font-bold" htmlFor="n">Your name</Label>
              <Input id="n" className="h-12 text-lg" value={name} onChange={(e) => setName(e.target.value)} /></div>
          )}
          <div className="space-y-1.5"><Label className="text-base font-bold" htmlFor="e">Email</Label>
            <Input id="e" type="email" required className="h-12 text-lg" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-base font-bold" htmlFor="p">Password</Label>
            <Input id="p" type="password" required minLength={6} className="h-12 text-lg" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {mode === "signup" && (
            <>
              <div className="space-y-1.5"><Label className="text-base font-bold" htmlFor="r">Referral code (optional)</Label>
                <Input id="r" className="h-12 text-lg" value={referral} onChange={(e) => setReferral(e.target.value)} /></div>
              <label className="flex items-start gap-3 text-base">
                <input type="checkbox" className="mt-1 h-6 w-6" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                I agree that my health data is stored securely and only shared with caregivers I invite. I can delete it anytime.
              </label>
            </>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
        <Button variant="link" className="mt-4 w-full" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </Button>
      </main>
      <Footer />
    </div>
  );
}

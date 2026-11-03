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
        <div className="mb-3 flex items-center justify-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand text-primary"><Pill className="h-8 w-8" /></span>
          <h1 className="text-2xl font-semibold text-primary">ShowMyMeds</h1>
        </div>
        <p className="mb-6 text-center text-xl">{mode === "signup" ? "Create your free account" : "Welcome back"}</p>

        <p className="text-center text-muted-foreground">Continue with</p>
        <div className="mt-3 flex justify-center gap-6">
          <button type="button" aria-label="Continue with Google" onClick={google("google")}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-card shadow-soft transition-transform hover:scale-105">
            <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          </button>
          <button type="button" aria-label="Continue with Apple" onClick={google("apple")}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-foreground shadow-soft transition-transform hover:scale-105">
            <svg viewBox="0 0 24 24" className="h-9 w-9" fill="currentColor" aria-hidden="true"><path d="M16.37 1.43c0 1.14-.42 2.2-1.25 3.08-.9.95-1.98 1.5-3.15 1.4-.02-.1-.03-.22-.03-.34 0-1.1.48-2.27 1.33-3.15.42-.44.96-.8 1.6-1.09.64-.28 1.25-.44 1.82-.47.02.19.03.38.03.57h-.35zM20.9 17.1c-.4.93-.88 1.78-1.43 2.57-.75 1.07-1.37 1.81-1.84 2.22-.74.68-1.53 1.03-2.38 1.05-.61 0-1.35-.17-2.21-.53-.86-.35-1.65-.52-2.37-.52-.76 0-1.57.17-2.44.52-.87.36-1.57.54-2.11.56-.82.04-1.63-.32-2.44-1.08-.52-.45-1.17-1.22-1.94-2.31-.83-1.17-1.51-2.52-2.04-4.06C1.13 13.86.85 12.24.85 10.67c0-1.8.39-3.35 1.17-4.65A6.84 6.84 0 0 1 4.46 3.5 6.57 6.57 0 0 1 7.76 2.57c.65 0 1.5.2 2.56.6 1.05.39 1.73.6 2.03.6.22 0 .98-.24 2.27-.71 1.22-.44 2.25-.62 3.1-.55 2.29.18 4.01 1.09 5.15 2.72-2.05 1.24-3.06 2.98-3.04 5.21.02 1.74.65 3.19 1.89 4.34.56.53 1.19.95 1.88 1.24-.15.44-.31.86-.48 1.27z"/></svg>
          </button>
        </div>
        <div className="my-5 text-center text-muted-foreground">or use your mobile number</div>
        <div className="space-y-3">
          <Label className="text-lg font-semibold" htmlFor="ph">Mobile number</Label>
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
            <div className="space-y-1.5"><Label className="text-lg font-semibold" htmlFor="n">Your name</Label>
              <Input id="n" className="h-12 text-lg" value={name} onChange={(e) => setName(e.target.value)} /></div>
          )}
          <div className="space-y-1.5"><Label className="text-lg font-semibold" htmlFor="e">Email</Label>
            <Input id="e" type="email" required className="h-12 text-lg" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-lg font-semibold" htmlFor="p">Password</Label>
            <Input id="p" type="password" required minLength={6} className="h-12 text-lg" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {mode === "signup" && (
            <>
              <div className="space-y-1.5"><Label className="text-lg font-semibold" htmlFor="r">Referral code (optional)</Label>
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

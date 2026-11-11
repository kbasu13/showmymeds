import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Footer } from "./Footer";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-5 py-8 [&_h2]:pt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed">
        <Link to="/" className="text-sm text-primary underline">← ShowMyMeds home</Link>
        <h1 className="text-2xl font-semibold text-primary">{title}</h1>
        <p className="text-sm text-muted-foreground">Last updated {updated}</p>
        {children}
        <p className="border-t pt-4 text-sm text-muted-foreground">See also: <Link to="/terms" className="underline">Terms of Use (EULA)</Link> · <Link to="/privacy" className="underline">Privacy Policy</Link> · <Link to="/data-rights" className="underline">DPDP & GDPR rights</Link></p>
      </main>
      <Footer />
    </div>
  );
}

export function AcceptLine() {
  return (
    <>By creating a profile or signing in, you automatically accept our <Link to="/terms" className="text-primary underline">Terms of Use (EULA)</Link>, <Link to="/privacy" className="text-primary underline">Privacy Policy</Link> and <Link to="/data-rights" className="text-primary underline">DPDP/GDPR Data Rights policy</Link>.</>
  );
}

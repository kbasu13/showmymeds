import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/data-rights")({ staticData: { sitemap: true },
  head: () => ({ meta: [{ title: "DPDP & GDPR data rights — ShowMyMeds" }, { name: "description", content: "Your rights under India's DPDP Act 2023 and the EU GDPR when using ShowMyMeds, and how to use them." }, { property: "og:title", content: "DPDP & GDPR data rights — ShowMyMeds" }, { property: "og:description", content: "Your rights under India's DPDP Act 2023 and the EU GDPR when using ShowMyMeds, and how to use them." }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  return (
    <LegalPage title="DPDP & GDPR data rights" updated="11 November 2026">
      <p>ShowMyMeds follows India's Digital Personal Data Protection Act, 2023 (DPDP) and, for users in the EU/UK, the General Data Protection Regulation (GDPR).</p>
      <h2>Consent</h2>
      <p>By creating a profile or signing in, you give consent for us to process your data for the purposes in our Privacy Policy. Health information is processed only to provide the app to you. You can withdraw consent at any time by asking us to delete your account.</p>
      <h2>Your rights</h2>
      <ul><li><b>Access</b> — get a summary of the data we hold about you.</li><li><b>Correction</b> — fix wrong or incomplete data (most of it you can edit yourself).</li><li><b>Erasure</b> — ask us to delete your account and data, except records the law requires us to keep.</li><li><b>Portability</b> (GDPR) — download your medicine history as a report.</li><li><b>Objection and restriction</b> (GDPR) — ask us to stop certain processing.</li><li><b>Nominate</b> (DPDP) — name someone to use your rights if you cannot.</li><li><b>Grievance</b> — complain to us, and then to the Data Protection Board of India or your EU supervisory authority.</li></ul>
      <h2>How to make a request</h2>
      <p>Signed-in users: open the profile menu → Manage subscription → Share with admin and describe your request. We reply within 30 days.</p>
      <h2>Children</h2>
      <p>Users under 18 should use ShowMyMeds with a parent or guardian, who manages the account.</p>
      <h2>Data transfers</h2>
      <p>Our cloud and AI providers may process data outside India; we only use providers with appropriate safeguards.</p>
    </LegalPage>
  );
}

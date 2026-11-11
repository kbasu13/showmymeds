import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({ staticData: { sitemap: true },
  head: () => ({ meta: [{ title: "Privacy Policy — ShowMyMeds" }, { name: "description", content: "How ShowMyMeds collects, uses, stores and protects your medicine and account information." }, { property: "og:title", content: "Privacy Policy — ShowMyMeds" }, { property: "og:description", content: "How ShowMyMeds collects, uses, stores and protects your medicine and account information." }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  return (
    <LegalPage title="Privacy Policy" updated="11 November 2026">
      <p>This policy explains what ShowMyMeds collects and why. By creating a profile or signing in, you agree to it.</p>
      <h2>What we collect</h2>
      <ul><li>Account details: name, email, mobile number, profile photo from Google or Apple.</li><li>Health information you enter: medicines, doses, times, stock, prescriptions, photos and dose history.</li><li>Payments: plan, amounts, GST, UPI transaction ID, optional GSTIN and billing name. We never see your UPI PIN or bank details.</li><li>Device data for reminders: notification subscription, time zone and browser type.</li><li>Referral and caregiver invitation records (who invited whom and how).</li></ul>
      <h2>How we use it</h2>
      <ul><li>To show reminders, track doses and stock, and build doctor reports.</li><li>To share your records with caregivers you invite.</li><li>To verify payments and issue invoices.</li><li>To answer your questions with the Ask helper — your question is sent to an AI service to produce an answer.</li><li>To provide support and keep the app secure.</li></ul>
      <p>We do not sell your data or use it for advertising.</p>
      <h2>Storage and security</h2>
      <p>Data is stored on secure cloud servers with access controls, so only you, your accepted caregivers and the app owner (for support) can see it. Photos and prescriptions are kept in private storage.</p>
      <h2>How long we keep it</h2>
      <p>We keep your data while your account is active. Payment records are kept as long as tax law requires. You can ask us to delete the rest.</p>
      <h2>Your choices</h2>
      <p>You can edit or delete medicines, remove caregivers and turn off notifications at any time. See <b>DPDP & GDPR rights</b> for access, correction and deletion requests.</p>
    </LegalPage>
  );
}

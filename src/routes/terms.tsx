import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({ staticData: { sitemap: true },
  head: () => ({ meta: [{ title: "Terms of Use (EULA) — ShowMyMeds" }, { name: "description", content: "The licence terms for using the ShowMyMeds medicine reminder app, Premium plans and payments." }, { property: "og:title", content: "Terms of Use (EULA) — ShowMyMeds" }, { property: "og:description", content: "The licence terms for using the ShowMyMeds medicine reminder app, Premium plans and payments." }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  return (
    <LegalPage title="Terms of Use (EULA)" updated="11 November 2026">
      <p>These terms are an agreement between you and Effemon Consultancy (a sole proprietorship), the operator of ShowMyMeds ("we", "us"). By creating a profile or signing in, you accept them.</p>
      <h2>1. Licence</h2>
      <p>We give you a personal, non-exclusive, non-transferable licence to use ShowMyMeds for managing your own or your family's medicines. You may not copy, resell, reverse-engineer or misuse the app.</p>
      <h2>2. Not medical advice</h2>
      <p>ShowMyMeds is a reminder and record-keeping tool. Medicine details, images and answers from the Ask helper are found automatically and may be wrong. Always follow your doctor or pharmacist. Do not rely on the app in an emergency.</p>
      <h2>3. Your account</h2>
      <ul><li>Keep your sign-in details safe; you are responsible for activity on your account.</li><li>Only invite caregivers you trust — they can see and update your medicine records.</li><li>We may suspend accounts that misuse the app.</li></ul>
      <h2>4. Reminders</h2>
      <p>Reminders depend on your phone, browser, internet and settings. We cannot guarantee every reminder arrives on time.</p>
      <h2>5. Premium and payments</h2>
      <ul><li>Premium is offered monthly, yearly or lifetime at the prices shown, plus GST as applicable.</li><li>UPI payments are verified using the transaction ID (UTR) you submit; Premium starts after verification.</li><li>Submitting a false transaction ID may lead to suspension.</li><li>Payments are non-refundable except in the cases listed in our <a href="/refund" className="underline">Refund Policy</a>.</li><li>Premium features stop when your plan ends.</li></ul>
      <h2>6. Liability</h2>
      <p>The app is provided "as is". To the extent the law allows, our total liability is limited to the amount you paid us in the last 12 months.</p>
      <h2>7. Changes and law</h2>
      <p>We may update these terms; continued use means you accept the update. These terms are governed by the laws of India.</p>
    </LegalPage>
  );
}

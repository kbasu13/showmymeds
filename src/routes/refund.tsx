import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

const DESC = "When ShowMyMeds Premium payments can be refunded, how to ask for a refund and how long it takes.";

export const Route = createFileRoute("/refund")({ staticData: { sitemap: true },
  head: () => ({ meta: [{ title: "Refund Policy — ShowMyMeds" }, { name: "description", content: DESC }, { property: "og:title", content: "Refund Policy — ShowMyMeds" }, { property: "og:description", content: DESC }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  return (
    <LegalPage title="Refund Policy" updated="13 November 2026">
      <p>ShowMyMeds is operated by Effemon Consultancy, a sole proprietorship in India ("we", "us"). This policy covers payments for ShowMyMeds Premium.</p>
      <h2>1. General rule</h2>
      <p>Premium payments (monthly, yearly or lifetime) are non-refundable once Premium has been activated on your account. Not using the app, forgetting to cancel, or changing your mind does not qualify for a refund.</p>
      <h2>2. When we will refund</h2>
      <ul>
        <li><b>Duplicate payment:</b> you paid more than once for the same plan or period.</li>
        <li><b>Wrong amount:</b> you paid more than the price shown on the payment page; we refund the extra.</li>
        <li><b>Payment not activated:</b> your money left your account but we could not activate Premium (for example, we cannot verify the payment) and you do not wish to retry.</li>
        <li><b>Paid but rejected:</b> we rejected your payment submission after the money reached us.</li>
        <li><b>Service failure:</b> a Premium feature you paid for did not work for a long period because of a fault on our side and we could not fix it within 7 days of your report.</li>
        <li><b>Unauthorised payment:</b> a payment made without your permission, reported within 7 days.</li>
        <li><b>Where the law requires</b> a refund.</li>
      </ul>
      <h2>3. How to ask</h2>
      <p>Go to Manage subscription → Share with admin within 7 days of the payment and give the transaction ID (UTR), the amount and the reason. We reply within 3 working days.</p>
      <h2>4. How refunds are paid</h2>
      <ul><li>Approved refunds go back to the same UPI ID or bank account, usually within 7 working days.</li><li>Premium for the refunded payment ends when the refund is made.</li><li>Partial refunds may be made for a partly used yearly plan in a service-failure case.</li></ul>
      <h2>5. Misuse</h2>
      <p>We may refuse refunds for false transaction IDs or repeated refund requests, and may suspend such accounts.</p>
    </LegalPage>
  );
}

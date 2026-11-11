import type { Database } from "@/integrations/supabase/types";
import { AUTO_TERMS, SELLER, planLabel } from "@/lib/plans";
import { invoiceBuyerName } from "@/lib/profile-name";

export type Payment = Database["public"]["Tables"]["payments"]["Row"];

const rs = (n: number) => `Rs. ${Number(n).toFixed(2)}`;
const dt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");

/** GST invoice (approved) or payment receipt (pending/rejected) as a PDF. */
export async function buildInvoice(p: Payment, email: string, name: string = "") {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const approved = p.status === "approved";
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(approved ? "Tax Invoice" : "Payment Receipt (not an invoice)", 14, 18);
  doc.setFontSize(10);
  const seller = [SELLER.name, SELLER.address, SELLER.state, `GSTIN: ${SELLER.gstin || "To be added"}`].filter(Boolean);
  doc.text(seller, 14, 27);
  const buyer = [`Billed to: ${invoiceBuyerName(p.bill_name, name)}`, email, `GSTIN: ${p.user_gstin || "Not provided"}`];
  doc.text(buyer, 120, 27);
  autoTable(doc, {
    startY: 50,
    theme: "plain",
    body: [
      ["Invoice no.", p.invoice_no || "Issued after verification"],
      ["Transaction ID (ShowMyMeds)", p.txn_no],
      ["UPI / bank transaction ID (UTR)", p.utr],
      ["Payment date", dt(p.created_at)],
      ["Status", p.status === "approved" ? "Paid and verified" : p.status === "pending" ? "Waiting for verification" : "Rejected"],
      ["Premium valid until", approved ? (p.premium_until ? dt(p.premium_until) : "Lifetime") : "-"],
    ],
  });
  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: y,
    head: [["Description", "Amount"]],
    body: [
      [`ShowMyMeds Premium - ${planLabel(p.plan)} plan${p.discount_code ? ` (code ${p.discount_code}, ${p.discount_percent}% off)` : ""}`, rs(p.base_amount)],
      [`GST @ ${p.gst_percent}%`, rs(p.gst_amount)],
      [{ content: "Total paid", styles: { fontStyle: "bold" } }, { content: rs(p.total), styles: { fontStyle: "bold" } }],
    ],
    headStyles: { fillColor: [40, 90, 120] },
  });
  const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(`${AUTO_TERMS} Terms accepted on ${dt(p.terms_accepted_at)}.`, 180), 14, y2);
  doc.text("This is a computer-generated document and needs no signature.", 14, y2 + 14);
  doc.save(`ShowMyMeds-${approved ? "invoice" : "receipt"}-${p.txn_no}.pdf`);
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayButton } from "@/components/pay/PayButton";
import { Container, Section } from "@/components/ui/Layout";
import { FactList } from "@/components/ui/FactList";
import { CUSTOMER_STATUS_LABELS, formatMinor, isPayable, normaliseReference } from "@/lib/billing/model";
import { getPublicInvoice } from "@/lib/billing/public-data";
import styles from "./pay.module.css";

/**
 * The customer payment page: /pay/GG-INV-2026-00001.
 *
 * Shows exactly what a payer needs and nothing else — Go Gulf, the invoice number, the
 * service, the amount, and where it stands. It is read through public_invoice_view, an
 * explicit column allow-list, so it cannot show a staff note, a billing address, a contact,
 * an internal id, an audit entry or anything about Supabase or Razorpay's credentials.
 *
 * Never cached and never indexed: the status must be live, and a payment link is for the
 * person it was sent to, not for a search engine. English only, like the other
 * transactional pages.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pay an invoice",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PayPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference: raw } = await params;
  const reference = normaliseReference(decodeURIComponent(raw));
  if (!reference) notFound();

  const invoice = await getPublicInvoice(reference);
  if (!invoice) notFound();

  const payable = isPayable(invoice.status);

  return (
    <Section>
      <Container>
        <div className={styles.card}>
          <div>
            <p className={styles.note}>Go Gulf · Invoice</p>
            <h1 className={styles.amount}>{formatMinor(invoice.totalMinor)}</h1>
          </div>

          <FactList
            items={[
              { key: "number", label: "Invoice number", value: invoice.reference, mono: true },
              { key: "service", label: "Service", value: invoice.purpose },
              { key: "status", label: "Payment status", value: <span className={styles.status}>{CUSTOMER_STATUS_LABELS[invoice.status]}</span> },
            ]}
          />

          {payable ? (
            <>
              <PayButton reference={invoice.reference} label={`Pay ${formatMinor(invoice.totalMinor)} securely`} />
              <p className={styles.note}>
                Payments are handled by Razorpay, a regulated payment gateway. You enter your card, UPI or bank details on Razorpay&apos;s own secure window — Go Gulf never sees or stores them.
              </p>
            </>
          ) : invoice.status === "paid" ? (
            <p role="status">Payment received. Thank you — there is nothing more to do.</p>
          ) : (
            <p role="status">This invoice cannot be paid online. If you believe that is a mistake, please contact Go Gulf.</p>
          )}
        </div>
      </Container>
    </Section>
  );
}

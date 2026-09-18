import type { Metadata } from "next";
import { InvoiceForm } from "@/components/admin/InvoiceForm";
import { NotAllowed, PageTitle } from "@/components/admin/ui";
import { getStaffContext } from "@/lib/auth/staff";
import { saveInvoice } from "../actions";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage() {
  const staff = await getStaffContext();
  if (!staff?.can["invoices.issue"]) return <NotAllowed what="creating invoices" />;

  return (
    <>
      <PageTitle
        eyebrow="Invoices"
        title="New invoice"
        description="Saved as a draft, which you can keep editing. Issuing locks the amounts and customer details and opens the customer payment page. For consultation and service payments only."
      />
      <InvoiceForm action={saveInvoice} />
    </>
  );
}

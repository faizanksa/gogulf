/**
 * Database refusals for invoices, in words a staff member can act on. The rules live in
 * Postgres (0015); PostgREST passes their errors through and the triggers raise stable
 * codes in `message`. Anything unrecognised gets a neutral sentence — the raw database
 * text is never shown.
 */

import type { DbError, Explained } from "@/lib/jobs/errors";

const CONSTRAINTS: Record<string, string> = {
  invoices_line_items_check: "Check the line items: each needs a description, a quantity above 0 and a unit price above ₹0.",
  invoices_discount_within_subtotal: "The discount cannot be more than the subtotal.",
  invoices_due_on_or_after_issue: "The due date cannot be before the issue date.",
  invoices_totals_add_up: "The totals do not add up. Reload the page and try again.",
  invoices_total_minor_check: "An invoice must bill more than ₹0.",
  invoices_tax_rate_percent_check: "The tax rate must be between 0 and 100.",
  invoices_customer_name_check: "Enter the customer's name.",
  invoices_purpose_check: "Describe the service being billed.",
  invoices_void_is_evidenced: "Give a reason for voiding this invoice.",
  invoices_notes_check: "Keep the notes under 2000 characters.",
};

export function explainInvoiceError(error: DbError | null | undefined): Explained {
  if (!error) return { message: "Something went wrong. Try again." };
  const message = error.message ?? "";
  const details = error.details ?? "";

  switch (message) {
    case "invoice_transition_not_allowed":
      return { message: `That status change is not allowed${details ? ` (${details.replace(">", " → ")})` : ""}. Refresh the page — the invoice may have changed.` };
    case "invoice_must_start_as_draft":
      return { message: "A new invoice starts as a draft." };
    case "invoice_not_found":
      return { message: "This invoice was not found." };
    case "invoice_not_payable":
      return { message: "This invoice is not open for payment." };
  }

  for (const [name, text] of Object.entries(CONSTRAINTS)) {
    if (message.includes(`"${name}"`)) return { message: text };
  }

  if (error.code === "42501") return { message: "You do not have permission to do this." };
  if (error.code === "PGRST116") return { message: "It was not found, or you do not have permission to change it." };
  return { message: "The change could not be saved. Try again, and tell an administrator if it keeps happening." };
}

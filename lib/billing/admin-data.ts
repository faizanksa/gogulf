/**
 * Invoices as the staff workspace reads them — through the signed-in staff member's own
 * session (createServerSupabase), so RLS decides which invoices each role sees. Never the
 * service-role client.
 */

import "server-only";

import { PAGE_SIZE, rangeOf } from "@/lib/admin/params";
import { createServerSupabase } from "@/lib/supabase/server";
import type { InvoiceStatus, TableRow } from "@/types/database";

export type InvoiceRow = TableRow<"invoices">;

export interface InvoicePayment {
  id: string;
  reference: string;
  status: string;
  method: string | null;
  amount_minor: number;
  paid_at: string | null;
  failed_at: string | null;
  failure_code: string | null;
  created_at: string;
}

export interface StaffInvoice extends InvoiceRow {
  creator: { full_name: string; email: string } | null;
  updater: { full_name: string; email: string } | null;
  /** Empty for a role without payments.view — RLS filters it, not this code. */
  payments: InvoicePayment[];
}

const PAYMENT_COLUMNS = "id,reference,status,method,amount_minor,paid_at,failed_at,failure_code,created_at";
const STAFF_INVOICE_SELECT = `*, creator:staff_users!invoices_created_by_fkey(full_name,email), updater:staff_users!invoices_updated_by_fkey(full_name,email), payments(${PAYMENT_COLUMNS})`;

export interface InvoiceListFilters {
  q: string;
  status: InvoiceStatus | "";
  page: number;
}

export async function listStaffInvoices(filters: InvoiceListFilters): Promise<{ invoices: StaffInvoice[]; total: number; failed: boolean }> {
  const supabase = await createServerSupabase();
  const { from, to } = rangeOf(filters.page, PAGE_SIZE);

  let query = supabase.from("invoices").select(STAFF_INVOICE_SELECT, { count: "exact" });
  if (filters.q) query = query.or(`reference.ilike.*${filters.q}*,customer_name.ilike.*${filters.q}*,customer_email.ilike.*${filters.q}*,purpose.ilike.*${filters.q}*`);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) return { invoices: [], total: 0, failed: true };
  return { invoices: (data ?? []) as unknown as StaffInvoice[], total: count ?? 0, failed: false };
}

export async function getStaffInvoice(id: string): Promise<StaffInvoice | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("invoices").select(STAFF_INVOICE_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as StaffInvoice | null) ?? null;
}

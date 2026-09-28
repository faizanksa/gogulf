import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactMergeForm } from "@/components/admin/ContactMergeForm";
import { NotAllowed, PageTitle, Panel, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { Input } from "@/components/form/Controls";
import { AlertView } from "@/components/ui/AlertView";
import { Button } from "@/components/ui/Button";
import { FactList } from "@/components/ui/FactList";
import { getStaffContext } from "@/lib/auth/staff";
import { isUuid } from "@/lib/crm/contact-edit";
import { getContact, mergePreview, searchMergeCandidates } from "@/lib/crm/data";
import { mergeContact } from "../../actions";

export const metadata: Metadata = { title: "Merge contacts" };

/**
 * Merge a duplicate INTO this contact (0021): find it, see what moves and what stays, confirm.
 * contacts.merge to be here. Whether the merge is allowed — scope, branches, already merged —
 * is decided by merge_contacts() in the database, which also does all of it or none of it.
 */
export default async function MergeContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; with?: string }>;
}) {
  const staff = await getStaffContext();
  if (!staff?.can["contacts.merge"]) return <NotAllowed what="merging contacts" />;
  const { id } = await params;
  const { q = "", with: withId } = await searchParams;
  const result = await getContact(id);
  if (!result) notFound();
  const survivor = result.contact;

  if (survivor.merged_into_id) {
    return (
      <>
        <PageTitle eyebrow="Contact" title={survivor.full_name} />
        <AlertView tone="info" toneLabel="Note" title="This contact was merged into another. Merge into that contact instead.">
          <p>
            <Link href={`/admin/contacts/${survivor.merged_into_id}/merge`}>Open it</Link>.
          </p>
        </AlertView>
      </>
    );
  }

  // Step 2 — confirm one chosen duplicate.
  if (withId) {
    const other = isUuid(withId) && withId !== id ? await getContact(withId) : null;
    if (!other || other.contact.merged_into_id) {
      return (
        <>
          <PageTitle eyebrow="Merge contacts" title={`Merge into ${survivor.full_name}`} />
          <AlertView tone="error" toneLabel="Error" title="That contact cannot be merged here: it is this contact, already merged, or not visible to you.">
            <p>
              <Link href={`/admin/contacts/${id}/merge`}>Choose another</Link>.
            </p>
          </AlertView>
        </>
      );
    }
    const merged = other.contact;
    const counts = await mergePreview(merged.id);
    const crossBranch = merged.branch_id !== survivor.branch_id;
    return (
      <>
        <PageTitle
          eyebrow="Merge contacts"
          title={`Merge “${merged.full_name}” into “${survivor.full_name}”`}
          description="The contact you are on stays. The other one is kept as a read-only record that points here."
        />
        {crossBranch ? (
          <AlertView tone="warning" toneLabel="Warning" title={`These contacts are in different branches (${merged.branch?.name ?? "no branch"} and ${survivor.branch?.name ?? "no branch"}).`}>
            <p>Only staff who work across all branches can merge them. If you cannot, the merge will be refused and nothing will change.</p>
          </AlertView>
        ) : null}
        <div className={styles.grid2}>
          <Panel id="merge-moves" title="Moves to this contact">
            <FactList
              items={[
                { key: "ids", label: "Phone numbers and emails", value: String(counts.identities) },
                { key: "apps", label: "Applications", value: String(counts.applications) },
                { key: "cases", label: "Cases", value: String(counts.cases) },
                { key: "notes", label: "Notes", value: String(counts.notes) },
                { key: "tasks", label: "Tasks", value: String(counts.tasks) },
                { key: "history", label: "Timeline entries", value: String(counts.activities) },
                { key: "drafts", label: "Draft invoices", value: String(counts.draftInvoices) },
              ]}
            />
            <p className={styles.muted}>Counts are what your role can see. If this contact already has a primary phone or email, the moved one becomes an extra.</p>
          </Panel>
          <Panel id="merge-stays" title="Stays as it is">
            <FactList
              items={[
                { key: "issued", label: "Issued or paid invoices", value: String(counts.otherInvoices) },
                { key: "payments", label: "Payments", value: String(counts.payments) },
                { key: "details", label: "This contact's details and consents", value: "Unchanged" },
              ]}
            />
            <p className={styles.muted}>
              Issued invoices and payments are financial records and are never changed. They stay with the merged record and are shown on this contact through
              the merge.
            </p>
          </Panel>
        </div>
        <ContactMergeForm action={mergeContact} survivorId={survivor.id} mergedId={merged.id} mergedName={merged.full_name} survivorName={survivor.full_name} />
      </>
    );
  }

  // Step 1 — find the duplicate.
  const candidates = await searchMergeCandidates(id, q);
  return (
    <>
      <PageTitle
        eyebrow="Merge contacts"
        title={`Merge a duplicate into ${survivor.full_name}`}
        description="Search for the other record of the same person. This contact stays; the one you choose is merged into it."
      />
      <form method="get" className={styles.filters} role="search" aria-label="Find the duplicate">
        <div className={`${styles.filterField} ${styles.filterSearch}`}>
          <label htmlFor="merge-q" className={styles.filterLabel}>
            Name, phone or email
          </label>
          <Input id="merge-q" name="q" defaultValue={q} minLength={2} maxLength={80} autoComplete="off" />
        </div>
        <div className={styles.filterActions}>
          <Button type="submit" size="sm" variant="secondary">
            Search
          </Button>
        </div>
      </form>
      {q.trim().length >= 2 ? (
        candidates.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="visually-hidden">Possible duplicates</caption>
              <thead>
                <tr>
                  <th scope="col">Contact</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Created</th>
                  <th scope="col">
                    <span className="visually-hidden">Choose</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id}>
                    <td data-label="">
                      <div className={styles.cellMain}>
                        <span className={styles.cellTitle}>{c.full_name}</span>
                        <span className={styles.mono}>{[c.primary_phone_e164, c.primary_email].filter(Boolean).join(" · ") || "—"}</span>
                      </div>
                    </td>
                    <td data-label="Branch">{c.branch?.name ?? "—"}</td>
                    <td data-label="Created" className={styles.nowrap}>
                      <Time iso={c.created_at} />
                    </td>
                    <td data-label="">
                      <Link href={`/admin/contacts/${id}/merge?with=${c.id}`}>Review merge</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.muted}>No other contact you can see matches “{q}”.</p>
        )
      ) : null}
    </>
  );
}

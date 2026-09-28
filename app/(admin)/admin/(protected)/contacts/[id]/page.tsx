import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusBadge, CASE_STATUS_LABELS, InvoiceStatusBadge, NotAllowed, PageTitle, Panel, STAGE_LABELS, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { AlertView } from "@/components/ui/AlertView";
import { Button } from "@/components/ui/Button";
import { FactList } from "@/components/ui/FactList";
import { formatMinor } from "@/lib/billing/model";
import { getStaffContext } from "@/lib/auth/staff";
import { getContact, getContactMergeContext } from "@/lib/crm/data";
import type { InvoiceStatus } from "@/types/database";

export const metadata: Metadata = { title: "Contact" };

/**
 * One person: how they are identified, their cases and applications, their billing and their
 * timeline. Edit and merge (0021) are offered to staff who hold the permission; the database
 * decides every change. A merged contact is shown read-only, pointing at the one it lives on in.
 */
export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; merged?: string }> }) {
  const staff = await getStaffContext();
  if (!staff?.can["contacts.view"]) return <NotAllowed what="viewing contacts" />;
  const { id } = await params;
  const result = await getContact(id);
  if (!result) notFound();
  const { contact, identities, cases, applications, activities } = result;
  const [merge, flags] = await Promise.all([getContactMergeContext(contact.id, contact.merged_into_id), searchParams]);
  const active = !contact.merged_into_id;

  return (
    <>
      <PageTitle
        eyebrow="Contact"
        title={contact.full_name}
        description={`${STAGE_LABELS[contact.lifecycle_stage] ?? contact.lifecycle_stage} · owner ${contact.owner?.full_name ?? "nobody"} · ${contact.branch?.name ?? "no branch"}`}
        actions={
          active ? (
            <>
              {staff.can["contacts.update"] ? (
                <Button href={`/admin/contacts/${contact.id}/edit`} size="sm" variant="secondary">
                  Edit
                </Button>
              ) : null}
              {staff.can["contacts.merge"] ? (
                <Button href={`/admin/contacts/${contact.id}/merge`} size="sm" variant="secondary">
                  Merge a duplicate
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />
      {flags.saved ? <AlertView tone="success" toneLabel="Success" title="Contact saved. The change is on the audit trail." /> : null}
      {flags.merged ? <AlertView tone="success" toneLabel="Success" title="Contacts merged. Everything that moved is listed below; the merged record is kept, read-only." /> : null}
      {merge.mergedInto ? (
        <AlertView tone="info" toneLabel="Note" title="This contact was merged into another and is kept read-only as history.">
          <p>
            It now lives on in <Link href={`/admin/contacts/${merge.mergedInto.id}`}>{merge.mergedInto.full_name}</Link>.
          </p>
        </AlertView>
      ) : null}
      <div className={styles.grid2}>
        <div className={styles.content}>
          <Panel id="contact-cases" title="Cases">
            {cases.length ? (
              <ul className={styles.timeline}>
                {cases.map((k) => (
                  <li key={k.id} className={styles.timelineItem}>
                    <Link href={`/admin/cases/${k.id}`} className={styles.timelineWhat}>
                      {k.case_number}
                    </Link>
                    <span>{k.title ?? "—"}</span>
                    <span className={styles.muted}>
                      {CASE_STATUS_LABELS[k.status]} · {k.stage?.name ?? "—"} · opened <Time iso={k.opened_at} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>No cases visible to your role.</p>
            )}
          </Panel>
          <Panel id="contact-applications" title="Applications">
            {applications.length ? (
              <ul className={styles.timeline}>
                {applications.map((a) => (
                  <li key={a.id} className={styles.timelineItem}>
                    <Link href={`/admin/applications/${a.id}`} className={styles.timelineWhat}>
                      {a.job_title}
                    </Link>
                    <span className={styles.muted}>
                      <ApplicationStatusBadge status={a.status} /> · <Time iso={a.created_at} withTime />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>No applications linked.</p>
            )}
          </Panel>
          <Panel id="contact-timeline" title="Timeline">
            {activities.length ? (
              <ol className={styles.timeline}>
                {activities.map((a) => (
                  <li key={a.id} className={styles.timelineItem}>
                    <span className={styles.timelineWhat}>{a.summary}</span>
                    <span className={styles.muted}>
                      <Time iso={a.occurred_at} withTime /> · {a.verb}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.muted}>Nothing recorded yet.</p>
            )}
          </Panel>
        </div>
        <div className={styles.content}>
          <Panel id="contact-identities" title="Identified by">
            {identities.length ? (
              <FactList
                items={identities.map((i) => ({
                  key: i.id,
                  label: `${i.type}${i.is_primary ? " (primary)" : ""}`,
                  value: (
                    <>
                      {i.value_normalized}
                      <br />
                      <span className={styles.muted}>
                        {i.verified_at ? "verified" : "not verified"}
                        {i.source ? ` · from ${i.source.replace(/_/g, " ")}` : ""}
                      </span>
                    </>
                  ),
                  mono: true,
                }))}
              />
            ) : (
              <p className={styles.muted}>No identities recorded.</p>
            )}
          </Panel>
          {merge.mergedFrom.length ? (
            <Panel id="contact-merged-from" title="Merged into this contact">
              <ul className={styles.timeline}>
                {merge.mergedFrom.map((c) => (
                  <li key={c.id} className={styles.timelineItem}>
                    <Link href={`/admin/contacts/${c.id}`} className={styles.timelineWhat}>
                      {c.full_name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
          {merge.invoices.length || merge.payments.length ? (
            <Panel id="contact-billing" title="Billing">
              <ul className={styles.timeline}>
                {merge.invoices.map((i) => (
                  <li key={i.id} className={styles.timelineItem}>
                    <Link href={`/admin/invoices/${i.id}`} className={styles.timelineWhat}>
                      {i.reference}
                    </Link>
                    <span className={styles.muted}>
                      <InvoiceStatusBadge status={i.status as InvoiceStatus} /> · {formatMinor(i.total_minor)}
                      {i.contact_id !== contact.id ? " · on a merged record" : ""}
                    </span>
                  </li>
                ))}
                {merge.payments.map((p) => (
                  <li key={p.id} className={styles.timelineItem}>
                    <span className={styles.timelineWhat}>{p.reference}</span>
                    <span className={styles.muted}>
                      payment · {p.status} · {formatMinor(p.amount_minor)}
                      {p.contact_id !== contact.id ? " · on a merged record" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
          <Panel id="contact-record" title="Record">
            <FactList
              items={[
                { key: "created", label: "Created", value: <Time iso={contact.created_at} withTime /> },
                { key: "updated", label: "Last updated", value: <Time iso={contact.updated_at} withTime /> },
                {
                  key: "consent",
                  label: "Marketing consent",
                  value: contact.consent_marketing ? "Given" : "Not given — applying for a job is not consent to marketing",
                },
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

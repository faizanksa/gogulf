import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusBadge, CASE_STATUS_LABELS, NotAllowed, PageTitle, Panel, STAGE_LABELS, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { FactList } from "@/components/ui/FactList";
import { getStaffContext } from "@/lib/auth/staff";
import { getContact } from "@/lib/crm/data";

export const metadata: Metadata = { title: "Contact" };

/** One person: how they are identified, their cases and applications, and their timeline. */
export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff?.can["contacts.view"]) return <NotAllowed what="viewing contacts" />;
  const { id } = await params;
  const result = await getContact(id);
  if (!result) notFound();
  const { contact, identities, cases, applications, activities } = result;

  return (
    <>
      <PageTitle
        eyebrow="Contact"
        title={contact.full_name}
        description={`${STAGE_LABELS[contact.lifecycle_stage] ?? contact.lifecycle_stage} · owner ${contact.owner?.full_name ?? "nobody"} · ${contact.branch?.name ?? "no branch"}`}
      />
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

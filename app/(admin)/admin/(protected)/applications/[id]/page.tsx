import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationAssignControl, ApplicationStatusControl, ConvertApplication } from "@/components/admin/ApplicationControls";
import { AddNoteForm } from "@/components/admin/NotesPanel";
import { ApplicationStatusBadge, NotAllowed, PageTitle, Panel, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { FactList } from "@/components/ui/FactList";
import { getStaffContext } from "@/lib/auth/staff";
import { getApplication, listAssignableStaff } from "@/lib/crm/data";
import { listNotes } from "@/lib/crm/notes";
import { auditTrail } from "@/lib/jobs/admin-data";
import { addNote } from "../../notes/actions";
import { assignApplication, convertApplication, setApplicationStatus } from "../actions";

export const metadata: Metadata = { title: "Application" };

const AUDIT_LABELS: Record<string, string> = {
  "job_application.status_changed": "Status changed",
  "job_application.assigned": "Assignment changed",
  "job_application.converted": "Converted to a contact and case",
  "job_application.updated": "Updated",
  "document.accessed": "Document opened",
};

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff?.can["applications.screen"]) return <NotAllowed what="screening applications" />;
  const { id } = await params;
  const [app, colleagues, audit] = await Promise.all([
    getApplication(id),
    listAssignableStaff(),
    staff.can["audit.view"] ? auditTrail("job_application", id) : Promise.resolve([]),
  ]);
  if (!app) notFound();
  // Notes belong to the contact. Until the application is converted there is no contact to
  // attach one to, so the panel says so instead of offering a form that could not save.
  const notes = app.contact_id && staff.can["notes.team.view"] ? await listNotes(app.contact_id) : [];

  const converted = app.case_id !== null;
  const documents = [
    { key: "cv", label: "CV", href: `/admin/applications/${app.id}/document?kind=cv`, allowed: staff.can["documents.view.employment"] },
    { key: "passport", label: "Passport", href: `/admin/applications/${app.id}/document?kind=passport`, allowed: staff.can["documents.view.identity"] },
    ...(app.other_paths ?? []).map((_, i) => ({
      key: `other-${i}`,
      label: `Other document ${i + 1}`,
      href: `/admin/applications/${app.id}/document?kind=other&n=${i}`,
      allowed: staff.can["documents.view.identity"],
    })),
  ];

  return (
    <>
      <PageTitle
        eyebrow={
          <span className={styles.badges}>
            <span>Application</span>
            <ApplicationStatusBadge status={app.status} />
          </span>
        }
        title={app.full_name}
        description={
          <>
            For {app.job ? <Link href={`/admin/jobs/${app.job.id}`}>{app.job.title}</Link> : app.job_title}
            {app.job ? <> ({app.job.reference})</> : null} · submitted <Time iso={app.created_at} withTime />
          </>
        }
      />

      <div className={styles.grid2}>
        <div className={styles.content}>
          <Panel id="applicant" title="What the applicant sent">
            <p className={styles.muted}>As submitted. Corrections belong on the contact, not here.</p>
            <FactList
              items={[
                { key: "name", label: "Name", value: app.full_name },
                { key: "email", label: "Email", value: app.email, mono: true },
                { key: "phone", label: "Phone", value: app.phone, mono: true },
                { key: "job", label: "Job", value: app.job_title },
                ...(app.job_country ? [{ key: "country", label: "Country", value: app.job_country }] : []),
                ...(app.experience ? [{ key: "experience", label: "Experience", value: app.experience }] : []),
                ...(app.message ? [{ key: "message", label: "Message", value: app.message }] : []),
                { key: "source", label: "Source", value: app.page_source ?? "—" },
                { key: "reference", label: "Submission reference", value: app.id, mono: true },
              ]}
            />
          </Panel>

          <Panel id="documents" title="Documents">
            <p className={styles.muted}>Each link opens a copy that expires after a minute. Opening a document is recorded in the audit trail.</p>
            <ul className={styles.inlineLinks}>
              {documents.map((d) => (
                <li key={d.key}>
                  {d.allowed ? (
                    <a href={d.href} target="_blank" rel="noopener noreferrer">
                      {d.label}
                      <span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <span className={styles.muted}>{d.label} — your role cannot open it</span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          {staff.can["notes.team.view"] || staff.can["notes.team.create"] ? (
            <Panel id="application-notes" title="Notes">
              {!app.contact_id ? (
                <p className={styles.muted}>Convert the application to a contact and case first — notes are kept on the contact, so the whole team sees them wherever the person appears.</p>
              ) : (
                <>
                  {staff.can["notes.team.create"] ? <AddNoteForm contactId={app.contact_id} caseId={app.case_id} path={`/admin/applications/${app.id}`} action={addNote} /> : null}
                  {notes.length ? (
                    <ol className={styles.timeline}>
                      {notes.map((n) => (
                        <li key={n.id} className={styles.timelineItem}>
                          <span>{n.body}</span>
                          <span className={styles.muted}>
                            <Time iso={n.created_at} withTime /> · {n.author?.full_name ?? "Staff"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className={styles.muted}>No notes yet.</p>
                  )}
                </>
              )}
            </Panel>
          ) : null}

          {staff.can["audit.view"] ? (
            <Panel id="application-history" title="History">
              {audit.length ? (
                <ol className={styles.timeline}>
                  {audit.map((entry) => (
                    <li key={entry.id} className={styles.timelineItem}>
                      <span className={styles.timelineWhat}>
                        {AUDIT_LABELS[entry.action] ?? entry.action}
                        {entry.action === "document.accessed" && entry.new_values?.document ? ` (${String(entry.new_values.document)})` : ""}
                        {entry.action === "job_application.status_changed"
                          ? ` — ${String(entry.old_values?.status)} → ${String(entry.new_values?.status)}`
                          : ""}
                      </span>
                      <span className={styles.muted}>
                        <Time iso={entry.occurred_at} withTime /> · {entry.actor_label ?? "System"}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.muted}>No history recorded yet.</p>
              )}
            </Panel>
          ) : null}
        </div>

        <div className={styles.content}>
          <Panel id="crm" title="Contact and case">
            {converted ? (
              <FactList
                items={[
                  { key: "contact", label: "Contact", value: app.contact ? <Link href={`/admin/contacts/${app.contact.id}`}>{app.contact.full_name}</Link> : "Not visible to your role" },
                  { key: "case", label: "Case", value: app.case ? <Link href={`/admin/cases/${app.case.id}`}>{app.case.case_number}</Link> : "Not visible to your role" },
                ]}
              />
            ) : app.status === "rejected" || app.status === "withdrawn" ? (
              <p className={styles.muted}>Move the application back to screening to convert it.</p>
            ) : staff.can["contacts.view"] && staff.can["cases.view"] ? (
              <ConvertApplication id={app.id} action={convertApplication} />
            ) : (
              <p className={styles.muted}>Your role cannot create contacts and cases.</p>
            )}
          </Panel>

          <Panel id="triage" title="Triage">
            {converted ? (
              <p className={styles.muted}>Converted applications are progressed on their case.</p>
            ) : (
              <ApplicationStatusControl id={app.id} status={app.status} action={setApplicationStatus} />
            )}
            <ApplicationAssignControl id={app.id} assigneeId={app.assignee_id} staff={colleagues} action={assignApplication} />
            <FactList
              items={[
                { key: "branch", label: "Branch", value: app.branch?.name ?? "—" },
                { key: "status-changed", label: "Status changed", value: <Time iso={app.status_changed_at} withTime /> },
                { key: "updated", label: "Last updated", value: <Time iso={app.updated_at} withTime /> },
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

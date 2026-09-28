import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactEditForm } from "@/components/admin/ContactEditForm";
import { NotAllowed, PageTitle } from "@/components/admin/ui";
import { AlertView } from "@/components/ui/AlertView";
import { getStaffContext } from "@/lib/auth/staff";
import { getContact, listAssignableStaff } from "@/lib/crm/data";
import { updateContact } from "../../actions";

export const metadata: Metadata = { title: "Edit contact" };

/**
 * Edit a contact (0021). contacts.update to be here; the owner field only with
 * contacts.assign. The database decides which contacts and which fields.
 */
export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff?.can["contacts.update"]) return <NotAllowed what="editing contacts" />;
  const { id } = await params;
  const result = await getContact(id);
  if (!result) notFound();
  const { contact } = result;

  if (contact.merged_into_id) {
    return (
      <>
        <PageTitle eyebrow="Contact" title={contact.full_name} />
        <AlertView tone="info" toneLabel="Note" title="This contact was merged into another and can no longer be edited.">
          <p>
            <Link href={`/admin/contacts/${contact.merged_into_id}`}>Open the contact it was merged into</Link>.
          </p>
        </AlertView>
      </>
    );
  }

  const owners = staff.can["contacts.assign"] ? await listAssignableStaff() : null;

  return (
    <>
      <PageTitle eyebrow="Contact" title={`Edit ${contact.full_name}`} description="Phone numbers and email addresses are identities: they move with a merge and are not edited here." />
      <ContactEditForm
        action={updateContact}
        owners={owners}
        values={{
          id: contact.id,
          full_name: contact.full_name,
          display_name: contact.display_name,
          lifecycle_stage: contact.lifecycle_stage,
          country_code: contact.country_code,
          nationality: contact.nationality,
          preferred_language: contact.preferred_language,
          date_of_birth: contact.date_of_birth,
          gender: contact.gender,
          notes_summary: contact.notes_summary,
          consent_email: contact.consent_email,
          consent_whatsapp: contact.consent_whatsapp,
          consent_sms: contact.consent_sms,
          consent_calls: contact.consent_calls,
          consent_marketing: contact.consent_marketing,
          owner_id: contact.owner_id,
        }}
      />
    </>
  );
}

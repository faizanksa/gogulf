import { getTranslator } from "./server";

/**
 * Every word the contact form shows, in the page's language, built on the server and
 * passed to the form as one prop — so the browser gets finished strings, not a catalogue.
 * `locale` travels with the submission so the server answers in the same language.
 *
 * The pattern for every form: 2C's rebuilt forms get the same kind of copy builder.
 */
export async function contactFormCopy() {
  const t = await getTranslator();
  return {
    locale: t.locale,
    errorSummaryTitle: t("forms.errorSummaryTitle"),
    honeypot: t("forms.honeypot"),
    field: { optional: t("common.optional"), errorPrefix: t("common.errorPrefix") },
    status: { sending: t("forms.sending"), success: t("common.tone.success"), error: t("common.tone.error") },
    labels: {
      fullName: t("forms.contact.fullName"),
      email: t("forms.contact.email"),
      phone: t("forms.contact.phone"),
      phoneHint: t("forms.contact.phoneHint"),
      message: t("forms.contact.message"),
    },
    submit: t("forms.contact.submit"),
    sending: t("forms.sending"),
    errors: {
      nameMissing: t("forms.contact.nameMissing"),
      emailMissing: t("forms.contact.emailMissing"),
      emailInvalid: t("forms.contact.emailInvalid"),
      messageMissing: t("forms.contact.messageMissing"),
    },
    outcome: {
      sent: t("forms.contact.sent"),
      sentNoCopy: t("forms.contact.sentNoCopy"),
      failed: t("forms.contact.failed"),
      offline: t("forms.outcome.offline"),
      unexpected: t("forms.outcome.unexpected"),
    },
  };
}

export type ContactFormCopy = Awaited<ReturnType<typeof contactFormCopy>>;

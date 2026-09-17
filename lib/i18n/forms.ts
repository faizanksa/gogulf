import type { EmployerFormCopy } from "@/components/forms/EmployerRequirementForm";
import type { ServiceInquiryCopy } from "@/components/forms/ServiceInquiryForm";
import { WHATSAPP } from "@/content/channels";
import { COMPANY } from "@/content/company";
import { SERVICES, type Service } from "@/content/services";
import { COUNTRIES } from "@/lib/jobs/model";
import { countryName } from "./format";
import { hrefIn, serviceText } from "./pages";
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

/**
 * Every word the job application form shows. Values the browser fills in later (a file
 * name, the reference, the route) are left as %1 / %2 — placeholders without letters,
 * so pseudo-localisation cannot alter them.
 */
export async function applyFormCopy() {
  const t = await getTranslator();
  return {
    locale: t.locale,
    errorSummaryTitle: t("forms.errorSummaryTitle"),
    honeypot: t("forms.honeypot"),
    opensWhatsApp: t("common.opensWhatsApp"),
    field: { optional: t("common.optional"), errorPrefix: t("common.errorPrefix") },
    status: { sending: t("forms.sending"), success: t("common.tone.success"), error: t("common.tone.error") },
    target: {
      applyingFor: t("apply.target.applyingFor"),
      general: t("apply.target.general"),
      reference: t("apply.target.reference"),
      // What the staff email records when no job was chosen; English, as before.
      generalValue: "General Application",
    },
    groups: { you: t("apply.groups.you"), documents: t("apply.groups.documents") },
    labels: {
      fullName: t("forms.contact.fullName"),
      email: t("forms.contact.email"),
      phone: t("forms.contact.phone"),
      phoneHint: t("forms.contact.phoneHint"),
      experience: t("apply.fields.experience"),
      experienceHint: t("apply.fields.experienceHint"),
      message: t("apply.fields.message"),
      cv: t("apply.fields.cv"),
      cvHint: t("apply.fields.cvHint"),
      passport: t("apply.fields.passport"),
      passportHint: t("apply.fields.passportHint"),
      other: t("apply.fields.other"),
      otherHint: t("apply.fields.otherHint"),
    },
    submit: t("apply.submit"),
    sending: t("apply.sending"),
    errors: {
      nameMissing: t("forms.contact.nameMissing"),
      emailMissing: t("forms.contact.emailMissing"),
      emailInvalid: t("forms.contact.emailInvalid"),
      phoneMissing: t("apply.errors.phoneMissing"),
      cvMissing: t("apply.errors.cvMissing"),
      passportMissing: t("apply.errors.passportMissing"),
      tooLarge: t("apply.errors.tooLarge", { file: "%1" }),
      uploadFailed: t("apply.errors.uploadFailed"),
    },
    outcome: { offline: t("forms.outcome.offline"), unexpected: t("forms.outcome.unexpected") },
    receipt: {
      status: t("apply.receipt.status"),
      heading: t("apply.receipt.heading"),
      reference: t("apply.receipt.reference"),
      route: t("apply.receipt.route", { from: "%1", to: "%2" }),
      gulf: t("apply.receipt.gulf"),
      job: t("apply.receipt.job"),
      jobReference: t("apply.receipt.jobReference"),
      country: t("apply.receipt.country"),
      documents: t("apply.receipt.documents"),
      confirmationSent: t("apply.receipt.confirmationSent"),
      confirmationFailed: t("apply.receipt.confirmationFailed"),
      next: t("apply.receipt.next"),
      keep: t("apply.receipt.keep"),
      safety: t("apply.receipt.safety"),
      otherJobs: t("apply.receipt.otherJobs"),
      ask: t("apply.receipt.ask"),
    },
    whatsapp: { href: WHATSAPP.href, message: t("apply.receipt.whatsappMessage", { reference: "%1" }) },
    routeFrom: COMPANY.address.locality,
    jobsHref: hrefIn("/jobs", t.locale),
  };
}

export type ApplyFormCopy = Awaited<ReturnType<typeof applyFormCopy>>;

/**
 * The service inquiry form's words. Option values are the exact service names the server
 * routes on (lib/forms/service-options.ts) and English country names — data for staff;
 * only the labels are translated.
 */
export async function serviceInquiryCopy(): Promise<ServiceInquiryCopy> {
  const t = await getTranslator();
  const option = (s: Service) => ({ id: s.id, value: s.inquiryOption ?? s.name, label: serviceText(s, t.locale).name });
  const forAudience = (audience: Service["audience"]) => SERVICES.filter((s) => s.audience === audience && s.inquiryOption).map(option);
  return {
    locale: t.locale,
    errorSummaryTitle: t("forms.errorSummaryTitle"),
    honeypot: t("forms.honeypot"),
    field: { optional: t("common.optional"), errorPrefix: t("common.errorPrefix") },
    status: { sending: t("forms.sending"), success: t("common.tone.success"), error: t("common.tone.error") },
    labels: {
      service: t("forms.inquiry.service"),
      name: t("forms.contact.fullName"),
      email: t("forms.contact.email"),
      phone: t("forms.contact.phone"),
      phoneHint: t("forms.contact.phoneHint"),
      country: t("forms.inquiry.country"),
      message: t("forms.contact.message"),
      messageHint: t("forms.inquiry.messageHint"),
    },
    servicePlaceholder: t("forms.inquiry.servicePlaceholder"),
    groups: { seekers: t("forms.inquiry.seekers"), employers: t("forms.inquiry.employers") },
    // "Other / Not Sure" is the value staff already know from the pre-redesign form.
    services: { seekers: forAudience("job-seekers"), employers: forAudience("employers"), other: { value: "Other / Not Sure", label: t("forms.inquiry.other") } },
    // The value stays the English name staff read in the notification email.
    countries: COUNTRIES.map((c) => ({ value: c.name, label: countryName(c.code, t.locale) })),
    anyCountry: t("forms.inquiry.anyCountry"),
    submit: t("forms.inquiry.submit"),
    sending: t("forms.sending"),
    errors: {
      serviceMissing: t("forms.inquiry.serviceMissing"),
      nameMissing: t("forms.contact.nameMissing"),
      emailMissing: t("forms.contact.emailMissing"),
      emailInvalid: t("forms.contact.emailInvalid"),
      phoneMissing: t("apply.errors.phoneMissing"),
    },
    outcome: {
      sent: t("forms.inquiry.sent"),
      sentNoCopy: t("forms.inquiry.sentNoCopy"),
      failed: t("forms.inquiry.failed"),
      offline: t("forms.outcome.offline"),
      unexpected: t("forms.outcome.unexpected"),
    },
  };
}

/**
 * The employer requirement form's words. Select values (timelines, provision, country)
 * stay in English: they end up in the message the business desk reads.
 */
export async function employerFormCopy(): Promise<EmployerFormCopy> {
  const t = await getTranslator();
  return {
    locale: t.locale,
    errorSummaryTitle: t("forms.errorSummaryTitle"),
    honeypot: t("forms.honeypot"),
    field: { optional: t("common.optional"), errorPrefix: t("common.errorPrefix") },
    status: { sending: t("forms.sending"), success: t("common.tone.success"), error: t("common.tone.error") },
    groups: { company: t("forms.employer.groups.company"), need: t("forms.employer.groups.need"), contact: t("forms.employer.groups.contact") },
    labels: {
      company: t("forms.employer.company"),
      service: t("forms.employer.service"),
      country: t("forms.employer.country"),
      city: t("forms.employer.city"),
      roles: t("forms.employer.roles"),
      rolesHint: t("forms.employer.rolesHint"),
      headcount: t("forms.employer.headcount"),
      timeline: t("forms.employer.timeline"),
      accommodation: t("forms.employer.accommodation"),
      transport: t("forms.employer.transport"),
      notes: t("forms.employer.notes"),
      name: t("forms.employer.name"),
      email: t("forms.employer.email"),
      phone: t("forms.contact.phone"),
      phoneHint: t("forms.contact.phoneHint"),
    },
    services: SERVICES.filter((s) => s.audience === "employers" && s.inquiryOption).map((s) => ({ value: s.inquiryOption!, label: serviceText(s, t.locale).name })),
    countries: [...COUNTRIES.map((c) => ({ value: c.name, label: countryName(c.code, t.locale) })), { value: "Other", label: t("forms.employer.countryOther") }],
    countryPlaceholder: t("forms.employer.countryPlaceholder"),
    timelines: [
      { value: "As soon as possible", label: t("forms.employer.timelineAsap") },
      { value: "Within a month", label: t("forms.employer.timelineMonth") },
      { value: "In 1 to 3 months", label: t("forms.employer.timelineQuarter") },
      { value: "Later / not sure", label: t("forms.employer.timelineLater") },
    ],
    provision: [
      { value: "Provided by the employer", label: t("forms.employer.provided") },
      { value: "Not provided", label: t("forms.employer.notProvided") },
      { value: "Not decided yet", label: t("forms.employer.undecided") },
    ],
    submit: t("forms.employer.submit"),
    sending: t("forms.sending"),
    errors: {
      companyMissing: t("forms.employer.companyMissing"),
      countryMissing: t("forms.employer.countryMissing"),
      rolesMissing: t("forms.employer.rolesMissing"),
      nameMissing: t("forms.employer.nameMissing"),
      emailMissing: t("forms.contact.emailMissing"),
      emailInvalid: t("forms.contact.emailInvalid"),
      phoneMissing: t("apply.errors.phoneMissing"),
    },
    outcome: {
      sent: t("forms.employer.sent"),
      sentNoCopy: t("forms.employer.sentNoCopy"),
      failed: t("forms.employer.failed"),
      offline: t("forms.outcome.offline"),
      unexpected: t("forms.outcome.unexpected"),
    },
  };
}

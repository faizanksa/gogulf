import { z } from "zod";
import { CANDIDATE_SERVICES, EMPLOYER_SERVICES } from "@/lib/forms/service-options";
import { validate } from "./schema";

/**
 * The service catalogue, with the business's one-line descriptions (carried over from
 * the pre-redesign /services page). On 12 Sep 2026 the names and summaries that implied
 * a registered or licensed recruiting agency were reworded neutrally — the company holds
 * no such registration (content/company.ts CLAIMS); the services themselves are unchanged. `inquiryOption` ties each
 * entry to the exact option name the inquiry form sends, so the server routes it to
 * the right desk. The 2C Services page renders from this.
 */

const inquiryOptions = [...CANDIDATE_SERVICES, ...EMPLOYER_SERVICES] as [string, ...string[]];

const service = z.object({
  id: z.string(),
  name: z.string().min(2),
  audience: z.enum(["job-seekers", "employers"]),
  summary: z.string().min(20),
  inquiryOption: z.enum(inquiryOptions).nullable(),
});

export type Service = z.infer<typeof service>;

export const SERVICES: Service[] = validate(
  z.array(service),
  [
    { id: "job-applications", name: "Gulf job applications", audience: "job-seekers", summary: "Help finding Gulf openings that suit you, and applying for them.", inquiryOption: "Gulf Job Applications" },
    { id: "job-matching", name: "Job matching", audience: "job-seekers", summary: "Matching your profile to the Gulf openings we list.", inquiryOption: "Job Matching" },
    { id: "interview-coordination", name: "Interview Coordination", audience: "job-seekers", summary: "Scheduling and coordinating candidate–employer interviews.", inquiryOption: "Interview Coordination" },
    { id: "visa-documentation", name: "Visa & Documentation", audience: "job-seekers", summary: "Guidance and processing support for the paperwork a job needs.", inquiryOption: "Visa & Documentation Assistance" },
    { id: "medical-coordination", name: "Medical Coordination", audience: "job-seekers", summary: "Scheduling and coordination of pre-employment medical exams.", inquiryOption: "Medical Coordination" },
    { id: "attestation-embassy", name: "Attestation & embassy formalities", audience: "job-seekers", summary: "Help arranging document attestation, including MOFA attestation, and embassy formalities.", inquiryOption: "Attestation & Embassy Formalities" },
    { id: "immigration-support", name: "Immigration Support", audience: "job-seekers", summary: "Guidance on the immigration paperwork a Gulf job needs, up to departure.", inquiryOption: "Immigration Support" },
    { id: "air-ticket-travel", name: "Air Ticket & Travel", audience: "job-seekers", summary: "Travel arrangements coordinated for departure.", inquiryOption: "Air Ticket & Travel Assistance" },
    { id: "pre-departure", name: "Pre-Departure Orientation", audience: "job-seekers", summary: "Briefing candidates on what to expect before they fly.", inquiryOption: "Pre-Departure Orientation" },
    { id: "employer-hiring", name: "Employer Hiring Solutions", audience: "employers", summary: "Hiring support for companies sourcing talent for Gulf roles.", inquiryOption: "Employer Hiring Solutions" },
    { id: "bulk-sourcing", name: "Bulk candidate sourcing", audience: "employers", summary: "Sourcing candidates at volume for construction, industrial and facility projects.", inquiryOption: "Bulk Candidate Sourcing" },
    { id: "recruitment-support", name: "Recruitment support", audience: "employers", summary: "Sourcing, screening and interview coordination handled for you, so your team stays focused on operations.", inquiryOption: "Recruitment Support" },
    { id: "candidate-screening", name: "Candidate Screening", audience: "employers", summary: "Checking and shortlisting candidates against your requirements.", inquiryOption: "Candidate Screening" },
    { id: "hr-support", name: "HR support", audience: "employers", summary: "Ongoing HR assistance for employers and the people they hire.", inquiryOption: "HR Support" },
  ],
  "content/services.ts",
);

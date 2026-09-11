import { z } from "zod";
import { CANDIDATE_SERVICES, EMPLOYER_SERVICES } from "@/lib/forms/service-options";
import { validate } from "./schema";

/**
 * The service catalogue, with the business's existing one-line descriptions (carried
 * over from the current /services page, not newly written). `inquiryOption` ties each
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
    { id: "overseas-recruitment", name: "Overseas Recruitment", audience: "job-seekers", summary: "Full-cycle recruitment for candidates seeking Gulf employment.", inquiryOption: "Overseas Recruitment" },
    { id: "gulf-job-placement", name: "Gulf Job Placement", audience: "job-seekers", summary: "Matching candidate profiles to open Gulf jobs.", inquiryOption: "Gulf Job Placement" },
    { id: "interview-coordination", name: "Interview Coordination", audience: "job-seekers", summary: "Scheduling and coordinating candidate–employer interviews.", inquiryOption: "Interview Coordination" },
    { id: "visa-documentation", name: "Visa & Documentation", audience: "job-seekers", summary: "Guidance and processing support for the paperwork a job needs.", inquiryOption: "Visa & Documentation Assistance" },
    { id: "medical-coordination", name: "Medical Coordination", audience: "job-seekers", summary: "Scheduling and coordination of pre-employment medical exams.", inquiryOption: "Medical Coordination" },
    { id: "mofa-embassy", name: "MOFA & Embassy Processing", audience: "job-seekers", summary: "Help arranging document attestation and embassy formalities.", inquiryOption: "MOFA & Embassy Processing" },
    { id: "immigration-support", name: "Immigration Support", audience: "job-seekers", summary: "Clearance and compliance guidance through to departure.", inquiryOption: "Immigration Support" },
    { id: "air-ticket-travel", name: "Air Ticket & Travel", audience: "job-seekers", summary: "Travel arrangements coordinated for departure.", inquiryOption: "Air Ticket & Travel Assistance" },
    { id: "pre-departure", name: "Pre-Departure Orientation", audience: "job-seekers", summary: "Briefing candidates on what to expect before they fly.", inquiryOption: "Pre-Departure Orientation" },
    { id: "employer-hiring", name: "Employer Hiring Solutions", audience: "employers", summary: "Hiring support for companies sourcing talent for Gulf roles.", inquiryOption: "Employer Hiring Solutions" },
    { id: "bulk-manpower", name: "Bulk Manpower Recruitment", audience: "employers", summary: "Large-scale workforce sourcing for construction, industrial and facility projects.", inquiryOption: "Bulk Manpower Recruitment" },
    { id: "rpo", name: "Recruitment Process Outsourcing", audience: "employers", summary: "End-to-end recruitment run for you, so your team stays focused on operations.", inquiryOption: "Recruitment Process Outsourcing (RPO)" },
    { id: "candidate-screening", name: "Candidate Screening", audience: "employers", summary: "Checking and shortlisting candidates against your requirements.", inquiryOption: "Candidate Screening" },
    { id: "hr-support", name: "HR & Recruitment Support", audience: "employers", summary: "Ongoing HR assistance for placed candidates and employers.", inquiryOption: "HR & Recruitment Support" },
  ],
  "content/services.ts",
);

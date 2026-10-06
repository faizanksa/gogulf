import { z } from "zod";
import { CANDIDATE_SERVICES, EMPLOYER_SERVICES } from "@/lib/forms/service-options";
import { validate } from "./schema";

/**
 * The service catalogue, with the business's one-line descriptions (carried over from
 * the pre-redesign /services page). On 12 Sep 2026 the names and summaries that implied
 * a registered or licensed recruiting agency were reworded neutrally — the company holds
 * no such registration (content/company.ts CLAIMS). On 6 Oct 2026 the catalogue was rebuilt
 * around what Go Gulf actually does: counselling, profile and document preparation, and
 * referral to registered recruiting agents, who run interviews, offers and visa processing.
 * No service may describe Go Gulf sourcing, selecting, interviewing, or arranging visas,
 * medicals, attestation or travel (content/content.test.ts). `inquiryOption` ties each
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
    { id: "counselling", name: "Career counselling", audience: "job-seekers", summary: "A conversation about the work you do, the Gulf roles and countries that may suit you, and how the process works.", inquiryOption: "Career Counselling" },
    { id: "job-applications", name: "Gulf job applications", audience: "job-seekers", summary: "Help choosing the openings we list and applying for them. It goes to the registered recruiting agent handling the job once you have the agent's details in writing and agree.", inquiryOption: "Gulf Job Applications" },
    { id: "profile-preparation", name: "Profile and CV preparation", audience: "job-seekers", summary: "Help preparing a clear CV and profile that a recruiting agent and an employer can read quickly.", inquiryOption: "Profile & CV Preparation" },
    { id: "document-preparation", name: "Document preparation", audience: "job-seekers", summary: "Help putting your passport copy, certificates and experience letters in order before your profile is referred.", inquiryOption: "Document Preparation" },
    { id: "ra-referral", name: "Referral to a registered recruiting agent", audience: "job-seekers", summary: "After you have the agent's name and registration number in writing, and with your agreement, an introduction to a registered recruiting agent who handles interviews, offers, visa processing and emigration formalities.", inquiryOption: "Referral to a Registered Recruiting Agent" },
    { id: "employer-introduction", name: "Introducing your requirement", audience: "employers", summary: "We pass your hiring requirement to registered recruiting agents we work with. The agent you engage handles sourcing, selection and visa processing, on its own terms.", inquiryOption: "Introduce a Hiring Requirement" },
    { id: "hiring-guidance", name: "Hiring process guidance", audience: "employers", summary: "Plain answers on how hiring from India works: the recruiting agent's role, emigration clearance and the documents involved.", inquiryOption: "Hiring Process Guidance" },
  ],
  "content/services.ts",
);

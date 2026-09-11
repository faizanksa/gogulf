"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { submitViaServer } from "@/lib/forms/transport";
import { submitJobApplication } from "@/lib/supabase";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB per file — bucket backstop is 10MB (see SUPABASE-SETUP.md)

// Full-page version of the old Jobs-page modal. Reads ?job=&country= from the
// URL (set by the "Apply Now" / "Submit a General Application" links on
// /jobs) to prefill which role this application is for.
//
// Submission has two independent steps:
//   1. CV, passport and any other documents upload to Supabase Storage, and
//      the application is saved as a row in Supabase — this is the source
//      of truth, and works even if step 2 below fails.
//   2. A best-effort notification + confirmation email goes out through
//      /api/forms/job-application, which sends with Resend on the server. The
//      raw files are deliberately NOT part of that email — documents belong in
//      access-controlled storage, not scattered across mailboxes. The email
//      names what was uploaded and carries the ID for looking it up.
//
// Phase 2B accessibility pass (the redesign is 2C-1; the upload flow is untouched until
// Phase 5): fields stay enabled while sending, the button reports its state instead;
// file hints are tied to their inputs; no response-time promise.
export default function ApplyForm() {
  const searchParams = useSearchParams();
  const jobTitle = searchParams.get("job") || "General Application";
  const jobCountry = searchParams.get("country") || "";
  const jobType = searchParams.get("type") || "";

  const formRef = useRef(null);
  const [cvFile, setCvFile] = useState(null);
  const [passportFile, setPassportFile] = useState(null);
  const [otherFiles, setOtherFiles] = useState([]);
  const [status, setStatus] = useState({ state: "idle", message: "" });

  function validateFiles() {
    if (!cvFile) return "Please attach your CV / Resume.";
    if (!passportFile) return "Please attach a copy of your passport.";
    const oversize = [cvFile, passportFile, ...otherFiles].find((f) => f.size > MAX_FILE_SIZE);
    if (oversize) return `"${oversize.name}" is larger than 8MB — please attach a smaller file.`;
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (status.state === "sending") return;

    const fileError = validateFiles();
    if (fileError) {
      setStatus({ state: "err", message: fileError });
      return;
    }

    setStatus({ state: "sending", message: "Uploading your documents…" });

    const els = formRef.current.elements;
    let result;
    try {
      result = await submitJobApplication({
        jobTitle,
        jobCountry,
        fullName: els.from_name.value,
        email: els.reply_to.value,
        phone: els.phone.value,
        experience: els.experience.value,
        message: els.message.value,
        pageSource: "Jobs Page",
        cvFile,
        passportFile,
        otherFiles,
      });
    } catch (err) {
      setStatus({
        state: "err",
        message: err instanceof Error ? err.message : "Something went wrong uploading your application. Please try again.",
      });
      return;
    }

    // Application + documents are safely saved in Supabase at this point.
    // The email below is a best-effort courtesy notification — its failure
    // shouldn't tell the applicant their submission didn't go through.
    const docsNote = [
      "CV",
      "Passport",
      ...(result.otherPaths.length
        ? [`+${result.otherPaths.length} more document${result.otherPaths.length > 1 ? "s" : ""}`]
        : []),
    ].join(", ");

    const emailResult = await submitViaServer("job-application", {
      from_name: els.from_name.value,
      reply_to: els.reply_to.value,
      phone: els.phone.value,
      service_type: jobTitle,
      country: jobCountry,
      experience: els.experience.value,
      message: els.message.value,
      documents: docsNote,
      submission_id: result.submissionId,
      page_source: "Jobs Page",
      website: els.website.value,
    });

    // The application and its documents are already saved. A failed
    // notification must never tell the applicant their submission did not go
    // through — that would be untrue, and would prompt a duplicate upload.
    const confirmationSent = emailResult.ok && emailResult.acknowledgementSent !== false;

    setStatus({
      state: "ok",
      message: confirmationSent
        ? "Application received — our recruitment team will contact you. A confirmation has also been emailed to you."
        : "Application received — our recruitment team will contact you. We could not email you a confirmation, but your application and documents did reach us.",
    });
    formRef.current.reset();
    setCvFile(null);
    setPassportFile(null);
    setOtherFiles([]);
  }

  const sending = status.state === "sending";
  const submitted = status.state === "ok";

  return (
    <>
      {/* Always visible above the fold (mobile included) so it's never ambiguous
          which job — and which country — this application is for. */}
      <div className="apply-target">
        <span className="apply-target-label">{submitted ? "Applied for" : "You're applying for"}</span>
        <span className="apply-target-value">
          {jobTitle}
          {jobCountry && <> — {jobCountry}</>}
        </span>
        {jobType && <span className="job-badge" data-type={jobType}>{jobType}</span>}
      </div>

      <div className="pass js-inquiry-form" id="apply-form-wrap">
        <div className="pass-main">
          {submitted ? (
            <div className="form-msg ok" role="status" style={{ marginTop: 0, fontSize: "1rem" }}>
              {status.message}
            </div>
          ) : (
            <>
              <form ref={formRef} id="apply-form" onSubmit={handleSubmit} aria-busy={sending || undefined}>
                {/* Honeypot — hidden from people, filled by naive bots. */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }}>
                  <label htmlFor="a_website">Leave this field empty</label>
                  <input type="text" id="a_website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="a_name">Full name</label>
                    <input type="text" id="a_name" name="from_name" autoComplete="name" required />
                  </div>
                  <div className="field">
                    <label htmlFor="a_email">Email address</label>
                    <input type="email" id="a_email" name="reply_to" autoComplete="email" required />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="a_phone">Phone or WhatsApp number</label>
                    <input type="tel" id="a_phone" name="phone" autoComplete="tel" required />
                  </div>
                  <div className="field">
                    <label htmlFor="a_experience">Years of experience</label>
                    <input type="text" id="a_experience" name="experience" placeholder="e.g. 3 years" />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="a_message">Message</label>
                  <textarea id="a_message" name="message" rows={3} placeholder="Anything you'd like us to know..." />
                </div>
              </form>

              <div className="apply-uploads">
                <div className="field">
                  <label htmlFor="a_cv">CV / Resume</label>
                  <input
                    type="file"
                    id="a_cv"
                    accept=".pdf,.doc,.docx"
                    aria-describedby="a_cv-hint"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                  />
                  <span className="field-hint" id="a_cv-hint">PDF or Word document, up to 8MB.</span>
                </div>
                <div className="field">
                  <label htmlFor="a_passport">Passport copy</label>
                  <input
                    type="file"
                    id="a_passport"
                    accept=".pdf,.jpg,.jpeg,.png"
                    aria-describedby="a_passport-hint"
                    onChange={(e) => setPassportFile(e.target.files?.[0] || null)}
                  />
                  <span className="field-hint" id="a_passport-hint">PDF, JPG or PNG, up to 8MB.</span>
                </div>
                <div className="field">
                  <label htmlFor="a_other">Other documents (optional)</label>
                  <input
                    type="file"
                    id="a_other"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    multiple
                    aria-describedby="a_other-hint"
                    onChange={(e) => setOtherFiles(Array.from(e.target.files || []))}
                  />
                  <span className="field-hint" id="a_other-hint">Certificates, experience letters, etc. Up to 8MB each.</span>
                </div>
              </div>

              <button type="submit" form="apply-form" className="btn btn-gold" aria-disabled={sending || undefined}>
                {sending ? "Submitting…" : "Submit application"}
              </button>
              <div className={`form-msg${status.state === "err" ? " err" : ""}`} role="status">
                {status.message}
              </div>
            </>
          )}
        </div>

        <div className="pass-stub">
          <div>
            <div className="stamp">Go Gulf · Application</div>
            <div style={{ marginTop: 26 }}>
              <div className="pass-label">Role</div>
              <div className="pass-value">{jobTitle}</div>
              {jobType && <div className="pass-value-sub">{jobType}</div>}
            </div>
            {jobCountry && (
              <div style={{ marginTop: 20 }}>
                <div className="pass-label">Destination</div>
                <div className="pass-value">{jobCountry}</div>
              </div>
            )}
            <div style={{ marginTop: 20 }}>
              <div className="pass-label">Next step</div>
              <div className="pass-value">Our team contacts you</div>
            </div>
          </div>
          <div>
            <div className="pass-label">Go Gulf. Get Hired.</div>
          </div>
        </div>
      </div>
    </>
  );
}

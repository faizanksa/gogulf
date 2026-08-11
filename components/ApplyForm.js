"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sendInquiry } from "@/lib/emailjs";
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
//   2. A best-effort notification + confirmation email goes out via EmailJS
//      (same shared template as Services/Contact — see lib/emailjs.js).
//      The raw files are deliberately NOT part of that email: the file
//      inputs live outside the <form ref={formRef}> element so EmailJS's
//      FormData(form) scan never touches them (large scans would blow past
//      EmailJS's attachment limits). The email just names what was uploaded
//      and the ID for looking it up in Supabase.
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

  function setHiddenField(name, value) {
    const el = formRef.current?.elements?.namedItem(name);
    if (el) el.value = value;
  }

  function validateFiles() {
    if (!cvFile) return "Please attach your CV / Resume.";
    if (!passportFile) return "Please attach a copy of your passport.";
    const oversize = [cvFile, passportFile, ...otherFiles].find((f) => f.size > MAX_FILE_SIZE);
    if (oversize) return `"${oversize.name}" is larger than 8MB — please attach a smaller file.`;
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();

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
    setHiddenField("submission_id", result.submissionId);
    setHiddenField("documents", docsNote);
    try {
      await sendInquiry(formRef.current);
    } catch (emailErr) {
      console.error("EmailJS notification failed (application was still saved to Supabase):", emailErr);
    }

    setStatus({
      state: "ok",
      message: "Application received — our recruitment team will contact you shortly. A confirmation has also been emailed to you.",
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
              <form ref={formRef} id="apply-form" onSubmit={handleSubmit}>
                <input type="hidden" name="page_source" value="Jobs Page" />
                <input type="hidden" name="to_email" value="jobs@gogulf.co" />
                <input type="hidden" name="service_type" value={jobTitle} />
                <input type="hidden" name="country" value={jobCountry} />
                <input type="hidden" name="submission_id" defaultValue="" />
                <input type="hidden" name="documents" defaultValue="" />

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="a_name">Full Name</label>
                    <input type="text" id="a_name" name="from_name" required disabled={sending} />
                  </div>
                  <div className="field">
                    <label htmlFor="a_email">Email Address</label>
                    <input type="email" id="a_email" name="reply_to" required disabled={sending} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="a_phone">Phone / WhatsApp</label>
                    <input type="tel" id="a_phone" name="phone" required disabled={sending} />
                  </div>
                  <div className="field">
                    <label htmlFor="a_experience">Years of Experience</label>
                    <input type="text" id="a_experience" name="experience" placeholder="e.g. 3 years" disabled={sending} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="a_message">Message</label>
                  <textarea id="a_message" name="message" rows={3} placeholder="Anything you'd like us to know..." disabled={sending} />
                </div>
              </form>

              <div className="apply-uploads">
                <div className="field">
                  <label htmlFor="a_cv">CV / Resume</label>
                  <input
                    type="file"
                    id="a_cv"
                    accept=".pdf,.doc,.docx"
                    disabled={sending}
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                  />
                  <span className="field-hint">PDF or Word document, up to 8MB.</span>
                </div>
                <div className="field">
                  <label htmlFor="a_passport">Passport Copy</label>
                  <input
                    type="file"
                    id="a_passport"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={sending}
                    onChange={(e) => setPassportFile(e.target.files?.[0] || null)}
                  />
                  <span className="field-hint">PDF, JPG or PNG, up to 8MB.</span>
                </div>
                <div className="field">
                  <label htmlFor="a_other">Other Documents (optional)</label>
                  <input
                    type="file"
                    id="a_other"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    multiple
                    disabled={sending}
                    onChange={(e) => setOtherFiles(Array.from(e.target.files || []))}
                  />
                  <span className="field-hint">Certificates, experience letters, etc. Up to 8MB each.</span>
                </div>
              </div>

              <button type="submit" form="apply-form" className="btn btn-gold" disabled={sending}>
                {sending ? "Submitting…" : "Submit Application"}
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
              <div className="pass-label">Response</div>
              <div className="pass-value">Within 1–2 business days</div>
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

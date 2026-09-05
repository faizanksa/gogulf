import { describe, it, expect, beforeEach, vi } from "vitest";

// server-only throws when imported outside a React Server Component build.
// Stubbing it lets the real modules be tested under Vitest without weakening
// the guard in production code.
vi.mock("server-only", () => ({}));

import {
  sendContactEmails,
  sendServiceInquiryEmails,
  sendJobApplicationEmails,
} from "./send";
import type { EmailMessage, EmailProvider } from "./provider";

/** Captures messages instead of sending them. */
function makeProvider(behaviour: "ok" | "fail-all" | "fail-second" = "ok") {
  const sent: EmailMessage[] = [];
  let calls = 0;
  const provider: EmailProvider = {
    name: "test",
    async send(message) {
      sent.push(message);
      calls += 1;
      if (behaviour === "fail-all") return { ok: false, error: "provider down" };
      if (behaviour === "fail-second" && calls === 2) {
        return { ok: false, error: "recipient rejected" };
      }
      return { ok: true, id: `msg-${calls}` };
    },
  };
  return { provider, sent };
}

const contact = {
  from_name: "Asha Kumar",
  reply_to: "asha@example.com",
  phone: "+919936309015",
  message: "Do you have openings for electricians in Qatar?",
  page_source: "Contact Page",
};

beforeEach(() => {
  process.env.RESEND_FROM_EMAIL = "Go Gulf <no-reply@gogulf.co>";
  process.env.RESEND_REPLY_TO = "careers@gogulf.co";
});

describe("contact flow", () => {
  it("sends a notification and an acknowledgement", async () => {
    const { provider, sent } = makeProvider();
    const result = await sendContactEmails(contact, provider);

    expect(result.ok).toBe(true);
    expect(sent).toHaveLength(2);
    expect(sent[0]?.to).toBe("careers@gogulf.co");
    expect(sent[1]?.to).toBe("asha@example.com");
  });

  it("sets Reply-To on the internal mail to the submitter, so staff can just hit reply", async () => {
    const { provider, sent } = makeProvider();
    await sendContactEmails(contact, provider);
    expect(sent[0]?.replyTo).toBe("asha@example.com");
  });

  it("sets Reply-To on the acknowledgement to a monitored inbox, not the customer", async () => {
    const { provider, sent } = makeProvider();
    await sendContactEmails(contact, provider);
    expect(sent[1]?.replyTo).toBe("careers@gogulf.co");
  });

  it("includes the message in both HTML and plain text", async () => {
    const { provider, sent } = makeProvider();
    await sendContactEmails(contact, provider);
    for (const message of sent) {
      expect(message.text.length).toBeGreaterThan(0);
      expect(message.html).toContain("<html");
    }
    expect(sent[0]?.text).toContain("openings for electricians");
  });

  it("fails the submission when the internal notification cannot be sent", async () => {
    const { provider, sent } = makeProvider("fail-all");
    const result = await sendContactEmails(contact, provider);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("provider down");
    // The acknowledgement must not be attempted once the notification failed.
    expect(sent).toHaveLength(1);
  });

  it("still succeeds when only the acknowledgement fails", async () => {
    // The business has the enquiry; only the customer's receipt was lost.
    // Telling the user their message failed would be untrue.
    const { provider } = makeProvider("fail-second");
    const result = await sendContactEmails(contact, provider);

    expect(result.ok).toBe(true);
    expect(result.acknowledgementFailed).toBe(true);
  });
});

describe("service inquiry routing", () => {
  const base = {
    from_name: "Ravi Nair",
    reply_to: "ravi@example.com",
    phone: "+919936309015",
    page_source: "Services Page",
  };

  it("routes employer services to the business desk", async () => {
    const { provider, sent } = makeProvider();
    await sendServiceInquiryEmails(
      { ...base, service_type: "Bulk Manpower Recruitment" },
      provider,
    );
    expect(sent[0]?.to).toBe("business@gogulf.co");
  });

  it("routes candidate services to the careers desk", async () => {
    const { provider, sent } = makeProvider();
    await sendServiceInquiryEmails(
      { ...base, service_type: "Gulf Job Placement" },
      provider,
    );
    expect(sent[0]?.to).toBe("careers@gogulf.co");
  });

  it("defaults an unrecognised service to the careers desk rather than failing", async () => {
    const { provider, sent } = makeProvider();
    await sendServiceInquiryEmails(
      { ...base, service_type: "Other / Not Sure" },
      provider,
    );
    expect(sent[0]?.to).toBe("careers@gogulf.co");
  });

  it("derives the recipient from the service, ignoring any injected address", async () => {
    // The old flow carried a hidden to_email field the browser could edit.
    // Routing is now server-side, so a forged field cannot redirect mail.
    const { provider, sent } = makeProvider();
    await sendServiceInquiryEmails(
      {
        ...base,
        service_type: "Candidate Screening",
        ...({ to_email: "attacker@evil.example" } as Record<string, unknown>),
      },
      provider,
    );
    expect(sent[0]?.to).toBe("business@gogulf.co");
    expect(JSON.stringify(sent)).not.toContain("attacker@evil.example");
  });
});

describe("job application flow", () => {
  const application = {
    from_name: "Imran Sheikh",
    reply_to: "imran@example.com",
    phone: "+919936309015",
    service_type: "Site Supervisor",
    country: "Saudi Arabia",
    experience: "5 years",
    documents: "CV, Passport, +1 more document",
    submission_id: "3f6e1556-c66a-49ba-8005-22b0699793cb",
    page_source: "Jobs Page",
  };

  it("names the documents but never attaches them", async () => {
    const { provider, sent } = makeProvider();
    await sendJobApplicationEmails(application, provider);

    expect(sent[0]?.text).toContain("CV, Passport");
    // Documents belong in access-controlled storage, not in mailboxes.
    for (const message of sent) {
      expect(message).not.toHaveProperty("attachments");
    }
  });

  it("carries the submission id so staff can find the uploaded files", async () => {
    const { provider, sent } = makeProvider();
    await sendJobApplicationEmails(application, provider);
    expect(sent[0]?.text).toContain(application.submission_id);
  });

  it("gives the applicant their reference in the acknowledgement", async () => {
    const { provider, sent } = makeProvider();
    await sendJobApplicationEmails(application, provider);
    expect(sent[1]?.to).toBe("imran@example.com");
    expect(sent[1]?.text).toContain(application.submission_id);
  });

  it("does not claim documents are stored when no upload was recorded", async () => {
    const { provider, sent } = makeProvider();
    const { submission_id: _omit, documents: _omit2, ...noUpload } = application;
    await sendJobApplicationEmails(noUpload, provider);
    expect(sent[0]?.text).toContain("No document upload was recorded");
  });
});

describe("template safety", () => {
  it("escapes HTML in user input so form text cannot inject into a staff inbox", async () => {
    const { provider, sent } = makeProvider();
    await sendContactEmails(
      {
        ...contact,
        from_name: '<img src=x onerror="alert(1)">',
        message: "<script>alert('xss')</script>",
      },
      provider,
    );

    const html = sent[0]?.html ?? "";
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('onerror="');
    expect(html).toContain("&lt;script&gt;");
  });

  it("omits blank optional fields rather than printing empty rows", async () => {
    const { provider, sent } = makeProvider();
    const { phone: _omit, ...noPhone } = contact;
    await sendContactEmails(noPhone, provider);
    expect(sent[0]?.text).not.toContain("Phone:");
  });

  it("tags messages by flow and kind for provider-side filtering", async () => {
    const { provider, sent } = makeProvider();
    await sendContactEmails(contact, provider);
    expect(sent[0]?.tags).toEqual({ flow: "contact", kind: "notification" });
    expect(sent[1]?.tags).toEqual({ flow: "contact", kind: "acknowledgement" });
  });

  it("never places personal data in provider tags", async () => {
    const { provider, sent } = makeProvider();
    await sendContactEmails(contact, provider);
    for (const message of sent) {
      const tagValues = Object.values(message.tags ?? {}).join(" ");
      expect(tagValues).not.toContain("asha@example.com");
      expect(tagValues).not.toContain("Asha");
    }
  });
});

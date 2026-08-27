# Connecting the Inquiry Form to Email (EmailJS)

Your website's Service Inquiry form (Services page), Apply form (**own page now:
`/jobs/apply`**, linked from every "Apply Now" button and "Submit a General
Application" on the Jobs page) and Contact form (Contact page) are wired to
send emails using **EmailJS** — a free service that lets a website send email
directly, without needing your own backend server.

**Two emails per submission:** your recruitment inbox gets the application
(Step 3 below), and the applicant gets an automatic confirmation copy (Step 6
— EmailJS's built-in Auto-Reply). Nothing else to build — same one template
handles both, and this applies to the Contact and Services forms too.

## Step 1 — Create an EmailJS account
Go to https://www.emailjs.com and sign up (free plan = 200 emails/month, enough to start).

## Step 2 — Connect your inbox
In the EmailJS dashboard: **Email Services → Add New Service**.
Connect the inbox that receives **careers@gogulf.co** (and ideally **business@gogulf.co**
too, or forward one to the other) via Gmail/Outlook/IMAP.
Copy the **Service ID** it gives you.

## Step 3 — Create an email template
Go to **Email Templates → Create New Template**. Use these variables (they match the
form fields exactly) in your template body:

```
New Service Inquiry — Go Gulf

Service Type: {{service_type}}
Name:         {{from_name}}
Email:        {{reply_to}}
Phone:        {{phone}}
Country:      {{country}}
Experience:   {{experience}}
Documents:    {{documents}}
Submission ID: {{submission_id}}
Message:      {{message}}
Source:       {{page_source}}
```

Note: `{{experience}}`, `{{documents}}` and `{{submission_id}}` are only sent
from the Jobs page application form — they'll simply appear blank for
inquiries submitted from the Services or Contact page forms, which is fine to
leave in the template.

`{{documents}}` and `{{submission_id}}` come from the Supabase upload step
(see `SUPABASE-SETUP.md`) — the CV/passport/other files themselves are
**not** emailed (they'd blow past EmailJS's attachment limits). `{{documents}}`
just lists what was uploaded (e.g. "CV, Passport, +1 more document"), and
`{{submission_id}}` is the row ID to look it up in the Supabase Dashboard —
worth including in the template body so you can jump straight to the files.

**To Email:** set this field to `{{to_email}}` (not a fixed address). The website
already sends this value automatically:
- Candidate services (job seeker) → **careers@gogulf.co**
- Employer / B2B services → **business@gogulf.co**

This way one form and one template route inquiries to the correct department
automatically — no manual sorting needed.

Set "Reply To" to `{{reply_to}}` so you can hit Reply and answer the candidate/employer directly.
Copy the **Template ID**.

## Step 4 — Get your Public Key
Go to **Account → API Keys** and copy your **Public Key**.

## Step 5 — Turn on Auto-Reply so applicants get a confirmation email

Still inside the same template (Step 3), open its **Auto-Reply** tab and switch
it on. This sends a *second*, separate email back to whoever filled in the
form — the applicant/candidate/inquirer — confirming it was received.

- **To Email:** `{{reply_to}}` — this is the email address the person typed
  into the form, so the confirmation goes to them, not to you.
- **Subject:** e.g. `We've received your application — Go Gulf`
- **Content:** something like:

```
Hi {{from_name}},

Thanks for applying to Go Gulf ({{service_type}}). Your application has been
received and our recruitment team will review it and contact you within
1–2 business days.

If you need to reach us sooner, WhatsApp +91 99363 09015 or reply to this email.

— Go Gulf Recruitment Team
```

Because all three forms (Contact, Services, Jobs Apply) share this one
template, turning this on gives every one of them an automatic "we got it"
confirmation email — no extra setup per page.

## Step 6 — Add your keys to the website
Copy `.env.local.example` (in the project root) to a new file named `.env.local`,
and fill in the three values:

```bash
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_service_id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_template_id
```

`.env.local` is git-ignored, so your real keys never get committed. Restart
`npm run dev` (or re-run `npm run build`) after saving it, and the Services,
Jobs (Apply) and Contact page forms will start emailing you the moment someone
submits.

If you deploy via Netlify or Vercel instead of uploading `out/` by hand, set
the same three `NEXT_PUBLIC_EMAILJS_*` variables in that host's dashboard
under Environment Variables, then trigger a rebuild.

## Later — Sending inquiries into a CRM automatically
When you're ready to move beyond email-only (you mentioned this is "CRM baad me"),
the cleanest next step is to point the form at a **Make.com webhook** instead of —
or in addition to — EmailJS. That webhook can then:
- Send the same email notification
- Save the inquiry as a new row/lead in your CRM (Airtable, Google Sheets, Zoho, etc.)
- Trigger a WhatsApp auto-reply via WATI, tying into the automation workflow we
  discussed for FC Group

When you're ready for that step, share which CRM you want leads to land in and
I'll build the Make scenario + adjust the form to submit to the webhook.

## Adding / Removing Jobs on the Jobs Page
Open `lib/jobs-data.js`. Each job is a simple block like this:

```js
{
  title: "Site Supervisor",
  country: "Saudi Arabia",
  industry: "Construction",
  type: "Full-Time",
  salary: "SAR 3,500 – 4,500 / month",
  posted: "2026-08-01",
  description: "Short description of the role..."
},
```

- **To add a job:** copy one block, edit the values, keep the comma at the end.
- **To remove a job:** delete its block.
- **Nothing else needs to change** — the Jobs page, search, filters, and Apply
  button all read from this one file automatically.

Whenever you post a new opening on WhatsApp or social media, add the same job
here so it also appears live on www.gogulf.co/jobs.

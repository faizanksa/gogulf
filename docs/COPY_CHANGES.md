# Copy changes: the registered recruiting-agent (RA) partner model

Branch `copy/ra-partner-model`, 6 October 2026. Decision **D13** in `content/company.ts`.

## What changed, in one paragraph

The site used to read as if Go Gulf places candidates: "Find a job", "Get Hired", "Hire
from India", "We source, screen and shortlist", "we arrange your flight". It now says what
the client confirmed. Go Gulf is a brand of Faizan Chaudhary Gulf Travels Private Limited
and is **not** registered as a recruiting agent under the Emigration Act, 1983. It
counsels job seekers, helps prepare their profile and documents, and refers them to
**registered recruiting agents**, who run interviews, offers, visa processing and the
collection of their statutory service charge. Employers' requirements are introduced to
those agents.

The partner list is data-driven ([content/partners.ts](../content/partners.ts)) and ships
**empty**. No partner, RA number, testimonial, statistic or employer name was invented.

**Round 2 (same day):** the client does not want RA names, numbers or logos on the public
site. Partners are now **hidden** by default (`PARTNER_DISPLAY = "hidden"`; `"named"` still
works and is tested). The site promises instead that each candidate gets the agent's name,
registration number and the split of responsibilities **in writing before paying
anything**. Section 0 records round 2. Sections 1–2 record round 1; where round 2
changed a string again, section 0 shows the current wording.

**Round 3 (same day, after a staging review):** the written disclosure now comes **before**
the referral, company registration is stated not to be a recruiting licence, and the legal
name and registered office are shown once (footer, /verify, /about, policies, emails)
instead of across the site. Section R3 is the latest state.

Only English changed. The other catalogues (hi, ml, ta, bn, ar) have not been started and
were left alone. CIN and GSTIN data, fee amounts, the database schema and migrations, the
CRM pipeline, payments code and auth were not touched.

---

## R3. Round 3 (latest): disclosure before referral, no licence reading, legal name once

These changes came from a review of staging.gogulf.co. Where round 3 changed a string
again, the table at the end of this section has the current wording.

### Change 1: the agent is named in writing BEFORE the profile is passed on

Before: step 04 was "Referral" (we pass your profile to an agent) and step 05 was "Written
disclosure". A candidate's documents could reach an agent they had not been told about.

After:

| # | With Go Gulf | # | With your recruiting agent |
|---|---|---|---|
| 1 | Application and registration | 6 | Shortlisting and interview |
| 2 | Counselling | 7 | Selection and offer |
| 3 | Document preparation | 8 | Medical and attestation |
| 4 | **Written disclosure**: "Before we pass on your profile, and before you pay anything, we give you in writing the agent's name and registration number, who is responsible for what, and any Go Gulf fee." | 9 | Visa and emigration clearance |
| 5 | **Referral, with your agreement**: "We pass your profile on only after you have the agent's details in writing and have agreed." | 10 | Departure and joining |

The same order now applies everywhere the sequence is described:
- **Pages:** the home process lead and job board lead, the disclosure statement (/verify,
  /candidates), the "What you should get in writing" lead, FAQ answers 4 and 8, the
  /services aside, the /jobs lead and steps, the job page's "How to apply", the apply page
  (lead, "After you apply", privacy note, receipt);
- **Services:** "Gulf job applications" and "Referral to a registered recruiting agent";
- **Consent box** (application and enquiry), the application acknowledgement email, and
  all three staff-email consent rows;
- **`llms.txt`**, and the Terms and Privacy drafts (listed below).

There is no structured data that lists the steps (no HowTo or FAQ schema), so nothing
changed there.

**The consent box now agrees to less.** Ticking it lets Go Gulf keep the details and
documents. Sharing them with an agent needs the written disclosure **and** a further
agreement. Wording: "…Before sharing them with a registered recruiting agent, Go Gulf
will give me the agent's name and registration number in writing and ask for my
agreement."

**Enforced by tests:**
- `content/public-claims.test.ts` checks that step 4 is "Written disclosure", step 5 is
  referral "only after…", and that ProcessSteps renders 4 before 5.
- It also checks the consent wording, the Privacy order and `llms.txt`, and fails on
  phrases such as "with your agreement, we pass your profile" (the old order).
- `tests/e2e/identity.spec.ts` checks the order on the rendered /candidates page.

### Change 2: company registration is not a recruiting licence

New line, beside the company facts on the home hero card, the company-facts band (on
/about and /employers) and /verify's company section: **"Company registration is not a
recruiting licence. Your recruiting agent's registration number is given to you in writing
before you pay."**

Licence-like wording reviewed across copy, metadata, structured data, `llms.txt` and
emails. Changed:

| Where | Before | After |
|---|---|---|
| Home hero card / facts band heading | A registered company you can look up | A company you can look up |
| Same, lead | Go Gulf is a brand of a company registered in India… | Go Gulf is a brand of a company incorporated in India… |
| /candidates, "Check the company" | Go Gulf is a brand of a registered company: look up its CIN… | Go Gulf is a brand of a company incorporated in India: look up its CIN… That is a company record, not a recruiting licence. Check a recruiting agent on the official list… |
| /about meta description | …a company registered in India with its office in Lucknow… | …a private limited company incorporated in India, with its registered office in Lucknow. |
| `llms.txt` operator line | …a private company registered in India… | …incorporated in India… Company registration is not a recruiting licence. |

Reviewed and left as they are, because none reads as a licence:
- "Registered office" (a legal term for an address);
- "registered under GST";
- "Registered business activity" (the MCA wording, see open question 17);
- "approved refunds";
- the "Verify Go Gulf" page name. It checks identity and contacts, and now carries the
  notice;
- every "registered recruiting agent" phrase, which describes the partners, never Go Gulf.

The guard test forbids "registered company", "company registered in India", and
"verified / licensed / approved / authorised company" in public files.

### Change 3: legal name and registered office shown once, not everywhere

| Where | Before | After |
|---|---|---|
| Top bar (every page) | Faizan Chaudhary Gulf Travels Pvt. Ltd. · CIN … | CIN … (the brand stays in the header) |
| Home hero card | "Operating company: Faizan Chaudhary Gulf Travels Private Limited" row | Row removed. CIN, incorporation date, office city and the fee rule stay; licence notice added |
| Company-facts band (/employers, /about) | Legal-name row | Row removed; licence notice added |
| /contact aside | "Registered office": legal name, full address, GSTIN | "Company details": "Our legal name, registered office, CIN and GSTIN are on Verify Go Gulf." (link). Phone, WhatsApp and both emails stay |
| Footer (every page) | Legal name twice ("brand of…" and "© 2026 Faizan Chaudhary…"); no address | Legal name **once** ("Go Gulf is a brand of…"), plus a compact **Registered office** row next to the CIN and GSTIN. Copyright line: "© 2026 Go Gulf. All rights reserved." |
| Share image (OG/Twitter) | Legal name line; alt text "Go Gulf — a brand of Faizan Chaudhary Gulf Travels Private Limited, Lucknow, India" | CIN line instead of the name; alt text "Go Gulf — counselling and referral for Gulf jobs from India, Lucknow" |
| Default site description (Organization `description`, `llms.txt` summary) | "Go Gulf, a brand of Faizan Chaudhary Gulf Travels Private Limited in Lucknow, …" | "Go Gulf, based in Lucknow, …" |
| /contact meta description | "…and the registered office of Faizan Chaudhary Gulf Travels Private Limited in Lucknow." | "Phone, WhatsApp and email for Go Gulf: one route for job seekers and one for employers, with a contact form that reaches the right team." |

**Still shown in full** (the allowed places):
- the footer (once, compact);
- /verify;
- /about (its lead already carried them);
- the policy pages that identify the contracting party, through the LegalPage header and
  each policy's "who we are";
- email footers;
- the Organization structured data and `llms.txt`, which describe the same company.

**Structured data:** the Organization node keeps `legalName`, the CIN identifier and the
registered-office `address`, consistent with the footer, which now shows both on every
page. `description` no longer names the legal entity. No GSTIN (D8). A test pins this.

**Configuration:** the registered office is configured in one place,
[lib/legal.js](../lib/legal.js) `REGISTERED_ADDRESS`. A new
`VISITOR_ADDRESS = null` (exposed as `COMPANY.visitorAddress`) is ready for a separate
visitor address, unused while null. No address was invented. The list of allowed places
is documented in `content/company.ts` and enforced by
`content/public-claims.test.ts` ("appears only in the allowed files").

### Round 3 legal-draft edits (for lawyer review)

1. **Terms, what this website is for:** "Before we pass your profile to a recruiting
   agent, and before you pay anything, … we tell you in writing the name and registration
   number… We pass your profile on only after that, and only with your agreement."
2. **Terms, using the website as a candidate:** the authorisation to share applies only
   "once we have told you in writing which registered recruiting agent handles a role and
   you have agreed".
3. **Terms, the hiring process:** "…document preparation, written disclosure of the
   recruiting agent and, with your agreement, referral to that agent."
4. **Privacy, how we use it:** referral "after telling you in writing which registered
   recruiting agent handles a role, and with your agreement".
5. **Privacy, grounds (consent):** "…after telling you in writing which agent, and only
   with your agreement."
6. **Privacy, who we share with (registered recruiting agents):** "we first tell you in
   writing which recruiting agent… handles the role, and its registration number. Only
   then, and only with your agreement, do we share your profile and supporting
   documents…"

### Round 3 deviations

15. **The licence notice on /about comes from the company-facts band.** /about already
    shows that band, so a second copy in the page body would have repeated it. /employers
    gets it the same way.
16. **The footer now shows the registered office**, which it didn't before. The brief
    allows the footer "(compact)". This keeps the Organization structured data
    (`address` on every page) consistent with what every page shows, rather than
    dropping the address from structured data.
17. **The Shipping & Delivery Policy keeps the operator's name** through the shared
    LegalPage header. It's a policy page that payment platforms read; removing the
    operator from one policy page would be inconsistent.
18. **/contact links to /verify for the legal name, registered office and GSTIN** instead
    of repeating them. Every contact detail stays (phone, WhatsApp, both emails, the
    form). The registered office is still visible on that page, in its footer.
19. **The new notice's wording is the brief's, verbatim:** "…given to you in writing
    before you pay." Elsewhere the copy says "before we pass on your profile, and before
    you pay anything". The notice is accurate (both are true) but shorter.

### Round 3 open questions (lawyer or CA)

17. **MCA business activity.** The company's registered activity on the MCA record is
    "Activities of travel agents and tour operators". /verify shows it as a fact. The
    actual business is counselling, document preparation and referral. Ask the CA whether
    the activity code should be updated, and the lawyer whether showing it creates any
    confusion.
18. **Registered office in the footer on every page.** It's needed for consistency with
    the Organization structured data. If the client prefers it only on /verify, the
    alternative is to drop `address` from the structured data. Decide with whoever owns
    SEO.
19. **A visitor address.** If the client wants a separate address for visitors, set
    `VISITOR_ADDRESS` in `lib/legal.js` from a confirmed address. Where it should then
    appear (contact page, Google Business Profile) is a business decision.
20. **Consent in two stages.** The consent box now agrees to keeping documents only, and
    sharing needs a later agreement. The lawyer should confirm how that second agreement
    is recorded (written, email or WhatsApp reply) so it can be proved later. See
    `docs/DISPUTE_CONTROLS.md` §1 and §7.
21. **Operational fit.** Staff must now get the candidate's agreement after the
    disclosure and before referral, for every referral. Confirm the business can do this
    every time. The site now promises it.

### Catalogue strings changed in round 3

| Key | Before (round 2) | After |
|---|---|---|
| `home.process.lead` | Go Gulf helps with the first five steps, and tells you in writing who your recruiting agent is before you pay anything. The agent handles the rest, with the employer and the authorities. | Go Gulf helps with the first five steps. Before your profile goes to a recruiting agent, or you pay anything, we tell you in writing who the agent is. The agent then handles the rest, with the employer and the authorities. |
| `home.process.s4` | title: Referral / body: With your agreement, we pass your profile to a registered recruiting agent we work with. | title: Written disclosure / body: Before we pass on your profile, and before you pay anything, we give you in writing the agent's name and registration number, who is responsible for what, and any Go Gulf fee. |
| `home.process.s5` | title: Written disclosure / body: Before you pay anything, we give you in writing the agent's name and registration number, who is responsible for what, and any Go Gulf fee. | title: Referral, with your agreement / body: We pass your profile on only after you have the agent's details in writing and have agreed. |
| `home.jobs.lead` | Each job has its own page with the place, the details and how to apply. Applications are passed to the registered recruiting agent handling the job. | Each job has its own page with the place, the details and how to apply. Applications go to the registered recruiting agent handling the job, once you have its details in writing and have agreed. |
| `partners.disclosure` | We work with registered recruiting agents. Before you pay anything, we give you in writing the agent's name, registration number, and who is responsible for what. | We work with registered recruiting agents. Before we pass on your profile, and before you pay anything, we give you in writing the agent's name, registration number, and who is responsible for what. |
| `verifyPage.payments.r5` | Before you pay anything, you get the recruiting agent's name and registration number in writing. You can check them on the official list of active recruiting agents. | Before your profile goes to a recruiting agent, and before you pay anything, you get the agent's name and registration number in writing. You can check them on the official list of active recruiting agents. |
| `candidatesPage.inWriting.lead` | Before you pay anything, make sure you have these in writing. If you do not, do not pay. | Make sure you have the first three in writing before your profile is passed on or you pay anything. If you do not, do not pay. |
| `candidatesPage.inWriting.i4` | A receipt from the agent for its service charge. | A receipt from the agent for every payment of its service charge. |
| `candidatesPage.faq.a4` | You get a confirmation email with a reference number, and our team contacts you. If your profile suits a role, and you agree, we pass it to the registered recruiting agent handling that role. | You get a confirmation email with a reference number, and our team contacts you. If your profile suits a role, we first tell you in writing which registered recruiting agent handles it, with its registration number. We pass your profile on only after that, and only if you agree. |
| `candidatesPage.faq.a8` | Yes. Before you pay anything, we give you in writing the agent's name and registration number, and who is responsible for what. We do not list the agents we work with on this website. | Yes. Before we pass on your profile, and before you pay anything, we give you in writing the agent's name and registration number, and who is responsible for what. We do not list the agents we work with on this website. |
| `servicesPage.inquiry.inWriting` | Before you pay anything, we give you in writing the recruiting agent's name and registration number, and who is responsible for what. | Before we pass on your details, and before you pay anything, we give you in writing the recruiting agent's name and registration number, and who is responsible for what. |
| `jobsPage.lead` | Read what each job involves, then apply online. Applying is free. Applications are passed to the registered recruiting agent handling the job. | Read what each job involves, then apply online. Applying is free. Applications go to the registered recruiting agent handling the job, once you have its details in writing and have agreed. |
| `jobsPage.step2` | We review it and, with your agreement, pass it to the registered recruiting agent handling the job. | We review it, tell you in writing which registered recruiting agent handles the job, and pass it on only if you agree. |
| `jobs.applyStep2` | If your profile suits the role, we pass it to the registered recruiting agent handling it. | If your profile suits the role, we tell you in writing which registered recruiting agent handles it, and pass it on only if you agree. |
| `apply.lead` | Fill in your details and attach your CV and a copy of your passport. You get a confirmation email with a reference number. If your profile suits the role, we pass your application to the registered recruiting agent handling it. | Fill in your details and attach your CV and a copy of your passport. You get a confirmation email with a reference number. If your profile suits the role, we tell you in writing which registered recruiting agent handles it before passing your application on. |
| `apply.receipt.next` | Our team reviews your application. If it suits the role, we pass it to the registered recruiting agent handling it. You will hear from us or from the agent about the next step. | Our team reviews your application. If it suits the role, we tell you in writing which registered recruiting agent handles it, and pass your application on only if you agree. |
| `apply.aside.next2` | If your profile suits the role, we pass it to the registered recruiting agent handling it. | If your profile suits the role, we tell you in writing which registered recruiting agent handles it, and pass it on only if you agree. |
| `apply.aside.privacy` | Your documents go to private storage, not email. We share them with the registered recruiting agent handling your application, and through it with the employer. You get the agent's name in writing before you pay anything — see our <privacy>Privacy policy</privacy>. | Your documents go to private storage, not email. We share them with a registered recruiting agent only after you have its name and registration number in writing and have agreed, and through it with the employer — see our <privacy>Privacy policy</privacy>. |
| `forms.consent.application` | I agree that Go Gulf may keep my details and documents, including my CV and passport copy, and share them with a registered recruiting agent for my job applications. Go Gulf will give me the agent's name and registration number in writing before I pay anything. | I agree that Go Gulf may keep my details and documents, including my CV and passport copy, for my job applications. Before sharing them with a registered recruiting agent, Go Gulf will give me the agent's name and registration number in writing and ask for my agreement. |
| `forms.consent.enquiry` | I agree that Go Gulf may use these details to answer my enquiry, and share them with a registered recruiting agent where my enquiry needs it. Go Gulf will give me the agent's name and registration number in writing before I pay anything. | I agree that Go Gulf may use these details to answer my enquiry. Before sharing them with a registered recruiting agent, Go Gulf will give me the agent's name and registration number in writing and ask for my agreement. |
| `companyFacts.heading` | A registered company you can look up | A company you can look up |
| `companyFacts.lead` | Go Gulf is a brand of a company registered in India. You can check each of these yourself, without asking us. | Go Gulf is a brand of a company incorporated in India. You can check each of these yourself, without asking us. |
| `companyFacts.notLicence` | *(new)* | Company registration is not a recruiting licence. Your recruiting agent's registration number is given to you in writing before you pay. |
| `candidatesPage.safety.check3` | Go Gulf is a brand of a registered company: look up its CIN on the Ministry of Corporate Affairs website. Check a recruiting agent on the official list of active recruiting agents. | Go Gulf is a brand of a company incorporated in India: look up its CIN on the Ministry of Corporate Affairs website. That is a company record, not a recruiting licence. Check a recruiting agent on the official list of active recruiting agents. |
| `footer.rights` | © {year} {legalName}. All rights reserved. | © {year} {brand}. All rights reserved. |
| `footer.record.office` | *(new)* | Registered office |
| `contactPage.aside.office` | Registered office | Company details |
| `contactPage.aside.officeBody` | *(new)* | Our legal name, registered office, CIN and GSTIN are on <verify>Verify Go Gulf</verify>. |
| `contactPage.aside.label` | Contact details and registered office | Contact details and company details |

---


## 0. Round 2: partners hidden, identity disclosed in writing

**Client decision:** recruiting-agent (RA) names, registration numbers and logos do
**not** appear on the public site. Instead, every candidate is given the agent's name,
registration number and the split of responsibilities **in writing before any payment**.
Hiding the agent from the public is acceptable; hiding it from the candidate is not.

### What changed

| Area | Round 1 | Round 2 (now) |
|---|---|---|
| `content/partners.ts` | Partners published when `active` and unexpired | Same internal record, plus an optional `capacity` field and a display setting `PARTNER_DISPLAY = "hidden"` (or `"named"`). Public output reads partners only through `publicPartners()` / `publicPartnerForJob()`, which return nothing while hidden. |
| /verify, partners section | "Registered recruiting-agent partners": the list, or "Our current partner list is being confirmed and will be published here." | "Registered recruiting agents": "Go Gulf is not registered as a recruiting agent… The agent is the party that recruits you", then the disclosure statement and the link to the MEA list of active recruiting agents. No partner list. |
| /verify, payment rules | 4 rules | Adds: "Before you pay anything, you get the recruiting agent's name and registration number in writing. You can check them on the official list of active recruiting agents." |
| /candidates | Partner list under the steps | Disclosure statement under the steps; a new **"What you should get in writing"** panel (contents entry "In writing"); a new FAQ: "Will I know which recruiting agent is handling my application?" |
| /services | — | Enquiry aside adds the short version: "Before you pay anything, we give you in writing the recruiting agent's name and registration number, and who is responsible for what." It links to the full panel on /candidates. |
| Job pages | "Recruiting agent: *name*, RA registration *number*" when a partner listed the job | No agent label while hidden. "Applications are passed to the registered recruiting agent handling the job" stays. |
| Process (home, /candidates) | Go Gulf: Application · Registration · Counselling · Document preparation · Referral | Go Gulf: **Application and registration** · Counselling · Document preparation · Referral · **Written disclosure** ("Before you pay anything, we give you in writing the agent's name and registration number, who is responsible for what, and any Go Gulf fee."). The agent's five steps are unchanged, so the split is still 5/5. |
| Consent checkbox | "…share them with registered recruiting agents and employers…" | Application and enquiry: "…share them with a registered recruiting agent… Go Gulf will give me the agent's name and registration number in writing before I pay anything." The employer form has its own wording, with no payment clause because employers aren't paying a recruiting agent here. Server validation is unchanged (`consent` must be `true`). |
| `llms.txt` | Listed partners, or "being confirmed" | "Go Gulf does not publish the names of the recruiting agents it works with. Before a candidate pays anything, Go Gulf gives them in writing the agent's name, registration number, and who is responsible for what." |
| Application staff email | Consent: "may be shared with registered recruiting agents and employers" | Consent: "may be shared with a registered recruiting agent; agent to be named to the applicant in writing before any payment" |
| /verify meta description | "…payment rules and our registered recruiting-agent partners." | "…payment rules and how we work with registered recruiting agents." |

### The "What you should get in writing" panel (/candidates)

It lists only what the client has committed to:

1. The recruiting agent's name and registration number.
2. Who is responsible for what: what Go Gulf does, and what the agent does.
3. A written quote for any Go Gulf fee, before you pay it.
4. A receipt from the agent for its service charge.

Lead: "Before you pay anything, make sure you have these in writing. If you do not, do not
pay." It ends with a link to the MEA list of active recruiting agents.

**Left out of live copy and listed as open questions (see section 4, items 11–13):** a
written agreement naming Go Gulf, the agent and the candidate; stage-by-stage expected
timelines; a receipt from Go Gulf itself for every payment.

### Catalogue strings changed in round 2

| Key | Before (first round) | After |
|---|---|---|
| `partners.disclosure` | *(new)* | We work with registered recruiting agents. Before you pay anything, we give you in writing the agent's name, registration number, and who is responsible for what. |
| `home.process.lead` | Go Gulf helps with the first five steps. A registered recruiting agent handles the rest, with the employer and the authorities. | Go Gulf helps with the first five steps, and tells you in writing who your recruiting agent is before you pay anything. The agent handles the rest, with the employer and the authorities. |
| `home.process.s1` | title: Application / body: You apply for a listed job, or send a general application. | title: Application and registration / body: You apply for a listed job or send a general application, and your profile and documents are recorded with us. |
| `home.process.s2` | title: Registration / body: Your profile and documents are recorded with us. | title: Counselling / body: We talk through your work, the roles and countries that may suit you, and how the process works. |
| `home.process.s3` | title: Counselling / body: We talk through your work, the roles and countries that may suit you, and how the process works. | title: Document preparation / body: We help you put your CV, passport copy, certificates and experience letters in order. |
| `home.process.s4` | title: Document preparation / body: We help you put your CV, passport copy, certificates and experience letters in order. | title: Referral / body: With your agreement, we pass your profile to a registered recruiting agent we work with. |
| `home.process.s5` | title: Referral / body: With your agreement, we pass your profile to a registered recruiting agent we work with. | title: Written disclosure / body: Before you pay anything, we give you in writing the agent's name and registration number, who is responsible for what, and any Go Gulf fee. |
| `verifyPage.partners.heading` | Registered recruiting-agent partners | Registered recruiting agents |
| `verifyPage.partners.lead` | Go Gulf is not registered as a recruiting agent. We counsel candidates, help prepare their documents and refer them to recruiting agents registered under the Emigration Act, 1983. Interviews, offers, visa processing and the agent's statutory service charge are handled by the agent. | Go Gulf is not registered as a recruiting agent. We counsel candidates, help prepare their documents and refer them to recruiting agents registered under the Emigration Act, 1983. The agent is the party that recruits you: it handles interviews, offers, visa processing and its statutory service charge. |
| `verifyPage.payments.r5` | *(new)* | Before you pay anything, you get the recruiting agent's name and registration number in writing. You can check them on the official list of active recruiting agents. |
| `candidatesPage.nav.inWriting` | *(new)* | In writing |
| `candidatesPage.inWriting.title` | *(new)* | What you should get in writing |
| `candidatesPage.inWriting.lead` | *(new)* | Before you pay anything, make sure you have these in writing. If you do not, do not pay. |
| `candidatesPage.inWriting.i1` | *(new)* | The recruiting agent's name and registration number. |
| `candidatesPage.inWriting.i2` | *(new)* | Who is responsible for what: what Go Gulf does, and what the agent does. |
| `candidatesPage.inWriting.i3` | *(new)* | A written quote for any Go Gulf fee, before you pay it. |
| `candidatesPage.inWriting.i4` | *(new)* | A receipt from the agent for its service charge. |
| `candidatesPage.inWriting.check` | *(new)* | Check the agent's registration yourself on the Ministry of External Affairs' <list>list of active recruiting agents</list>. |
| `candidatesPage.faq.a7` | No. Go Gulf is not registered as a recruiting agent under the Emigration Act, 1983. We counsel you, help prepare your profile and documents, and refer you to registered recruiting agents, who handle interviews, offers, visa processing and emigration formalities. <verify>See our recruiting-agent partners</verify>. | No. Go Gulf is not registered as a recruiting agent under the Emigration Act, 1983. We counsel you, help prepare your profile and documents, and refer you to registered recruiting agents, who handle interviews, offers, visa processing and emigration formalities. <verify>How we work with recruiting agents</verify>. |
| `candidatesPage.faq.q8` | *(new)* | Will I know which recruiting agent is handling my application? |
| `candidatesPage.faq.a8` | *(new)* | Yes. Before you pay anything, we give you in writing the agent's name and registration number, and who is responsible for what. We do not list the agents we work with on this website. |
| `aboutPage.what.role` | Go Gulf is not registered as a recruiting agent under the Emigration Act, 1983, and does not itself recruit, select or send anyone abroad. <verify>See our recruiting-agent partners</verify>. | Go Gulf is not registered as a recruiting agent under the Emigration Act, 1983, and does not itself recruit, select or send anyone abroad. <verify>How we work with recruiting agents</verify>. |
| `servicesPage.inquiry.inWriting` | *(new)* | Before you pay anything, we give you in writing the recruiting agent's name and registration number, and who is responsible for what. |
| `apply.aside.privacy` | Your documents go to private storage, not email. We share them with the registered recruiting agent handling your application, and through it with the employer — see our <privacy>Privacy policy</privacy>. | Your documents go to private storage, not email. We share them with the registered recruiting agent handling your application, and through it with the employer. You get the agent's name in writing before you pay anything — see our <privacy>Privacy policy</privacy>. |
| `forms.consent.application` | I agree that Go Gulf may keep my details and documents, including my CV and passport copy, and share them with registered recruiting agents and employers for my job applications. | I agree that Go Gulf may keep my details and documents, including my CV and passport copy, and share them with a registered recruiting agent for my job applications. Go Gulf will give me the agent's name and registration number in writing before I pay anything. |
| `forms.consent.enquiry` | I agree that Go Gulf may use these details to answer my enquiry, and share them with registered recruiting agents where my enquiry needs it. | I agree that Go Gulf may use these details to answer my enquiry, and share them with a registered recruiting agent where my enquiry needs it. Go Gulf will give me the agent's name and registration number in writing before I pay anything. |
| `forms.consent.employer` | *(new)* | I agree that Go Gulf may use these details to answer my enquiry and to introduce my requirement to registered recruiting agents. |

---


## 1. Before and after, page by page (round 1)

### Interface copy (`messages/en.json`)

Every changed catalogue string, grouped by page. "Before" is the text on `main` at
`674c1d2`.

#### Site header, footer and 404

| Key | Before | After |
|---|---|---|
| `nav.findAJob` | Find a job | Explore Gulf jobs |
| `footer.about` | Gulf job openings and enquiries from job seekers and employers, handled from {city}, {region}. | Counselling and document preparation for Gulf job seekers, and referral to registered recruiting agents. Based in {city}, {region}. |
| `footer.links.hireFromIndia` | Hire from India | Introduce a requirement |
| `notFound.links.employers` | Hiring from India | For employers |

#### Home (/)

| Key | Before | After |
|---|---|---|
| `home.title` | Work in the Gulf, with a company you can check. | Prepare for a Gulf job, with a company you can check. |
| `home.lead` | We help job seekers from India apply for jobs in the Gulf, and help employers there hire from India. Every fee is quoted in writing before you pay. | Go Gulf counsels job seekers from India, helps prepare their profile and documents, and refers them to registered recruiting agents, who run the hiring with the employer. Any Go Gulf fee is quoted in writing before you pay. |
| `home.findJob` | Find a job | Explore Gulf jobs |
| `home.hire` | Hire from India | Employers: introduce your requirement |
| `home.askFirst` | Have a question first? <wa>Ask us on WhatsApp</wa> | Not sure where to start? <wa>Talk to a counsellor on WhatsApp</wa> |
| `home.jobs.title` | Jobs you can apply for now | Gulf jobs open for applications |
| `home.jobs.lead` | Each job has its own page with the place, the details and how to apply. | Each job has its own page with the place, the details and how to apply. Applications are passed to the registered recruiting agent handling the job. |
| `home.doors.seekers.lead` | Apply for a listed job online, or send a general application. | Apply for a listed job, or send a general application and talk to a counsellor. |
| `home.doors.seekers.point3` | Every fee is quoted to you in writing before you pay. | Any Go Gulf fee is quoted to you in writing before you pay. |
| `home.doors.seekers.cta` | Find a job | Explore Gulf jobs |
| `home.doors.employers.point1` | Candidates are shortlisted against the requirement you share. | We introduce your requirement to registered recruiting agents we work with. |
| `home.doors.employers.point3` | Commercial terms are agreed with you in writing. | Any terms are agreed with you in writing before work starts. |
| `home.doors.employers.cta` | Tell us your requirement | Introduce your requirement |
| `home.process.title` | From your first enquiry to joining, in ten steps | How it works: ten steps, two roles |
| `home.process.lead` | The same ten steps for every candidate, from the first enquiry to joining the employer. | Go Gulf helps with the first five steps. A registered recruiting agent handles the rest, with the employer and the authorities. |
| `home.process.phase1` | Apply | With Go Gulf |
| `home.process.phase2` | Selection | With your recruiting agent |
| `home.process.s1` | title: Job enquiry / body: You apply for a job or send us an enquiry. | title: Application / body: You apply for a listed job, or send a general application. |
| `home.process.s2` | title: Registration / body: Your profile and documents are registered. | title: Registration / body: Your profile and documents are recorded with us. |
| `home.process.s3` | title: Consultation / body: Our team looks at the role, the country and your fit. | title: Counselling / body: We talk through your work, the roles and countries that may suit you, and how the process works. |
| `home.process.s4` | title: Shortlisting / body: Your profile is matched and shortlisted for the employer. | title: Document preparation / body: We help you put your CV, passport copy, certificates and experience letters in order. |
| `home.process.s5` | title: Employer interview / body: The interview is arranged between you and the employer. | title: Referral / body: With your agreement, we pass your profile to a registered recruiting agent we work with. |
| `home.process.s6` | title: Selection and offer / body: If you are selected, the employer issues an offer letter. | title: Shortlisting and interview / body: The recruiting agent shortlists candidates for the employer and arranges the interview. |
| `home.process.s7` | title: Medical and documents / body: Your medical test is done and your documents are checked. | title: Selection and offer / body: The employer decides who is selected. An offer comes from the employer, through the agent. |
| `home.process.s8` | title: Visa and attestation / body: Agreement, document attestation (including MOFA) and visa processing. | title: Medical and attestation / body: Your medical test and document attestation, as the employer and the destination country require. |
| `home.process.s9` | title: Departure / body: Immigration clearance and your flight ticket. | title: Visa and emigration clearance / body: The recruiting agent processes the visa and the emigration formalities. |
| `home.process.s10` | title: Joining and support / body: You join the employer abroad, with support after joining. | title: Departure and joining / body: You travel and join the employer, on the terms of your employment contract. |
| `home.money.rule1` | Every fee is quoted to you in writing before you pay. If a fee is not in writing, do not pay it. | Any Go Gulf fee is quoted to you in writing before you pay. If a fee is not in writing, do not pay it. |
| `home.money.rule2` | Pay only into an account we have confirmed to you in writing. If anyone asks you to pay somewhere else, stop and contact us. | Pay Go Gulf only into an account we have confirmed to you in writing. If anyone asks you to pay somewhere else, stop and contact us. |
| `home.money.rule4Title` | *(new)* | The agent's charge, with a receipt |
| `home.money.rule4` | *(new)* | A registered recruiting agent collects its statutory service charge itself and gives you a receipt for it. |
| `home.cta.lead` | Apply online, or talk to us first on WhatsApp, phone or email. | Explore the jobs, or talk to a counsellor first on WhatsApp, phone or email. |
| `home.cta.findJob` | Find a job | Explore Gulf jobs |
| `home.jobs.ask` | Ask on WhatsApp | Talk to a counsellor |
| `home.process.phase3` | Documents and visa | *(removed: the process now has two phases)* |
| `home.process.phase4` | Departure | *(removed: the process now has two phases)* |

#### About (/about)

| Key | Before | After |
|---|---|---|
| `aboutPage.title` | A Lucknow company helping people work in the Gulf | A Lucknow company helping people prepare for Gulf jobs |
| `aboutPage.what.seekers` | We list Gulf openings, take applications, and help with what a Gulf job needs — interviews, medicals, attestation, visas and travel. | We list Gulf openings, counsel job seekers, help prepare their profile and documents, and refer them to registered recruiting agents. The agent handles interviews, offers, visa processing and emigration formalities. |
| `aboutPage.what.employers` | We take your requirement, screen and shortlist candidates against it, and coordinate the paperwork for the candidates you select. | We introduce your requirement to registered recruiting agents we work with. The agent you engage handles sourcing, selection and visa processing, on its own written terms. |
| `aboutPage.what.employersLink` | Hiring from India | For employers |
| `aboutPage.what.role` | *(new)* | Go Gulf is not registered as a recruiting agent under the Emigration Act, 1983, and does not itself recruit, select or send anyone abroad. <verify>See our recruiting-agent partners</verify>. |
| `aboutPage.mission.body` | To connect job seekers in India with Gulf employers through ethical, transparent and technology-driven support — building successful careers and long-term business relationships. | To help job seekers in India prepare for Gulf jobs and reach registered recruiting agents, through ethical, transparent and technology-driven support. |
| `aboutPage.vision.body` | To become one of the most trusted and recognised names for Gulf careers, through reliable hiring support, useful technology and exceptional customer service. | To become one of the most trusted and recognised names for Gulf career guidance, through honest advice, useful technology and exceptional customer service. |
| `aboutPage.rules.r1` | Every fee is quoted to you in writing before you pay. | Any Go Gulf fee is quoted to you in writing before you pay. |

#### Contact (/contact)

| Key | Before | After |
|---|---|---|
| `contactPage.job.find` | Find a job | Explore Gulf jobs |
| `contactPage.assisted.title` | Help with applying, or a service | Counselling, or help with documents |
| `contactPage.assisted.body` | If you cannot apply online, or need help with documents, medicals, attestation, visas or travel, talk to us or send a service enquiry. | If you cannot apply online, would like counselling, or need help preparing your documents, talk to us or send a service enquiry. |
| `contactPage.employer.body` | Send your requirement — roles, headcount, location and timeline — to our business desk. | Send your requirement — roles, headcount, location and timeline — to our business desk. We introduce it to registered recruiting agents we work with. |

#### Verify (/verify) and the partner list

| Key | Before | After |
|---|---|---|
| `verifyPage.partners.heading` | *(new)* | Registered recruiting-agent partners |
| `verifyPage.partners.lead` | *(new)* | Go Gulf is not registered as a recruiting agent. We counsel candidates, help prepare their documents and refer them to recruiting agents registered under the Emigration Act, 1983. Interviews, offers, visa processing and the agent's statutory service charge are handled by the agent. |
| `verifyPage.payments.r1` | Every fee is quoted to you in writing before you pay. See <pricing>Pricing & fees</pricing>. | Any Go Gulf fee is quoted to you in writing before you pay. See <pricing>Pricing & fees</pricing>. |
| `verifyPage.payments.r4` | *(new)* | A registered recruiting agent collects its statutory service charge itself and gives you a receipt. Do not pay it to anyone who cannot give you the agent's receipt. |
| `partners.empty` | *(new)* | We refer candidates to registered recruiting agents. Our current partner list is being confirmed and will be published here. |
| `partners.city` | *(new)* | City |
| `partners.raNumber` | *(new)* | RA registration number |
| `partners.validUntil` | *(new)* | Registration valid until |
| `partners.website` | *(new)* | Website |
| `partners.check` | *(new)* | You can check any recruiting agent yourself on the Ministry of External Affairs' <list>list of active recruiting agents</list>, or on the <emigrate>eMigrate portal</emigrate>. |

#### Job seekers (/candidates)

| Key | Before | After |
|---|---|---|
| `candidatesPage.lead` | What happens when you apply through Go Gulf: the steps, the documents, the fees, and how to stay safe from fraud. | What Go Gulf does, what your recruiting agent does, the documents you need, the fees, and how to stay safe from fraud. |
| `candidatesPage.findJob` | Find a job | Explore Gulf jobs |
| `candidatesPage.ask` | Ask on WhatsApp | Talk to a counsellor |
| `candidatesPage.nav.partners` | *(new)* | Recruiting agents |
| `candidatesPage.steps.title` | The ten steps, from enquiry to joining | The ten steps, and who handles each |
| `candidatesPage.steps.lead` | Every candidate goes through the same steps, in this order. | The first five are with Go Gulf. The rest are with a registered recruiting agent, the employer and the authorities. |
| `candidatesPage.documents.laterNote` | Our team tells you what each step needs when you reach it. | Your recruiting agent tells you what each step needs when you reach it. |
| `candidatesPage.partners.kicker` | *(new)* | Recruiting agents |
| `candidatesPage.partners.title` | *(new)* | Who handles the hiring |
| `candidatesPage.partners.lead` | *(new)* | Go Gulf is not a recruiting agent. Interviews, offers, visa processing and emigration formalities are handled by recruiting agents registered under the Emigration Act, 1983. |
| `candidatesPage.fees.lead` | Some of our services carry a fee. None is payable until it has been quoted to you in writing. | Where a Go Gulf service carries a fee, it is quoted to you in writing before you pay. A recruiting agent's charge is separate, and is paid to the agent. |
| `candidatesPage.fees.rule1` | Every fee is quoted to you in writing before you pay. | Any Go Gulf fee is quoted to you in writing before you pay. |
| `candidatesPage.fees.rule2` | Pay only into an account we have confirmed to you in writing. | Pay Go Gulf only into an account we have confirmed to you in writing. |
| `candidatesPage.fees.rule5` | *(new)* | A registered recruiting agent collects its statutory service charge itself, and gives you a receipt. Ask for the receipt every time. |
| `candidatesPage.safety.check3` | Go Gulf is a brand of a registered company. You can look up its CIN on the Ministry of Corporate Affairs website. | Go Gulf is a brand of a registered company: look up its CIN on the Ministry of Corporate Affairs website. Check a recruiting agent on the official list of active recruiting agents. |
| `candidatesPage.faq.a4` | You get a confirmation email with a reference number, and our team contacts you about the next step. | You get a confirmation email with a reference number, and our team contacts you. If your profile suits a role, and you agree, we pass it to the registered recruiting agent handling that role. |
| `candidatesPage.faq.q7` | *(new)* | Is Go Gulf a recruiting agent? |
| `candidatesPage.faq.a7` | *(new)* | No. Go Gulf is not registered as a recruiting agent under the Emigration Act, 1983. We counsel you, help prepare your profile and documents, and refer you to registered recruiting agents, who handle interviews, offers, visa processing and emigration formalities. <verify>See our recruiting-agent partners</verify>. |
| `candidatesPage.cta.findJob` | Find a job | Explore Gulf jobs |

#### Employers (/employers)

| Key | Before | After |
|---|---|---|
| `employersPage.title` | Hire from India for your Gulf operation | Hiring from India? Introduce your requirement |
| `employersPage.lead` | Tell us the roles, headcount and timeline. We source, screen and shortlist candidates against your requirement, and coordinate the documentation and visa paperwork for the candidates you select. | Tell us the roles, headcount and timeline. We introduce your requirement to registered recruiting agents we work with. The agent you engage handles sourcing, selection, documentation and visa processing, on its own written terms. |
| `employersPage.requirement` | Tell us your requirement | Introduce your requirement |
| `employersPage.services.title` | Hiring support for Gulf employers | How we can help |
| `employersPage.services.lead` | Choose the kind of help you need, then tell us more in the requirement form. | Choose what you need, then tell us more in the requirement form. |
| `employersPage.process.title` | From your requirement to joining | How it works |
| `employersPage.process.s2Title` | Sourcing and screening | Introduction to recruiting agents |
| `employersPage.process.s2` | Candidates are sourced and shortlisted against your requirement. | We introduce your requirement to registered recruiting agents we work with. |
| `employersPage.process.s3Title` | Interviews | Terms with the agent |
| `employersPage.process.s3` | We schedule and coordinate interviews with shortlisted candidates. | The agent you choose agrees its terms with you directly, in writing. |
| `employersPage.process.s4Title` | Selection and offer | Sourcing and interviews |
| `employersPage.process.s4` | You select the candidates you want and issue offers. | The agent sources and shortlists candidates and arranges the interviews. |
| `employersPage.process.s5Title` | Documentation and visas | Selection and offer |
| `employersPage.process.s5` | We coordinate the documentation, MOFA attestation and visa paperwork for selected candidates. | You select the candidates you want and issue the offers. |
| `employersPage.process.s6Title` | Travel and joining | Visa, travel and joining |
| `employersPage.process.s6` | Selected candidates travel and join you. | The agent handles documentation, visa processing and emigration formalities. Selected candidates then travel and join you. |
| `employersPage.working.p1Title` | Screening against your brief | Registered agents |
| `employersPage.working.p1` | Candidates are shortlisted against the requirement you share. | We introduce requirements to recruiting agents registered under the Emigration Act, 1983. Their details are on our Verify page. |
| `employersPage.working.p3` | Employer engagements are quoted against your specific requirement. Requesting a quotation is free. | Sending us a requirement is free. Any terms are agreed in writing before work starts. |
| `employersPage.form.lead` | The more you tell us, the better we can plan the search. Fields marked optional can be left blank. | The more you tell us, the better we can brief the recruiting agents. Fields marked optional can be left blank. |
| `employersPage.form.noPromise` | *(new)* | Introducing a requirement does not mean it will be filled. Hiring decisions and timelines rest with you and the recruiting agent. |

#### Services (/services)

| Key | Before | After |
|---|---|---|
| `servicesPage.lead` | Services for job seekers and for employers hiring in the Gulf. Choose one and send an enquiry — it goes to the right team. | Counselling and preparation for job seekers, and introductions for employers. Interviews, offers and visa processing are handled by registered recruiting agents. Choose a service and send an enquiry. |
| `servicesPage.seekersLead` | Help with applying, and with what a Gulf job needs before you travel. | Help choosing jobs, preparing your profile and documents, and reaching a registered recruiting agent. |
| `servicesPage.employersLead` | Hiring support for companies recruiting from India for Gulf roles. | Introductions to registered recruiting agents, for companies hiring from India. |
| `servicesPage.inquiry.free` | Sending an enquiry is free. Where a service carries a fee, it is quoted to you in writing before you pay — see <pricing>Pricing & fees</pricing>. | Sending an enquiry is free. Where a Go Gulf service carries a fee, it is quoted to you in writing before you pay. A recruiting agent's statutory service charge is paid to the agent, against its receipt — see <pricing>Pricing & fees</pricing>. |

#### Jobs (/jobs)

| Key | Before | After |
|---|---|---|
| `jobsPage.lead` | Read what each job involves, then apply online. Applying is free. Every fee for a service is quoted in writing before you pay. | Read what each job involves, then apply online. Applying is free. Applications are passed to the registered recruiting agent handling the job. |
| `jobsPage.step2` | Our team contacts you about the next step. | We review it and, with your agreement, pass it to the registered recruiting agent handling the job. |
| `jobsPage.step3` | Any fee is quoted to you in writing before you pay. | The agent arranges interviews. The employer decides who is selected. |
| `jobsPage.sections.generalLead` | Roles we recruit for regularly. Ongoing jobs have no closing date. | Roles open on an ongoing basis. Ongoing jobs have no closing date. |

#### Job detail (/jobs/[slug])

| Key | Before | After |
|---|---|---|
| `jobs.agent` | *(new)* | Recruiting agent |
| `jobs.agentValue` | *(new)* | {name}, RA registration {number} |
| `jobs.applyStep2` | Our team contacts you about the next step. | If your profile suits the role, we pass it to the registered recruiting agent handling it. |
| `jobs.applyStep3` | Any fee is quoted to you in writing before you pay. | The agent arranges the interview. The employer decides who is selected. |
| `jobs.feesBody` | Every fee is quoted to you in writing before you pay. See <pricing>Pricing & fees</pricing>, and <verify>how to check you are dealing with Go Gulf</verify>. | Any Go Gulf fee is quoted to you in writing before you pay. A registered recruiting agent's statutory service charge is paid to the agent, against its receipt. See <pricing>Pricing & fees</pricing>, and <verify>how to check you are dealing with Go Gulf</verify>. |

#### Apply (/jobs/apply)

| Key | Before | After |
|---|---|---|
| `apply.lead` | Fill in your details and attach your CV and a copy of your passport. You get a confirmation email with a reference number. | Fill in your details and attach your CV and a copy of your passport. You get a confirmation email with a reference number. If your profile suits the role, we pass your application to the registered recruiting agent handling it. |
| `apply.receipt.next` | Our team reviews your application and contacts you about the next step. | Our team reviews your application. If it suits the role, we pass it to the registered recruiting agent handling it. You will hear from us or from the agent about the next step. |
| `apply.aside.next2` | Our team contacts you about the next step. | If your profile suits the role, we pass it to the registered recruiting agent handling it. |
| `apply.aside.next3` | Any fee is quoted to you in writing before you pay. | Any Go Gulf fee is quoted to you in writing before you pay. |
| `apply.aside.privacy` | Your documents go to private storage — they are not sent by email. See our <privacy>Privacy policy</privacy>. | Your documents go to private storage, not email. We share them with the registered recruiting agent handling your application, and through it with the employer — see our <privacy>Privacy policy</privacy>. |
| `apply.receipt.safety` | Every fee is quoted to you in writing before you pay. If anyone asks you to pay without a written quote, contact us first. | Any Go Gulf fee is quoted to you in writing before you pay. If anyone asks you to pay without a written quote or a recruiting agent's receipt, contact us first. |

#### Forms (all pages)

| Key | Before | After |
|---|---|---|
| `forms.validation.consentRequired` | *(new)* | Tick the box to agree before you send. |
| `forms.consent.application` | *(new)* | I agree that Go Gulf may keep my details and documents, including my CV and passport copy, and share them with registered recruiting agents and employers for my job applications. |
| `forms.consent.enquiry` | *(new)* | I agree that Go Gulf may use these details to answer my enquiry, and share them with registered recruiting agents where my enquiry needs it. |
| `forms.consent.policy` | *(new)* | Read our Privacy policy |
| `forms.consent.missing` | *(new)* | Tick the box to agree before you send. |

### Process (home page and /candidates)

Before: ten steps in four phases: *Apply* (1–3), *Selection* (4–6), *Documents and visa*
(7–8), *Departure* (9–10). The steps described Go Gulf shortlisting, arranging interviews
and handling the visa.

After: the same ten-step shape, in two phases that say **who** handles each step.

| # | With Go Gulf | # | With your recruiting agent |
|---|---|---|---|
| 1 | Application | 6 | Shortlisting and interview |
| 2 | Registration | 7 | Selection and offer (decided by the employer) |
| 3 | Counselling | 8 | Medical and attestation |
| 4 | Document preparation | 9 | Visa and emigration clearance |
| 5 | Referral (with your agreement) | 10 | Departure and joining |

"Joining and support" became "Departure and joining". Post-joining support was not
confirmed as something Go Gulf does (see open question 5).

### Services (`content/services.ts`, `lib/forms/service-options.ts`)

| Before (14 services) | After (7 services) |
|---|---|
| Gulf job applications · Job matching · Interview Coordination · Visa & Documentation · Medical Coordination · Attestation & embassy formalities · Immigration Support · Flight & Joining Support for Selected Candidates · Pre-Departure Orientation | **Job seekers:** Career counselling · Gulf job applications · Profile and CV preparation · Document preparation · Referral to a registered recruiting agent |
| Employer Hiring Solutions · Bulk candidate sourcing · Recruitment support · Candidate Screening · HR support | **Employers:** Introducing your requirement · Hiring process guidance |

The enquiry form's option values changed with them. Routing is unchanged: employer
options go to business@, candidate options to careers@. The server now refuses the
retired names, so a stale open tab gets "choose one of the services in the list".

### Page titles and descriptions (`content/pages.ts`, used for `<title>`, meta, OG, sitemap, llms.txt)

The titles were kept, including "Gulf Jobs from India — Go Gulf" for its search value.
Changed descriptions:

| Page | Before | After |
|---|---|---|
| / | Go Gulf lists current Gulf job openings and takes enquiries from job seekers and employers. A brand of Faizan Chaudhary Gulf Travels Pvt. Ltd., Lucknow. | Explore Gulf jobs from India. Go Gulf counsels job seekers, helps prepare documents and refers them to registered recruiting agents. Lucknow, India. |
| /jobs | Current Gulf job openings listed by Go Gulf. Read what each role involves, then apply online or ask about it on WhatsApp. | Current Gulf job openings listed by Go Gulf. Read what each role involves and apply online: applications go to the registered recruiting agent handling it. |
| /jobs/apply | Send your application to Go Gulf online with your CV and passport copy. You receive a confirmation email with a reference number. | Apply online for a Gulf job with your CV and passport copy. Go Gulf passes suitable applications to the registered recruiting agent handling the job. |
| /candidates | How applying for a Gulf job with Go Gulf works — the steps, the documents involved, and how fees are quoted: in writing, before you pay. | How Go Gulf helps you prepare for a Gulf job, what a registered recruiting agent does, the documents you need, and how fees are quoted. |
| /employers | Hiring from India for a Gulf operation? Tell Go Gulf the trades, headcount and timeline you need, and the business team will follow up. | Hiring from India for a Gulf operation? Go Gulf introduces your requirement to registered recruiting agents it works with. Tell us what you need. |
| /services | Go Gulf's services for job seekers and for employers hiring in the Gulf. Choose what you need and send an enquiry to the right team. | Counselling, profile and document preparation for Gulf job seekers, and introductions to registered recruiting agents for employers hiring from India. |
| /verify | How to check you are dealing with Go Gulf: the company's registration details, its official phone and email addresses, and its payment rules. | How to check you are dealing with Go Gulf: company registration, official contacts, payment rules and our registered recruiting-agent partners. |
| /pricing | How Go Gulf's services are priced, what a service fee covers, and the rule that no fee is payable unless it was first quoted to you in writing. | How any Go Gulf fee is quoted in writing before you pay, what it covers, and how a registered recruiting agent's statutory service charge is paid. |
| /privacy-policy | What personal information Go Gulf collects from visitors, job seekers and employers, how it is used and shared, and your rights over it. | What personal information Go Gulf collects, how it is used, when it is shared with registered recruiting agents and employers, and your rights. |
| /terms-and-conditions | The terms for using the Go Gulf website and its services, including that no selection, employment, visa or joining outcome is guaranteed. | The terms for using Go Gulf's website and services: counselling, preparation and referral to registered recruiting agents, with no outcome promised. |

Each changed page's `updatedOn` (the sitemap's `lastmod`) is now 2026-10-06.

### Other surfaces

| Surface | Before | After |
|---|---|---|
| Tagline (header, footer, share image, Organization `slogan`) | Go Gulf. Get Hired. | Go Gulf. Go prepared. *(needs client approval, see open question 1)* |
| Organization JSON-LD `description` (`lib/seo.ts`) | …lists Gulf job openings and takes enquiries from job seekers and employers. | …lists Gulf jobs, counsels job seekers from India, helps prepare their documents and refers them to registered recruiting agents. |
| `/llms.txt` | "takes applications and hiring enquiries, and helps with the documentation a Gulf job needs" | States the referral model and that Go Gulf is not registered as a recruiting agent, and lists the published partners (or says the list is being confirmed). |
| Application acknowledgement email | "our recruitment team will review it" | "our team will review it. If your profile suits the role, we will pass it to the registered recruiting agent handling the job, as you agreed. The employer decides who is selected." |
| Staff notification emails (all three) | n/a | New "Consent" row recording what the sender agreed to. |
| Job page facts | n/a | A "Recruiting agent" fact (name and RA number, linked to /verify#partners), shown **only** when a published partner lists that job's reference. |
| /verify | Company facts, contacts, payment rules | Adds a "Registered recruiting-agent partners" section with the partner list or the empty state, and a fourth payment rule about the agent's receipt. |
| /candidates | n/a | Adds a "Who handles the hiring" block with the partner list, and a new first FAQ: "Is Go Gulf a recruiting agent?" |
| /about | n/a | Adds one plain line: Go Gulf is not registered as a recruiting agent and does not itself recruit, select or send anyone abroad. |
| /employers | Form aside repeated "Employer engagements are quoted…" | "Introducing a requirement does not mean it will be filled. Hiring decisions and timelines rest with you and the recruiting agent." |

### Forms: a required consent checkbox (all four public forms)

The contact, service enquiry, employer requirement and job application forms now end with
a required checkbox. It links to the Privacy policy (in a new tab, so a half-filled form
is not lost):

- **Application:** "I agree that Go Gulf may keep my details and documents, including my
  CV and passport copy, and share them with registered recruiting agents and employers for
  my job applications."
- **Enquiries:** "I agree that Go Gulf may use these details to answer my enquiry, and
  share them with registered recruiting agents where my enquiry needs it."

The browser and the server both enforce it: `consent` must be literally `true`
([lib/forms/schemas.ts](../lib/forms/schemas.ts)). For job applications, the browser
check runs before any document is uploaded.

---

## 2. Legal-page edits for lawyer review

**All of these are DRAFT.** They make the policies consistent with the referral model. They
have not been reviewed by a lawyer and should not reach production until they are.
`POLICY_EFFECTIVE_DATE` was moved to 6 October 2026 and marked as a draft in
[lib/legal.js](../lib/legal.js).

### Round 2 additions (disclosure model)

1. **Terms, what this website is for:** "The registered recruiting agent, not us, is the
   party that recruits you". Whether you are selected, issued a visa or able to join
   depends on the employer and the authorities concerned. New paragraph: "Before you pay
   anything in connection with a role, we tell you in writing the name and registration
   number of the recruiting agent handling it, and who is responsible for what. Do not pay
   anyone until you have that in writing."
2. **Terms, fees:** "We tell you the agent's name and registration number in writing
   before you pay it."
3. **Privacy, who we share with (registered recruiting agents):** replaced "Our current
   partners are listed on our Verify page" with "Before you pay anything, we tell you in
   writing which agent is handling your application, and its registration number. You can
   check it on the official list of active recruiting agents; our Verify page explains
   how."
4. **Pricing, a recruiting agent's charges:** "Before you pay it, we give you in writing
   the agent's name and registration number." This page wasn't in the round-2 brief; it
   was added so all the policies make the same promise.

All of these are still DRAFT, for lawyer review.

### Terms & Conditions

1. **What this website is for:** removed "we introduce, screen, coordinate and support the
   process around that relationship". Added a paragraph: we are not registered as a
   recruiting agent under the Emigration Act, 1983. We counsel, prepare and refer to
   registered agents and introduce employers' requirements to them. The agent runs the
   recruitment (shortlisting, interviews, offers, visa processing, emigration formalities).
   The employer in your contract is your employer.
2. **Using the website as a candidate:** the authorisation to share now names the
   registered recruiting agent handling a role (and, through it, the employer), and
   explicitly includes the CV and passport copy. Timelines may come "from us or from the
   recruiting agent".
3. **Using the website as an employer:** the recruitment terms are agreed between the
   employer and the recruiting agent it engages. Only terms for a Go Gulf service are
   between the employer and us.
4. **Job listings:** removed "we screen employers before listing roles", an unverified
   claim (CLAIMS `employerVerification` is unresolved). Listings may come from employers,
   registered recruiting agents and their representatives.
5. **The application and hiring process:** rewritten as two parts: with us (application,
   registration, counselling, document preparation, referral) and with the agent, employer
   and authorities (shortlisting through joining). "Pre-departure briefing" and
   "post-joining support" were removed.
6. **Screening, interviews and selection:** "We screen and verify… and we coordinate
   interviews" became "We review candidate profiles before referring them. Shortlisting
   and interviews are arranged by the recruiting agent with the employer." "Decline to
   represent" became "decline to refer".
7. **Offers and employment:** "we provide post-joining support and will assist and
   escalate" became "tell the recruiting agent and tell us; we will help you reach the
   right party where we reasonably can".
8. **Visa, documentation, medical and immigration support:** "we assist with attestation,
   MOFA and embassy formalities, visa processing… travel arrangements. Our role is to
   guide, prepare, coordinate and submit" became "We help you prepare your documents.
   Visa processing, emigration formalities and the arrangements that follow selection are
   handled by the registered recruiting agent… We do not process visas, obtain emigration
   clearance or arrange travel."
9. **No guarantee:** "coordinating each stage properly" became "referring it only to
   registered recruiting agents". The "replacement arrangement with an employer client"
   example was removed.
10. **Third parties:** "sourcing partners" became "registered recruiting agents". Added:
    each agent acts under its own registration and is responsible for its own services and
    charges.
11. **Fees and payments:** removed "even where we coordinate the payment for you". Added:
    a registered recruiting agent's statutory service charge is collected by that agent,
    which gives a receipt; it is not paid to us and is not our fee.
12. **Intellectual property:** the tagline named in the clause changed from "Go Gulf. Get
    Hired." to "Go Gulf. Go prepared." This depends on open question 1.

### Privacy Policy

1. **Information from employers and partners:** sources are now the registered recruiting
   agent we referred you to, or an employer (no longer "a medical centre or a visa
   processing agent").
2. **Candidate information:** "Documentation and mobilisation information" (visa, MOFA,
   emigration, ticketing) became "Documentation information": documents we help prepare.
   Visa, attestation, emigration and travel information is the agent's, held only where
   shared with us. "Application information" now names the agent we referred you to, and
   status information only where the agent or employer tells us. Health information is
   "told", not "handled".
3. **How we use it:** shortlisting became counselling and preparation. "Share with
   employers and partners" became referral, with your agreement, to a registered agent and
   through it to employers. Coordinating interviews and the documentation stage was
   replaced by "keep track of what the agent and employer tell us" and "help you prepare
   your documents". "Post-joining support" became "respond to any question or issue you
   raise".
4. **Grounds (consent):** mentions referral to a registered recruiting agent and the
   consent box on our forms.
5. **Who we share with:** a new first category, **Registered recruiting agents**, receive
   your profile and documents including the CV and passport copy. The agent shares them
   with employers and authorities as the process requires, and handles them under its own
   privacy terms. It links to /verify#partners. "Sourcing partners" was removed. Service
   providers no longer list medical centres, visa and travel agents.
6. **Visa, medical, embassy and government processing:** those steps are handled by the
   recruiting agent, which submits what each body requires. We do not submit visa or
   emigration applications ourselves.
7. **Retention:** "Records of a completed placement" became "Records of an application
   that led to employment".

### Pricing & Fees

1. **How our services are priced:** employers "want their hiring requirement introduced to
   registered recruiting agents" (was "need manpower sourced and hired"). The rate-card
   reasoning no longer mentions visa and medical steps.
2. **What costs nothing:** corrected the inaccurate "This website takes no payment from
   anyone: there is no checkout on it". It now says the website sells nothing, and its only
   payment page is the secure page reached from a payment link Go Gulf sends for an invoice
   it has already issued in writing (`/pay/[reference]`).
3. **Candidate-side services:** the list now matches the services (counselling, profile
   preparation, applications, documents, referral). Interviews, offers, visa and emigration
   are the agent's work.
4. **Employer-side services:** introduction and guidance only. The recruitment itself is
   agreed with the agent on the agent's terms. "Where we charge for an employer-side
   service…". The "replacement" arrangement was removed.
5. **What a Go Gulf fee covers:** the lists match the new services.
6. **New section, "A recruiting agent's charges, which are not our fee":** a registered
   agent may charge a service charge as the Emigration Act, 1983 and its rules allow. The
   agent collects it and gives a receipt. It is not paid to us, not part of any Go Gulf
   fee, and not set by us. "Don't pay it without the agent's receipt, or to Go Gulf."
7. **Third-party costs:** removed "even where we arrange or coordinate the payment" and
   the pass-through-at-cost paragraph. Third-party costs are paid to the provider or
   through the agent, not to us.
8. **How to pay:** online payment is only through the link sent for that invoice.
9. **Intro line** updated to mention the recruiting agent's charges.

No fee amount was added or changed.

### Cancellation & Refunds

1. **Scope:** does not apply to a registered recruiting agent's service charge, which the
   agent refunds, where due, under its own terms and the law.
2. **Nature of what we provide:** counselling, profile and document preparation, and
   referral (was sourcing, screening, interview, visa, travel and post-joining support).
   The "paid onward to an embassy… or an airline" example was removed.
3. **Fees:** the agent's charge is the agent's; neither it nor third-party costs are our
   fee.
4. **Refund not available:** "work already performed" examples updated. "Amounts paid to
   third parties on your behalf" now requires your written agreement, and the airfare,
   medical and embassy list was removed. Outcomes may be decided by an employer, **a
   recruiting agent** or an authority. The "replacement" wording was removed.

### Shipping & Delivery Policy

Not in the original list, but it described Go Gulf coordinating interviews, visas, MOFA
and ticketing, so it was aligned too.

1. The list of what we deliver now covers counselling, profile and CV, documents, referral,
   and employer introductions. Interviews, offers, visa and emigration are delivered by the
   agent.
2. "Scheduled appointments" (interviews, medicals, embassy) became "Counselling
   sessions".
3. Documents are passed, with your agreement, to the agent, rather than "submitted by us
   to the employer, embassy, ministry".

---

## 3. Deviations from the plan, and why

1. **The claims guard test was rewritten, not just extended.**
   `content/public-claims.test.ts` banned "recruiting agent", "registered recruit…" and
   "eMigrate" everywhere, so the new model could not be written at all. Those blanket bans
   were replaced with narrower ones. They still fail the build on any wording that makes Go
   Gulf a registered, licensed or authorised agent, or has "we/Go Gulf" place, select,
   hire, recruit or shortlist people, or arrange visas, offers or travel. "Get Hired",
   "Hire from India" and "bulk sourcing" are banned outright. A positive test checks that
   /verify, /candidates, the Terms and llms.txt each say plainly that Go Gulf is not a
   recruiting agent. This test immediately caught the old tagline in the Terms'
   intellectual-property clause.
2. **The official link is the MEA page, plus the eMigrate portal.** The plan asked for the
   eMigrate "active RA" list on emigrate.gov.in, confirmed from the site. emigrate.gov.in
   renders entirely in JavaScript, so no deep link to an RA list could be confirmed there.
   The Ministry of External Affairs publishes the district- and state-wise "List of Active
   RA" on [mea.gov.in/overseas-employment.htm](https://www.mea.gov.in/overseas-employment.htm)
   as a dated PDF that is replaced over time, and links eMigrate from the same page. The
   site links that stable page plus the eMigrate portal home
   ([https://www.emigrate.gov.in/](https://www.emigrate.gov.in/)). Both URLs are constants
   in `content/partners.ts`, so they can be swapped if the client prefers another official
   link.
3. **"With Go Gulf" has five steps, not four.** The plan listed application,
   registration, consultation and document preparation, then went straight to the agent.
   The actual hand-over, **Referral (with your agreement)**, is now its own step, so a
   candidate can see where Go Gulf's part ends. The agent's side keeps the plan's six items
   in five steps (medical sits with attestation), so the total stays ten.
4. **Job-to-partner mapping lives in the partner config.** Jobs have no partner column, and
   schema changes were out of scope. Each partner lists the job references it handles
   (`jobReferences`). The schema refuses a job assigned to two agents.
5. **The service catalogue was cut, not reworded.** Nine of the fourteen services described
   the agent's work (interviews, visas, medicals, attestation, immigration, flights,
   sourcing, screening) or work not confirmed (HR support, pre-departure orientation).
   Rewording them would still have offered them as Go Gulf services, so they were removed.
6. **The consent checkbox was added to all four forms.** The existing pattern (native
   validation, an error map and the server schema) took it cleanly through a small shared
   `ConsentField`. Consent is recorded in the staff notification email, **not** in the
   database, because there is no column for it and schema changes were out of scope (open
   question 7).
7. **The Shipping & Delivery Policy was edited** although the plan named four legal pages.
   It contradicted the new model. The edits are listed above.
8. **"Talk to a counsellor"** replaced "Ask on WhatsApp" on the main WhatsApp buttons, as
   the plan suggested. The button still opens WhatsApp and says so to screen readers.

### Round 2 deviations

9. **"Fees and expected timelines" in the Written disclosure step.** The brief's step
   text included "fees and expected timelines". "Fees" became "any Go Gulf fee", which is
   already a confirmed rule. **Expected timelines were left out of live copy:** no
   commitment to give timelines exists, and the brief also says to omit anything
   unconfirmed. It is open question 12; add it back with one catalogue string
   (`home.process.s5.body`) once confirmed.
10. **To keep the 5/5 split, two steps were merged:** "Application" and "Registration"
    became "Application and registration". **"Written disclosure" comes after "Referral"**,
    because it has to name the agent the profile was referred to, and the consent text says
    the identity is given before any payment, not before referral.
11. **The disclosure statement shows in both modes.** In "named" mode, the list (or its
    empty state) appears above the same promise, so switching modes never drops the
    written-disclosure commitment.
12. **The employer consent wording has no payment clause.** Employers don't pay a
    recruiting agent through this site, so "before I pay anything" would be wrong for
    them.
13. **The /verify anchor stays `#partners`** even though no partners are listed, so links
    from Privacy, About and the FAQ keep working in either mode.
14. **Leak check by canary.** With the list empty, "no partner leaks in hidden mode" proves
    nothing. A made-up canary partner (mapped to a real job reference) was added
    temporarily, the site was built in hidden mode, and all 193 rendered pages (including
    `llms.txt`) and every browser bundle were searched. No match. The canary only appeared
    in server code, where the config itself is compiled. The file was then restored. Unit
    tests repeat the check with partners on record, and a guard test fails if any public
    file reads partners other than through the public accessors.

---

## 4. Open questions for the client

Nothing below was guessed. Each one either keeps the current safe wording or was left out.

1. **Tagline.** "Go Gulf. Get Hired." implied placement and was replaced with "Go Gulf. Go
   prepared." on the header, footer, share image and Organization `slogan`. Approve it, or
   supply another. The Terms' IP clause names it too.
2. **Can Go Gulf charge candidates at all?** The site keeps the existing rule ("any Go
   Gulf fee is quoted in writing before you pay") and invents no fee. Whether an entity that
   is not a registered recruiting agent may lawfully charge emigrants for counselling and
   document preparation, and on what terms, is a question for the lawyer. The answer may
   change the Pricing page substantially.
3. **The partners themselves.** Names, registered RA numbers, cities, expiry dates,
   capacity, websites, and which jobs each handles. Send them in writing. They are recorded
   internally and stay hidden from the public (section 5).
4. **JobPosting `hiringOrganization`.** When an employer is confidential, the job's
   structured data names *Go Gulf* as the hiring organisation (`lib/job-posting.ts`, not
   changed). Under the new model that is inaccurate. Options: name the partner agent when
   one is mapped, or emit no JobPosting for confidential employers (loses Google Jobs
   visibility for those jobs). Needs an SEO and business decision.
5. **Post-joining support.** Does Go Gulf do anything after a candidate joins? The copy no
   longer promises it.
6. **Pre-departure orientation, HR support, hiring-process guidance.** The first two were
   removed as unconfirmed. "Hiring process guidance" (plain answers on how hiring from
   India works) was kept as an employer service because it is counselling-like. Please
   confirm or remove it.
7. **Storing consent.** Consent is recorded only in the notification email. A
   `consent_at` and policy-version column on `job_applications` (and storing enquiries at
   all) needs a migration, which was out of scope here.
8. **Third-party payments on a candidate's behalf.** The refund policy still allows for
   "amounts paid to third parties on your behalf with your written agreement". If Go Gulf
   never pays anything on a candidate's behalf, that bullet can go.
9. **Featured jobs and the "Professional opportunities" section** still say jobs are
   "highlighted by the Go Gulf team". That is factual, but confirm that listing jobs
   handled by partner agents is agreed with those agents.
10. **Translations.** When hi, ml, ta, bn and ar are translated, translators should start
    from this version, not the old one.

Round 2:

11. **A written agreement naming Go Gulf, the agent and the candidate.** Recommended,
    but not confirmed. Not on the site until the client and the lawyer agree its form. See
    `docs/DISPUTE_CONTROLS.md` §1.
12. **Stage-by-stage expected timelines in writing.** Not promised on the site. Confirm
    whether Go Gulf or the agent will give them, and in what form.
13. **A receipt from Go Gulf for every payment.** The site promises a written quote for
    any Go Gulf fee and the agent's receipt for its charge. Confirm that Go Gulf issues its
    own receipt too (the /pay page confirms payment on screen; a receipt document is not
    confirmed).
14. **Who sends the written disclosure, and when exactly.** The copy says "before you pay
    anything". Confirm who sends it (Go Gulf or the agent), in what form (email, WhatsApp,
    a signed document), and that no payment is ever taken before it is sent.
15. **Disclosure to employers.** Employers are told their requirement goes to registered
    recruiting agents, but not that they'll be told which one. Confirm whether employers
    should get the same written disclosure.
16. **Grievance contact.** The internal checklist calls for one named contact. Nothing new
    was published, and the existing Privacy Policy grievance section is unchanged until the
    client names a person.

---

## 5. How to add real partners

Only from details the client has confirmed in writing.

1. Check the agent on the Ministry of External Affairs list of active recruiting agents
   (linked from [mea.gov.in/overseas-employment.htm](https://www.mea.gov.in/overseas-employment.htm)),
   or on eMigrate. Copy the **registration number exactly** as it appears there.
2. Open [content/partners.ts](../content/partners.ts) and add an entry to `PARTNER_DATA`.
   It stays INTERNAL: while `PARTNER_DISPLAY` is `"hidden"` (the client's decision), none of
   it reaches a public page.

   ```ts
   const PARTNER_DATA: z.input<typeof partnerListSchema> = [
     {
       id: "agent-name-mumbai",            // lowercase-hyphenated; never change it later
       name: "Agent's registered name",
       city: "Mumbai",
       raRegistrationNumber: "…exactly as registered…",
       validUntil: "2030-12-31",           // optional: registration expiry (YYYY-MM-DD)
       website: "https://…",               // optional, https only
       capacity: "1000+",                  // optional: as on the official record
       active: true,                       // false hides it without deleting it
       jobReferences: ["GG-JOB-2026-0001"], // optional: jobs this agent handles
     },
   ];
   ```

3. Run `npm test`. The schema refuses a missing or empty RA number, a malformed date, a
   non-https website, a duplicate id or RA number, and a job given to two agents.
4. Commit and push to `staging`.

With `PARTNER_DISPLAY = "hidden"` (now): **nothing public changes.** The record is used
internally, for example when staff write the disclosure to a candidate. The public pages
keep showing the written-disclosure promise.

Only if the client later decides to name partners, set `PARTNER_DISPLAY` to `"named"` in
`content/partners.ts`. Then:

- `/verify` and `/candidates` list every **active**, unexpired partner, each with its RA
  number directly under its name, above the same promise and the official links;
- a job whose reference is listed shows "Recruiting agent: *name*, RA registration
  *number*";
- `/llms.txt` lists the partners.

Either way, a partner whose `validUntil` has passed (by the Indian date) stops counting
as published automatically.
`active: false` withdraws one at once.

---

## 6. What was verified

Round 1: lint, typecheck, 486 unit tests and the server build passed in the branch's
worktree.

Round 2:
- lint, typecheck and the server build pass;
- 519 unit tests pass, including:
  - hidden mode renders no partner name, number, city or website, even when partners are
    passed in;
  - named mode renders them, with the number under the name;
  - `llms.txt` in both modes, with partners on record;
  - the claims guard still catches 17 placement, licence and outcome phrasings and allows
    the referral model's own wording;
  - public files read partners only through the public accessors;
- the canary build check (round 2 deviation 14) found no leak.

The Playwright suite, including a new check that /verify and /candidates show the
disclosure and name no agent, has to run against staging after deployment. It needs
staging's data.

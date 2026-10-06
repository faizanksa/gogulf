# Dispute controls: internal checklist

> **INTERNAL. Not legal advice, not a contract template, not for publication.** This file
> lives in the repository only. It is not linked from the website and no page renders it.
> Every item is a control **to confirm with the client or the lawyer**. None of it is a
> promise to candidates until the client confirms it, the lawyer approves the wording, and
> it is added to the site deliberately.

**Why this exists.** Go Gulf is not a registered recruiting agent. It counsels candidates,
prepares documents and refers them to registered recruiting agents (RAs). When a placement
goes wrong (a delay, a visa refusal, a changed job, an unpaid wage), the candidate will
usually complain to the name they dealt with first: Go Gulf. Hiding the RA's name on the
public site (client decision, 6 Oct 2026) is acceptable only if each candidate knows, in
writing, who the RA is and who is responsible for what. These controls are meant to make
that true in practice and provable later.

**How to use it.** For each item, record the decision, the owner and where the evidence is
kept. Then change `Status` from *to confirm* to *confirmed (date, by whom)*.

---

## 1. Written disclosure and a three-party agreement

**What:** before the candidate's profile is passed to an RA, and before any payment (round 3 order), the candidate receives in writing:
- the RA's name and registration number;
- who does what (Go Gulf: counselling, preparation, referral; RA: recruitment, visa,
  emigration; employer: selection, employment);
- any Go Gulf fee.

**To confirm:** whether this becomes a signed three-party document (Go Gulf, the RA and the
candidate), or two documents. What language it is in (the candidate's own?). Who keeps the
signed copy.

**Evidence:** a signed copy attached to the case in the CRM before any referral or payment is recorded, and the candidate's agreement to the referral, recorded after the disclosure was sent. The consent box on the site only covers keeping the documents.

**Status:** to confirm with client or lawyer. *(The site already promises the written
disclosure. The "three-party agreement" is NOT promised on the site; it is an open
question in COPY_CHANGES.md.)*

## 2. Fees collected by the RA, with receipts

**What:** the RA's statutory service charge is collected by the RA, within the legal limit,
against the RA's own receipt. Go Gulf never collects or holds it.

**To confirm:**
- whether Go Gulf charges candidates anything at all, and whether it may lawfully do so;
- how a candidate is told the RA's charge before paying;
- the legal ceiling that applies.

**Evidence:** a copy of every RA receipt on the case. No payment to Go Gulf without an
invoice.

**Status:** to confirm with client or lawyer.

## 3. Delays and visa expiry

**What:** written rules for what happens when a stage overruns, or a visa or medical expires
before departure: who pays to redo it, and when a candidate may withdraw with a refund.

**To confirm:** the rules themselves, which party bears each cost (RA, employer, Go Gulf,
candidate), and whether stage-by-stage expected timelines are given in writing (an open
question; not on the site).

**Evidence:** the rules in the three-party agreement, and dated stage changes in the CRM.

**Status:** to confirm with client or lawyer.

## 4. RA due diligence on eMigrate

**What:** before referring anyone to an RA, and periodically after:
- check the RA's registration number and validity on eMigrate / the MEA list of active RAs;
- check its permitted capacity;
- check for any suspension, cancellation or complaints.

**To confirm:**
- how often to re-check (each referral? monthly?);
- who checks;
- what happens on a failed check (stop referrals; tell candidates already referred).

**Evidence:**
- the internal record in `content/partners.ts` (`validUntil`, `capacity`, `active`);
- a dated note (or screenshot) of each check, kept internally;
- an expired `validUntil` drops the partner from the "published" set automatically.

**Status:** to confirm with client or lawyer.

## 5. Employer demand-letter checks

**What:** for every job, the RA holds the employer's demand letter / power of attorney and
the job order is registered as required. Go Gulf sees evidence of this before listing the
job or referring candidates to it.

**To confirm:** what evidence Go Gulf asks the RA for, and who checks it.

**Evidence:** reference or copy kept against the job in the admin. The jobs table has no
field for it today; adding one needs a schema change, out of scope here.

**Status:** to confirm with client or lawyer.

## 6. Never on visit visas

**What:** no candidate is ever sent abroad to work on a visit or tourist visa. Employment
visas only, with emigration clearance where the passport requires it.

**To confirm:** the written rule, and what staff do if an RA or employer proposes otherwise
(refuse, record, stop working with that RA?).

**Evidence:** visa type recorded on the case before departure.

**Status:** to confirm with client or lawyer.

## 7. Record-keeping in the CRM

**What:** every candidate case shows, with dates:
- which RA it was referred to;
- the disclosure sent;
- the agreement signed;
- each payment and receipt (whose, how much);
- each stage change;
- every complaint.

**To confirm:**
- which of these the current CRM can hold (cases, notes, activities and tasks exist; there
  is no RA field on a case, no document upload for receipts, and no consent column);
- what needs a schema change, which is out of scope for this branch.

**Evidence:** the case record itself. Retention follows the Privacy Policy.

**Status:** to confirm with client or lawyer.

## 8. Grievance process with one named contact

**What:** one named person handles complaints, with a written process: acknowledge, record,
involve the RA, escalate, close. Candidates are told how to reach that person.

**To confirm:**
- the person;
- the contact address (the Privacy Policy's grievance section and business@ exist today;
  nothing new may be published until the client confirms it);
- any response times. Do not publish an SLA until the client commits to it.

**Evidence:** each complaint recorded on the case, with its outcome.

**Status:** to confirm with client or lawyer.

## 9. A lawyer on retainer

**What:** a lawyer familiar with the Emigration Act, 1983, consumer law and the DPDP Act,
retained to:
- review the three-party agreement;
- review the policy drafts (marked DRAFT on the site);
- review this checklist;
- advise when a dispute arises.

**To confirm:** who, scope, and when the policy drafts get reviewed. The legal pages must
not go to production before that review.

**Status:** to confirm with client or lawyer.

---

## Related

- Public wording of the disclosure: `messages/en.json` (`partners.disclosure`,
  `candidatesPage.inWriting.*`, `home.process.s5`) and the Terms draft.
- Partner record and display setting: `content/partners.ts` (`PARTNER_DISPLAY`).
- Open questions for the client: `docs/COPY_CHANGES.md`.

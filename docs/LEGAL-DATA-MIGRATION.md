# Legal & Company Data Migration

**Date:** 5 September 2026
**Trigger:** the MCA record supplied on 5 Sep 2026 is now the authoritative company identity. The
details previously published on the site are **not** to be assumed authoritative.

**Nothing in this document has been applied.** No company information has been changed, and the
existing GSTIN has not been removed from the codebase. This is the audit and the proposed mapping.

---

## 1. Current published identity vs MCA record

| Field | Currently published | MCA-authoritative | Verdict |
| --- | --- | --- | --- |
| Legal name | Chaudhary Gulf Travels Private Limited | **FAIZAN CHAUDHARY GULF TRAVELS PRIVATE LIMITED** | **Change** |
| CIN | *not published* | **U52291UP2024PTC198095** | **Add** |
| Company type | "Private Limited Company" | Private Company | Align wording |
| Classification | *not published* | Non-Government Company | Add |
| Incorporation date | *not published* | **22 February 2024** | Add |
| Registrar | *not published* | ROC-Uttar Pradesh I | Add |
| Registration number | *not published* | 198095 | Add |
| Authorised capital | *not published* | ₹1,00,000 | Add to config, **do not display** (§6) |
| Paid-up capital | *not published* | ₹10,000 | Add to config, **do not display** (§6) |
| Directors | *not published* | Faizan Chaudhary; Ruksana Chaudhary | Add to config, display optional |
| Business activity | *not published* | **Activities of travel agents and tour operators** | Add — and see §5 |
| Company status | *not published* | Active | Add |
| Registered office | 1st Floor, G No-364, Kishan Bhawan, Mishrapur Kursi Road, Mishrapur, Lucknow, UP – 226021 | **C/o Asha Yadav, G No-364, Mishrapur Kursi Road, Jankipuram, Lucknow, Uttar Pradesh, India, 226021** | **Change** — see §4 |
| GSTIN | 09AALCC6656L1ZY | **Not evidenced by the MCA record** | **Quarantine** — see §3 |
| GST registration type | "Regular" | Not evidenced | Quarantine |
| GST registered on | "9 May 2024" | Not evidenced | Quarantine |

### CIN cross-check — internally consistent

`U52291UP2024PTC198095` decomposes as:

| Segment | Value | Cross-check |
| --- | --- | --- |
| Listing status | `U` — unlisted | Consistent |
| Industry code | `52291` | Travel agency / tour operator activity — matches the stated business activity |
| State | `UP` | Matches ROC-Uttar Pradesh I and a Lucknow registered office |
| Year | `2024` | Matches incorporation 22 Feb 2024 |
| Class | `PTC` — Private Limited Company | Matches |
| Registration number | `198095` | Matches the stated registration number |

The CIN is self-consistent with every other MCA field supplied. No contradictions.

---

## 2. Where old company information appears

Centralisation is good: **30+ consumers read from `lib/legal.js`**. Only four literals are
hardcoded outside it.

### 2a. The single source of truth

| File | Lines | Contains |
| --- | --- | --- |
| `lib/legal.js` | 18, 19, 21 | `name`, `shortName`, `tradeName` |
| `lib/legal.js` | 22 | `constitution` |
| `lib/legal.js` | 23–25 | `gstin`, `gstRegistrationType`, `gstRegisteredOn` |
| `lib/legal.js` | 36–42 | `REGISTERED_ADDRESS` |

### 2b. Hardcoded duplicates — must be updated by hand

| File | Line | Content | Why it is hardcoded |
| --- | --- | --- | --- |
| `app/privacy-policy/page.js` | 10 | Company name inside the `description` metadata string | Metadata is a plain string, not JSX — cannot interpolate a constant at that position without a small refactor |
| `app/terms-and-conditions/page.js` | 15 | Company name inside the `description` metadata string | Same |
| `public/llms.txt` | 27 | Company name | Static text file — cannot import from `lib/legal.js` |
| `public/llms.txt` | 28 | **GSTIN `09AALCC6656L1ZY`** | Same |
| `public/llms.txt` | 29 | Registered office address | Same |

`llms.txt` is the real drift risk: it is the only published surface that cannot read the config, and
it is consumed by AI answer engines. If it disagrees with the policy pages, the site tells crawlers
one thing and readers another.

**Recommendation:** generate `llms.txt` at build time from `lib/legal.js` (an `app/llms.txt/route.js`
with `dynamic = "force-static"`, exactly as `robots.js` and `sitemap.js` already do). That removes
the last hardcoded copy permanently. Phase 2.

### 2c. Derived consumers — update automatically, no edit needed

All of these read `LEGAL_ENTITY.*` or `ADDRESS_*` and will pick up new values with no code change:

| File | Reads |
| --- | --- |
| `components/Footer.js` | `brand`, `name`, `constitution`, `gstin`, `ADDRESS_LINES` |
| `components/LegalPage.js` | `name`, `constitution`, `brand`, `gstin`, `ADDRESS_LINES` |
| `app/contact/page.js` | `name`, `gstin`, `ADDRESS_LINES` |
| `app/privacy-policy/page.js` | `brand`, `name`, `constitution`, `gstin`, `ADDRESS_ONE_LINE` |
| `app/terms-and-conditions/page.js` | `brand`, `name`, `constitution`, `gstin`, `ADDRESS_ONE_LINE` |
| `app/pricing/page.js` | `brand`, `name`, `gstin` |
| `app/cancellation-and-refunds/page.js` | `brand` |
| `app/shipping-policy/page.js` | `brand` |
| `lib/seo.js` | `name` → JSON-LD `legalName`; `gstin` → `taxID` **and** `vatID`; address → `PostalAddress` |

---

## 3. GSTIN findings — reported, not removed

As instructed, the existing GSTIN has **not** been deleted from production or the codebase.

### 3a. Every occurrence

| # | File | Line | Form | Status |
| --- | --- | --- | --- | --- |
| 1 | `lib/legal.js` | 23 | Literal `"09AALCC6656L1ZY"` | **Source of truth** |
| 2 | `public/llms.txt` | 28 | Literal `GSTIN: 09AALCC6656L1ZY` | **Hardcoded duplicate** |
| 3 | `components/Footer.js` | 159 | `{LEGAL_ENTITY.gstin}` — every page, sitewide | Derived |
| 4 | `components/LegalPage.js` | 50 | `{LEGAL_ENTITY.gstin}` — legal page header | Derived |
| 5 | `components/LegalPage.js` | 104 | `{LEGAL_ENTITY.gstin}` — contact block | Derived |
| 6 | `app/contact/page.js` | 65 | `{LEGAL_ENTITY.gstin}` | Derived |
| 7 | `app/pricing/page.js` | 213 | `{LEGAL_ENTITY.gstin}` — "registered under GST with GSTIN …" | Derived |
| 8 | `app/privacy-policy/page.js` | 29 | `{LEGAL_ENTITY.gstin}` | Derived |
| 9 | `app/terms-and-conditions/page.js` | 57 | `{LEGAL_ENTITY.gstin}` | Derived |
| 10 | `lib/seo.js` | 146 | JSON-LD `taxID` | Derived — asserted to search engines |
| 11 | `lib/seo.js` | 147 | JSON-LD `vatID` | Derived — asserted to search engines |

Also present in `ARCHITECTURE-AUDIT.md` (my own Phase 0 document, line 825), quoted as a fact
to preserve. That line is now superseded by this document.

### 3b. Value currently stored

`09AALCC6656L1ZY`

### 3c. What currently supports it

The provenance comment at `lib/legal.js:7–14` states the legal name, constitution, GSTIN,
registration date and address were *"transcribed from the company's GST Registration Certificate
(Form GST REG-06)."*

**That certificate has not been supplied to this project.** The only evidence is the comment
asserting it exists.

### 3d. Structural observation — the GSTIN does not appear to match the new company name

Reported as an inference from the GSTIN's format, **not** as a verification. It should be checked
against the actual certificate, not relied upon.

An Indian GSTIN is `<state><PAN><entity><Z><checksum>`. Here:

```
09  AALCC6656L  1  Z  Y
│   │           │  │  └─ checksum
│   │           │  └──── fixed 'Z'
│   │           └─────── entity number within the state
│   └─────────────────── PAN of the registered entity
└─────────────────────── state 09 = Uttar Pradesh  ✓ consistent
```

In a PAN, the **5th character is the first letter of the entity's name**. Here the PAN is
`AALCC6656L`, so the 5th character is **`C`**.

- `CHAUDHARY Gulf Travels Private Limited` → begins with **C** → consistent.
- `FAIZAN Chaudhary Gulf Travels Private Limited` → begins with **F** → the PAN's 5th character
  would be expected to be `F`.

The 4th character `C` correctly denotes a Company, and the state code `09` correctly denotes Uttar
Pradesh — so the GSTIN is well-formed. But its PAN appears to belong to an entity whose name starts
with "C", not "F".

**Two readings, both requiring the same action:**

1. The GSTIN belongs to a **different legal entity** — a separate "Chaudhary Gulf Travels Private
   Limited" — in which case publishing it alongside the new company name misstates who the customer
   is transacting with.
2. The MCA name and the PAN diverge for a benign registration reason.

Either way: **do not publish this GSTIN against the new company name until the GST certificate is
produced.** The instruction to quarantine it is correct, and this observation strengthens it.

### 3e. Has an official GST record been provided?

**No.** No GST certificate, no GST portal search result, no screenshot. Only the source-code comment
at `lib/legal.js:7`.

### 3f. Recommended handling

`lib/legal.js` was written to degrade gracefully when the entity was unknown — commit `a8f234f`
removed that capability when the values were restored. **Reinstate the `HAS_GSTIN` gate** so an
unverified GSTIN is simply absent rather than blank or wrong:

- Move the current value to a clearly-labelled `UNVERIFIED_GSTIN` constant, retained in the file
  with its provenance note. Nothing is lost.
- Set `LEGAL_ENTITY.gstin = ""` and export `HAS_GSTIN = Boolean(LEGAL_ENTITY.gstin)`.
- Every consumer renders the GSTIN line only when `HAS_GSTIN`, and `lib/seo.js` omits `taxID` and
  `vatID` from JSON-LD entirely rather than emitting an empty string.
- `/pricing` line 213 currently asserts *"is registered under GST with GSTIN …"*. That whole
  sentence is gated, not just the number — a GST-registration claim without a number is worse than
  saying nothing.

The pattern already existed in this codebase and worked; restoring it is low-risk.

**Nothing is deleted from production in this phase.** The change lands in Phase 2 with the rest of
the legal-page work, or sooner on your instruction.

---

## 4. Registered office — two records of the same place

| Source | Address |
| --- | --- |
| Currently published (GST-derived) | 1st Floor, G No-364, **Kishan Bhawan**, Mishrapur Kursi Road, **Mishrapur**, Lucknow, Uttar Pradesh – 226021, India |
| MCA | **C/o Asha Yadav**, G No-364, Mishrapur Kursi Road, **Jankipuram**, Lucknow, Lucknow, Uttar Pradesh, India, 226021 |

| Element | Match |
| --- | --- |
| Plot — G No-364 | Same |
| Road — Mishrapur Kursi Road | Same |
| City — Lucknow | Same |
| State — Uttar Pradesh | Same |
| PIN — 226021 | Same |
| Building descriptor | **Differs** — "1st Floor, Kishan Bhawan" vs "C/o Asha Yadav" |
| Locality | **Differs** — "Mishrapur" vs "Jankipuram" |

Same plot, road and PIN; different building descriptor and locality name. Consistent with one
physical location recorded differently in two official registers, but I cannot verify that.

**Recommendation:** the *registered office* published on legal pages should be the **MCA address
verbatim**, because that is the address of record for a registered company and is what a
counterparty or regulator will cross-check. If the GST address is later evidenced and differs, the
site can carry both, labelled — "Registered office (MCA)" and "Principal place of business (GST)" —
which is normal and honest.

**Confirm with the business** which address should receive legal notice.

---

## 5. Two substantive issues the MCA record surfaces

### 5a. Registered business activity is travel, not recruitment

MCA records the company's activity as **"Activities of travel agents and tour operators"**, and the
CIN's industry code `52291` agrees.

The website presently:

- declares itself `"@type": "EmploymentAgency"` in Organization JSON-LD (`lib/seo.js:139`)
- describes itself throughout as an *"overseas recruitment platform"*
- sells recruitment services on `/services`, `/candidates`, `/employers`

This is a mismatch between the registered activity and the advertised primary business. It is not
necessarily a problem — a company may carry on activities within its objects clause, and the
memorandum may well cover recruitment — but it is exactly the kind of inconsistency a payment
gateway's compliance review or a regulator notices.

**Two actions:**

1. Check the company's Memorandum of Association objects clause covers overseas recruitment.
2. Once the platform covers both recruitment and travel, the JSON-LD `@type` should arguably become
   `Organization` with both `EmploymentAgency` and `TravelAgency` expressed, so the structured data
   matches both the registered activity and the actual business. Phase 2.

### 5b. Overseas recruitment licensing — an open question, flagged not answered

`lib/legal.js:12–14` deliberately notes that no *"recruitment/emigration licence number"* is
recorded because none was evidenced.

Recruiting Indian nationals for overseas employment in ECR countries generally requires a
Registration Certificate as a Recruiting Agent from the Protector General of Emigrants under the
Emigration Act. All six countries the site targets — Saudi Arabia, UAE, Qatar, Oman, Kuwait,
Bahrain — are ECR countries. The site states it is *"MOFA compliant"* and operates *"direct
approval"* recruitment.

**I am flagging this as a question for the company and its advisors, not asserting non-compliance.**
I have no visibility into what licences the company holds. But a platform that takes candidate
payments for overseas placement should be able to state its licence position, and it currently
cannot. It also bears on the Razorpay relationship.

**Action:** confirm whether an RA licence is held. If yes, it belongs in `lib/legal.js` and on the
legal pages — it is a trust asset. If no, the service descriptions need review with counsel.

---

## 6. Information that should NOT be published

| Field | Recommendation | Reason |
| --- | --- | --- |
| Authorised capital ₹1,00,000 | Store in config, **do not display** | No legal requirement to publish. A candidate deciding whether to pay ₹1,00,000 in placement fees does not benefit from seeing it next to the company's capital |
| Paid-up capital ₹10,000 | Store in config, **do not display** | Same, more acutely |
| Director names | Store in config; **display only if the business wants a leadership section** | Public MCA record, so publishing is permitted — but it is a business and privacy choice, not an obligation |
| CIN | **Display** | Standard practice, verifiable, builds trust |
| Incorporation date | **Display** where relevant | Verifiable |
| Registered office | **Display** | Required in practice for legal notice |

Capital figures are public on MCA for anyone who looks — the recommendation is simply not to
surface them unprompted on a site whose customers are being asked for significant payments.

---

## 7. The "Since 2008 / 20+ Years" problem — now a direct contradiction

Phase 0 flagged these as unverified. With an authoritative incorporation date of **22 February
2024**, they are now in direct conflict with the company record.

| File | Line | Claim |
| --- | --- | --- |
| `lib/seo.js` | 153 | `foundingDate: "2008"` — **asserted to search engines as structured data** |
| `app/page.js` | 29 | Hero stat: `2008` / "Group Heritage" |
| `app/page.js` | 39 | Trust bar: "20+ Years of Trust · Since 2008" |
| `app/about/page.js` | 9 | Metadata description: "20+ years of trust, since 2008" |
| `app/about/page.js` | 78 | Section eyebrow: "Since 2008" |
| `app/about/page.js` | 82 | Card: "20+ Years of Trust — Serving candidates and employers since 2008" |
| `public/llms.txt` | 3 | "Operating since 2008" |

`foundingDate: "2008"` is the most exposed: it is machine-readable structured data on an entity
whose `legalName` and `taxID` are stated in the same JSON-LD block. A crawler comparing that to the
public MCA record sees a 16-year discrepancy on the same entity.

**Three legitimate resolutions — a business decision, not a technical one:**

1. **Group/proprietor heritage.** If the founders traded under a predecessor firm from 2008, say so
   precisely: *"Our team has worked in Gulf recruitment since 2008. Faizan Chaudhary Gulf Travels
   Private Limited was incorporated in 2024."* Both statements true, and the heritage claim
   survives. `foundingDate` becomes `2024-02-22`, with the narrative in prose.
2. **Drop the claim.** Remove "since 2008" and "20+ years" everywhere; set `foundingDate:
   "2024-02-22"`.
3. **Substantiate.** If a predecessor entity genuinely dates to 2008 and can be evidenced, name it.

**Recommendation: option 1**, if the heritage is real. It keeps the commercial value of the claim
and is accurate. Option 2 if not.

The same applies to *"Thousands of Placements — Every Year"* (`app/page.js:40`,
`app/about/page.js:83`), which remains entirely unevidenced and is a stronger factual claim than the
date. A company incorporated in 2024 with ₹10,000 paid-up capital claiming thousands of placements
annually invites scrutiny it does not need.

---

## 8. Proposed `lib/legal.js` structure

Extending the existing file rather than replacing it — the provenance-comment discipline in it is
good practice and is preserved.

```js
export const LEGAL_ENTITY = {
  // ---- MCA record, 5 Sep 2026 (authoritative) ----
  name: "Faizan Chaudhary Gulf Travels Private Limited",
  shortName: "Faizan Chaudhary Gulf Travels Pvt. Ltd.",
  tradeName: "Faizan Chaudhary Gulf Travels Private Limited",
  cin: "U52291UP2024PTC198095",
  companyType: "Private Company",
  classification: "Non-Government Company",
  constitution: "Private Limited Company",     // descriptive, for prose
  incorporationDate: "22 February 2024",
  incorporationISO: "2024-02-22",
  roc: "Registrar of Companies, ROC-Uttar Pradesh I",
  registrationNumber: "198095",
  businessActivity: "Activities of travel agents and tour operators",
  status: "Active",
  brand: "Go Gulf",

  // ---- Public on MCA, deliberately NOT displayed (see §6) ----
  authorisedCapitalINR: 100000,
  paidUpCapitalINR: 10000,
  directors: ["Faizan Chaudhary", "Ruksana Chaudhary"],

  // ---- NOT EVIDENCED ----
  gstin: "",                    // see UNVERIFIED_GSTIN below
  gstRegistrationType: "",
  gstRegisteredOn: "",
};

// Quarantined, not deleted. Published on the site until 5 Sep 2026 against the
// previous company name. Sourced only from a code comment claiming a GST REG-06
// certificate that was never supplied. Its PAN segment (AALCC6656L) has 'C' as
// its 5th character, which corresponds to an entity name beginning with "C" —
// not "Faizan…". Do not publish until the certificate is produced.
export const UNVERIFIED_GSTIN = "09AALCC6656L1ZY";

export const HAS_GSTIN = Boolean(LEGAL_ENTITY.gstin);
export const HAS_CIN   = Boolean(LEGAL_ENTITY.cin);

export const REGISTERED_ADDRESS = {           // MCA registered office
  careOf: "C/o Asha Yadav",
  lines: ["C/o Asha Yadav, G No-364", "Mishrapur Kursi Road, Jankipuram"],
  locality: "Lucknow",
  district: "Lucknow",
  region: "Uttar Pradesh",
  postalCode: "226021",
  country: "India",
  countryCode: "IN",
};
```

---

## 9. Structured-data changes (`lib/seo.js`)

| Line | Now | Proposed |
| --- | --- | --- |
| 139 | `"@type": "EmploymentAgency"` | Revisit in Phase 2 to reflect both recruitment and travel (§5a) |
| 145 | `legalName: LEGAL_ENTITY.name` | Picks up the new name automatically |
| 146–147 | `taxID` / `vatID` = gstin | **Omit entirely** while unverified — never emit `""` |
| 153 | `foundingDate: "2008"` | `"2024-02-22"`, per §7 |
| — | *(absent)* | Add `identifier` for the CIN — a verifiable public identifier |
| 56–60 | Address from `REGISTERED_ADDRESS` | Picks up the MCA address automatically |

---

## 10. Legal-page review — required, not optional

Every page below states the operating entity. All read `lib/legal.js`, so the **name and address
propagate automatically** — but the surrounding *wording* must be re-read, because some sentences
assert things beyond the constants.

| Page | Automatic | Needs human review |
| --- | --- | --- |
| `/privacy-policy` | Name, constitution, address, GSTIN | Line 10 hardcoded name. GSTIN sentence at line 29. §third-parties (EmailJS→Resend). §cookies (breaks at auth) |
| `/terms-and-conditions` | Name, constitution, address, GSTIN | Line 15 hardcoded name. GSTIN sentence at line 57 |
| `/pricing` | Name, GSTIN | **Line 213 asserts GST registration** — gate the whole sentence |
| `/cancellation-and-refunds` | Brand only | Re-verify the refund window against real Razorpay behaviour before payments go live |
| `/shipping-policy` | Brand only | Low risk. Re-read once travel services sell physical deliverables (tickets, visas) |
| `/contact` | Name, GSTIN, address | GSTIN line at 65 |
| Footer | Name, constitution, GSTIN, address | Sitewide — highest-visibility surface |
| `llms.txt` | **Nothing** | All three values hardcoded. Regenerate from config (§2b) |

`POLICY_EFFECTIVE_DATE` and `POLICY_EFFECTIVE_ISO` (`lib/legal.js:57–58`, currently 11 August 2026)
must be bumped in the same commit as any substantive change.

**Do not rewrite the legal prose.** It is careful, and its restraint about unevidenced facts is a
feature. The changes proposed here are: swap constants, gate the GSTIN, correct the founding date,
and update the processor list — not a rewrite.

---

## 11. Unresolved — needed from the business

| # | Item | Blocks |
| --- | --- | --- |
| 1 | **GST certificate (Form GST REG-06)**, or written confirmation the company is not GST-registered | Publishing any GSTIN; GST invoicing in Phase 7 |
| 2 | Which address receives legal notice — MCA, or the GST address if different | Legal page updates |
| 3 | Whether an **overseas recruitment / PoE Recruiting Agent licence** is held (§5b) | Service descriptions; Razorpay compliance |
| 4 | Whether the MoA objects clause covers recruitment (§5a) | JSON-LD `@type`; service descriptions |
| 5 | Resolution for "Since 2008 / 20+ Years / Thousands of Placements" (§7) | Homepage, About, JSON-LD, llms.txt |
| 6 | Whether directors are named publicly | About page |
| 7 | Named DPDP **Grievance Officer** | Privacy policy |
| 8 | Whether the Razorpay merchant account is registered to the **new** entity name | Payments; refund flows |

Item 8 matters more than it looks: if Razorpay holds the account under the previous company name
while the website publishes a different legal entity, that inconsistency surfaces at settlement or
dispute — exactly when it is most expensive.

---

## 12. Sequencing

1. **Now:** report only. Nothing changed. *(this document)*
2. **On approval, before Phase 2:** update `lib/legal.js`; gate the GSTIN; fix the four hardcoded
   literals; correct `foundingDate`; bump the policy date. One commit, reviewed by whoever signs off
   legal changes (decision B5).
3. **Phase 2:** regenerate `llms.txt` from config; resolve the JSON-LD `@type`; apply the agreed
   "since 2008" wording.
4. **Phase 3 / 7 / 9:** processor list, cookie and account sections, payment and communication
   disclosures — each shipping in the same release as the feature that makes it necessary.

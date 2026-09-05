# Security Model

Treat this as a production financial and identity system. It stores passport scans, payment records
and phone numbers for people making significant financial commitments.

---

## 1. Non-negotiable stances

1. **The service-role key never reaches the browser.** Permitted uses only: verified webhooks, cron
   jobs, controlled migration tooling, system automation. **Never** to serve an ordinary customer or
   staff request.
2. **User-facing reads go through the caller's own Supabase session**, so RLS applies as
   defence-in-depth even when application-layer authorization has a bug.
3. **Every mutation** is a Server Action or Route Handler that re-authenticates, re-validates input
   with Zod, and re-checks permission server-side. Hiding a button is UX, not authorization.
4. **RLS is enabled on every table in `public`.** A table without a policy denies by default, and
   that is the intended failure mode.
5. **Money is integer paise.** No floating point, reports included.
6. **Never logged:** OTP codes, passwords, API keys, card/UPI data, full passport numbers, document
   contents, session tokens.
7. **No secret in `NEXT_PUBLIC_*`.** Enforced by `scripts/check-client-secrets.mjs`, which scans the
   built client bundle for the real values.

---

## 2. Current security posture — verified, not assumed

Measured against production on 5 Sep 2026 (`LEGACY-DATA-INSPECTION.md` §8). All probes read-only.

### What holds up

| Probe as anon (the key published in the browser) | Result |
| --- | --- |
| List buckets | 0 visible |
| List objects, bucket root and inside a known folder | 0 entries |
| Download an object with the exact key | HTTP 400 |
| Download via the public path with no key | HTTP 400 |
| Mint a signed URL | HTTP 400 |
| `SELECT` from `job_applications` | 0 rows |
| `SELECT count` | `content-range: */0` — count masked |
| `auth.users` | 0 users |

**The read-side RLS is correct and was tested, not inferred.** The Phase 0 audit raised the
anon-key model as a concern; on the read side that concern was unfounded, and the original
developer's work stands.

### What does not

| Issue | Severity | Detail | Closes |
| --- | --- | --- | --- |
| `anon` may INSERT rows and upload files, `with check (true)` | **High** | Unlimited unauthenticated writes. No rate limit, no CAPTCHA, no server validation | Phase 1 — writes move behind rate-limited server routes; anon INSERT revoked |
| Bucket accepts **any MIME type**, 10 MB | Medium | Malicious upload / storage-fill vector | Phase 1 — new bucket restricts types, server sniffs content |
| All validation is client-side | Medium | Trivially bypassed | Phase 1 — Zod on the server |
| Storage objects have no backup | **High** | Database backups exclude Storage (see `MIGRATION-PLAN.md` §6) | Phase 1 — independent mirror |
| No audit trail | Medium | Nothing records who accessed what | Phase 1 |

All five are consequences of the static-export architecture: with no server, the browser had to
write directly.

### Incident to note

During the Phase 0.5 repository sweep, a `grep` for env-var references matched `.env.local` and
**printed live secret values to the terminal** — the service-role key, Resend API key, Razorpay test
secret and the Supabase anon key. That was my error; the search should have excluded `.env*`.

The values reached the terminal and this session's transcript only, both on your own machine and
account. No value was written to a file, committed, or sent anywhere. **Recommended anyway, as
routine hygiene:** rotate `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` before production, and
regenerate the Razorpay test keys. The anon key is public by design and needs nothing. All future
searches exclude `.env*`.

---

## 3. Authentication

### Customer — phone + OTP

```
phone → OTP (provider abstraction) → verified → Supabase Auth session
                                                → contact_identities type 'auth_user'
                                                → resolves to the EXISTING contact
```

- Provider is pluggable (`lib/providers/otp/`): Firebase first, replaceable with MSG91 or Twilio
  without touching auth logic.
- **Rate limits, layered:** Supabase Auth defaults to 360 OTPs/hour with a 60-second per-request
  window (both configurable), plus our own per-phone and per-IP counters in Postgres. Neither alone
  is sufficient.
- OTP length and expiry set deliberately; Supabase recommends ≤ 1 hour, we use far shorter.
- **Only verified identities may authenticate.** An identity captured from a form is unverified
  until it passes OTP.
- OTPs are never logged, never returned in a response, never included in an error message.
- India **DLT registration** must be complete before production SMS — weeks of lead time, on the
  critical path for Phase 3.

### Staff — Google Workspace SSO

Restricted to the `gogulf.co` hosted domain. No password to leak, reset or share, and removing an
employee from Workspace revokes platform access immediately. `staff_users.is_active` is also checked
inside `has_perm()`, so deactivation takes effect on the **next query** rather than at token expiry.

Kept modular: staff auth is behind the same session abstraction, so it can change later without
touching the permission system.

### Separation

Customer sessions and staff sessions are distinct. A customer session can never satisfy
`has_perm()`; a staff session has no `current_contact_id()`. There is no shared "user" concept that
could accidentally bridge them.

---

## 4. Documents

| Requirement | Implementation |
| --- | --- |
| Private storage only | All buckets `public = false`. No "unlisted but public" tier exists |
| Server-authorized signed URLs | Minted only by a route that has authenticated the caller, checked the document's **category** permission, checked scope, and written an access record. **5-minute expiry** |
| Never emailed or logged | Signed URLs are single-purpose and short-lived |
| Access recorded | `document_access_log`: who, which document, when, from which IP |
| Upload validation | MIME sniffed from **content**, not filename or client `Content-Type`. Extension allow-list. Size capped server-side as well as at the bucket |
| Storage keys | The document UUID, never a user-supplied filename. Original filename kept in a column for recognition |
| Verification | `requested → uploaded → under_review → approved \| rejected → expired`, with `verified_by`, `verified_at`, `rejection_reason` |
| Expiry | Daily job flags documents expiring in 90/30/7 days, creates a task, notifies the customer if consented |
| Category permissions | `identity`, `employment`, `financial`, `travel`, `medical` — granted separately. See `RBAC-RLS.md` §3 |
| Customer access | Own documents only, enforced by RLS **and** by the signing route |
| Deletion | Soft delete → quarantine prefix → purge after the retention window. Gated on `documents.delete`, which almost nobody holds |

A candidate deployed on an expiring passport is a live operational failure, which is why expiry
tracking is a security requirement rather than a convenience.

---

## 5. Webhooks — one contract, every provider

1. Read the **raw** body before any JSON parsing. Signatures are computed over raw bytes; parsing
   first and re-serialising will fail verification or, worse, pass the wrong thing.
2. Verify the signature with a **timing-safe** comparison. `401` on failure.
3. Insert into `webhook_events`, unique on `(provider, provider_event_id)`. A duplicate means we
   have already seen this event: acknowledge `200` and stop.
4. Process inside a transaction; record `processed_at` or the error.
5. Return `2xx` quickly. Slow work goes to the outbox — every provider retries on timeout, and a
   slow handler turns one event into many.
6. **Never trust the payload as authorization.** Re-read the entity from our own database.

| Provider | Header | Scheme |
| --- | --- | --- |
| Razorpay | `X-Razorpay-Signature` | HMAC-SHA256(raw body, `RAZORPAY_WEBHOOK_SECRET`) |
| WhatsApp | `X-Hub-Signature-256` | HMAC-SHA256(raw body, `WHATSAPP_APP_SECRET`) |
| Resend | Svix headers | Svix signature verification |
| Telephony | provider-specific | Signature **and** source-IP allowlist |

`/api/cron/*` is authenticated by `CRON_SECRET`, so the endpoints are not openly callable.

---

## 6. Payments

- The webhook is the **only** thing that may mark a payment captured. The browser's success
  callback updates the UI and nothing else.
- Every attempt is recorded, including failures with the provider's reason.
- Refunds require **two different people** — `refunds.create` and `refunds.approve`, enforced by a
  database check constraint (`approved_by <> requested_by`), not by convention.
- Ledger rows are appended, never mutated. Balances are derived.
- Razorpay stays in **test mode** until Phase 7 sign-off. Live keys exist only in the production
  environment.
- No card, CVV, UPI PIN or bank credential ever touches our servers — that is the gateway's job,
  and the privacy policy already says so correctly.

---

## 7. Platform hardening

From Supabase's production checklist, applied here:

| Control | Setting |
| --- | --- |
| SSL enforcement on the database | On |
| Network restrictions | Restrict direct Postgres access to known IPs; the app uses the API |
| Organisation MFA | **Mandatory** for every Supabase account with access |
| Multiple org owners | So a lost account cannot orphan the project — exactly the situation blocker B1 described |
| Custom SMTP for auth email | So auth mail comes from `gogulf.co` and is not rate-capped |
| Auth rate limits | Tuned, then layered with our own per-phone and per-IP limits |
| Security & Performance Advisors | Reviewed before every production release |
| Secret rotation | Documented owner and schedule per secret |

---

## 8. Vulnerability classes and their controls

| Class | Control |
| --- | --- |
| **IDOR** | RLS scoped by `current_contact_id()` / `current_staff_id()`. A guessed UUID returns zero rows, not someone else's record |
| **Privilege escalation** | `roles.manage` and `permissions.manage` are SUPER_ADMIN only. `with check` clauses stop scope-hopping by reassigning branch |
| **Data leakage** | Category-scoped document permissions; `contacts.export` restricted to two roles; note visibility in the RLS predicate |
| **Secret exposure** | No secret in `NEXT_PUBLIC_*`; bundle scanner in CI; service role confined to webhooks/cron/tooling |
| **Unsafe upload** | Content-sniffed MIME, extension allow-list, server-side size cap, UUID storage keys, private bucket |
| **Broken RLS** | 14-assertion test matrix in CI (`RBAC-RLS.md` §6) |
| **Unprotected API** | `proxy.js` guards route groups; every handler re-checks independently |
| **Webhook replay** | `unique (provider, provider_event_id)` |
| **Webhook forgery** | Timing-safe signature verification before parsing |
| **OTP brute force** | Layered rate limits, short expiry, per-phone lockout |
| **Insider bulk extraction** | Export permission restricted; `document_access_log` reviewed weekly for unusual volume |
| **Audit tampering** | No `UPDATE`/`DELETE` policy on `audit_logs` for any role |
| **XSS / injection** | React escaping; Zod validation; parameterised queries; CSP headers via `proxy.js` |

---

## 9. Monitoring

| Concern | Tool | Catches |
| --- | --- | --- |
| **Webhook failures** | Sentry alert + DB check on `webhook_events.error is not null` | **Highest severity in the system** — a silently failing Razorpay webhook means customers pay and we never know |
| Application errors | Sentry, server + client + edge | Unhandled exceptions, Server Action failures, with release tagging |
| Outbox backlog | Cron check on pending rows older than 15 minutes | Stuck notifications, unsent email |
| Auth anomalies | Supabase auth logs + alerts | OTP brute force, unusual admin login times or locations |
| Payment reconciliation | Daily job | Razorpay settlement report vs `payments`; divergence raises a `FINANCE_MANAGER` task |
| Document access | Weekly report on `document_access_log` | Unusual volume of identity-document views by one user |
| Delivery health | Resend + WhatsApp webhooks → `communications.status` | Rising bounce and failure rates |
| Database health | Supabase Reports + Advisors | Slow queries, missing indexes, RLS gaps |
| Uptime | External HTTP monitor on `/api/health` | Checks DB reachability, storage reachability, outbox lag |

**Alert routing:** critical (payment webhook failure, auth outage, database down) pages a human.
High (outbox backlog, elevated error rate) goes to email and in-app. Everything else is a daily
digest. Only alerts a human can act on at 2 a.m. are allowed to wake one.

**Redaction is belt and braces:** a Sentry `beforeSend` scrubber *and* a logging helper that
redacts by key name. This is the class of mistake that ends up in a breach notification, so one
control is not enough.

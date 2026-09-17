# Google Workspace SSO for staff

How staff sign in to `/admin`, what has to exist in Google Cloud, and the exact
values for each Supabase project. Written 16 Sep 2026, after the identity chain
was verified on Mumbai staging.

---

## 1. Where `@gogulf.co` is actually enforced

**Supabase does not enforce it.** Automatic identity linking matches on the email
address alone; Google's `hd` (hosted domain) claim is not checked. Assuming
otherwise is the mistake to avoid here — a correctly configured Supabase project
will happily authenticate `random.person@gmail.com`.

Three independent controls do the work, and each is load-bearing:

| Control | Where | What it stops |
| --- | --- | --- |
| OAuth consent screen set to **Internal** | Google Cloud | A non-Workspace Google account cannot even consent |
| `enable_signup = false` | Supabase auth config | No account is created for anyone not pre-created |
| `staff_users` row required | `custom_access_token_hook` (`0006`) | No row ⇒ no `app_role`, `app_staff_id`, `app_branch` ⇒ `has_perm()` fails, RLS returns nothing, the route guard rejects the session |

The third is the real authorization boundary: the first two prevent an account
existing, the third makes an account worthless if one somehow does.

Verified on Mumbai staging — an authenticated `@gmail.com` identity received no
claims, no role, no permissions, and read zero rows from `contacts` and
`staff_users`.

## 2. What must exist in Google Cloud

One OAuth 2.0 Web application client, in a project owned by the `gogulf.co`
Workspace.

- **User type: Internal.** Not "External". Internal restricts sign-in to the
  Workspace and is the only one of the three controls that works before an
  account exists.
- **Authorized JavaScript origins** — the site, not Supabase.
- **Authorized redirect URIs** — Supabase, not the site. This is the one people
  get wrong: the browser returns to Supabase, which then redirects to the app.

The redirect URI is **project-specific**, which is why production Google OAuth
cannot be configured until the final production project ref is settled. Both
Mumbai refs are now fixed, so both values below are final.

## 3. Exact values

### Mumbai staging — `noxireidrbeqcvsirjec` (rehearsal)

| Setting | Value |
| --- | --- |
| Authorized redirect URI | `https://noxireidrbeqcvsirjec.supabase.co/auth/v1/callback` |
| Authorized JavaScript origin | `https://staging.gogulf.co` |
| Supabase `site_url` | `https://staging.gogulf.co` |
| Supabase `additional_redirect_urls` | `https://staging.gogulf.co/**` |
| Post-sign-in destination | `/admin` |

### Mumbai production — `exsnksrmkycloxiajwmx` — **NOT YET APPLIED**

| Setting | Value |
| --- | --- |
| Authorized redirect URI | `https://exsnksrmkycloxiajwmx.supabase.co/auth/v1/callback` |
| Authorized JavaScript origins | `https://www.gogulf.co` and `https://gogulf.co` |
| Supabase `site_url` | `https://www.gogulf.co` |
| Supabase `additional_redirect_urls` | `https://www.gogulf.co/**` |
| Post-sign-in destination | `/admin` |

Both origins are listed for production because `gogulf.co` 308-redirects to
`www.gogulf.co`; registering only one leaves a broken path depending on how the
staff member typed the address.

The same Google client can serve both projects — add both redirect URIs to it —
or use two clients. Two is tidier if staging is ever handed to someone who should
not hold the production secret.

## 4. Applying it

Credentials go in `.env.google-oauth.local` (gitignored, never committed):

```
GOGULF_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOGULF_GOOGLE_SECRET=...
```

`config.toml` references them as `env(GOGULF_GOOGLE_CLIENT_ID)` and
`env(GOGULF_GOOGLE_SECRET)`, so no secret is written to the repository.

```bash
set -a && . ./.env.google-oauth.local && set +a
npx supabase config push --project-ref noxireidrbeqcvsirjec     # staging
```

`config push` sends **every** setting in `config.toml` and has no preview.
Pushing with those variables unset writes an empty client id and breaks the
provider, so export them first and confirm a second push reports no changes.

Production is deliberately absent from that command. It gets the same treatment
at cutover, not before.

## 4a. The sign-in flow in the app (Phase 3)

1. `/admin/login` — "Sign in with Google" posts to a Server Action
   (`app/(admin)/admin/login/actions.ts`), which calls `signInWithOAuth` with PKCE and
   `redirectTo = <NEXT_PUBLIC_SITE_URL>/auth/callback?next=/admin…`. The site URL must be
   covered by `additional_redirect_urls` (`https://staging.gogulf.co/**` on staging).
2. Google → `https://<ref>.supabase.co/auth/v1/callback` → `/auth/callback?code=…`.
3. `app/auth/callback/route.ts` exchanges the code for a session and redirects to `next`,
   which `safeStaffNext()` restricts to `/admin` paths (no open redirect).
4. `/admin`'s guard classifies the session (`amr` oauth + provider google + staff claims)
   and asks `is_staff()` live. A Google account without an active `staff_users` row is
   sent back to the sign-in page.

`hd=gogulf.co` is passed to Google as a hint only — see §1 for the real controls.
There is no password form: staff sessions signed in any other way are refused by the guard.

## 5. Verifying a sign-in actually worked

A 200 and a session are not proof. Check the claims:

```sql
select raw_app_meta_data ->> 'provider' as provider,
       (select count(*) from auth.identities i where i.user_id = u.id
          and i.provider = 'google') as google_identities
  from auth.users u where email = 'admin@gogulf.co';
```

Then decode the access token and confirm `app_role = SUPER_ADMIN`,
`app_staff_id` is present, and `amr` contains `oauth` with provider `google`.
`lib/auth/route-guard.ts` requires all of it: staff claims arriving through a
password or a non-Google OAuth provider are rejected, which is tested in
`lib/auth/route-guard.test.ts`.

Test **both** administrators separately. They are independent identities with
different `auth.users` and `staff_users` rows, and one working sign-in says
nothing about the other.

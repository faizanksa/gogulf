import Link from "next/link";
import type { ReactNode } from "react";
import { SkipLink } from "@/components/site/SkipLink";
import { deploymentStage } from "@/lib/deployment";
import { supabaseProjectRef, type StaffContext } from "@/lib/auth/staff";
import { signOut } from "@/app/(admin)/admin/(protected)/actions";
import { AdminNav, type AdminNavItem } from "./AdminNav";
import styles from "./admin.module.css";

/**
 * The staff workspace frame: who is signed in, where this deployment's data lives, and
 * the sections this person's role can use.
 *
 * Outside production the header names the environment and the Supabase project, so a
 * tester can see at a glance which database they are changing. Navigation is filtered by
 * permission for usability only — each page and action checks again, and RLS decides.
 */
export function AdminShell({ staff, children }: { staff: StaffContext; children: ReactNode }) {
  const stage = deploymentStage();
  const ref = supabaseProjectRef();

  const items: AdminNavItem[] = [
    { href: "/admin", label: "Dashboard" },
    ...(staff.can["jobs.view"] ? [{ href: "/admin/jobs", label: "Jobs" }] : []),
    ...(staff.can["jobs.manage"] ? [{ href: "/admin/jobs/categories", label: "Categories", sub: true }] : []),
    ...(staff.can["applications.screen"] ? [{ href: "/admin/applications", label: "Applications" }] : []),
    ...(staff.can["contacts.view"] ? [{ href: "/admin/contacts", label: "Contacts" }] : []),
    ...(staff.can["cases.view"] ? [{ href: "/admin/cases", label: "Cases" }] : []),
  ];

  return (
    <>
      <SkipLink />
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link href="/admin" className={styles.brand}>
            Go Gulf <span className={styles.brandSub}>Staff workspace</span>
          </Link>
          {stage !== "production" ? (
            <span className={styles.env}>
              {stage === "staging" ? "Staging" : stage === "preview" ? "Preview" : "Local"}
              {ref ? <span className={styles.envRef}>· {ref}</span> : null}
            </span>
          ) : null}
          <div className={styles.user}>
            <span className={styles.userName}>
              <span>{staff.email}</span>
              <span className={styles.userRole}>
                {staff.roleLabel}
                {staff.branch ? ` · ${staff.branch}` : ""}
              </span>
            </span>
            <form action={signOut}>
              <button type="submit" className={styles.signOut}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className={styles.frame}>
        <AdminNav items={items} />
        <main id="main-content" tabIndex={-1} className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </div>
    </>
  );
}

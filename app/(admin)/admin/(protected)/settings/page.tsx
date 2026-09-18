import type { Metadata } from "next";
import { NotAllowed, PageTitle, Panel, Time } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { AlertView } from "@/components/ui/AlertView";
import { Badge } from "@/components/ui/Badge";
import { listSettings } from "@/lib/admin/platform-data";
import { getStaffContext } from "@/lib/auth/staff";

export const metadata: Metadata = { title: "Settings" };

/**
 * System settings, as recorded. Read-only in the MVP, and honestly so: these flags are
 * records of what each phase intends to switch on, and nothing in the running application
 * reads them — billing, for example, is on or off according to whether Razorpay credentials
 * exist (see Integrations), not this table. A toggle here would look like a control while
 * controlling nothing, so there is none. Writes remain possible only for `settings.manage`
 * holders (SUPER_ADMIN) and are audited.
 */
export default async function SettingsPage() {
  const staff = await getStaffContext();
  if (!staff?.can["settings.manage"]) return <NotAllowed what="viewing system settings" />;

  const settings = await listSettings();

  return (
    <>
      <PageTitle title="System settings" description="Feature records for the platform." />
      <AlertView tone="info" toneLabel="Note" title="These flags are records, not switches: nothing in the application reads them yet. Payments, for example, follow the Razorpay configuration shown under Integrations." />

      <Panel id="settings-list" title="Settings">
        {settings.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="visually-hidden">System settings</caption>
              <thead>
                <tr>
                  <th scope="col">Setting</th>
                  <th scope="col">Value</th>
                  <th scope="col">What it is for</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <tr key={s.key}>
                    <td data-label="Setting" className={styles.mono}>
                      {s.key}
                    </td>
                    <td data-label="Value">{typeof s.value === "boolean" ? <Badge tone={s.value ? "green" : "neutral"}>{s.value ? "On" : "Off"}</Badge> : <span className={styles.mono}>{JSON.stringify(s.value)}</span>}</td>
                    <td data-label="What it is for">{s.description ?? "—"}</td>
                    <td data-label="Updated" className={styles.nowrap}>
                      <Time iso={s.updated_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.muted}>No settings recorded.</p>
        )}
      </Panel>
    </>
  );
}

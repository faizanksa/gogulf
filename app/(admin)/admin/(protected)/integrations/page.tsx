import type { Metadata } from "next";
import { NotAllowed, PageTitle, Panel } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { Badge } from "@/components/ui/Badge";
import { integrationStatuses } from "@/lib/admin/integrations";
import { getStaffContext } from "@/lib/auth/staff";
import { deploymentStage } from "@/lib/deployment";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = { title: "Integrations" };

const TONES = { ok: "green", warning: "warning", off: "neutral", info: "blue" } as const;
const WORDS = { ok: "Working", warning: "Check", off: "Not configured", info: "Managed elsewhere" } as const;

/**
 * What each third-party service is doing on this deployment — presence and mode only. No
 * key, secret or length is ever shown (lib/admin/integrations.ts); credentials are
 * changed in Vercel and the provider's dashboard, never here.
 */
export default async function IntegrationsPage() {
  const staff = await getStaffContext();
  if (!staff?.can["integrations.manage"]) return <NotAllowed what="viewing integrations" />;

  const list = integrationStatuses(process.env, deploymentStage(), SITE_URL);

  return (
    <>
      <PageTitle title="Integrations" description="What each service is doing on this deployment. No credential is displayed; they are changed in Vercel and the provider's own dashboard." />
      {list.map((item) => (
        <Panel key={item.key} id={`int-${item.key}`} title={item.name} actions={<Badge tone={TONES[item.state]}>{WORDS[item.state]}</Badge>}>
          <p>{item.summary}</p>
          <ul className={styles.plainList}>
            {item.details.map((d) => (
              <li key={d} className={styles.muted}>
                {d}
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </>
  );
}

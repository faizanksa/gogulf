import Link from "next/link";
import { PageTitle } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";

/** A record that does not exist — or that this role's scope does not include. The two are not told apart. */
export default function NotFound() {
  return (
    <>
      <PageTitle title="Not found" />
      <div className={styles.panel}>
        <p>This record does not exist, or your role cannot see it.</p>
        <p>
          <Link href="/admin">Back to the dashboard</Link>
        </p>
      </div>
    </>
  );
}

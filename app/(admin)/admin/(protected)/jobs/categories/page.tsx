import type { Metadata } from "next";
import { CategoryToggle, NewCategoryForm } from "@/components/admin/CategoryControls";
import { NotAllowed, PageTitle, Panel } from "@/components/admin/ui";
import styles from "@/components/admin/admin.module.css";
import { Badge } from "@/components/ui/Badge";
import { getStaffContext } from "@/lib/auth/staff";
import { listCategories } from "@/lib/jobs/admin-data";
import { CLASSIFICATION_LABELS, CLASSIFICATIONS } from "@/lib/jobs/model";
import { createCategory, setCategoryActive } from "./actions";

export const metadata: Metadata = { title: "Job categories" };

/** Categories are data. A new one is a row here; nothing in the code lists them. */
export default async function CategoriesPage() {
  const staff = await getStaffContext();
  if (!staff?.can["jobs.manage"]) return <NotAllowed what="managing job categories" />;
  const categories = await listCategories();

  return (
    <>
      <PageTitle
        eyebrow="Jobs"
        title="Job categories"
        description="Each category belongs to general hiring or professional opportunities, which decides where its jobs appear on the Jobs page. Deactivating a category hides it from new jobs only."
      />
      <Panel id="new-category" title="Add a category">
        <NewCategoryForm action={createCategory} />
      </Panel>
      {CLASSIFICATIONS.map((classification) => (
        <Panel key={classification} id={`categories-${classification}`} title={CLASSIFICATION_LABELS[classification]}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="visually-hidden">{CLASSIFICATION_LABELS[classification]} categories</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories
                  .filter((c) => c.classification === classification)
                  .map((c) => (
                    <tr key={c.id}>
                      <td data-label="">
                        <div className={styles.cellMain}>
                          <strong>{c.name}</strong>
                          <span className={styles.mono}>{c.slug}</span>
                        </div>
                      </td>
                      <td data-label="Status">{c.is_active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                      <td data-label="">
                        <CategoryToggle id={c.id} active={c.is_active} action={setCategoryActive} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
    </>
  );
}

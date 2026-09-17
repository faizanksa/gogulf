"use client";

import { Input, Select } from "@/components/form/Controls";
import type { ActionState } from "@/lib/admin/action-state";
import { ActionForm, SubmitButton } from "./ActionForm";
import styles from "./admin.module.css";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function NewCategoryForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} hidden={{}}>
      {(pending) => (
        <div className={styles.filters}>
          <div className={`${styles.filterField} ${styles.filterSearch}`}>
            <label htmlFor="category-name" className={styles.filterLabel}>
              Category name
            </label>
            <Input id="category-name" name="name" maxLength={60} required />
          </div>
          <div className={styles.filterField}>
            <label htmlFor="category-classification" className={styles.filterLabel}>
              Classification
            </label>
            <Select id="category-classification" name="classification" defaultValue="general">
              <option value="general">General hiring</option>
              <option value="professional">Professional</option>
            </Select>
          </div>
          <div className={styles.filterActions}>
            <SubmitButton pending={pending}>Add category</SubmitButton>
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function CategoryToggle({ id, active, action }: { id: string; active: boolean; action: Action }) {
  return (
    <ActionForm action={action} hidden={{ id, active: String(!active) }}>
      {(pending) => (
        <SubmitButton pending={pending} variant="secondary">
          {active ? "Deactivate" : "Reactivate"}
        </SubmitButton>
      )}
    </ActionForm>
  );
}

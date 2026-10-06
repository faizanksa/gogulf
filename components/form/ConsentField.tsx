import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { Checkbox } from "./Controls";
import type { FieldText } from "./Field";
import fieldStyles from "./Field.module.css";
import styles from "./Controls.module.css";

/** The consent words, built on the server with the rest of a form's copy. */
export interface ConsentText {
  label: string;
  /** "Read our Privacy policy" — the link text. */
  policy: string;
  policyHref: string;
  missing: string;
  opensInNewTab: string;
}

/**
 * The required consent checkbox every public form ends with. Wired like Field: the error
 * is read before the control and tied to it with aria-describedby, and aria-invalid is set
 * only while there is an error. The privacy policy opens in a new tab so a half-filled
 * form is not lost. Submitted as `consent: true`; the server refuses anything else
 * (lib/forms/schemas.ts).
 */
export function ConsentField({ id, text, field, error }: { id: string; text: ConsentText; field: FieldText; error?: string }) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cx(fieldStyles.field, error && fieldStyles.hasError)}>
      {error ? (
        <p id={errorId} className={fieldStyles.error}>
          <Icon name="error" size={18} />
          <VisuallyHidden>{field.errorPrefix} </VisuallyHidden>
          {error}
        </p>
      ) : null}
      <Checkbox id={id} name="consent" value="yes" label={text.label} required aria-describedby={errorId} aria-invalid={error ? true : undefined} />
      <p className={styles.consentPolicy}>
        <a href={text.policyHref} target="_blank" rel="noopener noreferrer">
          {text.policy}
          <VisuallyHidden> {text.opensInNewTab}</VisuallyHidden>
        </a>
      </p>
    </div>
  );
}

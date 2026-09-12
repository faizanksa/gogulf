import { getTranslator } from "@/lib/i18n/server";
import styles from "./SkipLink.module.css";

/** First focusable element on every page; jumps past the header to the main content. */
export async function SkipLink() {
  const t = await getTranslator();
  return (
    <a href="#main-content" className={styles.skip}>
      {t("common.skipToContent")}
    </a>
  );
}

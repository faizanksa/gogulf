import styles from "./SkipLink.module.css";

/** First focusable element on every page; jumps past the header to the main content. */
export function SkipLink() {
  return (
    <a href="#main-content" className={styles.skip}>
      Skip to main content
    </a>
  );
}

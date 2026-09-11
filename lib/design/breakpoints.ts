/**
 * Breakpoints, mobile first — the values styles/tokens.css documents. CSS custom
 * properties cannot be used inside media queries, so CSS Modules write these numbers
 * literally; this file is the reference for scripts and tests.
 */
export const BREAKPOINTS = { sm: 480, md: 768, lg: 1024, xl: 1280 } as const;

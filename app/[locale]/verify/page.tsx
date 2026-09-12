/**
 * /<locale>/verify — the verify page in another language. One implementation, in
 * app/(marketing)/verify/page.tsx; it 404s in any language content/pages.ts does not
 * list for it (the pseudo-locales get it, for testing).
 */
export { default, generateMetadata } from "@/app/(marketing)/verify/page";

/**
 * /<locale>/jobs — the jobs list in another language. One implementation, in
 * app/(marketing)/jobs/page.tsx; it 404s in any language content/pages.ts does not list.
 */
export { default, generateMetadata } from "@/app/(marketing)/jobs/page";

export const revalidate = 3600;

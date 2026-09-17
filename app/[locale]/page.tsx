/**
 * /<locale> — the home page in another language. One implementation, in
 * app/(marketing)/page.tsx; it 404s in any language content/pages.ts does not list.
 */
export { default, generateMetadata } from "@/app/(marketing)/page";

export const revalidate = 600;

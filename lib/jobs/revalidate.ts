/**
 * After a staff change to a job, refresh every public page that could show it.
 *
 * Server Actions only. `updateTag` expires the tagged job reads at once (read-your-own-
 * writes: the next visit renders fresh data), and the paths cover pages whose output
 * depends on those reads — including languages under app/[locale].
 */

import "server-only";

import { revalidatePath, updateTag } from "next/cache";
import { PUBLIC_JOBS_TAG } from "./public-data";

export function revalidateJobPages(slug?: string | null) {
  updateTag(PUBLIC_JOBS_TAG);
  revalidatePath("/");
  revalidatePath("/jobs");
  revalidatePath("/jobs/apply");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/jobs/${slug}`);
  revalidatePath("/(marketing)/jobs/[slug]", "page");
  revalidatePath("/[locale]", "layout");
}

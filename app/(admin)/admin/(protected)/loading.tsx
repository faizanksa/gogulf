import { Skeleton } from "@/components/ui/States";

/** Shown while a workspace page reads the database. */
export default function Loading() {
  return <Skeleton lines={6} label="Loading" />;
}

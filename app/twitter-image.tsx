import { renderShareImage } from "@/lib/share-image";

// Literal values: Next reads these statically. Keep in step with lib/share-image.tsx.
export const alt = "Go Gulf — counselling and referral for Gulf jobs from India, Lucknow";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderShareImage();
}

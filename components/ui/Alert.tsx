import { getTranslator } from "@/lib/i18n/server";
import { AlertView, type AlertViewProps } from "./AlertView";

export type { AlertTone } from "./AlertView";

/**
 * An inline message, for Server Components: translates its spoken tone label itself.
 * Client Components use AlertView and pass the label in.
 */
export async function Alert(props: Omit<AlertViewProps, "toneLabel">) {
  const t = await getTranslator();
  return <AlertView {...props} toneLabel={t(`common.tone.${props.tone ?? "info"}`)} />;
}

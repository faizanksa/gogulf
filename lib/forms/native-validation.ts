/**
 * Browser-side validation using the platform's own constraint API — no library.
 *
 * Gives immediate, specific feedback before anything is sent. It is a convenience,
 * never a control: every server route re-validates with Zod and its field errors are
 * rendered through the same path.
 */

export interface FormError {
  /** The `id` of the field the message is about (links from the error summary). */
  fieldId: string;
  /** The field `name` — how the server reports it. */
  name: string;
  message: string;
}

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * Collect every invalid control in `form`. `messages` maps a field name to the message
 * to show; controls without one fall back to the browser's own validation message.
 */
export function collectNativeErrors(
  form: HTMLFormElement,
  messages: Record<string, (control: Control) => string> = {},
): FormError[] {
  const errors: FormError[] = [];
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
    if (!el.name || el.type === "hidden" || el.validity.valid) continue;
    const message = messages[el.name]?.(el) ?? el.validationMessage;
    errors.push({ fieldId: el.id || el.name, name: el.name, message });
  }
  return errors;
}

/** Turn server field errors ({ name: [messages] }) into the same shape. */
export function fromServerErrors(fieldErrors: Record<string, string[]> | undefined, idFor: (name: string) => string): FormError[] {
  if (!fieldErrors) return [];
  return Object.entries(fieldErrors)
    .filter(([, list]) => list.length > 0)
    .map(([name, list]) => ({ name, fieldId: idFor(name), message: list[0] as string }));
}

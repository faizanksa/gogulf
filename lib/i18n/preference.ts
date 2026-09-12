/**
 * The reader's language preference, kept in the browser's localStorage — not a cookie
 * (the privacy policy promises none) and never sent to the server. It only decides
 * whether the language suggestion appears; nothing ever redirects on it.
 *
 * Client-safe: no server imports.
 */

const PREFERRED = "gg-lang";
const SUGGESTIONS_OFF = "gg-lang-suggest";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked storage, private modes
  }
}

export function readPreferredLocale(): string | null {
  return storage()?.getItem(PREFERRED) ?? null;
}

export function rememberLocale(code: string): void {
  try {
    storage()?.setItem(PREFERRED, code);
  } catch {
    // quota or privacy settings: the choice still applies to this page view
  }
}

export function suggestionsDismissed(): boolean {
  return storage()?.getItem(SUGGESTIONS_OFF) === "off";
}

export function dismissSuggestions(): void {
  try {
    storage()?.setItem(SUGGESTIONS_OFF, "off");
  } catch {
    // as above
  }
}

export type ClipboardOutcome = "copied" | "blocked" | "unavailable";

/**
 * Write `text` to the clipboard, reporting why it failed instead of throwing so
 * callers can offer a manual-copy fallback.
 */
export async function copyText(text: string): Promise<ClipboardOutcome> {
  if (!navigator.clipboard?.writeText) return "unavailable";
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "blocked";
  }
}

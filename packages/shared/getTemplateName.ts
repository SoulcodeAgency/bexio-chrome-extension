import { TemplateEntry } from "./types";

/**
 * Returns the human-readable name for a template entry.
 *
 * Resolution order:
 * 1. `entry.templateName` — present in all entries created since v0.5.x.
 * 2. `entry.id` — fallback for entries created in v0.4.x and earlier, where `id` was used
 *    as the template name (no dedicated `templateName` field existed).
 * 3. `"No template name found"` — last-resort sentinel when both fields are absent or the
 *    entry itself is `undefined`/`null`.
 *
 * All UI code that displays a template name **must** go through this function rather than
 * reading `entry.templateName` directly, to keep backward-compat with v0.4.x stored data.
 *
 * @param entry  The template entry, or `undefined`/`null` for legacy callers.
 * @returns      The display name, always a non-empty string.
 */
function getTemplateName(entry: TemplateEntry): string {
    // Note: id was the template name in version 0.4.x - where no templateName did exist
    return entry?.templateName ?? entry?.id ?? "No template name found";
}

export default getTemplateName;
/**
 * The date this bundle was built, for the footer line — see `scripts/build-date/buildDate.ts`.
 * `typeof` rather than `??`: under Vitest the identifier is not defined at all (`src/buildDate.d.ts`).
 */
export const BUILD_DATE = typeof __BUILD_DATE__ === "string" ? __BUILD_DATE__ : "unknown";

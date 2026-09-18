/**
 * Replaced by a string literal at build time (`define` in this package's Vite config, value from
 * `scripts/build-date/buildDate.ts`). Typed `| undefined` on purpose: Vitest does not load the
 * package Vite configs, so under test the identifier does not exist at all — read it through
 * `typeof`, never directly, or the access throws a ReferenceError.
 */
declare const __BUILD_DATE__: string | undefined;

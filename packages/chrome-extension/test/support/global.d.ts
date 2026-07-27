import type { ChromeFake } from "../../../../test/support/chrome-fake";
declare global {
  // eslint-disable-next-line no-var
  var chrome: ChromeFake & typeof globalThis.chrome;
}
export {};

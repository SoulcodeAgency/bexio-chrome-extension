import { beforeEach } from "vitest";
import { installChromeFake, resetChromeFake } from "./chrome-fake";

installChromeFake();

beforeEach(() => {
  resetChromeFake();
});

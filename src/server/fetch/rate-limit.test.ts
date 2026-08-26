// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "./rate-limit";
describe("rate limit", () => {
  beforeEach(resetRateLimitsForTests);
  it("limits each key and resets after the window", () => {
    expect(checkRateLimit("a", 2, 1000, 0)).toBe(true);
    expect(checkRateLimit("a", 2, 1000, 1)).toBe(true);
    expect(checkRateLimit("a", 2, 1000, 2)).toBe(false);
    expect(checkRateLimit("a", 2, 1000, 1000)).toBe(true);
  });
});

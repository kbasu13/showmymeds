import { expect, test } from "vitest";
import { PREMIUM_PLANS } from "./plans";
test("premium prices", () => {
  expect(Object.fromEntries(PREMIUM_PLANS.map((p) => [p.id, p.price]))).toEqual({ monthly: 99, yearly: 990, lifetime: 4990 });
});

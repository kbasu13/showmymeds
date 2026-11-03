import { expect, test } from "vitest";
import { PREMIUM_PLANS } from "./plans";
test("premium prices", () => {
  expect(Object.fromEntries(PREMIUM_PLANS.map((p) => [p.id, p.price]))).toEqual({ monthly: 99, yearly: 990, lifetime: 4990 });
});
import { discountedPrice, randomCode, isPremiumActive } from "./plans";
test("50% off monthly ₹99 is ₹50", () => expect(discountedPrice(99, 50)).toBe(50));
test("75% off lifetime ₹4990 is ₹1248", () => expect(discountedPrice(4990, 75)).toBe(1248));
test("10% off yearly ₹990 is ₹891", () => expect(discountedPrice(990, 10)).toBe(891));
test("codes look like SMM-XXXXXX", () => expect(randomCode()).toMatch(/^SMM-[A-Z2-9]{6}$/));
test("expired free premium is not active", () => {
  expect(isPremiumActive("2020-01-01")).toBe(false);
  expect(isPremiumActive(null)).toBe(true);
});
import { withGst, upiLink } from "./plans";
test("monthly ₹99 + 18% GST is ₹116.82", () => expect(withGst(99)).toBe(116.82));
test("yearly ₹990 + 18% GST is ₹1168.20", () => expect(withGst(990)).toBe(1168.2));
test("UPI link pays kaustabh.basu-3@oksbi in INR", () => {
  expect(upiLink(116.82, "x")).toContain("pa=kaustabh.basu-3%40oksbi");
  expect(upiLink(116.82, "x")).toContain("am=116.82&cu=INR");
});

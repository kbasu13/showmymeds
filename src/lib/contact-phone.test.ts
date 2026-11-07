import { describe, expect, it } from "vitest";
import { displayPhone, internationalPhone } from "./contact-phone";

describe("International account contacts", () => {
  it("shows India's +91 code and complete mobile number", () => {
    expect(displayPhone("919876543210")).toBe("+91 98765 43210");
    expect(internationalPhone("+91 98765 43210")).toBe("+919876543210");
  });
  it("shows the US +1 code and complete mobile number", () => {
    expect(displayPhone("12025550123")).toBe("+1 202 555 0123");
    expect(internationalPhone("+1 (202) 555-0123")).toBe("+12025550123");
  });
  it("does not invent a country for a national-only number", () => {
    expect(displayPhone("9876543210")).toBe("9876543210");
    expect(internationalPhone("")).toBe("");
  });
});
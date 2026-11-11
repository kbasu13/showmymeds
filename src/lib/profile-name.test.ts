import { describe, expect, it } from "vitest";
import { firstName, invoiceBuyerName, profileName } from "./profile-name";

describe("account name presentation", () => {
  it("uses Kaustabh as the first name from a sign-in profile", () => {
    expect(firstName(profileName({ user_metadata: { full_name: "Kaustabh Basu" } }))).toBe("Kaustabh");
  });
  it("prefers a saved profile name over sign-in metadata", () => {
    expect(profileName({ user_metadata: { full_name: "Old Name" } }, "Kaustabh Basu")).toBe("Kaustabh Basu");
  });
  it("supports provider name and given-name fields", () => {
    expect(profileName({ user_metadata: { name: "Kaustabh Basu" } })).toBe("Kaustabh Basu");
    expect(profileName({ user_metadata: { given_name: "Kaustabh" } })).toBe("Kaustabh");
  });
  it("never invents a name from an email address", () => {
    expect(profileName({ user_metadata: { full_name: "person@example.com" } })).toBe("");
  });
  it("uses the first name for invoice fallback without changing explicit billing names", () => {
    expect(invoiceBuyerName(null, "Kaustabh Basu")).toBe("Kaustabh Basu");
    expect(invoiceBuyerName("Example Company", "Kaustabh Basu")).toBe("Example Company");
    expect(invoiceBuyerName(null, "")).toBe("Customer");
  });
});
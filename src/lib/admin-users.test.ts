import { describe, expect, it } from "vitest";
import { assertAdmin, assertCanSuspend, contactSchema, matchesUser } from "./admin-users";

describe("Owner account controls", () => {
  it("rejects non-admin access", () => { expect(() => assertAdmin(false)).toThrow(); expect(() => assertAdmin(true)).not.toThrow(); });
  it("protects the current owner from suspension", () => { expect(() => assertCanSuspend("owner", "owner", true, true)).toThrow(); });
  it("protects another owner from suspension", () => { expect(() => assertCanSuspend("owner", "other", true, true)).toThrow(); });
  it("allows suspension and restoration of ordinary accounts", () => { expect(() => assertCanSuspend("owner", "user", true, false)).not.toThrow(); expect(() => assertCanSuspend("owner", "user", false, false)).not.toThrow(); });
  it("finds contacts by name, email or phone", () => {
    const u = { name: "Test Caregiver", email: "care@example.com", phone: "+919876543210" };
    for (const term of ["caregiver", "CARE@", "987654"]) expect(matchesUser(u, term)).toBe(true);
    expect(matchesUser(u, "missing")).toBe(false);
  });
  it("requires international mobile numbers and valid emails", () => {
    const data = { userId: "00000000-0000-4000-8000-000000000001", name: "Test", email: "test@example.com", phone: "+919876543210" };
    expect(contactSchema.safeParse(data).success).toBe(true);
    expect(contactSchema.safeParse({ ...data, phone: "9876543210" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...data, email: "invalid" }).success).toBe(false);
  });
});
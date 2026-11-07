import { describe, expect, it } from "vitest";
import { inviteExpired, invitationText, inviteSchema, referralSchema, invitationFieldErrors, invitationShareError, sharingMethods } from "./invitations";
describe("Invitations", () => {
  it.each(sharingMethods)("returns field errors instead of technical errors for %s", (method) => {
    const family = inviteSchema.safeParse({ recipient: "", method, message: "Join me" });
    const refer = referralSchema.safeParse({ recipient: "", method, message: "Join me", phone: "" });
    expect(family.success).toBe(false); expect(refer.success).toBe(false);
    if (family.success || refer.success) throw new Error("Missing details must fail validation");
    expect(Object.keys(invitationFieldErrors(family.error))).toEqual(["recipient"]);
    expect(Object.keys(invitationFieldErrors(refer.error))).toEqual(["recipient", "phone"]);
    expect(referralSchema.safeParse({ recipient: "Anita", method, message: "Join me", phone: "+919876543210" }).success).toBe(true);
  });
  it("does not expose serialized errors from sharing failures", () => {
    expect(invitationShareError(new Error('{"code":"internal_error"}'), "Try again")).toBe("Try again");
  });
  it("expires unaccepted invitations exactly after 15 days", () => {
    expect(inviteExpired("2026-11-07T20:00:00Z", Date.parse("2026-11-22T19:59:59Z"))).toBe(false);
    expect(inviteExpired("2026-11-07T20:00:00Z", Date.parse("2026-11-22T20:00:00Z"))).toBe(true);
  });
  it("requires named invitations and a known method", () => {
    expect(inviteSchema.safeParse({ recipient: "Anita", method: "whatsapp", message: "Join me" }).success).toBe(true);
    expect(inviteSchema.safeParse({ recipient: "", method: "sms", message: "Join me" }).success).toBe(false);
    expect(inviteSchema.safeParse({ recipient: "Anita", method: "unknown", message: "Join me" }).success).toBe(false);
  });
  it("retains the unique referral link and code after editing", () => {
    const text = invitationText("Join me", "https://showmymeds.lovable.app/refer/token", "SMM-123");
    expect(text).toContain("https://showmymeds.lovable.app/refer/token"); expect(text).toContain("SMM-123");
  });
});

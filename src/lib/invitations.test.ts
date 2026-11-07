import { describe, expect, it } from "vitest";
import { inviteExpired, invitationText, inviteSchema } from "./invitations";
describe("Invitations", () => {
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

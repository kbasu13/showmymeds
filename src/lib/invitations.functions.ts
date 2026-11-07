import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { referralSchema, invitationText } from "./invitations";
import { assertAdmin } from "./admin-users";
export const createReferral = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input) => {
    const parsed = referralSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check your invitation details");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("create_referral_share", { _phone: data.phone, _recipient: data.recipient, _method: data.method, _message: data.message });
    if (error) throw new Error("Could not create referral. Please try again.");
    const row = Array.isArray(result) ? result[0] : result;
    if (!row) throw new Error("Could not create referral");
    return { text: invitationText(data.message, `https://showmymeds.lovable.app/refer/${row.token}`, row.code), code: row.code };
  });
export const listReferralRecords = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: active } = await context.supabase.rpc("is_account_active");
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    assertAdmin(active && admin);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [shares, acceptances] = await Promise.all([db.from("referral_shares").select("id,sender_id,code,recipient_name,method,created_at").order("created_at", { ascending: false }), db.from("referral_acceptances").select("user_id,share_id,accepted_at")]);
    if (shares.error) throw shares.error; if (acceptances.error) throw acceptances.error;
    return { shares: shares.data, acceptances: acceptances.data };
  });

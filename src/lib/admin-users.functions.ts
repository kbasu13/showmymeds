import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accessSchema, assertAdmin, assertCanSuspend, contactSchema, premiumSchema } from "./admin-users";

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: active } = await context.supabase.rpc("is_account_active");
    const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    assertAdmin(active && allowed);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const users = [];
    for (let page = 1; ; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      users.push(...data.users);
      if (data.users.length < 200) break;
    }
    const [profiles, premium, links, roles] = await Promise.all([
      db.from("profiles").select("id, display_name"), db.from("premium_users").select("*"),
      db.from("caregiver_links").select("id, patient_id, caregiver_id, status, created_at, recipient_name, share_method, expires_at"),
      db.from("user_roles").select("user_id, role"),
    ]);
    for (const result of [profiles, premium, links, roles]) if (result.error) throw result.error;
    return {
      users: users.map((u) => ({
        id: u.id, name: profiles.data?.find((p) => p.id === u.id)?.display_name || u.user_metadata?.['full_name'] || u.user_metadata?.['name'] || "",
        email: u.email || "", phone: u.phone || u.user_metadata?.['phone'] || u.user_metadata?.['phone_number'] || "",
        suspended: !!u.banned_until && new Date(u.banned_until).getTime() > Date.now(),
        admin: roles.data?.some((r) => r.user_id === u.id && r.role === "admin") ?? false,
        premium: premium.data?.find((p) => p.user_id === u.id) ?? null,
        createdAt: u.created_at,
      })),
      links: links.data ?? [],
    };
  });

export const updateAdminContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input) => contactSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: active } = await context.supabase.rpc("is_account_active");
    const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    assertAdmin(active && allowed);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: current, error: readError } = await db.auth.admin.getUserById(data.userId);
    if (readError) throw readError;
    if (!data.email && current.user.email) throw new Error("An existing sign-in email cannot be removed.");
    if (!data.phone && current.user.phone) throw new Error("An existing sign-in mobile number cannot be removed.");
    const { error } = await db.auth.admin.updateUserById(data.userId, {
      ...(data.email !== (current.user.email || "") && data.email ? { email: data.email } : {}),
      ...(data.phone !== (current.user.phone || "") && data.phone ? { phone: data.phone } : {}),
      user_metadata: { ...current.user.user_metadata, full_name: data.name, name: data.name, phone: data.phone },
    });
    if (error) throw error;
    const { error: profileError } = await db.from("profiles").upsert({ id: data.userId, display_name: data.name });
    if (profileError) throw new Error("Sign-in details saved, but the display name could not be saved. Please retry.");
    return { success: true };
  });

export const updateAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input) => accessSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: active } = await context.supabase.rpc("is_account_active");
    const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    assertAdmin(active && allowed);
    const { data: targetAdmin } = await context.supabase.rpc("has_role", { _user_id: data.userId, _role: "admin" });
    assertCanSuspend(context.userId, data.userId, data.suspended, targetAdmin === true);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.auth.admin.updateUserById(data.userId, { ban_duration: data.suspended ? "876000h" : "none" });
    if (error) throw error;
    return { success: true };
  });

export const updateAdminPremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input) => premiumSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: active } = await context.supabase.rpc("is_account_active");
    const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    assertAdmin(active && allowed);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = data.revoke
      ? await db.from("premium_users").delete().eq("user_id", data.userId)
      : await db.from("premium_users").upsert({ user_id: data.userId, expires_at: data.expires, granted_at: new Date().toISOString(), source: "admin_grant" });
    if (error) throw error;
    return { success: true };
  });

export const removeAdminConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: active } = await context.supabase.rpc("is_account_active");
    const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    assertAdmin(active && allowed);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.from("caregiver_links").delete().eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });
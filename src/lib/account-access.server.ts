import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Call only after the request's bearer token has been validated with getUser.
export async function isValidatedAccountActive(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) return false;
  return !data.user.banned_until || new Date(data.user.banned_until).getTime() <= Date.now();
}
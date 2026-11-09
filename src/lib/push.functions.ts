import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendPush, medicineImageUrl, doseBody } from "./push-send.server";

/** Sends a sample reminder (using one of the user's medicines when available) to their devices. */
export const sendTestPush = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ endpoint: z.string().url().max(2000) }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: sub } = await context.supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("endpoint", data.endpoint).maybeSingle();
    if (!sub) throw new Error("This phone is not set up for notifications yet");
    const { data: med } = await context.supabase.from("medicines").select("name,dosage,image_url,times").eq("user_id", context.userId).order("name").limit(1).maybeSingle();
    const image = await medicineImageUrl(med?.image_url ?? null, context.supabase as never);
    const ok = await sendPush(sub, {
      title: med ? `💊 ${med.name}` : "💊 ShowMyMeds test",
      body: med ? `Test reminder · ${doseBody(med.times?.[0] ?? "08:00", med.dosage)}` : "Notifications are working on this phone.",
      image, tag: "showmymeds-test",
    });
    if (!ok) { await context.supabase.from("push_subscriptions").delete().eq("id", sub.id); throw new Error("This phone's notification link expired. Turn notifications on again."); }
    return { sent: true };
  });

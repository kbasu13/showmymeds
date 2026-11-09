import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { sendPush, medicineImageUrl, doseBody } from "@/lib/push-send.server";

function localNow(tz: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`, minutes: Number(parts["hour"]) * 60 + Number(parts["minute"]) };
}

export const Route = createFileRoute("/api/public/jobs/dose-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: subs } = await db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth,tz");
        let sent = 0;
        const byUser = new Map<string, NonNullable<typeof subs>>();
        for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
        for (const [userId, devices] of byUser) {
          let tz = devices[0]!.tz; try { localNow(tz); } catch { tz = "Asia/Kolkata"; }
          const { date, minutes } = localNow(tz);
          const { data: meds } = await db.from("medicines").select("id,name,dosage,image_url,times,start_date,end_date,notes").eq("user_id", userId).lte("start_date", date);
          for (const med of meds ?? []) {
            if (med.end_date && med.end_date < date) continue;
            for (const time of med.times ?? []) {
              const [h, m] = time.split(":").map(Number); const diff = minutes - (h! * 60 + m!);
              if (diff < 0 || diff > 6) continue;
              const { data: taken } = await db.from("dose_logs").select("id").eq("medicine_id", med.id).eq("scheduled_date", date).eq("scheduled_time", time).maybeSingle();
              if (taken) continue;
              const { error: dup } = await db.from("push_sent").insert({ medicine_id: med.id, scheduled_date: date, scheduled_time: time });
              if (dup) continue;
              const image = await medicineImageUrl(med.image_url, db as never);
              for (const d of devices) {
                const ok = await sendPush(d, { title: `💊 ${med.name}`, body: doseBody(time, med.dosage, med.notes), image, tag: `${med.id}-${date}-${time}`, url: "/today" }).catch(() => true);
                if (!ok) await db.from("push_subscriptions").delete().eq("id", d.id); else sent++;
              }
            }
          }
        }
        return Response.json({ success: true, sent });
      },
    },
  },
});

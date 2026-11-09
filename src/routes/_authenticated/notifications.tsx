import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BellRing, BellOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useUser } from "@/lib/meds";
import { usePremium, UpgradeCard } from "@/components/Premium";
import { sendTestPush } from "@/lib/push.functions";
import { currentSubscription, detectPlatform, disablePush, enablePush, isBrave, pushStatus, type Platform, type PushStatus } from "@/lib/push";

export const Route = createFileRoute("/_authenticated/notifications")({ staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Phone notifications — ShowMyMeds" },
    { name: "description", content: "Turn on dose reminders on your phone's lock screen, with medicine name and photo." },
    { property: "og:title", content: "Phone notifications — ShowMyMeds" },
    { property: "og:description", content: "Get medicine reminders on your lock screen." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: NotificationsPage,
});

const STATUS: Record<PushStatus, { text: string; tone: string }> = {
  on: { text: "On for this phone", tone: "text-success" },
  off: { text: "Off on this phone", tone: "text-muted-foreground" },
  blocked: { text: "Blocked in browser settings", tone: "text-destructive" },
  "needs-install": { text: "Add ShowMyMeds to your Home Screen first", tone: "text-destructive" },
  unsupported: { text: "This browser can't show notifications", tone: "text-destructive" },
};

function NotificationsPage() {
  const { data: user } = useUser();
  const { data: premium } = usePremium(user?.id);
  const test = useServerFn(sendTestPush);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [platform, setPlatform] = useState<Platform>("android");
  const [brave, setBrave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState<string>("");

  const refresh = () => pushStatus().then(setStatus);
  useEffect(() => { setPlatform(detectPlatform()); isBrave().then(setBrave); refresh(); }, []);
  useEffect(() => { if (status && status !== "on" && status !== "off") setHelp(brave ? "brave" : platform); }, [status, brave, platform]);

  const turnOn = async () => {
    if (!user) return; setBusy(true);
    try { await enablePush(user.id); toast.success("Notifications are on for this phone"); }
    catch (e) {
      const msg = (e as Error).message;
      if (msg === "dismissed") toast("You closed the permission box. Tap the button again and choose Allow.");
      else { toast.error("Couldn't turn on notifications. See the help steps below."); setHelp(brave ? "brave" : platform); }
    } finally { setBusy(false); refresh(); }
  };
  const turnOff = async () => { setBusy(true); try { await disablePush(); toast("Notifications turned off for this phone"); } finally { setBusy(false); refresh(); } };
  const sendTest = async () => {
    setBusy(true);
    try { const sub = await currentSubscription(); if (!sub) throw new Error("Turn notifications on first"); await test({ data: { endpoint: sub.endpoint } }); toast.success("Test sent — check your notifications"); }
    catch (e) { toast.error((e as Error).message || "Couldn't send a test"); } finally { setBusy(false); }
  };

  useEffect(() => { if (premium === false) currentSubscription().then((s) => { if (s) disablePush(); }); }, [premium]);
  if (premium === false) return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-primary">Allow notifications</h1>
      <UpgradeCard feature="Notifications" text="Get dose reminders on your phone's lock screen with the medicine name and photo." />
    </div>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-primary">Allow notifications</h1>
      <p className="text-muted-foreground">Get a reminder on your lock screen at each dose time, with the medicine name, dose and photo — even when the app is closed.</p>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 font-medium">
          {status === "on" ? <CheckCircle2 className="h-5 w-5 text-success" /> : status === "off" ? <BellOff className="h-5 w-5 text-muted-foreground" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
          <span className={status ? STATUS[status].tone : ""}>{status ? STATUS[status].text : "Checking…"}</span>
        </div>
        {status === "on" ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={sendTest} disabled={busy}><BellRing className="h-4 w-4" /> Send test notification</Button>
            <Button variant="outline" onClick={turnOff} disabled={busy}>Turn off</Button>
          </div>
        ) : (
          <Button onClick={turnOn} disabled={busy || status === "unsupported" || status === "needs-install"}><BellRing className="h-4 w-4" /> Turn on notifications</Button>
        )}
        {brave && <p className="text-sm text-muted-foreground">You're using Brave. If notifications don't arrive, follow the Brave steps below.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Having trouble? Help for your phone</h2>
        <Accordion type="single" collapsible value={help} onValueChange={setHelp} className="rounded-xl border bg-card px-4">
          <AccordionItem value="ios">
            <AccordionTrigger>iPhone or iPad</AccordionTrigger>
            <AccordionContent><ol className="list-decimal space-y-1 pl-5">
              <li>Open ShowMyMeds in <b>Safari</b> (iOS 16.4 or newer).</li>
              <li>Tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</li>
              <li>Open ShowMyMeds from the new Home Screen icon and sign in.</li>
              <li>Come back to this page and tap <b>Turn on notifications</b>, then <b>Allow</b>.</li>
              <li>If you tapped Don't Allow: Settings → Notifications → ShowMyMeds → turn on <b>Allow Notifications</b> and <b>Sounds</b>.</li>
              <li>Check Focus / Do Not Disturb isn't hiding ShowMyMeds.</li>
            </ol></AccordionContent>
          </AccordionItem>
          <AccordionItem value="android">
            <AccordionTrigger>Android (Chrome, Edge, Samsung Internet)</AccordionTrigger>
            <AccordionContent><ol className="list-decimal space-y-1 pl-5">
              <li>Tap <b>Turn on notifications</b> and choose <b>Allow</b>.</li>
              <li>If blocked: tap the icon left of the web address → <b>Permissions</b> → <b>Notifications</b> → <b>Allow</b>. Reload this page.</li>
              <li>Phone Settings → Apps → your browser → Notifications: turn on, with <b>Sound</b> enabled.</li>
              <li>Phone Settings → Apps → your browser → Battery: choose <b>Unrestricted</b> so reminders aren't delayed.</li>
              <li>Tip: browser menu → <b>Add to Home screen</b> for an app icon.</li>
            </ol></AccordionContent>
          </AccordionItem>
          <AccordionItem value="brave">
            <AccordionTrigger>Brave browser</AccordionTrigger>
            <AccordionContent><ol className="list-decimal space-y-1 pl-5">
              <li>Brave turns off push messages by default. Type <b>brave://settings/privacy</b> in the address bar.</li>
              <li>Turn on <b>Use Google services for push messaging</b>, then fully close and reopen Brave.</li>
              <li>Tap the lion (Shields) icon on this site — ShowMyMeds works with Shields up; if something looks wrong, set Shields down for this site only.</li>
              <li>Tap the icon left of the web address → <b>Site settings</b> → <b>Notifications</b> → <b>Allow</b>.</li>
              <li>On Android, also set Brave's battery use to <b>Unrestricted</b>. On iPhone, Brave can't show notifications — use Safari and Add to Home Screen.</li>
            </ol></AccordionContent>
          </AccordionItem>
          <AccordionItem value="desktop">
            <AccordionTrigger>Computer</AccordionTrigger>
            <AccordionContent><ol className="list-decimal space-y-1 pl-5">
              <li>Click the padlock icon left of the web address → Notifications → <b>Allow</b>.</li>
              <li>Windows: Settings → System → Notifications → allow your browser. Mac: System Settings → Notifications → your browser.</li>
              <li>Keep the browser running in the background for reminders.</li>
            </ol></AccordionContent>
          </AccordionItem>
        </Accordion>
        <p className="text-sm text-muted-foreground">Sound: phones play their standard notification tone; custom sounds aren't allowed for web apps. Keep the app open for the loud in-app alarm.</p>
      </section>
    </div>
  );
}

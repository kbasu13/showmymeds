import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Mic, Camera, ImagePlus, CalendarPlus, Pencil, Trash2, X, Search, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MedImage } from "@/components/MedImage";
import { supabase } from "@/integrations/supabase/client";
import {
  FORMS, useUser, useMeds, useRefreshMeds, lookupMedicineImage, lookupComposition, lookupMedInfo, uploadFile, type Medicine,
} from "@/lib/meds";
import { buildIcs, daysOfStockLeft, ymd, time12, doseText, dmyDay, titleCase, type Med } from "@/lib/schedule";
import type { RxItem } from "@/routes/api/rxscan";

export const Route = createFileRoute("/_authenticated/medicines")({
  head: () => ({ meta: [{ title: "My medicines — ShowMyMeds" }, { name: "description", content: "Add and manage your medicines." }] }),
  component: MedicinesPage,
});

function MedicinesPage() {
  const { data: user } = useUser();
  const { data: meds = [] } = useMeds(user?.id);
  const refresh = useRefreshMeds();
  const [editing, setEditing] = useState<Medicine | "new" | null>(null);
  const [queue, setQueue] = useState<RxItem[]>([]);
  const [prefill, setPrefill] = useState<RxItem | null>(null);
  const [formKey, setFormKey] = useState(0);
  const next = (q: RxItem[]) => {
    const [first, ...rest] = q;
    setQueue(rest);
    if (first) { setPrefill(first); setEditing("new"); setFormKey((k) => k + 1); }
    else { setPrefill(null); setEditing(null); }
  };

  const exportCalendar = () => {
    const ics = buildIcs(meds as unknown as Med[]);
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "showmymeds-schedule.ics";
    a.click();
    toast.success("Calendar file ready — open it to add reminders to your phone calendar");
  };

  const remove = async (m: Medicine) => {
    if (!confirm(`Delete ${m.name}?`)) return;
    await supabase.from("medicines").delete().eq("id", m.id);
    refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-primary">Medicines</h1>
        <Button size="lg" onClick={() => setEditing("new")}><Plus /> Add</Button>
      </div>
      {meds.length > 0 && (
        <Button variant="outline" size="lg" className="w-full text-base" onClick={exportCalendar}>
          <CalendarPlus /> Add schedule to phone calendar
        </Button>
      )}
      <ul className="space-y-3">
        {meds.map((m) => (
          <li key={m.id} className="rounded-xl border bg-card p-4 shadow-soft">
            <div className="flex gap-3 sm:gap-4">
              <MedImage src={m.image_url} form={m.form} name={m.name} />
              <div className="grid min-w-0 flex-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <p className="break-words text-lg font-semibold leading-tight text-primary">{m.name}</p>
                  {m.manufacturer && <p className="text-muted-foreground">By {titleCase(m.manufacturer)}</p>}
                  <p className="break-words text-sm text-muted-foreground">{m.composition || "Composition not added"}</p>
                  <p className="mt-1 font-medium">{doseText(Number(m.dose_qty), m.form)} each time</p>
                </div>
                <div className="min-w-0 sm:text-right">
                  <p className="font-medium">at {[...m.times].sort().map(time12).join(", ")}</p>
                  <p className="text-sm">Available stock: {Number(m.stock)} ({daysOfStockLeft(m as unknown as Med)} days)</p>
                  <p className="text-sm text-muted-foreground">Dose started on {dmyDay(m.start_date)}</p>
                  {m.end_date && <p className="text-sm text-muted-foreground">Ends on {dmyDay(m.end_date)}</p>}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="text-base" onClick={() => setEditing(m)}><Pencil /> Edit</Button>
              <Button variant="ghost" className="text-base text-destructive" onClick={() => remove(m)}><Trash2 /> Delete</Button>
            </div>
          </li>
        ))}
        {meds.length === 0 && <p className="rounded-xl bg-hero p-8 text-center text-xl">No medicines yet. Tap “Add” to begin.</p>}
      </ul>
      {editing && user && (
        <MedForm key={formKey} userId={user.id} med={editing === "new" ? null : editing} prefill={editing === "new" ? prefill : null}
          remaining={queue.length}
          onQueue={(items) => next(items)}
          onClose={() => { setQueue([]); setPrefill(null); setEditing(null); }}
          onSaved={() => { refresh(); next(queue); }} />
      )}
    </div>
  );
}

function MedForm({ userId, med, prefill, remaining, onQueue, onClose, onSaved }: {
  userId: string; med: Medicine | null; prefill: RxItem | null; remaining: number;
  onQueue: (items: RxItem[]) => void; onClose: () => void; onSaved: () => void;
}) {
  const endFromDays = (d: number | null) => { if (!d) return ""; const x = new Date(); x.setDate(x.getDate() + d - 1); return ymd(x); };
  const [f, setF] = useState({
    name: med?.name ?? prefill?.name ?? "", composition: med?.composition ?? prefill?.composition ?? "", manufacturer: med?.manufacturer ?? prefill?.manufacturer ?? "", form: med?.form ?? prefill?.form ?? "tablet",
    dosage: med?.dosage ?? "", dose_qty: String(med?.dose_qty ?? prefill?.dose_qty ?? 1), times: med?.times ?? prefill?.times ?? ["08:00"],
    start_date: med?.start_date ?? ymd(new Date()), end_date: med?.end_date ?? endFromDays(prefill?.days ?? null),
    stock: String(med?.stock ?? 30), image_url: med?.image_url ?? null as string | null,
    prescription_path: med?.prescription_path ?? null as string | null, notes: med?.notes ?? prefill?.notes ?? "",
    warn_days: med?.warn_days ?? 7,
  });
  const [ongoing, setOngoing] = useState(med ? !med.end_date : !prefill?.days);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<RxItem[] | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);

  const scan = async (file: File | undefined): Promise<unknown> => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please take a photo of the prescription (not a PDF).");
    setScanning(true);
    try {
      const path = await uploadFile(userId, file, "rx");
      set("prescription_path", path);
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/api/rxscan", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ path }) });
      const j = (await r.json()) as { items?: RxItem[]; error?: string };
      if (!r.ok) return toast.error(j.error ?? "Could not read the prescription.");
      const items = j.items ?? [];
      if (items.length === 0) return toast("We couldn't read any medicines. Please type them in.");
      setFound(items); setPicked(items.map(() => true));
    } catch (e) { toast.error((e as Error).message); }
    finally { setScanning(false); }
    return undefined;
  };
  const { data: me } = useQuery({ queryKey: ["profile", userId], queryFn: async () => (await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle()).data });
  const [busy, setBusy] = useState(false);
  const [photoCleared, setPhotoCleared] = useState(false);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const listen = (): void => {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec })
      .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input isn't supported on this browser");  return; }
    const r = new SR();
    r.lang = navigator.language;
    r.onresult = (e) => set("name", e.results[0]![0].transcript);
    r.start();
    toast("Listening… say the medicine name");
  };

  const findImage = async (): Promise<unknown> => {
    if (!f.name) return toast.error("Enter a name first");
    const info = f.composition && f.manufacturer ? null : await lookupMedInfo(f.name);
    const comp = f.composition ? null : info?.composition ?? null;
    if (comp) set("composition", comp);
    if (!f.manufacturer && info?.manufacturer) set("manufacturer", info.manufacturer);
    const url = await lookupMedicineImage(f.name, comp ?? f.composition);
    if (url) { set("image_url", url); setPhotoCleared(false); toast.success(comp ? "Picture and composition found" : "Picture found"); }
    else toast(comp ? "Composition found — no picture, a simple icon will be shown" : "No picture found — a simple icon will be shown");
    return undefined;
  };

  const clearPhoto = () => {
    set("image_url", null);
    setPhotoCleared(true);
    toast("Photo removed — a simple icon will be shown");
  };

  const upload = async (file: File | undefined, kind: "image" | "rx") => {
    if (!file) return;
    try {
      const path = await uploadFile(userId, file, kind);
      set(kind === "image" ? "image_url" : "prescription_path", path);
      if (kind === "image") setPhotoCleared(false);
      toast.success(kind === "image" ? "Picture uploaded" : "Prescription uploaded");
    } catch (e) { toast.error((e as Error).message); }
  };

  const save = async (): Promise<unknown> => {
    if (!f.name.trim()) return toast.error("Please enter the medicine name");
    setBusy(true);
    let composition = f.composition;
    let manufacturer = f.manufacturer;
    if (!composition.trim() || !manufacturer.trim()) {
      const info = await lookupMedInfo(f.name);
      if (!composition.trim()) composition = info.composition ?? "";
      if (!manufacturer.trim()) manufacturer = info.manufacturer ?? "";
    }
    let image_url = f.image_url;
    if (!image_url && !photoCleared) image_url = await lookupMedicineImage(f.name, composition);
    const row = {
      name: f.name.trim(), composition: composition || null, manufacturer: manufacturer.trim() || null, form: f.form, dosage: f.dosage || null,
      dose_qty: Number(f.dose_qty) || 1, times: f.times.filter(Boolean), start_date: f.start_date,
      end_date: ongoing ? null : f.end_date || null, warn_days: f.warn_days, stock: Number(f.stock) || 0, image_url,
      prescription_path: f.prescription_path, notes: f.notes || null,
    };
    const { error } = med
      ? await supabase.from("medicines").update(row).eq("id", med.id)
      : await supabase.from("medicines").insert(row);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    return onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{med ? "Edit medicine" : prefill ? "Check this medicine" : "Add a medicine"}</DialogTitle>
          {prefill && <p className="text-sm font-medium text-primary">From your prescription — please review before saving.{remaining > 0 ? ` ${remaining} more after this.` : ""}</p>}
          <p className="text-base text-muted-foreground">This will be {med ? "saved" : "added"} for {me?.display_name || "you"}.</p>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2 rounded-xl border bg-secondary/50 p-3">
            <p className="text-base font-semibold">Faster ways to add it</p>
            <Button className="w-full" asChild>
              <label><Camera /> {scanning ? "Reading prescription…" : f.prescription_path ? "Scan another prescription" : "Scan prescription"}
                <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={scanning}
                  onChange={(e) => { scan(e.target.files?.[0]); e.target.value = ""; }} /></label>
            </Button>
            <Button variant="outline" className="w-full" onClick={listen}><Mic /> Say it out loud</Button>
            <p className="text-sm text-muted-foreground">We read the prescription (even handwriting) and suggest every medicine on it. Prescription photos are stored privately. Always check the details before saving.</p>
          </div>

          <Field label="Medicine name">
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="For example Paracetamol" />
          </Field>

          <Field label="Manufacturer (optional)" hint="We look this up if you leave it empty.">
            <div className="flex gap-2">
              <Input value={f.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} placeholder="For example Cipla" />
              <Button variant="secondary" size="icon" aria-label="Look up manufacturer" onClick={async () => {
                const m = (await lookupMedInfo(f.name)).manufacturer;
                if (m) { set("manufacturer", m); toast.success("Manufacturer found"); } else toast("Couldn't find the company — please type it");
              }}><Search /></Button>
            </div>
          </Field>

          <Field label="What's in it (optional)" hint="Active ingredients. We look these up if you leave it empty.">
            <div className="flex gap-2">
              <Textarea rows={2} value={f.composition} onChange={(e) => set("composition", e.target.value)} placeholder="For example Paracetamol 500mg + Caffeine 30mg" />
              <Button variant="secondary" size="icon" aria-label="Look up composition" onClick={async () => {
                const c = await lookupComposition(f.name);
                if (c) { set("composition", c); toast.success("Composition found"); } else toast("Couldn't find the composition — please type it");
              }}><Search /></Button>
            </div>
          </Field>

          <Field label="How much/many each time?">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Less" onClick={() => set("dose_qty", String(Math.max(0.25, Number(f.dose_qty) - (Number(f.dose_qty) > 1 ? 1 : 0.25))))}>−</Button>
              <span className="w-12 text-center text-lg font-semibold">{Number(f.dose_qty)}</span>
              <Button variant="outline" size="icon" aria-label="More" onClick={() => set("dose_qty", String(Number(f.dose_qty) + (Number(f.dose_qty) >= 1 ? 1 : 0.25)))}>+</Button>
            </div>
            <Select value={f.form} onValueChange={(v) => set("form", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMS.map((x) => <SelectItem key={x.id} value={x.id}>{UNITS[x.id] ?? x.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>


          <Field label="How many times a day?" hint="Tap a number, then adjust each time if you need to.">
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((n) => (
                <Button key={n} variant={f.times.length === n ? "default" : "outline"}
                  onClick={() => set("times", DEFAULT_TIMES[n]!.map((d, i) => f.times[i] ?? d))}>{n}</Button>
              ))}
            </div>
            <div className="space-y-2 pt-1">
              {f.times.map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-14 text-sm text-muted-foreground">Dose {i + 1}</span>
                  <Input type="time" className="flex-1" value={t}
                    onChange={(e) => set("times", f.times.map((x, j) => (j === i ? e.target.value : x)))} />
                </div>
              ))}
            </div>
          </Field>

          <Field label="Course starts"><Input type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
          <Field label="Course ends">
            <Input type="date" value={ongoing ? "" : f.end_date} disabled={ongoing} onChange={(e) => set("end_date", e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={ongoing} onCheckedChange={(c) => setOngoing(!!c)} /> Ongoing — no end date
            </label>
          </Field>

          <Field label={`How many ${UNITS[f.form] ?? "units"} do you have now?`}>
            <Input type="number" value={f.stock} onChange={(e) => set("stock", e.target.value)} />
          </Field>

          <Field label="Warn me before it runs out" hint="We show the refill reminder this many days ahead.">
            <div className="grid grid-cols-3 gap-2">
              {[3, 7, 14].map((d) => (
                <Button key={d} variant={f.warn_days === d ? "default" : "outline"} onClick={() => set("warn_days", d)}>{d} days</Button>
              ))}
            </div>
          </Field>

          <Field label="Photo of the medicine (optional)" hint="If you don't add a photo, we'll look one up from the medicine name. Tap the photo to enlarge it.">
            <div className="flex items-center gap-3">
              <MedImage src={f.image_url} form={f.form} name={f.name} className="h-20 w-20" />
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" asChild>
                  <label><ImagePlus /> Take a photo
                    <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => upload(e.target.files?.[0], "image")} /></label>
                </Button>
                <Button variant="outline" size="sm" onClick={findImage}><Search /> Find it online</Button>
                {f.image_url && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={clearPhoto}><ImageOff /> Remove photo</Button>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Photos are stored privately in your account.</p>
          </Field>

          <Field label="Notes (optional)" hint="Anything the doctor said, like 'after food'.">
            <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>

          <Button size="lg" className="w-full" disabled={busy} onClick={save}>{busy ? "Saving…" : remaining > 0 ? "Save and check next" : "Save medicine"}</Button>
          {prefill && <Button variant="ghost" className="w-full" onClick={onSaved}>Skip this one</Button>}
        </div>
      </DialogContent>
      {found && (
        <Dialog open onOpenChange={(o) => !o && setFound(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">We found {found.length} medicine{found.length > 1 ? "s" : ""}</DialogTitle>
              <p className="text-base text-muted-foreground">Choose which to add. You'll check each one before it's saved.</p>
            </DialogHeader>
            <ul className="space-y-2">
              {found.map((it, i) => (
                <li key={i}>
                  <label className="flex items-start gap-3 rounded-lg border p-3">
                    <Checkbox className="mt-1 h-5 w-5" checked={!!picked[i]} onCheckedChange={(c) => setPicked((p) => p.map((x, j) => (j === i ? !!c : x)))} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{it.name}</span>
                      {it.composition && <span className="block text-sm text-muted-foreground">{it.composition}</span>}
                      <span className="block text-sm">{doseText(it.dose_qty, it.form)} at {it.times.map(time12).join(", ")}{it.days ? ` for ${it.days} days` : ""}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPicked(found.map(() => true))}>Select all</Button>
              <Button className="flex-1" disabled={!picked.some(Boolean)} onClick={() => {
                const sel = found.filter((_, i) => picked[i]);
                setFound(null);
                onQueue(sel);
              }}>Review {picked.filter(Boolean).length} selected</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}

type SpeechRec = { lang: string; start: () => void; onresult: (e: { results: { 0: { transcript: string } }[] }) => void };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-base font-semibold">{label}</Label>{children}{hint && <p className="text-sm text-muted-foreground">{hint}</p>}</div>;
}

const UNITS: Record<string, string> = {
  tablet: "tablet(s)", capsule: "capsule(s)", syrup: "ml", drops: "drop(s)",
  injection: "injection(s)", inhaler: "puff(s)", cream: "application(s)",
};
const DEFAULT_TIMES: Record<number, string[]> = {
  1: ["08:00"], 2: ["08:00", "20:00"], 3: ["08:00", "14:00", "20:00"], 4: ["08:00", "12:00", "16:00", "20:00"],
};

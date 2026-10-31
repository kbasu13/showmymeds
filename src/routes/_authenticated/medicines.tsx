import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Mic, Camera, ImagePlus, CalendarPlus, Pencil, Trash2, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MedImage } from "@/components/MedImage";
import { supabase } from "@/integrations/supabase/client";
import {
  FORMS, useUser, useMeds, useRefreshMeds, lookupMedicineImage, uploadFile, type Medicine,
} from "@/lib/meds";
import { buildIcs, daysOfStockLeft, ymd, type Med } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/medicines")({
  head: () => ({ meta: [{ title: "My medicines — ShowMyMeds" }, { name: "description", content: "Add and manage your medicines." }] }),
  component: MedicinesPage,
});

function MedicinesPage() {
  const { data: user } = useUser();
  const { data: meds = [] } = useMeds(user?.id);
  const refresh = useRefreshMeds();
  const [editing, setEditing] = useState<Medicine | "new" | null>(null);

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
        <h1 className="text-4xl font-bold text-primary">Medicines</h1>
        <Button size="lg" onClick={() => setEditing("new")}><Plus /> Add</Button>
      </div>
      {meds.length > 0 && (
        <Button variant="outline" className="w-full" onClick={exportCalendar}>
          <CalendarPlus /> Add schedule to phone calendar
        </Button>
      )}
      <ul className="space-y-3">
        {meds.map((m) => (
          <li key={m.id} className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex gap-4">
              <MedImage src={m.image_url} form={m.form} name={m.name} />
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold text-primary">{m.name}</p>
                <p className="text-muted-foreground">{m.composition || "Composition not added"}</p>
                <p className="mt-1">{m.dosage} · {m.times.join(", ")}</p>
                <p className="text-sm text-muted-foreground">
                  Stock: {Number(m.stock)} ({daysOfStockLeft(m as unknown as Med)} days) · {m.start_date}{m.end_date ? ` → ${m.end_date}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(m)}><Pencil /> Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => remove(m)}><Trash2 /> Delete</Button>
            </div>
          </li>
        ))}
        {meds.length === 0 && <p className="rounded-2xl bg-hero p-8 text-center text-xl">No medicines yet. Tap “Add” to begin.</p>}
      </ul>
      {editing && user && (
        <MedForm userId={user.id} med={editing === "new" ? null : editing}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

function MedForm({ userId, med, onClose, onSaved }: { userId: string; med: Medicine | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: med?.name ?? "", composition: med?.composition ?? "", form: med?.form ?? "tablet",
    dosage: med?.dosage ?? "", dose_qty: String(med?.dose_qty ?? 1), times: med?.times ?? ["08:00"],
    start_date: med?.start_date ?? ymd(new Date()), end_date: med?.end_date ?? "",
    stock: String(med?.stock ?? 30), image_url: med?.image_url ?? null as string | null,
    prescription_path: med?.prescription_path ?? null as string | null, notes: med?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
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
    const url = await lookupMedicineImage(f.name);
    if (url) { set("image_url", url); toast.success("Picture found"); }
    else toast("No picture found — a simple icon will be shown");
  };

  const upload = async (file: File | undefined, kind: "image" | "rx") => {
    if (!file) return;
    try {
      const path = await uploadFile(userId, file, kind);
      set(kind === "image" ? "image_url" : "prescription_path", path);
      toast.success(kind === "image" ? "Picture uploaded" : "Prescription uploaded");
    } catch (e) { toast.error((e as Error).message); }
  };

  const save = async (): Promise<unknown> => {
    if (!f.name.trim()) return toast.error("Please enter the medicine name");
    setBusy(true);
    let image_url = f.image_url;
    if (!image_url && !med) image_url = await lookupMedicineImage(f.name);
    const row = {
      name: f.name.trim(), composition: f.composition || null, form: f.form, dosage: f.dosage || null,
      dose_qty: Number(f.dose_qty) || 1, times: f.times.filter(Boolean), start_date: f.start_date,
      end_date: f.end_date || null, stock: Number(f.stock) || 0, image_url,
      prescription_path: f.prescription_path, notes: f.notes || null,
    };
    const { error } = med
      ? await supabase.from("medicines").update(row).eq("id", med.id)
      : await supabase.from("medicines").insert(row);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-2xl">{med ? "Edit medicine" : "Add medicine"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <MedImage src={f.image_url} form={f.form} name={f.name} className="h-24 w-24" />
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={findImage}><Search /> Find picture</Button>
              <Button variant="outline" size="sm" asChild>
                <label><ImagePlus /> Use my photo
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0], "image")} /></label>
              </Button>
            </div>
          </div>
          <Field label="Medicine name">
            <div className="flex gap-2">
              <Input className="h-12 text-lg" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Metformin" />
              <Button variant="secondary" size="icon" onClick={listen} aria-label="Speak the name"><Mic /></Button>
            </div>
          </Field>
          <Field label="Main composition (salt)">
            <Input className="h-12 text-lg" value={f.composition} onChange={(e) => set("composition", e.target.value)} placeholder="e.g. Metformin Hydrochloride 500mg" />
          </Field>
          <Field label="Type">
            <div className="flex flex-wrap gap-2">
              {FORMS.map((x) => (
                <Button key={x.id} size="sm" variant={f.form === x.id ? "default" : "outline"} onClick={() => set("form", x.id)}>{x.label}</Button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dosage"><Input className="h-12 text-lg" value={f.dosage} onChange={(e) => set("dosage", e.target.value)} placeholder="1 tablet" /></Field>
            <Field label="Units per dose"><Input className="h-12 text-lg" type="number" min="0.25" step="0.25" value={f.dose_qty} onChange={(e) => set("dose_qty", e.target.value)} /></Field>
          </div>
          <Field label={`Times per day (${f.times.length})`}>
            <div className="space-y-2">
              {f.times.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <Input type="time" className="h-12 text-lg" value={t}
                    onChange={(e) => set("times", f.times.map((x, j) => (j === i ? e.target.value : x)))} />
                  {f.times.length > 1 && (
                    <Button variant="ghost" size="icon" aria-label="Remove time" onClick={() => set("times", f.times.filter((_, j) => j !== i))}><X /></Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => set("times", [...f.times, "20:00"])}><Plus /> Add a time</Button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Course starts"><Input type="date" className="h-12" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
            <Field label="Course ends"><Input type="date" className="h-12" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
          </div>
          <Field label="Stock in hand (units)"><Input type="number" className="h-12 text-lg" value={f.stock} onChange={(e) => set("stock", e.target.value)} /></Field>
          <Field label="Prescription photo">
            <Button variant="outline" asChild className="w-full">
              <label><Camera /> {f.prescription_path ? "Replace prescription" : "Upload prescription"}
                <input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only"
                  onChange={(e) => upload(e.target.files?.[0], "rx")} /></label>
            </Button>
          </Field>
          <Field label="Notes"><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. after food" /></Field>
          <Button size="lg" className="w-full" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save medicine"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type SpeechRec = { lang: string; start: () => void; onresult: (e: { results: { 0: { transcript: string } }[] }) => void };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-base font-bold">{label}</Label>{children}</div>;
}

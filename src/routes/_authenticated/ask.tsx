import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Send, Plus, Paperclip, Camera, Mic, Square, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUser, FORMS, uploadFile } from "@/lib/meds";
import { joinTimes, doseText } from "@/lib/schedule";
import { usePremium, UpgradeCard } from "@/components/Premium";

export const Route = createFileRoute("/_authenticated/ask")({ staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Ask — ShowMyMeds" }, { name: "description", content: "Ask questions about your doses and side effects." }, { property: "og:title", content: "Ask — ShowMyMeds" }, { property: "og:description", content: "Ask questions about your doses and side effects." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AskPage,
});

type Msg = { role: "user" | "assistant"; text: string; att?: string };
type Attached = { path: string; name: string };

const MAX_FILE = 8 * 1024 * 1024;
const MAX_SECONDS = 60;

/** Keep uploads light: photos are resized to at most 1280 px on the long edge. */
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    if (scale >= 1 && file.size < 1_500_000) { bmp.close?.(); return file; }
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d")?.drawImage(bmp, 0, 0, w, h);
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.82));
    bmp.close?.();
    if (!out) return file;
    return new File([out], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function AskPage() {
  const { data: user } = useUser();
  const { data: premium, isLoading } = usePremium(user?.id);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Hello! Ask me about your dose history, possible side effects, or check medicines your doctor has prescribed before you take them.\n\nYou can also **attach a photo or PDF** (a prescription, a medicine pack, a report) or **speak your question** using the mic." },
  ]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<Attached | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  if (isLoading) return <p>Loading…</p>;
  if (!premium) {
    return <UpgradeCard feature="Ask" text="Chat about your medicines, dose history and side effects." />;
  }

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !user) return;
    if (f.size > MAX_FILE) { toast.error("That file is too large. Please keep it under 8 MB."); return; }
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf && !f.type.startsWith("image/")) { toast.error("Please attach a photo or a PDF."); return; }
    setUploading(true);
    try {
      const prepared = isPdf ? f : await shrink(f);
      const path = await uploadFile(user.id, prepared, "ask");
      setFile({ path, name: f.name });
    } catch {
      toast.error("Could not attach that file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const transcribe = async (blob: Blob) => {
    setHearing(true);
    try {
      const { data } = await supabase.auth.getSession();
      const mime = blob.type || "audio/webm";
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : "webm";
      const fd = new FormData();
      fd.append("file", new File([blob], `voice.${ext}`, { type: mime }));
      const r = await fetch("/api/ask-transcribe", {
        method: "POST",
        headers: { authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: fd,
      });
      const j = (await r.json().catch(() => ({}))) as { text?: string; error?: string };
      const heard = (j.text ?? "").trim();
      if (!r.ok || !heard) { toast.error(j.error ?? "I could not hear that. Please try again."); return; }
      setQ((v) => (v.trim() ? `${v.trim()} ${heard}` : heard));
    } catch {
      toast.error("Voice input is not available right now. Please type your question.");
    } finally {
      setHearing(false);
    }
  };

  const toggleRec = async () => {
    if (recording) { recRef.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Your browser can't record voice here. Please type your question.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recRef.current = null;
        setRecording(false);
        await transcribe(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
      };
      recRef.current = mr;
      mr.start();
      setRecording(true);
      window.setTimeout(() => { if (recRef.current === mr && mr.state !== "inactive") mr.stop(); }, MAX_SECONDS * 1000);
    } catch {
      toast.error("Please allow microphone access, then try again.");
    }
  };

  const send = async () => {
    if ((!q.trim() && !file) || busy) return;
    const question = q.trim() || "Please look at the attached file.";
    const attached = file;
    const history = [...msgs.slice(1), { role: "user" as const, text: question }];
    const userMsg: Msg = attached ? { role: "user", text: question, att: attached.name } : { role: "user", text: question };
    setMsgs((m) => [...m, userMsg, { role: "assistant", text: "…" }]);
    setQ("");
    setFile(null);
    setBusy(true);
    const put = (text: string) => setMsgs((m) => [...m.slice(0, -1), { role: "assistant", text }]);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ messages: history, attachment: attached ? { path: attached.path } : undefined }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        put(j.error ?? j.message ?? "Sorry, something went wrong. Please try again later.");
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        put(text);
      }
      if (!text) put("Sorry, I couldn't answer that right now. Please try again later.");
    } catch {
      put("Sorry, something went wrong. Please try again later.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[70vh] flex-col gap-3">
      <h1 className="text-2xl font-semibold text-primary">Ask</h1>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border bg-card p-4">
        {msgs.map((m, i) => (
          m.role === "user"
            ? <div key={i} className="ml-auto max-w-[85%] rounded-xl bg-primary p-3 text-lg text-primary-foreground">
                <p>{m.text}</p>
                {m.att && <p className="mt-1 flex items-center gap-1 text-sm opacity-90"><Paperclip className="h-3.5 w-3.5" />{m.att}</p>}
              </div>
            : <div key={i} className="max-w-[90%] space-y-2"><div className=" space-y-2 rounded-xl bg-secondary p-3 text-base leading-relaxed [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-primary [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1"><ReactMarkdown>{stripBlocks(m.text)}</ReactMarkdown></div>
                {user && parseBlocks(m.text).map((d, j) => <AddCard key={j} med={d} userId={user.id} />)}</div>
        ))}
      </div>

      <div className="space-y-2">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={pick} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
        {(uploading || recording || hearing) && (
          <div className="flex items-center gap-2">
            {uploading && <span className="text-sm text-muted-foreground">Attaching…</span>}
            {recording && <span className="text-sm font-medium text-destructive">Listening… tap stop when you're done</span>}
            {hearing && <span className="text-sm text-muted-foreground">Turning your voice into text…</span>}
          </div>
        )}

        {file && (
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-sm">
            <Paperclip className="h-4 w-4 shrink-0" />
            <span className="truncate">{file.name}</span>
            <button type="button" aria-label="Remove attachment" onClick={() => setFile(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        <form className="relative" onSubmit={(e) => { e.preventDefault(); send(); }}>
          {toolsOpen && (
            <div className="absolute bottom-full left-0 z-10 mb-2 w-56 rounded-xl border bg-card p-1.5 shadow-lg">
              <button type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-base hover:bg-secondary" onClick={() => { setToolsOpen(false); fileRef.current?.click(); }}>
                <Paperclip className="h-4.5 w-4.5 text-primary" /> Attach a photo or PDF
              </button>
              <button type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-base hover:bg-secondary" onClick={() => { setToolsOpen(false); camRef.current?.click(); }}>
                <Camera className="h-4.5 w-4.5 text-primary" /> Take a photo
              </button>
              <button type="button" className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-base hover:bg-secondary ${recording ? "text-destructive" : ""}`} onClick={() => { setToolsOpen(false); toggleRec(); }}>
                <Mic className={`h-4.5 w-4.5 ${recording ? "text-destructive" : "text-primary"}`} /> {recording ? "Stop recording" : "Speak your question"}
              </button>
            </div>
          )}
          <Button type="button" size="icon" variant="ghost" aria-label="More options" aria-expanded={toolsOpen} onClick={() => setToolsOpen((v) => !v)} className="absolute left-1.5 top-1/2 h-9 w-9 -translate-y-1/2"><Plus className={toolsOpen ? "rotate-45 transition-transform" : "transition-transform"} /></Button>
          <Input className={`h-12 pl-12 text-base ${recording ? "pr-24" : "pr-14"}`} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setToolsOpen(false)} placeholder="What would you like to know?" />
          {recording && (
            <Button type="button" size="icon" variant="destructive" aria-label="Stop recording" onClick={() => recRef.current?.stop()} className="absolute right-12 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full">
              <Square className="h-4 w-4 fill-current" />
            </Button>
          )}
          <Button type="submit" size="icon" aria-label="Send" disabled={busy} className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2"><Send /></Button>
        </form>
      </div>
    </div>
  );
}

type Draft = { name: string; form?: string; dose_qty?: number; times?: string[]; composition?: string | null; manufacturer?: string | null; stock?: number; start_date?: string; end_date?: string | null; notes?: string | null };
const BLOCK = /```add-medicine\s*([\s\S]*?)```/g;
function stripBlocks(t: string) { return t.replace(BLOCK, "").replace(/```add-medicine[\s\S]*$/, ""); }
function parseBlocks(t: string): Draft[] {
  const out: Draft[] = [];
  for (const m of t.matchAll(BLOCK)) { try { const d = JSON.parse(m[1]!); if (d?.name) out.push(d); } catch { /* partial */ } }
  return out;
}

function AddCard({ med }: { med: Draft; userId: string }) {
  const navigate = useNavigate();
  const form = FORMS.some((f) => f.id === med.form) ? med.form! : "tablet";
  const times = (med.times ?? []).filter((t) => /^\d{2}:\d{2}$/.test(t));
  const review = () => {
    let days: number | null = null;
    if (med.end_date && /^\d{4}-\d{2}-\d{2}$/.test(med.end_date)) {
      const start = med.start_date && /^\d{4}-\d{2}-\d{2}$/.test(med.start_date) ? new Date(med.start_date) : new Date(new Date().toISOString().slice(0, 10));
      days = Math.max(1, Math.round((+new Date(med.end_date) - +start) / 864e5) + 1);
    }
    sessionStorage.setItem("smm-ask-draft", JSON.stringify({
      name: med.name.slice(0, 120), composition: med.composition ?? null, manufacturer: med.manufacturer ?? null, form,
      dose_qty: Math.max(1, Number(med.dose_qty) || 1), times: times.length ? times : ["08:00"], days, notes: med.notes ?? null,
    }));
    navigate({ to: "/medicines" });
  };
  return (
    <div className="rounded-xl border bg-card p-3 text-base">
      <p className="font-semibold text-primary">{med.name}</p>
      {med.composition && <p className="text-sm text-muted-foreground">{med.composition}</p>}
      <p className="text-sm">{doseText(Math.max(1, Number(med.dose_qty) || 1), form)} at {joinTimes(times.length ? times : ["08:00"])}</p>
      <Button size="sm" className="mt-2" onClick={review}><Plus /> Review and add</Button>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Gem, Ticket, Trash2, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { DISCOUNT_PERCENTS, randomCode } from "@/lib/plans";
import { useIsAdmin } from "@/components/Premium";
import { useUser } from "@/lib/meds";
import { AdminUsers } from "@/components/AdminUsers";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Manage users — ShowMyMeds Admin" }, { name: "description", content: "Manage ShowMyMeds users, caregivers, account access and Premium." }, { property: "og:title", content: "Manage users — ShowMyMeds Admin" }, { property: "og:description", content: "Owner-only account and caregiver management." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

const DURATIONS = [
  { id: "month", label: "1 month", days: 30 },
  { id: "year", label: "1 year", days: 365 },
  { id: "life", label: "Lifetime", days: 0 },
] as const;

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "Never");

function AdminPage() {
  const { data: me } = useUser();
  const { data: isAdmin, isLoading } = useIsAdmin(me?.id);
  if (isLoading) return null;
  if (!isAdmin) return <p className="text-muted-foreground">This page is only for the app owner.</p>;
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-primary">Admin</h1>
      <AdminUsers />
      <FreePremium />
      <Codes />
    </div>
  );
}

function FreePremium() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [dur, setDur] = useState<string>("year");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const list = useQuery({
    queryKey: ["admin-premium"],
    queryFn: async () => { const { data, error } = await supabase.rpc("admin_list_premium"); if (error) throw error; return data; },
  });
  const selected = list.data?.find((p) => p.user_id === selectedId);
  async function give() {
    const d = DURATIONS.find((x) => x.id === dur);
    if (!d) return;
    const expires = d.days ? new Date(Date.now() + d.days * 864e5).toISOString() : null;
    const { error } = await supabase.rpc("admin_grant_premium", { _email: email, _expires: expires as string });
    if (error) { toast.error(error.message); return; }
    toast.success(`Premium given to ${email}`); setEmail("");
    qc.invalidateQueries({ queryKey: ["admin-premium"] }); qc.invalidateQueries({ queryKey: ["premium"] });
  }
  async function remove(id: string) {
    const { error } = await supabase.rpc("admin_revoke_premium", { _user: id });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-premium"] }); qc.invalidateQueries({ queryKey: ["premium"] });
  }
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Gem className="h-4 w-4 text-premium" /> Give Premium for free</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="email" placeholder="User's email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex gap-1">
          {DURATIONS.map((d) => (
            <Button key={d.id} size="sm" variant={dur === d.id ? "default" : "outline"} onClick={() => setDur(d.id)}>{d.label}</Button>
          ))}
        </div>
        <Button size="sm" onClick={give} disabled={!email.includes("@")}>Give Premium</Button>
      </div>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild><Button variant="outline" role="combobox" aria-label="Select Premium account" aria-expanded={pickerOpen} className="w-full justify-between gap-2" disabled={!list.data?.length}><span className="truncate">{selected ? selected.display_name || selected.email : `Select Premium account (${list.data?.length ?? 0})`}</span><ChevronsUpDown className="h-4 w-4 shrink-0" /></Button></PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0"><Command><CommandInput placeholder="Search name or email" aria-label="Search Premium accounts" /><CommandList className="max-h-56"><CommandEmpty>No matching accounts.</CommandEmpty><CommandGroup>{(list.data ?? []).map((p) => <CommandItem key={p.user_id} value={`${p.user_id} ${p.display_name || ""} ${p.email || ""}`} onSelect={() => { setSelectedId(p.user_id); setPickerOpen(false); }}><div className="min-w-0 py-1"><p className="break-words font-medium">{p.display_name || p.email}</p><p className="break-all text-xs text-muted-foreground">{p.email}</p></div></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent>
      </Popover>
      {selected && (
          <div className="flex items-center gap-2 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{selected.display_name || selected.email}</p>
              <p className="break-all text-xs text-muted-foreground">{selected.email} · ends {fmt(selected.expires_at)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => remove(selected.user_id)}><Trash2 /> Remove</Button>
          </div>
      )}
      {list.data?.length === 0 && <p className="text-sm text-muted-foreground">No one has Premium yet.</p>}
    </section>
  );
}

function Codes() {
  const qc = useQueryClient();
  const [percent, setPercent] = useState<number>(50);
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const codes = useQuery({
    queryKey: ["admin-codes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-codes"] });
  async function create() {
    const code = randomCode();
    const { error } = await supabase.from("discount_codes").insert({
      code, percent, max_uses: maxUses ? Number(maxUses) : null,
      expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
    });
    if (error) { toast.error(error.message); return; }
    navigator.clipboard?.writeText(code).catch(() => {});
    toast.success(`Code ${code} created and copied`); refresh();
  }
  async function toggle(id: string, active: boolean) {
    await supabase.from("discount_codes").update({ active }).eq("id", id); refresh();
  }
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Ticket className="h-4 w-4 text-primary" /> Discount codes</h2>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-1">
          {DISCOUNT_PERCENTS.map((p) => (
            <Button key={p} size="sm" variant={percent === p ? "default" : "outline"} onClick={() => setPercent(p)}>{p}%</Button>
          ))}
        </div>
        <label className="text-xs text-muted-foreground">Max uses
          <Input className="w-24" type="number" min={1} placeholder="Unlimited" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">Expires on
          <Input className="w-40" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
        <Button size="sm" onClick={create}>Create code</Button>
      </div>
      <ul className="divide-y text-sm">
        {(codes.data ?? []).map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className={c.active ? "font-mono font-semibold" : "font-mono text-muted-foreground line-through"}>{c.code} · {c.percent}% off</p>
              <p className="text-xs text-muted-foreground">Used {c.used_count}{c.max_uses ? ` of ${c.max_uses}` : ""} · expires {fmt(c.expires_at)}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Copy code" onClick={() => { navigator.clipboard?.writeText(c.code); toast("Copied"); }}><Copy /></Button>
            <Button size="sm" variant="outline" onClick={() => toggle(c.id, !c.active)}>{c.active ? "Switch off" : "Switch on"}</Button>
          </li>
        ))}
        {codes.data?.length === 0 && <li className="py-2 text-muted-foreground">No codes yet.</li>}
      </ul>
    </section>
  );
}

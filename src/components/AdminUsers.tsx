import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronsUpDown, Settings2, UsersRound, Save, Trash2, ShieldBan, ShieldCheck, Gem } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { displayPhone, internationalPhone } from "@/lib/contact-phone";
import { listAdminUsers, updateAdminContact, updateAdminAccess, updateAdminPremium, removeAdminConnection } from "@/lib/admin-users.functions";
import { matchesUser } from "@/lib/admin-users";
import { isPremiumActive } from "@/lib/plans";

type Directory = Awaited<ReturnType<typeof listAdminUsers>>;
type Account = Directory["users"][number];

export function AdminUsers() {
  const fetchUsers = useServerFn(listAdminUsers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Account | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const query = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers(), refetchInterval: 60000 });
  const links = query.data?.links ?? [];
  const users = (query.data?.users ?? []).filter((u) => matchesUser(u, search) && (filter === "all" || (filter === "caregivers" ? links.some((l) => l.caregiver_id === u.id && l.status === "accepted") : u.suspended)));
  const current = users.find((u) => u.id === accountId);
  return <section className="space-y-4">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><UsersRound className="h-5 w-5" /> Users & caregivers <span className="text-sm text-muted-foreground">({query.data?.users.length ?? 0})</span></h2>
    <div className="flex flex-wrap gap-2">{([["all", "All users"], ["caregivers", "Caregivers"], ["suspended", "Suspended"]] as const).map(([id, label]) => <Button key={id} size="sm" variant={filter === id ? "default" : "outline"} onClick={() => setFilter(id)}>{label}</Button>)}</div>
    <Popover open={pickerOpen} onOpenChange={(open) => { setPickerOpen(open); if (!open) setSearch(""); }}>
      <PopoverTrigger asChild><Button variant="outline" role="combobox" aria-label="Select user or caregiver" aria-expanded={pickerOpen} disabled={query.isPending || query.isError} className="w-full justify-between gap-2"><span className="truncate">{current ? current.name || current.email || "Name not provided" : "Select user or caregiver"}</span><ChevronsUpDown className="h-4 w-4 shrink-0" /></Button></PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}><CommandInput aria-label="Search users" placeholder="Search name, email or mobile" value={search} onValueChange={setSearch} /><CommandList className="max-h-56"><CommandEmpty>No matching accounts.</CommandEmpty><CommandGroup>{users.map((u) => <CommandItem key={u.id} value={u.id} onSelect={() => { setAccountId(u.id); setPickerOpen(false); setSearch(""); }} className="items-start py-2"><div className="min-w-0"><p className="break-words font-medium">{u.name || "Name not provided"}</p><p className="break-all text-xs text-muted-foreground">{u.email || "Email not provided"}</p><p className="text-xs text-muted-foreground">{displayPhone(u.phone) || "Mobile not provided"}</p></div></CommandItem>)}</CommandGroup></CommandList></Command>
      </PopoverContent>
    </Popover>
    {query.isPending && <p className="text-muted-foreground">Loading accounts…</p>}
    {query.isError && <div role="alert" className="text-destructive">Could not load accounts. <Button variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button></div>}
    <ul>{(current ? [current] : []).map((u) => <li key={u.id} className="flex items-center gap-3 py-4">
      <div className="min-w-0 flex-1 space-y-1"><p className="break-words font-semibold">{u.name || "Name not provided"}</p><p className="break-all text-sm text-muted-foreground">{u.email || "Email not provided"}</p><p className="break-words text-sm text-muted-foreground">{displayPhone(u.phone) || "Mobile not provided"}</p>
        <p className="flex flex-wrap gap-x-3 text-xs font-medium text-primary">{u.admin && <span>Owner</span>}<span>{links.some((l) => l.caregiver_id === u.id && l.status === "accepted") ? "User · Caregiver" : "User"}</span>{u.premium && isPremiumActive(u.premium.expires_at) && <span>Premium</span>}{u.suspended && <span className="text-destructive">Suspended</span>}</p>
      </div><Button variant="outline" size="sm" onClick={() => setSelected(u)} aria-label={`Settings for ${u.name || u.email || "user"}`}><Settings2 className="h-4 w-4" /><span className="hidden sm:inline">Settings</span></Button>
    </li>)}</ul>
    {!query.isPending && !query.isError && !users.length && <p className="text-muted-foreground">No matching accounts.</p>}
    {selected && query.data && <UserSettings key={selected.id} account={query.data.users.find((u) => u.id === selected.id) ?? selected} directory={query.data} onClose={() => setSelected(null)} />}
  </section>;
}

function UserSettings({ account, directory, onClose }: { account: Account; directory: Directory; onClose: () => void }) {
  const qc = useQueryClient();
  const contact = useServerFn(updateAdminContact), access = useServerFn(updateAdminAccess), premium = useServerFn(updateAdminPremium), disconnect = useServerFn(removeAdminConnection);
  const [name, setName] = useState(account.name), [email, setEmail] = useState(account.email), [phone, setPhone] = useState(displayPhone(account.phone));
  const [duration, setDuration] = useState("year"), [expiry, setExpiry] = useState(account.premium?.expires_at?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ label: string; action: () => Promise<unknown> } | null>(null);
  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await action(); toast.success(message); setConfirm(null); await Promise.all([qc.invalidateQueries({ queryKey: ["admin-users"] }), qc.invalidateQueries({ queryKey: ["premium"] }), qc.invalidateQueries({ queryKey: ["admin-premium"] }), qc.invalidateQueries({ queryKey: ["links"] })]); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save changes."); }
    finally { setBusy(false); }
  };
  const connections = directory.links.filter((l) => l.patient_id === account.id || l.caregiver_id === account.id);
  const grant = () => {
    if (duration === "custom" && (!expiry || new Date(`${expiry}T23:59:59`).getTime() <= Date.now())) { toast.error("Choose a future expiry date."); return; }
    const ends = duration === "life" ? null : duration === "custom" ? new Date(`${expiry}T23:59:59`).toISOString() : new Date(Date.now() + (duration === "month" ? 30 : 365) * 864e5).toISOString();
    return run(() => premium({ data: { userId: account.id, expires: ends, revoke: false } }), "Premium access saved");
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto">
    <DialogHeader><DialogTitle>Account settings</DialogTitle><DialogDescription className="break-all">{account.name || account.email || "User"}</DialogDescription></DialogHeader>
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setConfirm({ label: "Save these contact details? Changing email or mobile may change how this person signs in.", action: () => contact({ data: { userId: account.id, name, email, phone: internationalPhone(phone) } }) }); }}>
      <h3 className="font-semibold">Name & contact details</h3>
      <label className="block space-y-1 text-sm">Name<Input required value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="block space-y-1 text-sm">Email<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="block space-y-1 text-sm">Mobile number (with country code)<Input type="tel" placeholder="+91 98765 43210 or +1 202 555 0123" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      {phone && !internationalPhone(phone).startsWith("+") && <p className="text-sm text-muted-foreground">Country code missing. Add +91 for India, +1 for the US, or the correct code for this number.</p>}
      <Button size="sm" disabled={busy}><Save /> Save contact details</Button>
    </form>
    <section className="space-y-3 border-t pt-4"><h3 className="flex items-center gap-2 font-semibold"><Gem className="h-4 w-4" /> Premium access</h3>
      <p className="text-sm text-muted-foreground">{account.premium ? account.premium.expires_at ? `Expires ${new Date(account.premium.expires_at).toLocaleDateString()}` : "Lifetime Premium" : "No Premium access"}</p>
      <div className="flex flex-wrap gap-2">{([["month", "1 month"], ["year", "1 year"], ["life", "Lifetime"], ["custom", "Set expiry"]] as const).map(([id, label]) => <Button key={id} size="sm" variant={duration === id ? "default" : "outline"} onClick={() => setDuration(id)}>{label}</Button>)}</div>
      {duration === "custom" && <Input aria-label="Premium expiry date" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />}
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={grant}>Grant / update Premium</Button>{account.premium && <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm({ label: "Remove Premium access for this account?", action: () => premium({ data: { userId: account.id, expires: null, revoke: true } }) })}>Remove Premium</Button>}</div>
    </section>
    <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Caregiver connections</h3>
      {!connections.length && <p className="text-sm text-muted-foreground">No caregiver connections.</p>}
      {connections.map((l) => { const otherId = l.patient_id === account.id ? l.caregiver_id : l.patient_id; const other = directory.users.find((u) => u.id === otherId); return <div key={l.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{other?.name || other?.email || "Unaccepted invitation"}</p><p className="text-xs text-muted-foreground">{l.patient_id === account.id ? "Caregiver" : "Cares for"} · {l.status}</p></div><Button size="icon" variant="ghost" disabled={busy} aria-label="Remove connection" onClick={() => setConfirm({ label: "Remove this caregiver connection? They will no longer be able to view these medicines.", action: () => disconnect({ data: { id: l.id } }) })}><Trash2 /></Button></div>; })}
    </section>
    <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Account access</h3><p className="text-sm text-muted-foreground">{account.suspended ? "Suspended" : "Active"}</p>
      {!account.admin && <Button variant={account.suspended ? "outline" : "destructive"} size="sm" disabled={busy} onClick={() => setConfirm({ label: account.suspended ? "Restore access to this account?" : "Suspend this account? Sign-in and access to medicines will be blocked. Saved data will be kept.", action: () => access({ data: { userId: account.id, suspended: !account.suspended } }) })}>{account.suspended ? <ShieldCheck /> : <ShieldBan />}{account.suspended ? "Restore account" : "Suspend account"}</Button>}
      {account.admin && <p className="text-xs text-muted-foreground">Owner accounts cannot be suspended.</p>}
    </section>
    {confirm && <div role="alert" className="space-y-3 border-t pt-4"><p className="text-sm font-medium">{confirm.label}</p><div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => run(confirm.action, "Account updated")}>{busy ? "Saving…" : "Confirm"}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button></div></div>}
  </DialogContent></Dialog>;
}
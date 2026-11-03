import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Pill, BarChart3, Users, MessageCircle, Check } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Footer } from "./Footer";
import { AlarmWatcher } from "./AlarmWatcher";
import { PendingPayment } from "./PendingPayment";
import { THEMES, usePrefs } from "@/lib/prefs";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/meds";
import { useIsAdmin, usePremium } from "./Premium";

const NAV = [
  { to: "/today", label: "Today", icon: CalendarCheck },
  { to: "/medicines", label: "Medicines", icon: Pill },
  { to: "/history", label: "History", icon: BarChart3 },
  { to: "/family", label: "Family", icon: Users },
  { to: "/ask", label: "Ask", icon: MessageCircle },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, size, setTheme, setSize } = usePrefs();
  const { data: user } = useUser();
  const { data: isAdmin } = useIsAdmin(user?.id);
  const { data: premium } = usePremium(user?.id);
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const photo = meta["avatar_url"] || meta["picture"];
  const fullName = meta["full_name"] || meta["name"] || user?.email || "";
  const parts = fullName.split(/[\s@.]+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase() || "?";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header className="sticky top-0 z-40 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center border-b bg-background/95 px-4 py-3 backdrop-blur">
        <span />
        <Link to="/today" className="flex min-w-0 items-center justify-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-primary"><Pill /></span>
          <span className="truncate font-display text-lg font-semibold text-primary">ShowMyMeds</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Profile and display settings" className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 text-base">
            <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Display Settings</DropdownMenuLabel>
            <div className="grid grid-cols-2 gap-2 p-2">
              {(["normal", "large"] as const).map((s) => (
                <Button key={s} variant={size === s ? "default" : "outline"} size="sm" onClick={() => setSize(s)}>
                  {s === "normal" ? "Normal" : "Large"}
                </Button>
              ))}
            </div>
            <DropdownMenuLabel>Colour theme</DropdownMenuLabel>
            {THEMES.map((t) => (
              <DropdownMenuItem key={t.id} onSelect={(e) => { e.preventDefault(); setTheme(t.id); }} className="min-h-11 text-base">
                <span data-theme={t.id} className="h-5 w-5 rounded-full border bg-brand" />
                {t.label}
                {theme === t.id && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {!premium && <DropdownMenuItem asChild className="min-h-11 text-base"><Link to="/premium">💎 Go Premium</Link></DropdownMenuItem>}
            {isAdmin && <DropdownMenuItem asChild className="min-h-11 text-base"><Link to="/admin">🛠 Admin</Link></DropdownMenuItem>}
            <DropdownMenuItem onSelect={signOut} className="min-h-11 text-base">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">{children}</main>
      <Footer />

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="flex min-h-16 flex-col items-center justify-center gap-1 py-2 text-xs font-semibold sm:text-sm text-muted-foreground"
                activeProps={{ className: "bg-secondary text-primary" }}>
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {user && <AlarmWatcher userId={user.id} />}
      {user && premium !== undefined && <PendingPayment userId={user.id} premium={!!premium} />}
    </div>
  );
}

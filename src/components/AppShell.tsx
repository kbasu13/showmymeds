import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Pill, CalendarClock, UsersRound, CircleHelp, Check, Gem, LogOut } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Footer } from "./Footer";
import { AlarmWatcher } from "./AlarmWatcher";
import { THEMES, usePrefs } from "@/lib/prefs";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/meds";
import { useIsAdmin, usePremium } from "./Premium";
import { useProfileName } from "@/lib/user-profile";

const NAV = [
  { to: "/today", label: "Today", icon: CalendarCheck },
  { to: "/medicines", label: "Medicines", icon: Pill },
  { to: "/history", label: "History", icon: CalendarClock },
  { to: "/family", label: "Family", icon: UsersRound },
  { to: "/ask", label: "Ask", icon: CircleHelp },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, size, setTheme, setSize } = usePrefs();
  const { data: user } = useUser();
  const { data: isAdmin } = useIsAdmin(user?.id);
  const { data: premium } = usePremium(user?.id);
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const photo = meta["avatar_url"] || meta["picture"];
  const { name: fullName, firstName } = useProfileName();
  const parts = fullName.split(/[\s@.]+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "")).toUpperCase() || "?";
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
      <header className="sticky top-0 z-40 grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center border-b bg-background/95 px-4 py-3 backdrop-blur">
        <span aria-hidden />
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
            <DropdownMenuLabel className="break-words">{firstName ? `Hi ${firstName}!` : "Hi there!"}</DropdownMenuLabel>
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
            <div className="grid grid-cols-6 gap-1 px-2 py-2">
              {THEMES.map((t) => (
                <Button key={t.id} variant="ghost" size="icon" aria-label={t.label} aria-pressed={theme === t.id} title={t.label} onClick={() => setTheme(t.id)}
                  className={`mx-auto h-9 w-9 rounded-full border-2 p-0 ${theme === t.id ? "border-foreground" : "border-transparent"}`}>
                  <span data-theme={t.id} className="flex h-7 w-7 items-center justify-center rounded-full border bg-brand">
                    {theme === t.id && <Check className="h-4 w-4 text-primary" />}
                  </span>
                </Button>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="min-h-11 text-base"><Link to="/services" className="flex w-full items-center gap-2">🧭 Discover {!premium && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-premium px-2 py-0.5 text-xs font-semibold text-premium-foreground"><Gem className="h-3.5 w-3.5" /> Premium</span>}</Link></DropdownMenuItem>
            <DropdownMenuItem asChild className="min-h-11 text-base"><Link to="/notifications" className="flex w-full items-center gap-2">🔔 Allow notifications {!premium && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-premium px-2 py-0.5 text-xs font-semibold text-premium-foreground"><Gem className="h-3.5 w-3.5" /> Premium</span>}</Link></DropdownMenuItem>
            <DropdownMenuItem asChild className="min-h-11 text-base"><Link to="/refer">🎁 Refer app</Link></DropdownMenuItem>
            {!premium && <DropdownMenuItem asChild className="min-h-11 text-base"><Link to="/premium">💎 Go Premium</Link></DropdownMenuItem>}
            <DropdownMenuItem asChild className="min-h-11 text-base"><Link to="/subscription">🧾 Manage subscription</Link></DropdownMenuItem>
            {isAdmin && <DropdownMenuItem asChild className="min-h-11 text-base"><Link to="/admin">🛠 Admin</Link></DropdownMenuItem>}
            <DropdownMenuItem onSelect={signOut} className="min-h-11 text-base"><span className="flex w-full items-center gap-2"><LogOut className="h-4 w-4" /> Sign out</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">{children}</main>
      <Footer />

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="flex min-h-16 flex-col items-center justify-center gap-1 py-2 text-sm font-semibold sm:text-base text-muted-foreground"
                activeProps={{ className: "bg-secondary text-primary" }}>
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {user && <AlarmWatcher userId={user.id} />}
    </div>
  );
}

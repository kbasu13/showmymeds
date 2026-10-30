import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Pill, BarChart3, Users, MessageCircle, UserCircle, Check } from "lucide-react";
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
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/today" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-primary"><Pill /></span>
          <span className="font-display text-2xl font-bold text-primary">ShowMyMeds</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Profile and display settings"><UserCircle className="!size-8" /></Button>
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
              <Link to={to} className="flex min-h-16 flex-col items-center justify-center gap-1 py-2 text-sm font-bold text-muted-foreground"
                activeProps={{ className: "bg-secondary text-primary" }}>
                <Icon className="h-7 w-7" />
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

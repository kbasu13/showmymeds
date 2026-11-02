import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function usePremium(userId: string | undefined) {
  return useQuery({
    queryKey: ["premium", userId],
    enabled: !!userId,
    queryFn: async () => !!(await supabase.from("premium_users").select("user_id").eq("user_id", userId!).maybeSingle()).data,
  });
}

export function PremiumBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-premium px-2 py-0.5 text-xs font-semibold text-premium-foreground", className)}>
      <Gem className="h-3.5 w-3.5" /> Premium
    </span>
  );
}

export function UpgradeCard({ feature, text }: { feature: string; text: string }) {
  return (
    <div className="space-y-3 rounded-xl border bg-hero p-6 text-center">
      <Gem className="mx-auto h-10 w-10 text-premium" />
      <h2 className="text-xl font-semibold text-primary">{feature} is a Premium feature</h2>
      <p className="text-muted-foreground">{text}</p>
      <Button asChild><Link to="/premium"><Gem /> Upgrade to Premium</Link></Button>
    </div>
  );
}

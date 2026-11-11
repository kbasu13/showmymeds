import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/meds";

export function usePayments() {
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePendingPayment() {
  return usePayments().data?.find((p) => p.status === "pending");
}

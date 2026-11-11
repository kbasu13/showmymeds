import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/meds";
import { firstName, profileName } from "@/lib/profile-name";

export function useProfileName() {
  const { data: user } = useUser();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const name = profileName(user, profile?.display_name);
  return { name, firstName: firstName(name) };
}
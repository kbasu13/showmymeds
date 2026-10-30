import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Medicine = Tables<"medicines">;
export type DoseLog = Tables<"dose_logs">;

export const FORMS = [
  { id: "tablet", label: "Tablet" },
  { id: "capsule", label: "Capsule" },
  { id: "syrup", label: "Syrup" },
  { id: "drops", label: "Drops" },
  { id: "injection", label: "Injection" },
  { id: "inhaler", label: "Inhaler" },
  { id: "cream", label: "Cream" },
] as const;

export function useUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
}

export function useMeds(userId: string | undefined) {
  return useQuery({
    queryKey: ["meds", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicines").select("*").eq("user_id", userId!).order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useLogs(userId: string | undefined, fromDate: string) {
  return useQuery({
    queryKey: ["logs", userId, fromDate],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dose_logs").select("*").eq("user_id", userId!).gte("scheduled_date", fromDate);
      if (error) throw error;
      return data;
    },
  });
}

export function useRefreshMeds() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["meds"] });
    qc.invalidateQueries({ queryKey: ["logs"] });
  };
}

export async function takeDose(medicineId: string, date: string, time: string) {
  const { error } = await supabase.rpc("take_dose", { _medicine: medicineId, _date: date, _time: time });
  if (error) throw error;
}

/** Look up a picture of the medicine online (Wikipedia). Returns null when nothing is found. */
export async function lookupMedicineImage(name: string): Promise<string | null> {
  const q = name.trim().split(/\s+/)[0];
  if (!q) return null;
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.thumbnail?.source ?? j?.originalimage?.source ?? null;
  } catch {
    return null;
  }
}

export async function uploadFile(userId: string, file: File, kind: "image" | "rx") {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${kind}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("prescriptions").upload(path, file);
  if (error) throw error;
  return path;
}

export async function signedUrl(path: string) {
  const { data } = await supabase.storage.from("prescriptions").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

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

export async function untakeDose(medicineId: string, date: string, time: string) {
  const { error } = await supabase.rpc("untake_dose", { _medicine: medicineId, _date: date, _time: time });
  if (error) throw error;
}

async function wikiImage(q: string): Promise<string | null> {
  if (!q.trim()) return null;
  try {
    const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=3&gsrsearch=${encodeURIComponent(q)}&prop=pageimages&piprop=thumbnail&pithumbsize=400`;
    const r = await fetch(u);
    if (!r.ok) return null;
    const j = (await r.json()) as { query?: { pages?: Record<string, { index: number; thumbnail?: { source: string } }> } };
    const pages = Object.values(j.query?.pages ?? {}).sort((a, b) => a.index - b.index);
    return pages.find((p) => p.thumbnail)?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

/** Look up a picture of the medicine online: brand name first, then its main ingredient. */
export async function lookupMedicineImage(name: string, composition?: string | null): Promise<string | null> {
  const n = name.trim();
  const ingredient = (composition ?? "").split("+")[0]?.replace(/[\d.]+\s*(mg|mcg|g|ml|iu|%).*$/i, "").trim() ?? "";
  return (
    (await wikiImage(`${n} medicine`)) ??
    (await wikiImage(n.split(/\s+/)[0] ?? "")) ??
    (ingredient ? await wikiImage(ingredient) : null)
  );
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

/** Look up the full active composition of a medicine online. Returns null when unknown. */
export async function lookupComposition(name: string): Promise<string | null> {
  if (!name.trim()) return null;
  const { data } = await supabase.auth.getSession();
  try {
    const r = await fetch("/api/composition", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) return null;
    return ((await r.json()) as { composition: string | null }).composition;
  } catch {
    return null;
  }
}

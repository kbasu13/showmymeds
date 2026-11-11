type NamedUser = { user_metadata?: Record<string, unknown> } | null | undefined;

/** Use a saved profile name first, then names supplied during sign-in; never guess from email. */
export function profileName(user: NamedUser, displayName?: string | null): string {
  const metadata = user?.user_metadata;
  const candidates = [displayName, metadata?.["full_name"], metadata?.["name"], metadata?.["given_name"]];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() && !candidate.includes("@")) {
      return candidate.trim().replace(/\s+/g, " ");
    }
  }
  return "";
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function invoiceBuyerName(billingName: string | null, name: string): string {
  return billingName?.trim() || firstName(name) || "Customer";
}
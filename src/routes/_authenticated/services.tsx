import { createFileRoute } from "@tanstack/react-router";
import { MapPin, HeartHandshake, Store, BadgePercent, MessageCircle } from "lucide-react";
import { PremiumBadge, usePremium, UpgradeCard } from "@/components/Premium";
import { useUser } from "@/lib/meds";

export const Route = createFileRoute("/_authenticated/services")({
  head: () => ({
    meta: [
      { title: "Discover — ShowMyMeds" }, { property: "og:title", content: "Discover — ShowMyMeds" },
      { name: "description", content: "Find care centres and pharmacies nearby, with partner discounts. Coming soon." },
      { property: "og:description", content: "Find care centres and pharmacies nearby, with partner discounts. Coming soon." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }],
  }),
  component: ServicesPage,
});

const maps = (q: string) => `https://www.google.com/maps/search/${encodeURIComponent(q + " near me")}`;

const CARE = ["Geriatric care", "Pediatric care", "Palliative care", "Home nursing"];

function ServicesPage() {
  const { data: user } = useUser();
  const { data: premium, isLoading } = usePremium(user?.id);
  if (isLoading) return <p>Loading…</p>;
  if (!premium) return <UpgradeCard feature="Discover" text="Find care centres, pharmacies and partner discounts near you." />;
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-primary">Discover</h1>
        <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm font-semibold">More coming soon</p>
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><MapPin className="text-primary" /> Care centres near you</h2>
        <p className="text-muted-foreground">Open the map, tap a place to see its phone number and address, then call or WhatsApp them.</p>
        <div className="grid grid-cols-2 gap-2">
          {CARE.map((c) => (
            <a key={c} href={maps(c + " centre")} target="_blank" rel="noreferrer"
              className="rounded-lg border bg-background p-3 text-center font-semibold hover:bg-secondary">{c}</a>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><HeartHandshake className="text-primary" /> Partner care agencies</h2>
        <p className="text-muted-foreground">Trusted caregiver agencies with special discounts when you book through ShowMyMeds, and a one-tap WhatsApp button.</p>
        <Soon />
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Store className="text-primary" /> Pharmacies near you</h2>
        <a href={maps("pharmacy")} target="_blank" rel="noreferrer"
          className="block rounded-lg border bg-background p-3 text-center font-semibold hover:bg-secondary">Find pharmacies on the map</a>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><BadgePercent className="text-primary" /> Partner pharmacies</h2>
        <p className="text-muted-foreground">Order from partner pharmacies directly and get a discount for ordering through this app.</p>
        <Soon />
      </section>

      <p className="text-center text-sm text-muted-foreground">More services will be added soon.</p>
    </div>
  );
}

function Soon() {
  return (
    <p className="flex items-center justify-center gap-2 rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">
      <MessageCircle className="h-4 w-4" /> Partner list coming soon
    </p>
  );
}

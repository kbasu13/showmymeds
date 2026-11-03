import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="px-4 py-6 text-center text-sm text-muted-foreground">
      © {new Date().getFullYear()} Built with love{" "}
      <Heart className="inline h-4 w-4 fill-destructive text-destructive align-[-2px]" aria-label="love" />. Powered by EMC. All rights reserved.
    </footer>
  );
}

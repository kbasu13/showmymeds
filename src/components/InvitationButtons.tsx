import { MessageCircle, MessageSquare, Mail, Share2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SharingMethod } from "@/lib/invitations";
export function InvitationButtons({ busy, onSend }: { busy: boolean; onSend: (method: SharingMethod) => void }) {
  return <div className="flex flex-wrap gap-2">{([{ method: "whatsapp", label: "WhatsApp", icon: MessageCircle }, { method: "sms", label: "SMS", icon: MessageSquare }, { method: "email", label: "Email", icon: Mail }, { method: "share", label: "More", icon: Share2 }, { method: "copy", label: "Copy", icon: Copy }] as const).map(({ method, label, icon: Icon }) => <Button key={method} disabled={busy} variant={method === "whatsapp" ? "default" : "outline"} size="sm" onClick={() => onSend(method)}><Icon />{label}</Button>)}</div>;
}

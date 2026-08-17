import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { Calendar, Church, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCapabilities } from "@/lib/adminCapabilities";
import { useBishopDesk } from "@/hooks/useBishopDesk";

type ActionItem = { label: string; count: number; link: string; icon: React.ReactNode };

export function AdminActionItems({ user }: { user: User | null }) {
  const { has, loading: capLoading } = useCapabilities(user);
  // Desk access is not the same test as the capability. Bishop and his
  // secretary sit in bishop_booking_authorized_users and are not necessarily
  // admins at all — and a capability can only be held by an admin — so gating
  // on has("bishop_desk") alone would hide the Bishop's own invitations from
  // the Bishop. has_bishop_desk_access ORs both paths; this hook calls it.
  const desk = useBishopDesk(user);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (capLoading || desk.loading || !user) return;
    (async () => {
      const next: ActionItem[] = [];

      if (has("events_review")) {
        const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "pending");
        if (count) next.push({ label: "Events awaiting review", count, link: "/dashboard/events?filter=pending", icon: <Calendar className="h-4 w-4" /> });
      }

      if (desk.hasAccess) {
        // Table may not exist yet if the Bishop's Desk migration hasn't been
        // deployed — fail quietly rather than breaking the whole dashboard.
        const { count, error } = await supabase
          .from("bishop_booking_requests")
          .select("id", { count: "exact", head: true })
          // 'new' is the untriaged bucket in bishop_booking_status; there is no
          // 'submitted' value in that enum, so filtering on one would have
          // matched nothing and hidden this row for good.
          .eq("status", "new");
        if (!error && count) {
          next.push({ label: "New Bishop's Desk invitations", count, link: "/dashboard/engagements", icon: <Church className="h-4 w-4" /> });
        }
      }

      setItems(next);
      setLoading(false);
    })();
  }, [capLoading, desk.loading, desk.hasAccess, has, user]);

  if (capLoading || desk.loading || loading || items.length === 0) return null;

  return (
    <div className="border border-accent/30 bg-accent/5">
      <div className="px-6 py-4 border-b border-accent/20 eyebrow text-accent">— Needs Your Attention</div>
      <div className="divide-y divide-accent/10">
        {items.map((item) => (
          <Link key={item.label} to={item.link as any} className="flex items-center justify-between px-6 py-4 hover:bg-accent/10 transition-colors">
            <div className="flex items-center gap-3">
              <div className="text-accent">{item.icon}</div>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl">{item.count}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AdminCapability =
  | "events_review"
  | "groups_management"
  | "evangelism_management"
  | "programs_management"
  | "bishop_desk"
  | "admin_management";

export const CAPABILITY_CATALOG: { key: AdminCapability; label: string; description: string }[] = [
  { key: "events_review", label: "Events", description: "Approve, reject, and edit member-submitted events." },
  { key: "groups_management", label: "Groups", description: "Create groups and manage group membership." },
  { key: "evangelism_management", label: "Evangelism", description: "Oversee all evangelism contacts and follow-ups, not just their own." },
  { key: "programs_management", label: "Reading Programs", description: "Create and edit reading programs, lessons, and quizzes." },
  { key: "bishop_desk", label: "Bishop's Desk", description: "Access and manage Bishop's ministry engagement requests and calendar." },
  { key: "admin_management", label: "Admin Settings", description: "Name admins and control which capabilities each one holds. Sensitive — grant sparingly." },
];

export function useCapabilities(user: User | null) {
  const [capabilities, setCapabilities] = useState<AdminCapability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCapabilities([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("admin_capability_grants")
        .select("capability")
        .eq("user_id", user.id);
      if (!active) return;
      setCapabilities((data ?? []).map((r) => r.capability as AdminCapability));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  // Memoized deliberately. Consumers put `has` in a useEffect dependency array,
  // and an inline arrow would be a new reference on every render — the effect
  // would set state, trigger a render, produce a new `has`, and run again.
  const has = useCallback(
    (cap: AdminCapability) => capabilities.includes(cap),
    [capabilities],
  );

  return { capabilities, loading, has };
}

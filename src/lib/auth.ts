import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "leader" | "member";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST (per Supabase guidance)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useRoles(user: User | null) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoadedUserId(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!active) return;
        setRoles((data ?? []).map((r) => r.role as AppRole));
        setLoadedUserId(user.id);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setRoles([]);
        setLoadedUserId(user.id);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const effectiveLoading = loading || (!!user && loadedUserId !== user.id);

  return {
    roles,
    loading: effectiveLoading,
    isAdmin: roles.includes("admin"),
    isLeader: roles.includes("leader") || roles.includes("admin"),
  };
}

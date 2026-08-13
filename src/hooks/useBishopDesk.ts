import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { bishopDb } from "@/lib/bishopDb";

export type DeskAccess = {
  loading: boolean;
  hasAccess: boolean;
  /** Bishop-visibility notes are readable only when this is true. */
  isBishop: boolean;
  displayName: string | null;
  email: string | null;
};

const DENIED: Omit<DeskAccess, "loading"> = {
  hasAccess: false,
  isBishop: false,
  displayName: null,
  email: null,
};

/**
 * Desk membership, mirroring the shape of `useRoles` in lib/auth.ts.
 *
 * Access comes from `has_bishop_desk_access`, a SECURITY DEFINER RPC, rather
 * than from `user_roles`: managing the church's events is not the same trust
 * boundary as reading a visiting church's correspondence and the Bishop's own
 * notes, so being an admin here grants nothing by itself.
 *
 * This gates the *UI only*. Every table behind it carries its own RLS policy,
 * so a user who forced their way past this component would still read nothing.
 */
export function useBishopDesk(user: User | null): DeskAccess {
  const [state, setState] = useState<Omit<DeskAccess, "loading">>(DENIED);
  const [loading, setLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setState(DENIED);
      setLoadedUserId(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    (async () => {
      try {
        const { data: allowed, error } = await bishopDb.rpc("has_bishop_desk_access", {
          _user_id: user.id,
        });
        if (!active) return;

        if (error || !allowed) {
          setState(DENIED);
        } else {
          // RLS on the roster already restricts this to desk members, so a
          // second permission check here would be redundant.
          const { data: row } = await bishopDb
            .from("bishop_booking_authorized_users")
            .select("is_bishop, display_name, email")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!active) return;
          setState({
            hasAccess: true,
            isBishop: Boolean(row?.is_bishop),
            displayName: row?.display_name ?? null,
            email: row?.email ?? null,
          });
        }
      } catch {
        if (active) setState(DENIED);
      } finally {
        if (active) {
          setLoadedUserId(user.id);
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  // Same guard as useRoles: while a *different* user's result is still in
  // state, report loading rather than briefly showing the previous verdict.
  return { ...state, loading: loading || (!!user && loadedUserId !== user.id) };
}

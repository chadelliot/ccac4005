// PRIVATE — only callable by someone holding the 'admin_management' capability.
// auth.users (and therefore email addresses) isn't exposed to PostgREST, so
// listing "which admin is which" and adding a new admin by email both need
// to go through the service role here.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const CAPABILITIES = [
  "events_review", "groups_management", "evangelism_management",
  "programs_management", "bishop_desk", "admin_management",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const asCaller = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await asCaller.auth.getUser();
    if (authError || !user) return json({ error: "Not authenticated" }, 401);

    const { data: canManage } = await asCaller.rpc("has_capability", { _user_id: user.id, _capability: "admin_management" });
    if (!canManage) return json({ error: "You don't have Admin Settings access." }, 403);

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const { data: roleRows } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      const userIds = [...new Set((roleRows ?? []).map((r) => r.user_id))];
      if (userIds.length === 0) return json({ admins: [] });

      const { data: profiles } = await admin.from("profiles").select("id, display_name").in("id", userIds);
      const { data: grants } = await admin.from("admin_capability_grants").select("user_id, capability").in("user_id", userIds);

      const admins = await Promise.all(userIds.map(async (id) => {
        const { data: authUser } = await admin.auth.admin.getUserById(id);
        const profile = profiles?.find((p) => p.id === id);
        return {
          user_id: id,
          email: authUser?.user?.email ?? "(unknown)",
          display_name: profile?.display_name ?? null,
          capabilities: (grants ?? []).filter((g) => g.user_id === id).map((g) => g.capability),
        };
      }));

      return json({ admins });
    }

    if (body.action === "set_capability") {
      const { targetUserId, capability, enabled } = body;
      if (!targetUserId || !CAPABILITIES.includes(capability)) {
        return json({ error: "Invalid targetUserId or capability" }, 400);
      }
      // The database has a trigger for this, but it tests auth.uid() and every
      // write below goes through the service role, where auth.uid() is NULL —
      // so the trigger never fires on the only path the UI uses. Without this
      // check the last admin_management holder can revoke themselves and lock
      // everyone out of Admin Settings permanently.
      if (!enabled && capability === "admin_management" && targetUserId === user.id) {
        return json({ error: "You cannot remove your own Admin Settings access. Have another admin do it." }, 400);
      }
      if (enabled) {
        const { error } = await admin
          .from("admin_capability_grants")
          .upsert({ user_id: targetUserId, capability, granted_by: user.id }, { onConflict: "user_id,capability" });
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await admin
          .from("admin_capability_grants")
          .delete()
          .eq("user_id", targetUserId)
          .eq("capability", capability);
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    if (body.action === "add_admin") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return json({ error: "Email is required" }, 400);

      // listUsers doesn't support filtering by exact email in older SDKs; page
      // through until found (fine for a church-sized user base).
      let targetId: string | null = null;
      for (let page = 1; page <= 20 && !targetId; page++) {
        const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        const match = list?.users.find((u) => u.email?.toLowerCase() === email);
        if (match) targetId = match.id;
        if (!list || list.users.length < 200) break;
      }
      if (!targetId) return json({ error: "No member account found with that email. They need to sign up first." }, 404);

      const { error: roleError } = await admin
        .from("user_roles")
        .upsert({ user_id: targetId, role: "admin" }, { onConflict: "user_id,role" });
      if (roleError) return json({ error: roleError.message }, 400);

      return json({ ok: true, user_id: targetId });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-manage-permissions error:", e);
    return json({ error: "Something went wrong." }, 500);
  }
});

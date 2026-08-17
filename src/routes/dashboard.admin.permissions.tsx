import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useCapabilities, CAPABILITY_CATALOG, type AdminCapability } from "@/lib/adminCapabilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/admin/permissions")({
  head: () => ({ meta: [{ title: "Admin Settings — CCAC" }] }),
  component: AdminPermissionsPage,
});

type AdminRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  capabilities: AdminCapability[];
};

function AdminPermissionsPage() {
  const { user } = useSession();
  const { has, loading: capLoading } = useCapabilities(user);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-permissions", { body: { action: "list" } });
    if (error || data?.error) {
      toast.error(data?.error || "Couldn't load admins.");
    } else {
      setAdmins(data.admins);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!capLoading && has("admin_management")) load();
    else if (!capLoading) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capLoading]);

  const toggle = async (targetUserId: string, capability: AdminCapability, enabled: boolean) => {
    const key = `${targetUserId}:${capability}`;
    setPendingKey(key);
    // optimistic update
    setAdmins((prev) => prev.map((a) => a.user_id !== targetUserId ? a : {
      ...a,
      capabilities: enabled ? [...a.capabilities, capability] : a.capabilities.filter((c) => c !== capability),
    }));
    const { data, error } = await supabase.functions.invoke("admin-manage-permissions", {
      body: { action: "set_capability", targetUserId, capability, enabled },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Couldn't update that permission.");
      load(); // revert by reloading truth from the server
    }
    setPendingKey(null);
  };

  const addAdmin = async () => {
    if (!addEmail.trim()) return;
    setAdding(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-permissions", {
      body: { action: "add_admin", email: addEmail.trim() },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Couldn't add that admin.");
    } else {
      toast.success("Admin added. Choose which areas they can manage below.");
      setAddOpen(false);
      setAddEmail("");
      load();
    }
    setAdding(false);
  };

  if (capLoading || loading) {
    return <div className="eyebrow text-muted-foreground">Loading...</div>;
  }

  if (!has("admin_management")) {
    return (
      <div className="max-w-lg">
        <div className="eyebrow text-accent mb-3">— Admin Settings</div>
        <h1 className="font-display text-4xl mb-4">Restricted</h1>
        <p className="text-muted-foreground">
          You don't have Admin Settings access. Ask another admin with that permission to update
          your capabilities if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow text-accent mb-3">— Admin Settings</div>
          <h1 className="font-display text-5xl">Who Manages What</h1>
          <p className="text-muted-foreground mt-3 max-w-xl">
            Every admin is named individually. Check the areas each one should be able to manage —
            unchecked areas stay hidden from their dashboard menu.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4" /> Name a New Admin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Name a New Admin</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label htmlFor="admin-email">Member's email</Label>
              <Input id="admin-email" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="name@example.com" />
              <p className="text-xs text-muted-foreground">
                They must already have a member account. No capabilities are granted automatically —
                you'll check the boxes for them next.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={addAdmin} disabled={adding}>
                {adding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Admin
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {admins.map((admin) => (
          <div key={admin.user_id} className="border border-border bg-card p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-accent" />
              </div>
              <div>
                <div className="font-display text-xl">{admin.display_name || "Unnamed"}</div>
                <div className="text-sm text-muted-foreground">{admin.email}</div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {CAPABILITY_CATALOG.map((cap) => {
                const checked = admin.capabilities.includes(cap.key);
                const isSelfAdminManagement = admin.user_id === user?.id && cap.key === "admin_management";
                const key = `${admin.user_id}:${cap.key}`;
                return (
                  <div key={cap.key} className="flex items-start gap-3">
                    <Checkbox
                      id={key}
                      checked={checked}
                      disabled={pendingKey === key || (isSelfAdminManagement && checked)}
                      onCheckedChange={(c) => toggle(admin.user_id, cap.key, !!c)}
                    />
                    <div>
                      <Label htmlFor={key} className="font-medium cursor-pointer">{cap.label}</Label>
                      <p className="text-xs text-muted-foreground">{cap.description}</p>
                      {isSelfAdminManagement && checked && (
                        <p className="text-xs text-accent mt-1">Can't remove your own Admin Settings access.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {admins.length === 0 && (
          <p className="text-muted-foreground">No admins yet — name one to get started.</p>
        )}
      </div>
    </div>
  );
}

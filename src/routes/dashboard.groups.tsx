import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Users, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/dashboard/groups")({
  head: () => ({ meta: [{ title: "Groups — CCAC" }] }),
  component: GroupsPage,
});

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

const groupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

function GroupsPage() {
  const { user } = useSession();
  const { isAdmin } = useRoles(user);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: gs }, { data: mems }] = await Promise.all([
      supabase.from("groups").select("*").order("name"),
      user
        ? supabase.from("group_members").select("group_id").eq("user_id", user.id)
        : Promise.resolve({ data: [] as { group_id: string }[] }),
    ]);
    setGroups((gs ?? []) as GroupRow[]);
    setMyGroupIds(new Set((mems ?? []).map((m) => m.group_id)));
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow text-accent mb-3">— Small Groups</div>
          <h1 className="font-display text-5xl">Groups</h1>
          <p className="text-muted-foreground mt-3">
            Connect with your group, share messages, and organise gatherings.
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> New Group
              </Button>
            </DialogTrigger>
            <CreateGroupDialog
              onCreated={() => {
                setOpen(false);
                load();
              }}
            />
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground eyebrow">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center">
          <div className="eyebrow text-muted-foreground mb-2">— No groups yet</div>
          <div className="font-display text-2xl mb-2">
            {isAdmin ? "Create your first group" : "No groups have been set up"}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {groups.map((g) => (
            <Link
              key={g.id}
              to="/dashboard/groups/$id"
              params={{ id: g.id }}
              className="group flex items-center justify-between gap-4 border border-border bg-card hover:border-foreground/20 hover:bg-muted/30 transition-colors p-5 cursor-pointer"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-night text-night-foreground rounded-sm">
                  <Users className="h-4 w-4 text-gold" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-display text-xl group-hover:underline">{g.name}</div>
                    {myGroupIds.has(g.id) && (
                      <Badge variant="outline" className="text-[10px]">Member</Badge>
                    )}
                  </div>
                  {g.description && (
                    <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {g.description}
                    </div>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateGroupDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useSession();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = groupSchema.safeParse({ name, description });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("groups").insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      created_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Group created");
    setName("");
    setDescription("");
    onCreated();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">New Group</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="g-name">Name</Label>
          <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-desc">Description</Label>
          <Textarea
            id="g-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create group"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

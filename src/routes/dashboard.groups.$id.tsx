import { createFileRoute, Link, useParams } from "@tanstack/react-router";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Send, Trash2, UserPlus, Crown, Calendar } from "lucide-react";

export const Route = createFileRoute("/dashboard/groups/$id")({
  head: () => ({ meta: [{ title: "Group — CCAC" }] }),
  component: GroupDetail,
});

type Group = { id: string; name: string; description: string | null };
type Member = {
  id: string;
  user_id: string;
  role: "leader" | "member";
  display_name: string | null;
  avatar_url: string | null;
};
type Message = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
};
type Profile = { id: string; display_name: string | null; avatar_url: string | null };
type GroupEvent = {
  id: string;
  title: string;
  start_at: string;
  status: string;
};

const messageSchema = z.string().trim().min(1).max(4000);

function GroupDetail() {
  const { id } = useParams({ from: "/dashboard/groups/$id" });
  const { user } = useSession();
  const { isAdmin } = useRoles(user);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const myMembership = members.find((m) => m.user_id === user?.id);
  const isLeader = myMembership?.role === "leader";
  const canManage = isAdmin;
  const canPost = !!myMembership || isAdmin;

  const load = async () => {
    setLoading(true);
    const { data: g } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
    setGroup(g as Group | null);

    const { data: mems } = await supabase
      .from("group_members")
      .select("id, user_id, role")
      .eq("group_id", id);

    const userIds = (mems ?? []).map((m) => m.user_id);
    const profilesById = new Map<string, Profile>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);
      (profs ?? []).forEach((p) => profilesById.set(p.id, p as Profile));
    }
    setMembers(
      (mems ?? []).map((m) => {
        const p = profilesById.get(m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role as "leader" | "member",
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      }),
    );

    const { data: msgs } = await supabase
      .from("group_messages")
      .select("id, user_id, body, created_at")
      .eq("group_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    const msgUserIds = Array.from(new Set((msgs ?? []).map((m) => m.user_id)));
    const msgProfsById = new Map<string, Profile>();
    if (msgUserIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", msgUserIds);
      (profs ?? []).forEach((p) => msgProfsById.set(p.id, p as Profile));
    }
    setMessages(
      (msgs ?? []).map((m) => {
        const p = msgProfsById.get(m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          body: m.body,
          created_at: m.created_at,
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      }),
    );

    const { data: evs } = await supabase
      .from("events")
      .select("id, title, start_at, status")
      .eq("group_id", id)
      .order("start_at", { ascending: true });
    setEvents((evs ?? []) as GroupEvent[]);

    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [id, user]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      toast.error("Message cannot be empty");
      return;
    }
    setPosting(true);
    const { error } = await supabase.from("group_messages").insert({
      group_id: id,
      user_id: user.id,
      body: parsed.data,
    });
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    load();
  };

  const deleteMessage = async (mid: string) => {
    const { error } = await supabase.from("group_messages").delete().eq("id", mid);
    if (error) return toast.error(error.message);
    setMessages((ms) => ms.filter((m) => m.id !== mid));
  };

  const removeMember = async (memId: string) => {
    if (!confirm("Remove this member from the group?")) return;
    const { error } = await supabase.from("group_members").delete().eq("id", memId);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleLeader = async (memId: string, current: "leader" | "member") => {
    const next = current === "leader" ? "member" : "leader";
    const { error } = await supabase.from("group_members").update({ role: next }).eq("id", memId);
    if (error) return toast.error(error.message);
    load();
  };

  if (loading) return <div className="text-muted-foreground eyebrow">Loading…</div>;
  if (!group)
    return (
      <div className="space-y-4">
        <div className="text-muted-foreground">Group not found.</div>
        <Link to="/dashboard/groups" className="eyebrow text-xs underline">
          ← Back to groups
        </Link>
      </div>
    );

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <Link
          to="/dashboard/groups"
          className="eyebrow text-xs text-muted-foreground inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> All groups
        </Link>
        <h1 className="font-display text-4xl mt-3">{group.name}</h1>
        {group.description && (
          <p className="text-muted-foreground mt-2">{group.description}</p>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8">
        {/* Message board */}
        <section className="space-y-4">
          <div className="eyebrow text-muted-foreground">— Message board</div>

          {canPost ? (
            <form onSubmit={post} className="space-y-2">
              <Textarea
                placeholder="Share an update, prayer request, or question…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={4000}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={posting || !body.trim()} size="sm">
                  <Send className="h-3 w-3" /> {posting ? "Posting…" : "Post"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="border border-dashed border-border p-4 text-sm text-muted-foreground">
              You're not a member of this group. Ask an admin to add you.
            </div>
          )}

          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-sm text-muted-foreground">No messages yet.</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="border border-border bg-card p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex-shrink-0">
                        {m.avatar_url && (
                          <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {m.display_name ?? "Member"}
                        </div>
                        <div className="text-[10px] eyebrow text-muted-foreground">
                          {new Date(m.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                    {(m.user_id === user?.id || isAdmin) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => deleteMessage(m.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="text-sm whitespace-pre-wrap pl-9">{m.body}</div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Sidebar: members + events */}
        <aside className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="eyebrow text-muted-foreground">— Members ({members.length})</div>
              {canManage && (
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <UserPlus className="h-3 w-3" /> Add
                    </Button>
                  </DialogTrigger>
                  <AddMemberDialog
                    groupId={id}
                    existingUserIds={new Set(members.map((m) => m.user_id))}
                    onAdded={() => {
                      setAddOpen(false);
                      load();
                    }}
                  />
                </Dialog>
              )}
            </div>
            <div className="space-y-2">
              {members.length === 0 ? (
                <div className="text-sm text-muted-foreground">No members yet.</div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 border border-border bg-card p-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex-shrink-0">
                        {m.avatar_url && (
                          <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm truncate">{m.display_name ?? "Member"}</div>
                        {m.role === "leader" && (
                          <div className="text-[10px] eyebrow text-gold flex items-center gap-1">
                            <Crown className="h-2.5 w-2.5" /> Leader
                          </div>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title={m.role === "leader" ? "Demote to member" : "Promote to leader"}
                          onClick={() => toggleLeader(m.id, m.role)}
                        >
                          <Crown className={`h-3 w-3 ${m.role === "leader" ? "text-gold" : ""}`} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => removeMember(m.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="eyebrow text-muted-foreground">— Group events</div>
              {(isLeader || isAdmin) && (
                <SubmitGroupEventButton groupId={id} onCreated={load} />
              )}
            </div>
            <div className="space-y-2">
              {events.length === 0 ? (
                <div className="text-sm text-muted-foreground">No events yet.</div>
              ) : (
                events.map((e) => (
                  <Link
                    key={e.id}
                    to="/dashboard/events/$id"
                    params={{ id: e.id }}
                    className="block border border-border bg-card p-3 hover:border-foreground/20"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">{e.title}</div>
                      <Badge
                        variant={e.status === "approved" ? "default" : "outline"}
                        className="text-[9px]"
                      >
                        {e.status}
                      </Badge>
                    </div>
                    <div className="text-[10px] eyebrow text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(e.start_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AddMemberDialog({
  groupId,
  existingUserIds,
  onAdded,
}: {
  groupId: string;
  existingUserIds: Set<string>;
  onAdded: () => void;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [role, setRole] = useState<"leader" | "member">("member");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .order("display_name")
      .then(({ data }) => {
        setProfiles(((data ?? []) as Profile[]).filter((p) => !existingUserIds.has(p.id)));
      });
  }, [existingUserIds]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return toast.error("Pick someone to add");
    setSubmitting(true);
    const { error } = await supabase.from("group_members").insert({
      group_id: groupId,
      user_id: selected,
      role,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Member added");
    onAdded();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Add member</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Person</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Select a person" />
            </SelectTrigger>
            <SelectContent>
              {profiles.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No more people to add
                </div>
              )}
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name ?? p.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as "leader" | "member")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="leader">Leader</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting || !selected}>
            {submitting ? "Adding…" : "Add to group"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

const groupEventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  start_at: z.string().min(1),
  end_at: z.string().optional().or(z.literal("")),
});

function SubmitGroupEventButton({ groupId, onCreated }: { groupId: string; onCreated: () => void }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = groupEventSchema.safeParse({ title, description, location, start_at: startAt, end_at: endAt });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setSubmitting(true);
    const { error } = await supabase.from("events").insert({
      title: parsed.data.title,
      description: parsed.data.description || null,
      location: parsed.data.location || null,
      start_at: new Date(parsed.data.start_at).toISOString(),
      end_at: parsed.data.end_at ? new Date(parsed.data.end_at).toISOString() : null,
      submitted_by: user.id,
      group_id: groupId,
      is_public: false,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Event submitted for approval");
    setTitle(""); setDescription(""); setLocation(""); setStartAt(""); setEndAt("");
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Calendar className="h-3 w-3" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Submit group event</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Starts</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Group events go through admin approval before appearing in the church events list.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit for approval"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

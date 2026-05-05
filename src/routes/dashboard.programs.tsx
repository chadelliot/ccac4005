import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, BookMarked, ChevronRight, Sparkles, Trash2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/dashboard/programs")({
  head: () => ({ meta: [{ title: "Discipleship Programs — CCAC" }] }),
  component: ProgramsPage,
});

type Program = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  status: string;
  program_type: string;
  cover_image: string | null;
  estimated_duration: string | null;
  created_by: string;
  created_at: string;
};

const PROGRAM_TYPES = [
  { value: "lesson_based", label: "Lesson-based discipleship" },
  { value: "reading_plan", label: "Daily Bible reading plan" },
  { value: "year_bible", label: "365-day Bible plan" },
  { value: "topical", label: "Topical scripture study" },
  { value: "devotional", label: "Devotional series" },
  { value: "custom", label: "Custom program" },
];

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  program_type: z.string(),
  estimated_duration: z.string().trim().max(60).optional(),
  includes_quiz: z.boolean(),
  includes_certificate: z.boolean(),
});

function ProgramsPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const { isAdmin, isLeader } = useRoles(user);
  const canCreate = isAdmin || isLeader;
  const [items, setItems] = useState<Program[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    program_type: "lesson_based",
    estimated_duration: "",
    includes_quiz: false,
    includes_certificate: false,
  });

  const load = async () => {
    const { data, error } = await supabase
      .from("reading_programs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as Program[]);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { data: created, error } = await supabase.from("reading_programs").insert({
      ...parsed.data,
      description: parsed.data.description || null,
      estimated_duration: parsed.data.estimated_duration || null,
      created_by: user.id,
      status: "draft",
    }).select("id").maybeSingle();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Draft created — add days, lessons, and a quiz next.");
    setOpen(false);
    setForm({ title: "", description: "", program_type: "lesson_based", estimated_duration: "", includes_quiz: false, includes_certificate: false });
    if (created?.id) navigate({ to: "/dashboard/programs/$id", params: { id: created.id } });
    else load();
  };

  const myDrafts = items.filter((p) => p.status === "draft" && p.created_by === user?.id);
  const published = items.filter((p) => p.status === "published");
  const archived = items.filter((p) => p.status === "archived");

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow text-accent mb-2">— Discipleship</div>
          <h1 className="font-display text-5xl">Programs</h1>
          <p className="text-muted-foreground mt-2">Day-by-day Bible reading plans, lesson-based discipleship, quizzes, and certificates.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-night text-night-foreground hover:bg-night/90 rounded-none px-6 py-6 eyebrow">
                <Plus className="h-4 w-4" /> New Program
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-3xl">New Program</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} placeholder="Foundations of the Gospel" />
                </div>
                <div>
                  <Label>Program type</Label>
                  <Select value={form.program_type} onValueChange={(v) => setForm({ ...form, program_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROGRAM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={2000} placeholder="Who this is for, what it covers..." />
                </div>
                <div>
                  <Label>Estimated duration</Label>
                  <Input value={form.estimated_duration} onChange={(e) => setForm({ ...form, estimated_duration: e.target.value })} placeholder="30 days" />
                </div>
                <div className="flex items-center justify-between border border-border p-3">
                  <Label className="cursor-pointer">Include quiz</Label>
                  <Switch checked={form.includes_quiz} onCheckedChange={(v) => setForm({ ...form, includes_quiz: v })} />
                </div>
                <div className="flex items-center justify-between border border-border p-3">
                  <Label className="cursor-pointer">Issue certificate</Label>
                  <Switch checked={form.includes_certificate} onCheckedChange={(v) => setForm({ ...form, includes_certificate: v })} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy} className="w-full bg-night text-night-foreground hover:bg-night/90 rounded-none py-6 eyebrow">
                    {busy ? "Creating..." : "Create Program"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="published">
        <TabsList>
          <TabsTrigger value="published">Published ({published.length})</TabsTrigger>
          {canCreate && <TabsTrigger value="drafts">My drafts ({myDrafts.length})</TabsTrigger>}
          {canCreate && <TabsTrigger value="archived">Archived ({archived.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="published" className="mt-4"><ProgramList items={published} canCreate={canCreate} onChanged={load} /></TabsContent>
        <TabsContent value="drafts" className="mt-4"><ProgramList items={myDrafts} canCreate={canCreate} onChanged={load} /></TabsContent>
        <TabsContent value="archived" className="mt-4"><ProgramList items={archived} canCreate={canCreate} onChanged={load} /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProgramList({ items, canCreate, onChanged }: { items: Program[]; canCreate: boolean; onChanged?: () => void }) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-border p-16 text-center">
        <BookMarked className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <div className="eyebrow text-muted-foreground">No programs here yet</div>
        {canCreate && <p className="text-sm text-muted-foreground mt-2">Use “New Program” to start, then click a program to add days, lessons, quizzes, and a certificate.</p>}
      </div>
    );
  }
  const typeLabel = (t: string) => PROGRAM_TYPES.find((x) => x.value === t)?.label ?? t;

  const publish = async (e: React.MouseEvent, p: Program) => {
    e.preventDefault(); e.stopPropagation();
    const { error } = await supabase.from("reading_programs").update({ status: "published", is_published: true }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Published");
    onChanged?.();
  };
  const remove = async (e: React.MouseEvent, p: Program) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("reading_programs").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onChanged?.();
  };

  return (
    <div className="space-y-2">
      {items.map((p) => (
        <Link
          key={p.id}
          to="/dashboard/programs/$id"
          params={{ id: p.id }}
          className="flex items-center justify-between gap-4 bg-card border border-border p-5 hover:border-foreground/30 hover:bg-muted/30 transition-colors group"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="font-display text-xl group-hover:underline underline-offset-4">{p.title}</div>
              <Badge variant="outline" className="text-[10px]">{typeLabel(p.program_type)}</Badge>
              {p.status === "draft" && <Badge variant="outline">Draft</Badge>}
              {p.status === "archived" && <Badge variant="outline">Archived</Badge>}
              {p.program_type === "year_bible" && <Sparkles className="h-3 w-3 text-accent" />}
            </div>
            {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
          </div>
          {canCreate && p.status === "draft" && (
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="outline" className="rounded-none eyebrow gap-1" onClick={(e) => publish(e, p)}>
                <Send className="h-3 w-3" /> Publish
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => remove(e, p)} title="Delete draft">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground shrink-0" />
        </Link>
      ))}
    </div>
  );
}

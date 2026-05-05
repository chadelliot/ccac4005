import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, BookOpen, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard/programs")({
  head: () => ({ meta: [{ title: "Reading Programs — CCAC" }] }),
  component: ProgramsPage,
});

type Program = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  created_by: string;
  created_at: string;
};

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
});

function ProgramsPage() {
  const { user } = useSession();
  const { isAdmin, isLeader } = useRoles(user);
  const canCreate = isAdmin || isLeader;
  const [items, setItems] = useState<Program[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      title: fd.get("title"),
      description: (fd.get("description") as string) || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.from("reading_programs").insert({ ...parsed.data, created_by: user.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Program created");
    setOpen(false);
    (e.target as HTMLFormElement).reset();
    load();
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow text-accent mb-2">— Discipleship</div>
          <h1 className="font-display text-5xl">Reading Programs</h1>
          <p className="text-muted-foreground mt-2">Day-by-day Bible study plans to share with contacts and walk through together.</p>
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
                <DialogTitle className="font-display text-3xl">New Reading Program</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input name="title" required maxLength={120} placeholder="Foundations of the Gospel" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea name="description" rows={4} maxLength={2000} placeholder="Who this is for, what it covers..." />
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

      {items.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <div className="eyebrow text-muted-foreground">No programs yet</div>
          {canCreate && <p className="text-sm text-muted-foreground mt-2">Create the first plan above.</p>}
        </div>
      ) : (
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
                  {!p.is_published && <Badge variant="outline">Draft</Badge>}
                </div>
                {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

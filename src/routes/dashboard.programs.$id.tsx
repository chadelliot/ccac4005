import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, CheckCircle2, Circle, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PassageView } from "@/components/bible/PassageView";
import { getBooksMeta, parseRefInput, passageLabel, type BookMeta, type Passage } from "@/lib/bible";

export const Route = createFileRoute("/dashboard/programs/$id")({
  head: () => ({ meta: [{ title: "Program — CCAC" }] }),
  component: ProgramDetail,
});

type Program = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  created_by: string;
};

type Day = {
  id: string;
  program_id: string;
  day_number: number;
  title: string | null;
  passages: Passage[];
  notes: string | null;
};

function ProgramDetail() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { isAdmin } = useRoles(user);
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [progress, setProgress] = useState<Set<string>>(new Set());
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const canEdit = !!program && (isAdmin || program.created_by === user?.id);

  const load = async () => {
    const [{ data: p }, { data: d }, { data: pr }] = await Promise.all([
      supabase.from("reading_programs").select("*").eq("id", id).maybeSingle(),
      supabase.from("reading_program_days").select("*").eq("program_id", id).order("day_number"),
      user ? supabase.from("reading_program_progress").select("day_id").eq("user_id", user.id).eq("program_id", id) : Promise.resolve({ data: [] }),
    ]);
    setProgram(p as Program | null);
    setDays((d ?? []) as unknown as Day[]);
    setProgress(new Set(((pr ?? []) as { day_id: string }[]).map((x) => x.day_id)));
  };

  useEffect(() => {
    getBooksMeta().then(setBooks);
  }, []);
  useEffect(() => {
    if (user) load(); /* eslint-disable-next-line */
  }, [id, user]);

  if (!program) return <div className="eyebrow text-muted-foreground">Loading...</div>;

  const togglePublished = async () => {
    const { error } = await supabase.from("reading_programs").update({ is_published: !program.is_published }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const handleDeleteProgram = async () => {
    if (!confirm("Delete this entire program?")) return;
    const { error } = await supabase.from("reading_programs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    navigate({ to: "/dashboard/programs" });
  };

  const handleAddDay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = ((fd.get("title") as string) || "").trim();
    const refsRaw = ((fd.get("refs") as string) || "").trim();
    const notes = ((fd.get("notes") as string) || "").trim();
    if (!refsRaw) return toast.error("Add at least one passage reference");
    const refs = refsRaw.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
    const passages: Passage[] = [];
    for (const r of refs) {
      const p = parseRefInput(r, books);
      if (!p) return toast.error(`Couldn't parse "${r}" — try e.g. John 3:1-21`);
      passages.push(p);
    }
    const nextDay = (days[days.length - 1]?.day_number ?? 0) + 1;
    setBusy(true);
    const { error } = await supabase.from("reading_program_days").insert({
      program_id: id,
      day_number: nextDay,
      title: title || null,
      passages: passages as unknown as Day["passages"],
      notes: notes || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Day ${nextDay} added`);
    setAddOpen(false);
    (e.target as HTMLFormElement).reset();
    load();
  };

  const handleDeleteDay = async (dayId: string) => {
    if (!confirm("Delete this day?")) return;
    const { error } = await supabase.from("reading_program_days").delete().eq("id", dayId);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleComplete = async (day: Day) => {
    if (!user) return;
    if (progress.has(day.id)) {
      const { error } = await supabase.from("reading_program_progress").delete().eq("user_id", user.id).eq("day_id", day.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("reading_program_progress").insert({ user_id: user.id, program_id: id, day_id: day.id });
      if (error) return toast.error(error.message);
    }
    load();
  };

  const completedCount = days.filter((d) => progress.has(d.id)).length;

  return (
    <div className="max-w-4xl space-y-8">
      <Link to="/dashboard/programs" className="eyebrow text-muted-foreground inline-flex items-center gap-2 hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All Programs
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow text-accent mb-2">— Reading Program</div>
          <h1 className="font-display text-5xl">{program.title}</h1>
          {program.description && <p className="text-muted-foreground mt-3 max-w-2xl">{program.description}</p>}
          <div className="flex items-center gap-3 mt-3">
            {program.is_published ? <Badge variant="secondary" className="bg-accent/20">Published</Badge> : <Badge variant="outline">Draft</Badge>}
            {days.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {completedCount} / {days.length} days complete
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button onClick={togglePublished} variant="outline" className="rounded-none eyebrow">
              {program.is_published ? "Unpublish" : "Publish"}
            </Button>
            <Button onClick={handleDeleteProgram} variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 rounded-none">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="bg-card border border-border p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="eyebrow text-accent">— Days</div>
          {canEdit && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="rounded-none eyebrow"><Plus className="h-3 w-3" /> Add Day</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl">Add Day {(days[days.length - 1]?.day_number ?? 0) + 1}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddDay} className="space-y-4">
                  <div>
                    <Label>Title (optional)</Label>
                    <Input name="title" maxLength={120} placeholder="The Word made flesh" />
                  </div>
                  <div>
                    <Label>Passages</Label>
                    <Textarea name="refs" rows={3} required placeholder={"John 1:1-18\nGen 1:1-5"} />
                    <p className="text-xs text-muted-foreground mt-1">One per line or comma-separated. Examples: <code>John 3:16</code>, <code>Rom 10:9-13</code>, <code>Gen 1</code>.</p>
                  </div>
                  <div>
                    <Label>Reflection notes (optional)</Label>
                    <Textarea name="notes" rows={3} maxLength={2000} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={busy} className="w-full bg-night text-night-foreground hover:bg-night/90 rounded-none py-6 eyebrow">
                      {busy ? "Saving..." : "Add Day"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {days.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <BookOpen className="h-6 w-6 mx-auto mb-2" />
            No days yet.
          </div>
        ) : (
          <div className="space-y-2">
            {days.map((day) => {
              const done = progress.has(day.id);
              const isOpen = openDay === day.id;
              return (
                <div key={day.id} className={`border ${done ? "border-accent/40 bg-accent/5" : "border-border"}`}>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <button
                      onClick={() => toggleComplete(day)}
                      className="text-accent hover:scale-110 transition-transform shrink-0"
                      title={done ? "Mark incomplete" : "Mark complete"}
                    >
                      {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <button onClick={() => setOpenDay(isOpen ? null : day.id)} className="flex-1 text-left min-w-0">
                      <div className="font-medium">
                        Day {day.day_number}
                        {day.title && <span className="text-muted-foreground font-normal"> — {day.title}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {day.passages.map((p) => passageLabel(p, books)).join(" • ")}
                      </div>
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => setOpenDay(isOpen ? null : day.id)}>
                      {isOpen ? "Hide" : "Read"}
                    </Button>
                    {canEdit && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteDay(day.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {isOpen && (
                    <div className="border-t border-border p-5 space-y-6 bg-background">
                      {day.passages.map((p, i) => (
                        <PassageView key={i} passage={p} />
                      ))}
                      {day.notes && (
                        <div className="border-l-2 border-accent pl-4 text-sm italic text-muted-foreground whitespace-pre-wrap">
                          {day.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

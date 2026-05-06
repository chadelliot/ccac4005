import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, CheckCircle2, Circle, BookOpen, Award, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

import { PassageView } from "@/components/bible/PassageView";
import { getBooksMeta, parseRefInput, passageLabel, type BookMeta, type Passage } from "@/lib/bible";
import { AIPlanGenerator } from "@/components/programs/AIPlanGenerator";
import { LessonsManager } from "@/components/programs/LessonsManager";
import { QuizEditor } from "@/components/programs/QuizEditor";
import { QuizTaker } from "@/components/programs/QuizTaker";
import { downloadCertificatePdf } from "@/lib/certificate";

export const Route = createFileRoute("/dashboard/programs/$id")({
  head: () => ({ meta: [{ title: "Program — CCAC" }] }),
  component: ProgramDetail,
});

type Program = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
  status: string;
  program_type: string;
  estimated_duration: string | null;
  includes_quiz: boolean;
  includes_certificate: boolean;
  certificate_config: any;
  created_by: string;
};

type Day = {
  id: string;
  program_id: string;
  day_number: number;
  title: string | null;
  passages: Passage[];
  notes: string | null;
  scripture_reference: string | null;
  summary: string | null;
  reflection_question: string | null;
  assigned_date: string | null;
};

type Enrollment = { id: string; percent_complete: number; certificate_issued: boolean; completion_date: string | null };

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
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [busy, setBusy] = useState(false);

  const canEdit = !!program && (isAdmin || program.created_by === user?.id);

  const load = async () => {
    const [{ data: p }, { data: d }, { data: pr }, { data: en }] = await Promise.all([
      supabase.from("reading_programs").select("*").eq("id", id).maybeSingle(),
      supabase.from("reading_program_days").select("*").eq("program_id", id).order("day_number"),
      user ? supabase.from("reading_program_progress").select("day_id").eq("user_id", user.id).eq("program_id", id) : Promise.resolve({ data: [] }),
      user ? supabase.from("program_enrollments").select("*").eq("program_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setProgram(p as Program | null);
    setDays((d ?? []) as unknown as Day[]);
    setProgress(new Set(((pr ?? []) as { day_id: string }[]).map((x) => x.day_id)));
    setEnrollment((en as Enrollment | null) ?? null);
  };

  useEffect(() => { getBooksMeta().then(setBooks); }, []);
  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [id, user]);

  const completedCount = days.filter((d) => progress.has(d.id)).length;
  const completion = days.length ? Math.round((completedCount / days.length) * 100) : 0;

  // Sync enrollment percent when it changes (must run on every render — keep above any early return)
  useEffect(() => {
    if (enrollment && completion !== Math.round(enrollment.percent_complete)) {
      const isComplete = completion === 100 && days.length > 0;
      supabase.from("program_enrollments").update({
        percent_complete: completion,
        completion_date: isComplete ? new Date().toISOString() : null,
      }).eq("id", enrollment.id);
    }
  }, [completion, enrollment, days.length]);

  if (!program) return <div className="eyebrow text-muted-foreground">Loading...</div>;

  const setStatus = async (status: string) => {
    const { error } = await supabase.from("reading_programs").update({ status, is_published: status === "published" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Status: ${status}`);
    load();
  };

  const handleDeleteProgram = async () => {
    if (!confirm("Delete this entire program?")) return;
    const { error } = await supabase.from("reading_programs").delete().eq("id", id);
    if (error) return toast.error(error.message);
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
      if (!p) return toast.error(`Couldn't parse "${r}"`);
      passages.push(p);
    }
    const nextDay = (days[days.length - 1]?.day_number ?? 0) + 1;
    setBusy(true);
    const { error } = await supabase.from("reading_program_days").insert({
      program_id: id, day_number: nextDay, title: title || null,
      passages: passages as any, notes: notes || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setAddOpen(false);
    (e.target as HTMLFormElement).reset();
    load();
  };

  const handleDeleteDay = async (dayId: string) => {
    if (!confirm("Delete this day?")) return;
    await supabase.from("reading_program_days").delete().eq("id", dayId);
    load();
  };

  const toggleComplete = async (day: Day) => {
    if (!user) return;
    if (progress.has(day.id)) {
      await supabase.from("reading_program_progress").delete().eq("user_id", user.id).eq("day_id", day.id);
    } else {
      await supabase.from("reading_program_progress").insert({ user_id: user.id, program_id: id, day_id: day.id });
    }
    load();
  };

  const enroll = async () => {
    if (!user) return;
    const { error } = await supabase.from("program_enrollments").insert({ program_id: id, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Enrolled");
    load();
  };

  const completedCount = days.filter((d) => progress.has(d.id)).length;
  const completion = days.length ? Math.round((completedCount / days.length) * 100) : 0;

  // Sync enrollment percent occasionally
  useEffect(() => {
    if (enrollment && completion !== Math.round(enrollment.percent_complete)) {
      const isComplete = completion === 100 && days.length > 0;
      supabase.from("program_enrollments").update({
        percent_complete: completion,
        completion_date: isComplete ? new Date().toISOString() : null,
      }).eq("id", enrollment.id);
    }
  }, [completion, enrollment, days.length]);

  const downloadCert = async () => {
    if (!user || !program) return;
    const cfg = program.certificate_config ?? {};
    const memberName = cfg.member_name ?? user.email ?? "Member";
    downloadCertificatePdf({
      title: cfg.title ?? "Certificate of Completion",
      subtitle: cfg.subtitle,
      programName: program.title,
      memberName,
      completionDate: new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
      churchName: cfg.church_name ?? "CCAC",
      signatureName: cfg.signature_name,
      signatureTitle: cfg.signature_title,
    });
    if (enrollment && !enrollment.certificate_issued) {
      await supabase.from("program_enrollments").update({ certificate_issued: true }).eq("id", enrollment.id);
      await supabase.from("certificates").insert({
        program_id: id, user_id: user.id,
        certificate_title: cfg.title ?? "Certificate of Completion",
        certificate_subtitle: cfg.subtitle ?? null,
        church_name: cfg.church_name ?? "CCAC",
        member_name: memberName,
        signature_name: cfg.signature_name ?? null,
        signature_title: cfg.signature_title ?? null,
      }).then(() => load());
    }
  };

  const certEarned = program.includes_certificate && completion === 100 && days.length > 0;

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/dashboard/programs" className="eyebrow text-muted-foreground inline-flex items-center gap-2 hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All Programs
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="eyebrow text-accent mb-2">— {program.program_type.replace("_", " ")}</div>
          <h1 className="font-display text-4xl sm:text-5xl">{program.title}</h1>
          {program.description && <p className="text-muted-foreground mt-3 max-w-2xl">{program.description}</p>}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <Badge variant={program.status === "published" ? "secondary" : "outline"}>{program.status}</Badge>
            {program.estimated_duration && <Badge variant="outline">{program.estimated_duration}</Badge>}
            {program.includes_quiz && <Badge variant="outline">Quiz</Badge>}
            {program.includes_certificate && <Badge variant="outline" className="gap-1"><Award className="h-3 w-3" /> Certificate</Badge>}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            {program.status !== "published" && <Button size="sm" variant="outline" className="rounded-none eyebrow" onClick={() => setStatus("published")}>Publish</Button>}
            {program.status === "published" && <Button size="sm" variant="outline" className="rounded-none eyebrow" onClick={() => setStatus("draft")}>Unpublish</Button>}
            {program.status !== "archived" && <Button size="sm" variant="outline" className="rounded-none eyebrow" onClick={() => setStatus("archived")}>Archive</Button>}
            <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={handleDeleteProgram}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      </div>

      {user && !canEdit && program.status === "published" && (
        <div className="border border-border bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
          {enrollment ? (
            <>
              <div className="flex-1 min-w-[200px]">
                <div className="eyebrow text-xs mb-1">Your progress</div>
                <Progress value={completion} className="h-2" />
                <div className="text-xs text-muted-foreground mt-1">{completedCount} of {days.length} days • {completion}%</div>
              </div>
              {certEarned && (
                <Button onClick={downloadCert} className="bg-night text-night-foreground rounded-none eyebrow gap-2">
                  <Award className="h-4 w-4" /> Download certificate
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="text-sm">Enroll to track your progress and earn a certificate.</div>
              <Button onClick={enroll} className="bg-night text-night-foreground rounded-none eyebrow">Enroll</Button>
            </>
          )}
        </div>
      )}

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content"><BookOpen className="h-3 w-3 mr-1" /> Content</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          {(program.includes_quiz || canEdit) && <TabsTrigger value="quiz">Quiz</TabsTrigger>}
          {canEdit && program.includes_certificate && <TabsTrigger value="cert"><Award className="h-3 w-3 mr-1" /> Certificate</TabsTrigger>}
          {canEdit && <TabsTrigger value="report"><BarChart3 className="h-3 w-3 mr-1" /> Report</TabsTrigger>}
        </TabsList>

        <TabsContent value="content" className="mt-4">
          <div className="bg-card border border-border p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="eyebrow text-accent">— Daily readings ({days.length})</div>
              {canEdit && (
                <div className="flex gap-2">
                  <AIPlanGenerator programId={id} onCreated={load} />
                  <Dialog open={addOpen} onOpenChange={setAddOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="rounded-none eyebrow"><Plus className="h-3 w-3" /> Add Day</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader><DialogTitle className="font-display text-2xl">Add Day {(days[days.length - 1]?.day_number ?? 0) + 1}</DialogTitle></DialogHeader>
                      <form onSubmit={handleAddDay} className="space-y-4">
                        <div><Label>Title (optional)</Label><Input name="title" maxLength={120} /></div>
                        <div>
                          <Label>Passages</Label>
                          <Textarea name="refs" rows={3} required placeholder={"John 1:1-18\nGen 1:1-5"} />
                        </div>
                        <div><Label>Notes (optional)</Label><Textarea name="notes" rows={3} /></div>
                        <DialogFooter>
                          <Button type="submit" disabled={busy} className="w-full bg-night text-night-foreground rounded-none py-6 eyebrow">{busy ? "Saving..." : "Add Day"}</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>

            {days.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <BookOpen className="h-6 w-6 mx-auto mb-2" />
                No days yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-[700px] overflow-y-auto">
                {days.map((day) => {
                  const done = progress.has(day.id);
                  const isOpen = openDay === day.id;
                  const ref = day.scripture_reference || day.passages?.map((p) => passageLabel(p, books)).join(" • ");
                  return (
                    <div key={day.id} className={`border ${done ? "border-accent/40 bg-accent/5" : "border-border"}`}>
                      <div className="flex items-center justify-between gap-2 p-3">
                        <button onClick={() => toggleComplete(day)} className="text-accent shrink-0">
                          {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                        </button>
                        <button onClick={() => setOpenDay(isOpen ? null : day.id)} className="flex-1 text-left min-w-0">
                          <div className="font-medium text-sm">Day {day.day_number}{day.title ? ` — ${day.title}` : ""}</div>
                          <div className="text-xs text-muted-foreground truncate">{ref}</div>
                        </button>
                        <Button size="sm" variant="ghost" onClick={() => setOpenDay(isOpen ? null : day.id)}>{isOpen ? "Hide" : "Read"}</Button>
                        {canEdit && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteDay(day.id)}><Trash2 className="h-3 w-3" /></Button>}
                      </div>
                      {isOpen && (
                        <div className="border-t border-border p-4 bg-background space-y-4">
                          {day.summary && <p className="text-sm italic text-muted-foreground">{day.summary}</p>}
                          {day.passages?.map((p, i) => <PassageView key={i} passage={p} />)}
                          {day.reflection_question && (
                            <div className="border-l-2 border-accent pl-3 text-sm italic">{day.reflection_question}</div>
                          )}
                          {day.notes && <div className="text-sm whitespace-pre-wrap">{day.notes}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="lessons" className="mt-4">
          <LessonsManager programId={id} canEdit={canEdit} userId={user?.id ?? null} />
        </TabsContent>

        {(program.includes_quiz || canEdit) && (
          <TabsContent value="quiz" className="mt-4 space-y-4">
            {canEdit && <QuizEditor programId={id} canEdit={canEdit} />}
            {!canEdit && user && <QuizTaker programId={id} userId={user.id} />}
          </TabsContent>
        )}

        {canEdit && program.includes_certificate && (
          <TabsContent value="cert" className="mt-4">
            <CertificateEditor program={program} onSaved={load} />
          </TabsContent>
        )}

        {canEdit && (
          <TabsContent value="report" className="mt-4">
            <ProgramReport programId={id} totalDays={days.length} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function CertificateEditor({ program, onSaved }: { program: Program; onSaved: () => void }) {
  const cfg = program.certificate_config ?? {};
  const [c, setC] = useState({
    title: cfg.title ?? "Certificate of Completion",
    subtitle: cfg.subtitle ?? "",
    church_name: cfg.church_name ?? "CCAC",
    signature_name: cfg.signature_name ?? "",
    signature_title: cfg.signature_title ?? "",
    member_name: cfg.member_name ?? "",
  });
  const save = async () => {
    const { error } = await supabase.from("reading_programs").update({ certificate_config: c }).eq("id", program.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };
  const preview = () => downloadCertificatePdf({
    title: c.title, subtitle: c.subtitle, programName: program.title,
    memberName: c.member_name || "Sample Member",
    completionDate: new Date().toLocaleDateString(),
    churchName: c.church_name, signatureName: c.signature_name, signatureTitle: c.signature_title,
  });
  return (
    <div className="border border-border bg-card p-5 space-y-3">
      <div className="eyebrow text-accent">— Certificate</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Title</Label><Input value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} /></div>
        <div><Label>Subtitle</Label><Input value={c.subtitle} onChange={(e) => setC({ ...c, subtitle: e.target.value })} /></div>
        <div><Label>Church name</Label><Input value={c.church_name} onChange={(e) => setC({ ...c, church_name: e.target.value })} /></div>
        <div><Label>Member name on cert (optional default)</Label><Input value={c.member_name} onChange={(e) => setC({ ...c, member_name: e.target.value })} /></div>
        <div><Label>Signature name</Label><Input value={c.signature_name} onChange={(e) => setC({ ...c, signature_name: e.target.value })} /></div>
        <div><Label>Signature title</Label><Input value={c.signature_title} onChange={(e) => setC({ ...c, signature_title: e.target.value })} /></div>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} className="bg-night text-night-foreground rounded-none eyebrow">Save</Button>
        <Button variant="outline" onClick={preview}>Preview PDF</Button>
      </div>
    </div>
  );
}

function ProgramReport({ programId, totalDays }: { programId: string; totalDays: number }) {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: en } = await supabase.from("program_enrollments").select("*").eq("program_id", programId);
      const list = en ?? [];
      setEnrollments(list);
      if (list.length) {
        const { data: pr } = await supabase.from("profiles").select("id, display_name").in("id", list.map((e: any) => e.user_id));
        const map: Record<string, any> = {};
        for (const p of pr ?? []) map[(p as any).id] = p;
        setProfiles(map);
      }
      const { data: qz } = await supabase.from("quizzes").select("id").eq("program_id", programId);
      if (qz?.length) {
        const { data: att } = await supabase.from("quiz_attempts").select("*").in("quiz_id", qz.map((q: any) => q.id));
        setAttempts(att ?? []);
      }
      setLoading(false);
    })();
  }, [programId]);

  if (loading) return <div className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 inline animate-spin" /> Loading...</div>;

  const completed = enrollments.filter((e) => e.percent_complete >= 100).length;
  const avgQuiz = attempts.length ? Math.round(attempts.reduce((s, a) => s + Number(a.percent), 0) / attempts.length) : 0;
  const passed = attempts.filter((a) => a.passed).length;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="Enrolled" value={enrollments.length} />
        <Stat label="Completed" value={completed} />
        <Stat label="Avg quiz score" value={`${avgQuiz}%`} />
        <Stat label="Quizzes passed" value={passed} />
      </div>
      <div className="border border-border bg-card p-4">
        <div className="eyebrow text-accent text-xs mb-2">— Members</div>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No enrollments yet.</p>
        ) : (
          <div className="space-y-1">
            {enrollments.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm border border-border p-2">
                <span>{profiles[e.user_id]?.display_name ?? e.user_id.slice(0, 8)}</span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  {totalDays} days
                  <span className="w-32"><Progress value={Math.round(e.percent_complete)} className="h-1.5" /></span>
                  {Math.round(e.percent_complete)}%
                  {e.certificate_issued && <Award className="h-3 w-3 text-accent" />}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="eyebrow text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-3xl mt-1">{value}</div>
    </div>
  );
}

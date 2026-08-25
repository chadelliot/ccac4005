import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PassageView } from "@/components/bible/PassageView";
import { parseRefInput, getBooksMeta, type BookMeta, type Passage } from "@/lib/bible";

type Lesson = {
  id: string;
  program_id: string;
  lesson_number: number;
  title: string;
  description: string | null;
  focus_scriptures: { ref: string }[];
  scripture_text: string | null;
  teaching_notes: string | null;
  reflection_questions: string[];
  call_to_action: string | null;
  completion_required: boolean;
};

export function LessonsManager({
  programId,
  canEdit,
  userId,
}: {
  programId: string;
  canEdit: boolean;
  userId: string | null;
}) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [books, setBooks] = useState<BookMeta[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("program_lessons")
      .select("*")
      .eq("program_id", programId)
      .order("lesson_number");
    setLessons((data ?? []) as unknown as Lesson[]);
    if (userId) {
      const { data: lp } = await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", userId)
        .eq("program_id", programId);
      setCompleted(new Set(((lp ?? []) as { lesson_id: string }[]).map((l) => l.lesson_id)));
    }
  };
  useEffect(() => {
    getBooksMeta().then(setBooks);
  }, []);
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [programId, userId]);

  const addLesson = async () => {
    const next = (lessons[lessons.length - 1]?.lesson_number ?? 0) + 1;
    const { error } = await supabase.from("program_lessons").insert({
      program_id: programId,
      lesson_number: next,
      title: `Lesson ${next}`,
    });
    if (error) return toast.error(error.message);
    load();
  };

  const update = async (id: string, patch: Partial<Lesson>) => {
    const { error } = await supabase
      .from("program_lessons")
      .update(patch as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const del = async (id: string) => {
    if (!confirm("Delete lesson?")) return;
    await supabase.from("program_lessons").delete().eq("id", id);
    load();
  };

  const toggleComplete = async (id: string) => {
    if (!userId) return;
    if (completed.has(id)) {
      await supabase.from("lesson_progress").delete().eq("user_id", userId).eq("lesson_id", id);
    } else {
      await supabase
        .from("lesson_progress")
        .insert({ user_id: userId, program_id: programId, lesson_id: id });
    }
    load();
  };

  return (
    <div className="border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="eyebrow text-accent">— Lessons</div>
        {canEdit && (
          <Button size="sm" variant="outline" className="rounded-none eyebrow" onClick={addLesson}>
            <Plus className="h-3 w-3" /> Add Lesson
          </Button>
        )}
      </div>
      {lessons.length === 0 && <p className="text-sm text-muted-foreground">No lessons yet.</p>}
      <div className="space-y-2">
        {lessons.map((l) => {
          const isOpen = open === l.id;
          const done = completed.has(l.id);
          return (
            <div
              key={l.id}
              className={`border ${done ? "border-accent/40 bg-accent/5" : "border-border"}`}
            >
              <div className="flex items-center gap-2 p-3">
                {userId && (
                  <button onClick={() => toggleComplete(l.id)} className="text-accent shrink-0">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => setOpen(isOpen ? null : l.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="font-medium">
                    Lesson {l.lesson_number} — {l.title}
                  </div>
                  {l.description && (
                    <div className="text-xs text-muted-foreground truncate">{l.description}</div>
                  )}
                </button>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => del(l.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {isOpen && (
                <div className="border-t border-border p-4 space-y-4 bg-background">
                  {canEdit ? (
                    <LessonEditor lesson={l} onSave={(patch) => update(l.id, patch)} />
                  ) : (
                    <LessonReader lesson={l} books={books} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LessonEditor({
  lesson,
  onSave,
}: {
  lesson: Lesson;
  onSave: (patch: Partial<Lesson>) => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description ?? "");
  const [scriptures, setScriptures] = useState(
    (lesson.focus_scriptures ?? []).map((s) => s.ref).join("\n"),
  );
  const [notes, setNotes] = useState(lesson.teaching_notes ?? "");
  const [reflections, setReflections] = useState((lesson.reflection_questions ?? []).join("\n"));
  const [cta, setCta] = useState(lesson.call_to_action ?? "");

  const save = () => {
    onSave({
      title,
      description: description || null,
      focus_scriptures: scriptures
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((ref) => ({ ref })),
      teaching_notes: notes || null,
      reflection_questions: reflections
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      call_to_action: cta || null,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"></div>
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save} />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={save}
        />
      </div>
      <div>
        <Label>Focus scriptures (one per line, e.g. John 3:16)</Label>
        <Textarea
          rows={3}
          value={scriptures}
          onChange={(e) => setScriptures(e.target.value)}
          onBlur={save}
        />
      </div>
      <div>
        <Label>Teaching notes</Label>
        <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={save} />
      </div>
      <div>
        <Label>Reflection questions (one per line)</Label>
        <Textarea
          rows={3}
          value={reflections}
          onChange={(e) => setReflections(e.target.value)}
          onBlur={save}
        />
      </div>
      <div>
        <Label>Call to action</Label>
        <Input value={cta} onChange={(e) => setCta(e.target.value)} onBlur={save} />
      </div>
    </div>
  );
}

function LessonReader({ lesson, books }: { lesson: Lesson; books: BookMeta[] }) {
  const passages: Passage[] = (lesson.focus_scriptures ?? [])
    .map((s) => parseRefInput(s.ref, books))
    .filter((p): p is Passage => !!p);
  return (
    <div className="space-y-4">
      {lesson.description && <p className="text-muted-foreground">{lesson.description}</p>}
      {passages.map((p, i) => (
        <PassageView key={i} passage={p} />
      ))}
      {lesson.teaching_notes && (
        <div>
          <div className="eyebrow text-accent text-xs mb-1">— Teaching</div>
          <div className="whitespace-pre-wrap text-sm">{lesson.teaching_notes}</div>
        </div>
      )}
      {lesson.reflection_questions?.length > 0 && (
        <div>
          <div className="eyebrow text-accent text-xs mb-1">— Reflect</div>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {lesson.reflection_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
      {lesson.call_to_action && (
        <div className="border-l-2 border-accent pl-3 italic text-sm">{lesson.call_to_action}</div>
      )}
    </div>
  );
}

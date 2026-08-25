import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { QuizPdfImport } from "@/components/programs/QuizPdfImport";

type Quiz = {
  id: string;
  program_id: string;
  lesson_id: string | null;
  title: string;
  description: string | null;
  passing_score: number;
  allow_retakes: boolean;
  show_correct_answers: boolean;
  randomize_questions: boolean;
  required_for_completion: boolean;
};
type Q = {
  id: string;
  quiz_id: string;
  position: number;
  question_type: string;
  question_text: string;
  answer_options: string[];
  correct_answer: string | null;
  acceptable_answers: string[];
  case_sensitive: boolean;
  explanation: string | null;
  points: number;
  auto_grading_enabled: boolean;
  requires_admin_review: boolean;
  grading_instructions: string | null;
};

export function QuizEditor({ programId, canEdit }: { programId: string; canEdit: boolean }) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Record<string, Q[]>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = async () => {
    const { data } = await supabase
      .from("quizzes")
      .select("*")
      .eq("program_id", programId)
      .order("created_at");
    const list = (data ?? []) as Quiz[];
    setQuizzes(list);
    if (list.length) {
      const ids = list.map((q) => q.id);
      const { data: qs } = await supabase
        .from("quiz_questions")
        .select("*")
        .in("quiz_id", ids)
        .order("position");
      const grouped: Record<string, Q[]> = {};
      for (const q of (qs ?? []) as Q[]) {
        (grouped[q.quiz_id] ||= []).push(q);
      }
      setQuestions(grouped);
    }
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [programId]);

  const addQuiz = async () => {
    const { error } = await supabase
      .from("quizzes")
      .insert({ program_id: programId, title: "New Quiz" });
    if (error) return toast.error(error.message);
    load();
  };
  const updateQuiz = async (id: string, patch: Partial<Quiz>) => {
    const { error } = await supabase.from("quizzes").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const deleteQuiz = async (id: string) => {
    if (!confirm("Delete quiz?")) return;
    await supabase.from("quizzes").delete().eq("id", id);
    load();
  };
  const addQuestion = async (quizId: string, type: string) => {
    const pos = (questions[quizId]?.length ?? 0) + 1;
    const { error } = await supabase.from("quiz_questions").insert({
      quiz_id: quizId,
      position: pos,
      question_type: type,
      question_text: "New question",
      points: 1,
      answer_options: type === "multiple_choice" ? ["A", "B", "C", "D"] : [],
    });
    if (error) return toast.error(error.message);
    load();
  };
  const updateQ = async (id: string, patch: Partial<Q>) => {
    const { error } = await supabase.from("quiz_questions").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const deleteQ = async (id: string) => {
    await supabase.from("quiz_questions").delete().eq("id", id);
    load();
  };

  if (!canEdit && quizzes.length === 0) return null;

  return (
    <div className="border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="eyebrow text-accent">— Quizzes</div>
        {canEdit && (
          <Button size="sm" variant="outline" className="rounded-none eyebrow" onClick={addQuiz}>
            <Plus className="h-3 w-3" /> Add Quiz
          </Button>
        )}
      </div>
      {quizzes.length === 0 && <p className="text-sm text-muted-foreground">No quizzes yet.</p>}
      {quizzes.map((quiz) => {
        const isOpen = open[quiz.id];
        const qs = questions[quiz.id] ?? [];
        return (
          <div key={quiz.id} className="border border-border">
            <div className="flex items-center justify-between p-3 gap-2">
              <button
                onClick={() => setOpen({ ...open, [quiz.id]: !isOpen })}
                className="flex-1 text-left font-medium"
              >
                {quiz.title}{" "}
                <span className="text-xs text-muted-foreground">— {qs.length} questions</span>
              </button>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => deleteQuiz(quiz.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {isOpen && (
              <div className="border-t border-border p-4 space-y-4 bg-background">
                {canEdit && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Title</Label>
                      <Input
                        defaultValue={quiz.title}
                        onBlur={(e) => updateQuiz(quiz.id, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Passing score (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={quiz.passing_score}
                        onBlur={(e) =>
                          updateQuiz(quiz.id, { passing_score: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        rows={2}
                        defaultValue={quiz.description ?? ""}
                        onBlur={(e) => updateQuiz(quiz.id, { description: e.target.value })}
                      />
                    </div>
                    <ToggleRow
                      label="Allow retakes"
                      value={quiz.allow_retakes}
                      onChange={(v) => updateQuiz(quiz.id, { allow_retakes: v })}
                    />
                    <ToggleRow
                      label="Show correct answers"
                      value={quiz.show_correct_answers}
                      onChange={(v) => updateQuiz(quiz.id, { show_correct_answers: v })}
                    />
                    <ToggleRow
                      label="Randomize questions"
                      value={quiz.randomize_questions}
                      onChange={(v) => updateQuiz(quiz.id, { randomize_questions: v })}
                    />
                    <ToggleRow
                      label="Required for completion"
                      value={quiz.required_for_completion}
                      onChange={(v) => updateQuiz(quiz.id, { required_for_completion: v })}
                    />
                  </div>
                )}

                <div className="space-y-3">
                  {qs.map((q, idx) => (
                    <QuestionRow
                      key={q.id}
                      q={q}
                      idx={idx}
                      canEdit={canEdit}
                      onChange={updateQ}
                      onDelete={deleteQ}
                    />
                  ))}
                </div>

                {canEdit && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <span className="eyebrow text-xs text-muted-foreground self-center">Add:</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addQuestion(quiz.id, "multiple_choice")}
                    >
                      Multiple choice
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addQuestion(quiz.id, "true_false")}
                    >
                      True/False
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addQuestion(quiz.id, "fill_blank")}
                    >
                      Fill blank
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addQuestion(quiz.id, "short_answer")}
                    >
                      Short answer
                    </Button>
                      <QuizPdfImport
                        quizId={quiz.id}
                        startPosition={questions[quiz.id]?.length ?? 0}
                        onImported={load}
                      />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border border-border p-2">
      <Label className="text-sm">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function QuestionRow({
  q,
  idx,
  canEdit,
  onChange,
  onDelete,
}: {
  q: Q;
  idx: number;
  canEdit: boolean;
  onChange: (id: string, patch: Partial<Q>) => void;
  onDelete: (id: string) => void;
}) {
  const [text, setText] = useState(q.question_text);
  const [opts, setOpts] = useState((q.answer_options ?? []).join("\n"));
  const [correct, setCorrect] = useState(q.correct_answer ?? "");
  const [explanation, setExplanation] = useState(q.explanation ?? "");
  const [points, setPoints] = useState(q.points);

  const save = () => {
    onChange(q.id, {
      question_text: text,
      answer_options:
        q.question_type === "multiple_choice"
          ? opts
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      correct_answer: correct,
      explanation: explanation || null,
      points,
    });
  };

  if (!canEdit) {
    return (
      <div className="border border-border p-3 text-sm">
        <div className="font-medium">
          Q{idx + 1}. {q.question_text}
        </div>
      </div>
    );
  }
  return (
    <div className="border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="eyebrow text-xs text-muted-foreground">
          Q{idx + 1} • {q.question_type.replace("_", " ")}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => onDelete(q.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} onBlur={save} />
      {q.question_type === "multiple_choice" && (
        <div>
          <Label className="text-xs">Options (one per line)</Label>
          <Textarea rows={4} value={opts} onChange={(e) => setOpts(e.target.value)} onBlur={save} />
        </div>
      )}
      {q.question_type === "true_false" ? (
        <div>
          <Label className="text-xs">Correct answer</Label>
          <Select
            value={correct || "true"}
            onValueChange={(v) => {
              setCorrect(v);
              onChange(q.id, { correct_answer: v });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div>
          <Label className="text-xs">Correct / expected answer</Label>
          <Input value={correct} onChange={(e) => setCorrect(e.target.value)} onBlur={save} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Points</Label>
          <Input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
            onBlur={save}
          />
        </div>
        <div>
          <Label className="text-xs">Explanation (optional)</Label>
          <Input
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            onBlur={save}
          />
        </div>
      </div>
    </div>
  );
}

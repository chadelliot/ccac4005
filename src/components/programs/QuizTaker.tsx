import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Quiz = {
  id: string;
  title: string;
  description: string | null;
  passing_score: number;
  allow_retakes: boolean;
  show_correct_answers: boolean;
  randomize_questions: boolean;
};
type Q = {
  id: string;
  position: number;
  question_type: string;
  question_text: string;
  answer_options: string[];
  correct_answer: string | null;
  acceptable_answers: string[];
  case_sensitive: boolean;
  explanation: string | null;
  points: number;
  grading_instructions: string | null;
};

type Attempt = {
  id: string;
  score: number;
  max_score: number;
  percent: number;
  passed: boolean;
  answers: any;
  ai_grading_feedback: any;
  submitted_at: string;
};

export function QuizTaker({ programId, userId }: { programId: string; userId: string }) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Record<string, Q[]>>({});
  const [attempts, setAttempts] = useState<Record<string, Attempt[]>>({});
  const [active, setActive] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [last, setLast] = useState<Attempt | null>(null);

  const load = async () => {
    const { data: qz } = await supabase.from("quizzes").select("*").eq("program_id", programId);
    const list = (qz ?? []) as Quiz[];
    setQuizzes(list);
    if (!list.length) return;
    const ids = list.map((q) => q.id);
    const [{ data: qs }, { data: at }] = await Promise.all([
      supabase.from("quiz_questions").select("*").in("quiz_id", ids).order("position"),
      supabase.from("quiz_attempts").select("*").in("quiz_id", ids).eq("user_id", userId).order("submitted_at", { ascending: false }),
    ]);
    const grouped: Record<string, Q[]> = {};
    for (const q of (qs ?? []) as Q[]) (grouped[(q as any).quiz_id] ||= []).push(q);
    setQuestions(grouped);
    const att: Record<string, Attempt[]> = {};
    for (const a of (at ?? []) as any[]) (att[a.quiz_id] ||= []).push(a);
    setAttempts(att);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [programId, userId]);

  if (quizzes.length === 0) return null;

  const submitQuiz = async (quiz: Quiz) => {
    const qs = questions[quiz.id] ?? [];
    setSubmitting(true);
    try {
      let score = 0, max = 0;
      const answerRecords: any[] = [];
      const aiFeedback: any[] = [];

      for (const q of qs) {
        max += q.points;
        const ans = (answers[q.id] ?? "").trim();
        let correct = false;
        let earned = 0;
        if (q.question_type === "multiple_choice" || q.question_type === "true_false") {
          const target = (q.correct_answer ?? "").toString().trim();
          correct = q.case_sensitive ? ans === target : ans.toLowerCase() === target.toLowerCase();
          earned = correct ? q.points : 0;
        } else if (q.question_type === "fill_blank") {
          const cands = [q.correct_answer ?? "", ...(q.acceptable_answers ?? [])].map((s) => s.toString().trim());
          correct = cands.some((c) => q.case_sensitive ? c === ans : c.toLowerCase() === ans.toLowerCase());
          earned = correct ? q.points : 0;
        } else if (q.question_type === "short_answer") {
          // AI grade
          try {
            const { data, error } = await supabase.functions.invoke("program-ai", {
              body: {
                mode: "grade_short",
                question: q.question_text,
                expected: q.correct_answer ?? "",
                instructions: q.grading_instructions ?? "",
                answer: ans,
                points: q.points,
              },
            });
            if (error) throw error;
            const g = data as any;
            earned = Math.max(0, Math.min(q.points, Number(g?.score) || 0));
            correct = earned >= q.points * 0.6;
            aiFeedback.push({ question_id: q.id, ...g });
          } catch (e) {
            aiFeedback.push({ question_id: q.id, error: "AI grading failed" });
          }
        }
        score += earned;
        answerRecords.push({ question_id: q.id, answer: ans, earned, max: q.points, correct });
      }

      const percent = max ? Math.round((score / max) * 100) : 0;
      const passed = percent >= quiz.passing_score;

      const { data: ins, error } = await supabase.from("quiz_attempts").insert({
        quiz_id: quiz.id, user_id: userId, score, max_score: max, percent, passed,
        answers: answerRecords, ai_grading_feedback: aiFeedback.length ? aiFeedback : null,
      }).select("*").single();
      if (error) throw error;

      setLast(ins as any);
      setActive(null);
      setAnswers({});
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-border bg-card p-5 space-y-4">
      <div className="eyebrow text-accent">— Quizzes</div>
      {quizzes.map((quiz) => {
        const qs = questions[quiz.id] ?? [];
        const past = attempts[quiz.id] ?? [];
        const best = past.reduce<Attempt | null>((b, a) => (!b || a.percent > b.percent ? a : b), null);
        const passed = best?.passed;
        return (
          <div key={quiz.id} className="border border-border p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-medium">{quiz.title}</div>
                {quiz.description && <p className="text-xs text-muted-foreground">{quiz.description}</p>}
                <div className="text-xs text-muted-foreground mt-1">{qs.length} questions • Pass at {quiz.passing_score}%</div>
              </div>
              <div className="flex items-center gap-2">
                {best && <Badge variant={passed ? "secondary" : "outline"}>Best: {best.percent}%</Badge>}
                {(!best || quiz.allow_retakes) && (
                  <Button size="sm" className="bg-night text-night-foreground rounded-none eyebrow" onClick={() => { setActive(quiz.id); setLast(null); setAnswers({}); }}>
                    {best ? "Retake" : "Take quiz"}
                  </Button>
                )}
              </div>
            </div>

            {active === quiz.id && (
              <div className="border-t border-border pt-4 space-y-4">
                {qs.map((q, i) => (
                  <div key={q.id} className="space-y-2">
                    <Label className="text-sm font-medium">Q{i + 1}. {q.question_text}</Label>
                    {q.question_type === "multiple_choice" && (
                      <div className="space-y-1">
                        {(q.answer_options ?? []).map((opt) => (
                          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer p-2 border border-border hover:bg-muted">
                            <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => setAnswers({ ...answers, [q.id]: opt })} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}
                    {q.question_type === "true_false" && (
                      <div className="flex gap-2">
                        {["true", "false"].map((v) => (
                          <button key={v} type="button" onClick={() => setAnswers({ ...answers, [q.id]: v })}
                            className={`px-4 py-2 border eyebrow text-xs ${answers[q.id] === v ? "bg-night text-night-foreground" : "border-border"}`}>{v}</button>
                        ))}
                      </div>
                    )}
                    {q.question_type === "fill_blank" && (
                      <Input value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                    )}
                    {q.question_type === "short_answer" && (
                      <Textarea rows={3} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button onClick={() => submitQuiz(quiz)} disabled={submitting} className="bg-night text-night-foreground rounded-none eyebrow">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                  </Button>
                  <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
                </div>
              </div>
            )}

            {last && active === null && best?.id === last.id && (
              <div className="border-t border-border pt-4">
                <div className={`text-lg font-medium ${last.passed ? "text-accent" : "text-destructive"}`}>
                  You scored {last.percent}%. {last.passed ? "Congratulations, you passed." : "You did not pass this attempt."}
                </div>
                {quiz.show_correct_answers && (
                  <div className="mt-3 space-y-2">
                    {qs.map((q, i) => {
                      const a = (last.answers as any[]).find((x) => x.question_id === q.id);
                      return (
                        <div key={q.id} className="text-sm border border-border p-2">
                          <div className="font-medium">Q{i + 1}. {q.question_text}</div>
                          <div className="text-muted-foreground">Your answer: {a?.answer || "—"} ({a?.earned}/{a?.max})</div>
                          {q.correct_answer && <div className="text-accent">Correct: {q.correct_answer}</div>}
                          {q.explanation && <div className="text-xs italic">{q.explanation}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {past.length > 0 && active !== quiz.id && (
              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                {past.slice(0, 5).map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1">
                    {a.passed ? <CheckCircle2 className="h-3 w-3 text-accent" /> : <Circle className="h-3 w-3" />}
                    {a.percent}%
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

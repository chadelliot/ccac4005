import { useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { parseQuizPdf, type ParsedQuestion } from "@/lib/quizPdf";

/**
 * Turn a PDF quiz into a digital one.
 *
 * Reads the PDF in the browser and matches the numbering the quiz already
 * uses — no API call, no credits, and the file never leaves the machine.
 *
 * Because it is pattern matching rather than comprehension, it will not get
 * every layout right. That is exactly why nothing saves until the questions are
 * shown for correction: a wrong answer key in a Bible study quiz teaches the
 * wrong thing, so a person confirms every question first.
 */
export function QuizPdfImport({
  quizId,
  startPosition,
  onImported,
}: {
  quizId: string;
  startPosition: number;
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [fileName, setFileName] = useState("");

  const onFile = async (file: File) => {
    setParsing(true);
    setFileName(file.name);
    try {
      const parsed = await parseQuizPdf(file);
      setQuestions(parsed);
      if (parsed.length === 0) {
        toast.error("No numbered questions found in that PDF.");
      }
    } catch {
      toast.error("Could not read that PDF.");
    } finally {
      setParsing(false);
    }
  };

  const edit = (i: number, patch: Partial<ParsedQuestion>) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const save = async () => {
    const usable = questions.filter((q) => q.text.trim());
    if (usable.length === 0) return;
    setSaving(true);
    const rows = usable.map((q, i) => {
      const multi = q.options.length >= 2;
      return {
        quiz_id: quizId,
        position: startPosition + i + 1,
        // Without options it is a written answer, and a written answer with no
        // key cannot be auto-marked — flagged for review rather than silently
        // marked wrong.
        question_type: multi ? "multiple_choice" : "short_answer",
        question_text: q.text.trim(),
        answer_options: multi ? q.options.map((o) => `${o.label}. ${o.text}`) : null,
        correct_answer: q.answer
          ? multi
            ? (q.options.find((o) => o.label === q.answer)
                ? `${q.answer}. ${q.options.find((o) => o.label === q.answer)!.text}`
                : q.answer)
            : q.answer
          : null,
        auto_grading_enabled: Boolean(q.answer) && multi,
        requires_admin_review: !q.answer,
        points: 1,
      };
    });

    const { error } = await supabase.from("quiz_questions").insert(rows);
    setSaving(false);
    if (error) {
      toast.error(error.message ?? "Could not save those questions.");
      return;
    }
    toast.success(`Imported ${rows.length} question${rows.length === 1 ? "" : "s"}.`);
    setOpen(false);
    setQuestions([]);
    setFileName("");
    onImported();
  };

  const withoutAnswer = questions.filter((q) => !q.answer).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-none eyebrow">
          <FileUp className="h-3 w-3" /> Import PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import a quiz from a PDF</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="quiz-pdf">Quiz PDF</Label>
            <Input
              id="quiz-pdf"
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Read on this device — the file is not uploaded anywhere. Works with the usual layout:
              numbered questions, lettered options, and “Answer: B” where the key is printed.
            </p>
          </div>

          {parsing && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading {fileName}…
            </p>
          )}

          {questions.length > 0 && (
            <>
              <div className="border-l-2 border-accent bg-accent/5 py-2 pl-3 text-xs text-muted-foreground">
                Found {questions.length} question{questions.length === 1 ? "" : "s"}.
                {withoutAnswer > 0 &&
                  ` ${withoutAnswer} had no printed answer — those will be marked for review rather than auto-graded.`}{" "}
                Check each one before saving.
              </div>

              <div className="space-y-4">
                {questions.map((q, i) => (
                  <div key={i} className="border border-border p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-2 text-xs text-muted-foreground">{i + 1}.</span>
                      <Input
                        value={q.text}
                        onChange={(e) => edit(i, { text: e.target.value })}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Remove question ${i + 1}`}
                        className="mt-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {q.options.length > 0 && (
                      <ul className="space-y-1 pl-6">
                        {q.options.map((o, oi) => (
                          <li key={oi} className="flex items-center gap-2 text-xs">
                            <span
                              className={`w-4 shrink-0 font-semibold ${
                                q.answer === o.label ? "text-accent" : "text-muted-foreground"
                              }`}
                            >
                              {o.label}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{o.text}</span>
                            <button
                              type="button"
                              onClick={() => edit(i, { answer: o.label })}
                              className={`shrink-0 text-[10px] uppercase tracking-wider ${
                                q.answer === o.label
                                  ? "text-accent"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {q.answer === o.label ? "correct" : "mark correct"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {q.options.length === 0 && (
                      <p className="pl-6 text-xs text-muted-foreground">
                        No options found — saved as a written answer for manual marking.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving || questions.length === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {questions.length || ""} question{questions.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

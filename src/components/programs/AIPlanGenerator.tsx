import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { generateReadingPlan } from "@/lib/readingPlan";
import { getBooksMeta } from "@/lib/bible";

type Props = {
  programId: string;
  onCreated: () => void;
};

const STYLE_OPTIONS = [
  { v: "canonical", l: "Canonical (Genesis → Revelation)" },
  { v: "ot_nt", l: "OT + NT mix (coming soon — uses canonical for now)" },
  { v: "psalms_proverbs", l: "Includes Psalms & Proverbs (coming soon)" },
];

export function AIPlanGenerator({ programId, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"deterministic" | "ai">("deterministic");

  // Deterministic
  const [days, setDays] = useState(365);
  const [startDate, setStartDate] = useState("");
  const [_style, setStyle] = useState("canonical");
  const [busy, setBusy] = useState(false);

  // AI
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDays, setAiDays] = useState(30);
  const [aiBusy, setAiBusy] = useState(false);

  const runDeterministic = async () => {
    setBusy(true);
    try {
      const books = await getBooksMeta();
      const plan = generateReadingPlan({ books, days, startDate: startDate || undefined });
      const rows = plan.map((d) => ({
        program_id: programId,
        day_number: d.day_number,
        title: d.title,
        passages: d.passages,
        assigned_date: d.assigned_date ?? null,
        scripture_reference: d.scripture_reference,
        book_name: d.book_name,
        chapter_start: d.chapter_start,
        chapter_end: d.chapter_end,
      }));
      // Insert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from("reading_program_days").insert(rows.slice(i, i + 100));
        if (error) throw error;
      }
      toast.success(`Generated ${plan.length} days`);
      setOpen(false);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const runAI = async () => {
    if (!aiPrompt.trim()) return toast.error("Describe what to generate");
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("program-ai", {
        body: { mode: "generate_plan", prompt: aiPrompt, days: aiDays },
      });
      if (error) throw error;
      const result = data as any;
      if (Array.isArray(result?.days) && result.days.length > 0) {
        const rows = result.days.map((d: any, i: number) => ({
          program_id: programId,
          day_number: d.day_number ?? i + 1,
          title: d.title ?? `Day ${i + 1}`,
          passages: [],
          scripture_reference: d.scripture_reference ?? null,
          summary: d.summary ?? null,
          reflection_question: d.reflection_question ?? null,
        }));
        for (let i = 0; i < rows.length; i += 100) {
          const { error: e2 } = await supabase.from("reading_program_days").insert(rows.slice(i, i + 100));
          if (e2) throw e2;
        }
        toast.success(`AI generated ${rows.length} days`);
      }
      if (Array.isArray(result?.lessons) && result.lessons.length > 0) {
        const rows = result.lessons.map((l: any, i: number) => ({
          program_id: programId,
          lesson_number: l.lesson_number ?? i + 1,
          title: l.title ?? `Lesson ${i + 1}`,
          description: l.description ?? null,
          focus_scriptures: (l.focus_scriptures ?? []).map((s: string) => ({ ref: s })),
          teaching_notes: l.teaching_notes ?? null,
          reflection_questions: l.reflection_questions ?? [],
          call_to_action: l.call_to_action ?? null,
        }));
        const { error: e3 } = await supabase.from("program_lessons").insert(rows);
        if (e3) throw e3;
        toast.success(`AI generated ${rows.length} lessons`);
      }
      setOpen(false);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "AI failed");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-none eyebrow gap-2">
          <Sparkles className="h-3 w-3" /> Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Generate plan</DialogTitle>
        </DialogHeader>

        <div className="flex border border-border">
          <button onClick={() => setTab("deterministic")} className={`flex-1 px-4 py-2 text-sm eyebrow ${tab === "deterministic" ? "bg-night text-night-foreground" : ""}`}>Bible plan (deterministic)</button>
          <button onClick={() => setTab("ai")} className={`flex-1 px-4 py-2 text-sm eyebrow ${tab === "ai" ? "bg-night text-night-foreground" : ""}`}>AI assistant</button>
        </div>

        {tab === "deterministic" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Splits the entire Bible across N days canonically (Genesis → Revelation). Best for 30/90/180/365-day plans.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Days</Label>
                <Input type="number" min={1} max={1189} value={days} onChange={(e) => setDays(parseInt(e.target.value) || 1)} />
              </div>
              <div>
                <Label>Start date (optional)</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Style</Label>
              <Select defaultValue="canonical" onValueChange={setStyle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STYLE_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button onClick={runDeterministic} disabled={busy} className="w-full bg-night text-night-foreground rounded-none py-6 eyebrow">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Generate ${days} days`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Use AI to draft a topical reading plan or lesson series. Always editable before publishing.</p>
            <div>
              <Label>Prompt</Label>
              <Textarea rows={4} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="A 30-day discipleship plan for new believers focused on salvation, prayer, baptism, the Holy Spirit, and Christian living." />
            </div>
            <div>
              <Label>Target length (days/lessons)</Label>
              <Input type="number" min={1} max={365} value={aiDays} onChange={(e) => setAiDays(parseInt(e.target.value) || 1)} />
            </div>
            <DialogFooter>
              <Button onClick={runAI} disabled={aiBusy} className="w-full bg-night text-night-foreground rounded-none py-6 eyebrow gap-2">
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-3 w-3" /> Draft with AI</>}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

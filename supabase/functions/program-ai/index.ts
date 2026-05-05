// Edge function: AI helper for the discipleship program builder.
// Modes:
//   "generate_plan"   – generate a structured reading or lesson plan
//   "lesson_outline"  – flesh out a single lesson (notes, reflections)
//   "quiz_questions"  – generate quiz questions from a topic / passage
//   "grade_short"     – grade a short-answer response
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(body: unknown) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not set");
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    if (r.status === 429) throw new Error("Rate limit reached. Try again shortly.");
    if (r.status === 402) throw new Error("AI credits exhausted. Add funds in Workspace > Usage.");
    throw new Error(`AI gateway error ${r.status}: ${await r.text()}`);
  }
  return r.json();
}

function tool(name: string, description: string, parameters: unknown) {
  return [{ type: "function", function: { name, description, parameters } }];
}

function pickToolArgs(j: any): any {
  const tc = j?.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) return null;
  try { return JSON.parse(tc.function.arguments); } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { mode, ...input } = await req.json();
    const model = "google/gemini-2.5-flash";

    if (mode === "generate_plan") {
      const { prompt, days } = input as { prompt: string; days?: number };
      const tools = tool("propose_plan", "Propose a discipleship reading plan or lesson plan.", {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          program_type: { type: "string", enum: ["reading_plan", "lesson_based", "topical", "devotional", "year_bible"] },
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                day_number: { type: "integer" },
                title: { type: "string" },
                scripture_reference: { type: "string" },
                summary: { type: "string" },
                reflection_question: { type: "string" },
              },
              required: ["day_number", "title"],
            },
          },
          lessons: {
            type: "array",
            items: {
              type: "object",
              properties: {
                lesson_number: { type: "integer" },
                title: { type: "string" },
                description: { type: "string" },
                focus_scriptures: { type: "array", items: { type: "string" } },
                teaching_notes: { type: "string" },
                reflection_questions: { type: "array", items: { type: "string" } },
                call_to_action: { type: "string" },
              },
              required: ["lesson_number", "title"],
            },
          },
        },
        required: ["title", "description", "program_type"],
      });
      const j = await callAI({
        model,
        messages: [
          { role: "system", content: "You design discipleship Bible programs. Always respond by calling propose_plan. Keep daily readings to ~2-4 chapters. KJV-friendly tone." },
          { role: "user", content: `Create a program. Target length: ${days ?? "(unspecified)"} days. User request: ${prompt}` },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "propose_plan" } },
      });
      return Response.json(pickToolArgs(j) ?? {}, { headers: corsHeaders });
    }

    if (mode === "lesson_outline") {
      const { topic, scriptures } = input as { topic: string; scriptures?: string[] };
      const tools = tool("propose_lesson", "Outline a single discipleship lesson.", {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          focus_scriptures: { type: "array", items: { type: "string" } },
          teaching_notes: { type: "string" },
          reflection_questions: { type: "array", items: { type: "string" } },
          call_to_action: { type: "string" },
        },
        required: ["title", "teaching_notes", "reflection_questions"],
      });
      const j = await callAI({
        model,
        messages: [
          { role: "system", content: "You write discipleship lessons. Always call propose_lesson." },
          { role: "user", content: `Topic: ${topic}\nFocus scriptures (optional): ${(scriptures ?? []).join(", ")}` },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "propose_lesson" } },
      });
      return Response.json(pickToolArgs(j) ?? {}, { headers: corsHeaders });
    }

    if (mode === "quiz_questions") {
      const { topic, count } = input as { topic: string; count?: number };
      const tools = tool("propose_quiz", "Propose quiz questions.", {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_type: { type: "string", enum: ["multiple_choice", "true_false", "fill_blank", "short_answer"] },
                question_text: { type: "string" },
                answer_options: { type: "array", items: { type: "string" } },
                correct_answer: { type: "string" },
                explanation: { type: "string" },
                points: { type: "integer" },
              },
              required: ["question_type", "question_text", "correct_answer"],
            },
          },
        },
        required: ["questions"],
      });
      const j = await callAI({
        model,
        messages: [
          { role: "system", content: "You write Bible-knowledge quiz questions. Always call propose_quiz." },
          { role: "user", content: `Generate ${count ?? 5} questions on: ${topic}` },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "propose_quiz" } },
      });
      return Response.json(pickToolArgs(j) ?? {}, { headers: corsHeaders });
    }

    if (mode === "grade_short") {
      const { question, expected, instructions, answer, points } = input as {
        question: string; expected: string; instructions?: string; answer: string; points: number;
      };
      const tools = tool("grade_answer", "Grade a short-answer response.", {
        type: "object",
        properties: {
          score: { type: "number" },
          max: { type: "number" },
          feedback: { type: "string" },
        },
        required: ["score", "max", "feedback"],
      });
      const j = await callAI({
        model,
        messages: [
          { role: "system", content: "You grade Bible-study short answers fairly. Always call grade_answer." },
          { role: "user", content: `Question: ${question}\nExpected answer: ${expected}\nInstructions: ${instructions ?? "Award partial credit for clearly correct ideas."}\nMax points: ${points}\nStudent answer: ${answer}` },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "grade_answer" } },
      });
      return Response.json(pickToolArgs(j) ?? { score: 0, max: points, feedback: "Could not grade." }, { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("program-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Edge function: AI helper for the discipleship program builder.
// Modes:
//   "generate_plan"   – generate a structured reading or lesson plan
//   "lesson_outline"  – flesh out a single lesson (notes, reflections)
//   "quiz_questions"  – generate quiz questions from a topic / passage
//   "grade_short"     – grade a short-answer response
//
// Calls the Claude API directly. Structured outputs (output_config.format)
// guarantee the response parses against the schema for each mode, so callers
// get the same object shape the old tool-calling path produced.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-opus-5";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * One call to Claude, constrained to `schema`.
 *
 * Streams because plan generation can run long — a non-streaming request at
 * this max_tokens risks an HTTP timeout. `fallbacks: "default"` lets the API
 * re-serve the request on another model if a safety classifier declines it.
 */
async function ask(
  client: Anthropic,
  opts: {
    system: string;
    user: string;
    schema: Record<string, unknown>;
    maxTokens: number;
    effort: Effort;
  },
): Promise<Record<string, unknown>> {
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: {
      effort: opts.effort,
      format: { type: "json_schema", schema: opts.schema },
    },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("The model declined this request. Try rewording it.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error(
      "Response hit the length limit before finishing. Try a shorter plan.",
    );
  }

  // With structured outputs the JSON lands in a text block; thinking blocks
  // come first and carry no content, so pick the text block explicitly.
  const text = message.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("Model returned no text content");
  }
  return JSON.parse(text.text);
}

const dayItem = {
  type: "object",
  properties: {
    day_number: { type: "integer" },
    title: { type: "string" },
    scripture_reference: { type: "string" },
    summary: { type: "string" },
    reflection_question: { type: "string" },
  },
  required: [
    "day_number",
    "title",
    "scripture_reference",
    "summary",
    "reflection_question",
  ],
  additionalProperties: false,
};

const lessonItem = {
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
  required: [
    "lesson_number",
    "title",
    "description",
    "focus_scriptures",
    "teaching_notes",
    "reflection_questions",
    "call_to_action",
  ],
  additionalProperties: false,
};

// Structured outputs require every property listed in `required`, so a plan
// returns both arrays and leaves the one that doesn't apply empty. Callers
// already branch on `.length > 0`.
const planSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    program_type: {
      type: "string",
      enum: [
        "reading_plan",
        "lesson_based",
        "topical",
        "devotional",
        "year_bible",
      ],
    },
    days: { type: "array", items: dayItem },
    lessons: { type: "array", items: lessonItem },
  },
  required: ["title", "description", "program_type", "days", "lessons"],
  additionalProperties: false,
};

const lessonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    focus_scriptures: { type: "array", items: { type: "string" } },
    teaching_notes: { type: "string" },
    reflection_questions: { type: "array", items: { type: "string" } },
    call_to_action: { type: "string" },
  },
  required: [
    "title",
    "description",
    "focus_scriptures",
    "teaching_notes",
    "reflection_questions",
    "call_to_action",
  ],
  additionalProperties: false,
};

const quizSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_type: {
            type: "string",
            enum: [
              "multiple_choice",
              "true_false",
              "fill_blank",
              "short_answer",
            ],
          },
          question_text: { type: "string" },
          answer_options: { type: "array", items: { type: "string" } },
          correct_answer: { type: "string" },
          explanation: { type: "string" },
          points: { type: "integer" },
        },
        required: [
          "question_type",
          "question_text",
          "answer_options",
          "correct_answer",
          "explanation",
          "points",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

const gradeSchema = {
  type: "object",
  properties: {
    score: { type: "number" },
    max: { type: "number" },
    feedback: { type: "string" },
  },
  required: ["score", "max", "feedback"],
  additionalProperties: false,
};

const CONCISE =
  "Keep each field concise and usable as-is by a teacher — no filler, no preamble.";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require a signed-in caller — this function spends metered AI credits.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Not authenticated" }, 401);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not set" }, 500);
    const client = new Anthropic({ apiKey });

    const { mode, ...input } = await req.json();

    if (mode === "generate_plan") {
      const { prompt, days } = input as { prompt: string; days?: number };
      const result = await ask(client, {
        system:
          "You design discipleship Bible programs. Keep daily readings to ~2-4 chapters. KJV-friendly tone. " +
          "Return days for a reading plan or lessons for a lesson-based program — leave the other array empty. " +
          CONCISE,
        user: `Create a program. Target length: ${days ?? "(unspecified)"} days. User request: ${prompt}`,
        schema: planSchema,
        maxTokens: 32000,
        effort: "high",
      });
      return json(result);
    }

    if (mode === "lesson_outline") {
      const { topic, scriptures } = input as {
        topic: string;
        scriptures?: string[];
      };
      const result = await ask(client, {
        system: `You write discipleship lessons. KJV-friendly tone. ${CONCISE}`,
        user: `Topic: ${topic}\nFocus scriptures (optional): ${(scriptures ?? []).join(", ")}`,
        schema: lessonSchema,
        maxTokens: 8000,
        effort: "high",
      });
      return json(result);
    }

    if (mode === "quiz_questions") {
      const { topic, count } = input as { topic: string; count?: number };
      const result = await ask(client, {
        system: `You write Bible-knowledge quiz questions. KJV-friendly tone. ${CONCISE}`,
        user: `Generate ${count ?? 5} questions on: ${topic}`,
        schema: quizSchema,
        maxTokens: 8000,
        effort: "medium",
      });
      return json(result);
    }

    if (mode === "grade_short") {
      const { question, expected, instructions, answer, points } = input as {
        question: string;
        expected: string;
        instructions?: string;
        answer: string;
        points: number;
      };
      const result = await ask(client, {
        system:
          "You grade Bible-study short answers fairly. Award partial credit for clearly correct ideas. " +
          "Feedback is one or two encouraging sentences.",
        user:
          `Question: ${question}\nExpected answer: ${expected}\n` +
          `Instructions: ${instructions ?? "Award partial credit for clearly correct ideas."}\n` +
          `Max points: ${points}\nStudent answer: ${answer}`,
        schema: gradeSchema,
        maxTokens: 4000,
        effort: "low",
      });
      return json(result);
    }

    return json({ error: "Unknown mode" }, 400);
  } catch (e) {
    console.error("program-ai error:", e);

    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: "Rate limit reached. Try again shortly." }, 429);
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return json({ error: "Invalid ANTHROPIC_API_KEY." }, 500);
    }
    if (e instanceof Anthropic.APIError) {
      return json({ error: `AI error (${e.status}): ${e.message}` }, 502);
    }
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});

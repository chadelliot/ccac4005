// Read a photographed receipt into the fields of the expense form.
//
// The output is a suggestion, never a saved record. A misread total on a tax
// return is worse than no reading at all, so this fills the form and the person
// who took the photograph confirms it before anything is written. Every field
// is optional in the schema — a blank the user fills in is better than a
// plausible invention.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const MODEL = "claude-opus-5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    // ISO date. Null rather than today's date when the receipt does not show
    // one — defaulting silently to today would misfile the expense by weeks.
    spent_on: { type: ["string", "null"], description: "Date on the receipt, YYYY-MM-DD, or null if not visible." },
    vendor: { type: ["string", "null"], description: "Shop or supplier name as printed." },
    amount: { type: ["string", "null"], description: "Grand total actually paid, digits and one decimal point only, e.g. 47.31. Null if unclear." },
    payment_method: { type: ["string", "null"], enum: ["cash", "check", "card", "transfer", "other", null] },
    description: { type: ["string", "null"], description: "One short line on what was bought." },
    category_hint: { type: ["string", "null"], description: "Best-matching category name from the list supplied, or null." },
    confidence: { type: "string", enum: ["high", "medium", "low"], description: "How legible the receipt was." },
  },
  required: ["spent_on", "vendor", "amount", "payment_method", "description", "category_hint", "confidence"],
};

const SYSTEM = `You read photographs of receipts for a church's expense records.

Report only what is printed on the receipt. If a field is not legible or not
present, return null for it — a blank the bookkeeper fills in is far better than
a plausible guess that reaches a tax return unchecked.

The amount is the grand total actually paid, after tax and any discount, not a
subtotal or an individual line item. Return it as digits with at most one
decimal point and no currency symbol.

Set confidence to low if the image is blurred, cropped, or you are unsure of the
total for any reason.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Not authenticated" }, 401);

    const asCaller = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await asCaller.auth.getUser();
    if (authError || !user) return json({ ok: false, error: "Not authenticated" }, 401);

    // Reading receipts costs API credits, so it is gated on the same capability
    // that may record an expense at all.
    const { data: allowed } = await asCaller.rpc("has_capability", {
      _user_id: user.id,
      _capability: "finance_management",
    });
    if (!allowed) return json({ ok: false, error: "You do not have Finances access." }, 403);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ ok: false, error: "Receipt reading is not configured." }, 500);

    const payload = await req.json();
    const imageBase64 = payload?.image_base64;
    const mediaType = payload?.media_type ?? "image/jpeg";
    const categories: string[] = Array.isArray(payload?.categories) ? payload.categories : [];

    if (typeof imageBase64 !== "string" || imageBase64.length < 100) {
      return json({ ok: false, error: "No image supplied" }, 400);
    }
    // Roughly 7MB of base64 is about 5MB of image; past that the request is
    // more likely to time out than to succeed.
    if (imageBase64.length > 7_000_000) {
      return json({ ok: false, error: "That photo is too large — try again with a smaller one." }, 400);
    }

    const client = new Anthropic({ apiKey });

    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        // Reading a receipt is legibility, not reasoning. Low effort keeps it
        // quick and cheap; the schema does the structuring.
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            {
              type: "text",
              text: categories.length
                ? `Read this receipt. For category_hint, choose the closest of: ${categories.join(", ")} — or null if none fit.`
                : "Read this receipt.",
            },
          ],
        },
      ],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return json({ ok: false, error: "The model declined to read that image." });
    }
    if (message.stop_reason === "max_tokens") {
      return json({ ok: false, error: "Reading the receipt ran long. Try a clearer photo." });
    }

    // Structured output lands in a text block; thinking blocks come first and
    // carry no content, so pick the text block explicitly.
    const text = message.content.find((b: { type: string }) => b.type === "text");
    if (!text || !("text" in text)) {
      return json({ ok: false, error: "No reading came back." });
    }

    return json({ ok: true, fields: JSON.parse((text as { text: string }).text) });
  } catch (e) {
    console.error("receipt-scan error:", e);
    return json({ ok: false, error: "Could not read that receipt." }, 500);
  }
});

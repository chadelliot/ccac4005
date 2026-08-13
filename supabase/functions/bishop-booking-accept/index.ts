// Desk-only accept: flip the request to accepted and write it to the Bishop's
// Google Calendar.
//
// verify_jwt is on for this function, but that only proves the caller is signed
// in — it says nothing about desk membership. Authorisation is checked here
// against bishop_booking_authorized_users before anything is written.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serviceClient } from "../_shared/rate-limit.ts";
import { createEvent, calendarConfigured, missingCalendarSecrets } from "../_shared/google-calendar.ts";
import { sendEmail, acceptanceEmail, emailConfigured } from "../_shared/email.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Not signed in" }, 401);

    // A caller-scoped client: resolves the JWT to a real user without trusting
    // any user id supplied in the body.
    const asCaller = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );

    const { data: { user }, error: userErr } = await asCaller.auth.getUser();
    if (userErr || !user) return json({ error: "Not signed in" }, 401);

    const db = serviceClient();

    const { data: desk } = await db
      .from("bishop_booking_authorized_users")
      .select("user_id, email, display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!desk) return json({ error: "You do not have access to the Bishop's Desk." }, 403);

    const body = await req.json().catch(() => null);
    const requestId = typeof body?.request_id === "string" ? body.request_id : null;
    if (!requestId) return json({ error: "request_id is required" }, 400);

    const { data: reqRow, error: loadErr } = await db
      .from("bishop_booking_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (loadErr || !reqRow) return json({ error: "Request not found" }, 404);
    if (reqRow.status === "accepted" && reqRow.calendar_event_id) {
      // Idempotent: a double-click must not create a second calendar entry.
      return json({ ok: true, already_accepted: true, calendar_event_id: reqRow.calendar_event_id });
    }

    const { data: internal } = await db
      .from("bishop_booking_internal_settings")
      .select("calendar_id, secretary_name, secretary_email")
      .eq("id", 1)
      .maybeSingle();

    const { data: publicSettings } = await db
      .from("bishop_booking_public_settings")
      .select("accommodation_policy, travel_policy")
      .eq("id", 1)
      .maybeSingle();

    // Calendar first. If it fails the status stays put, so the desk can retry —
    // the alternative, marking accepted and failing to book, leaves a church
    // told "yes" for an engagement that is on no calendar anywhere.
    let calendarEventId: string | null = null;
    let calendarWarning: string | null = null;

    if (!calendarConfigured()) {
      calendarWarning = `Google Calendar is not configured (missing: ${missingCalendarSecrets().join(", ")}). The request was accepted but nothing was added to the diary.`;
    } else {
      try {
        const created = await createEvent({
          summary: `${reqRow.event_name} — ${reqRow.church_name}`,
          description: [
            `Request ${reqRow.request_number}`,
            `Church: ${reqRow.church_name} (Pastor ${reqRow.pastor_name})`,
            `Role: ${reqRow.service_role}${reqRow.service_role_other ? ` — ${reqRow.service_role_other}` : ""}`,
            `Contact: ${reqRow.contact_name} · ${reqRow.contact_email} · ${reqRow.contact_phone}`,
            reqRow.theme ? `Theme: ${reqRow.theme}` : null,
            reqRow.expected_attendance ? `Expected attendance: ${reqRow.expected_attendance}` : null,
          ].filter(Boolean).join("\n"),
          location: [reqRow.venue_name, reqRow.venue_address || reqRow.church_address, reqRow.church_city, reqRow.church_state]
            .filter(Boolean).join(", "),
          startDate: reqRow.event_date,
          startTime: String(reqRow.start_time).slice(0, 5),
          endDate: reqRow.event_end_date,
          calendarId: internal?.calendar_id,
        });
        calendarEventId = created.id;
      } catch (err) {
        const message = err instanceof Error ? err.message : "calendar_failed";
        console.error("bishop-booking-accept: calendar write failed", message);
        return json({
          error:
            message === "calendar_refresh_token_invalid"
              ? "Google rejected the stored refresh token. Re-run the OAuth consent flow in GOOGLE_SETUP.md, then try again."
              : "Could not add this engagement to the Bishop's calendar, so nothing was changed. Please try again.",
        }, 502);
      }
    }

    const { error: updateErr } = await db
      .from("bishop_booking_requests")
      .update({
        status: "accepted",
        calendar_event_id: calendarEventId,
        decided_at: new Date().toISOString(),
        decided_by: user.id,
      })
      .eq("id", requestId);

    if (updateErr) {
      console.error("bishop-booking-accept: status update failed", updateErr);
      return json({ error: "The calendar entry was created but the request could not be updated. Please check before retrying." }, 500);
    }

    // The status trigger logs the transition; this records who pressed the
    // button and what happened on the Google side.
    await db.from("bishop_booking_activity").insert({
      request_id: requestId,
      actor_id: user.id,
      actor_email: desk.email ?? user.email ?? null,
      action: "accepted",
      to_status: "accepted",
      detail: calendarEventId ? `Added to calendar (${calendarEventId})` : calendarWarning,
    });

    let emailResult: unknown = { sent: false, skipped: "email_not_configured" };
    if (emailConfigured()) {
      emailResult = await sendEmail({
        to: reqRow.contact_email,
        subject: `Accepted — ${reqRow.event_name} (${reqRow.request_number})`,
        replyTo: internal?.secretary_email || undefined,
        html: acceptanceEmail({
          contactName: reqRow.contact_name,
          churchName: reqRow.church_name,
          requestNumber: reqRow.request_number,
          eventName: reqRow.event_name,
          when: formatWhen(reqRow.event_date, reqRow.event_end_date, String(reqRow.start_time).slice(0, 5)),
          accommodationPolicy: publicSettings?.accommodation_policy ?? "",
          travelPolicy: publicSettings?.travel_policy ?? "",
          secretaryName: internal?.secretary_name ?? "",
          secretaryEmail: internal?.secretary_email ?? "",
        }),
      });
    }

    return json({ ok: true, calendar_event_id: calendarEventId, warning: calendarWarning, email: emailResult });
  } catch (err) {
    console.error("bishop-booking-accept failed", err);
    return json({ error: "Accept failed" }, 500);
  }
});

function formatWhen(date: string, endDate: string | null, time: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  };
  const [h, mi] = time.split(":").map(Number);
  const t = new Date(2000, 0, 1, h, mi).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return endDate && endDate !== date ? `${fmt(date)} – ${fmt(endDate)} at ${t}` : `${fmt(date)} at ${t}`;
}

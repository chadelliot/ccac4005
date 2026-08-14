// Public submission endpoint for the invitation form.
//
// This is the only write path into bishop_booking_requests. The table grants
// `anon` nothing, so everything arrives here first: honeypot, rate limit,
// blocked-weekday and lead-time checks, then the insert under the service role.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkAndRecord, serviceClient } from "../_shared/rate-limit.ts";
import {
  sendEmail,
  acknowledgementEmail,
  deskNotificationEmail,
  emailConfigured,
} from "../_shared/email.ts";

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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const EVENT_TYPES = ["revival","conference","anniversary","installation","ordination","musical","banquet","funeral","wedding","other"];
const SERVICE_ROLES = ["preach","teach","keynote","officiate","panel","greetings","other"];
// bishop_arranges is retired: the host covers travel.
const TRAVEL = ["host_arranges","not_required"];
const APPAREL = ["vestments","civic","shirt_tie","casual","other"];

/** Trim, cap, and turn "" into null so empty optionals do not become empty strings. */
const s = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request body" }, 400);

    // Honeypot. A real visitor never sees this field, so anything in it is a bot.
    // Answer 200 with a plausible shape: telling a scraper it was detected just
    // teaches it to fill the form differently next time.
    if (typeof body.website_url === "string" && body.website_url.trim() !== "") {
      console.warn("bishop-booking-submit: honeypot tripped");
      return json({ ok: true, request_number: null });
    }

    const contact_email = s(body.contact_email, 255)?.toLowerCase() ?? "";
    if (!EMAIL_RE.test(contact_email)) return json({ error: "A valid contact email is required." }, 400);

    const required = {
      church_name: s(body.church_name, 200),
      pastor_name: s(body.pastor_name, 200),
      church_city: s(body.church_city, 120),
      church_state: s(body.church_state, 60),
      church_postal_code: s(body.church_postal_code, 20),
      contact_name: s(body.contact_name, 200),
      contact_phone: s(body.contact_phone, 40),
      event_name: s(body.event_name, 250),
    };
    const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) return json({ error: "Some required details are missing.", fields: missing }, 400);

    const event_date = s(body.event_date, 10) ?? "";
    const start_time = s(body.start_time, 5) ?? "";
    if (!DATE_RE.test(event_date)) return json({ error: "Choose an event date." }, 400);
    if (!TIME_RE.test(start_time)) return json({ error: "Choose a start time." }, 400);

    const event_end_date = s(body.event_end_date, 10);
    if (event_end_date && (!DATE_RE.test(event_end_date) || event_end_date < event_date)) {
      return json({ error: "The end date cannot be before the start date." }, 400);
    }

    const event_type = EVENT_TYPES.includes(body.event_type) ? body.event_type : null;
    const service_role = SERVICE_ROLES.includes(body.service_role) ? body.service_role : null;
    if (!event_type || !service_role) return json({ error: "Choose an event type and a role." }, 400);

    const apparel = APPAREL.includes(body.apparel) ? body.apparel : null;
    if (!apparel) return json({ error: "Choose the expected attire." }, 400);

    const db = serviceClient();

    const { data: settings } = await db
      .from("bishop_booking_public_settings")
      .select("blocked_weekdays, lead_time_days, accepting_requests, response_time_note")
      .eq("id", 1)
      .maybeSingle();

    if (settings && settings.accepting_requests === false) {
      return json({ error: "The Bishop's calendar is closed to new requests at this time." }, 403);
    }

    // Same checks the form ran, repeated because the form can be bypassed.
    const [y, mo, d] = event_date.split("-").map(Number);
    const local = new Date(y, mo - 1, d);
    const blocked: number[] = settings?.blocked_weekdays ?? [0];
    if (blocked.includes(local.getDay())) {
      return json({
        error:
          local.getDay() === 0
            ? "Bishop Marcus is with his own congregation on Sundays. Please choose another day."
            : "That weekday is not available for engagements.",
      }, 400);
    }

    const leadDays = settings?.lead_time_days ?? 30;
    const today = new Date();
    if (local < new Date(today.getFullYear(), today.getMonth(), today.getDate() + leadDays)) {
      return json({ error: `Invitations need at least ${leadDays} days' notice.` }, 400);
    }

    // Rate limit last among the cheap checks: no reason to spend a write on a
    // submission that was going to be rejected for its content anyway.
    const limit = await checkAndRecord(req, contact_email);
    if (!limit.allowed) return json({ error: limit.reason }, 429);

    const insert = {
      ...required,
      contact_email,
      church_address: s(body.church_address, 300),
      church_website: s(body.church_website, 300),
      affiliation: s(body.affiliation, 200),
      contact_role: s(body.contact_role, 120),
      preferred_contact_method: ["email", "phone", "either"].includes(body.preferred_contact_method)
        ? body.preferred_contact_method
        : "either",
      event_type,
      event_type_other: s(body.event_type_other, 160),
      service_role,
      service_role_other: s(body.service_role_other, 160),
      apparel,
      apparel_notes: s(body.apparel_notes, 200),
      event_date,
      event_end_date,
      start_time,
      expected_attendance:
        Number.isFinite(Number(body.expected_attendance)) && Number(body.expected_attendance) >= 0
          ? Math.floor(Number(body.expected_attendance))
          : null,
      venue_name: s(body.venue_name, 200),
      venue_address: s(body.venue_address, 300),
      theme: s(body.theme, 300),
      travel_arrangement: TRAVEL.includes(body.travel_arrangement) ? body.travel_arrangement : "host_arranges",
      nearest_airport: s(body.nearest_airport, 120),
      accommodation_notes: s(body.accommodation_notes, 2000),
      armor_bearer_count:
        Number.isFinite(Number(body.armor_bearer_count)) && Number(body.armor_bearer_count) >= 0
          ? Math.min(20, Math.floor(Number(body.armor_bearer_count)))
          : 0,
      honorarium_notes: s(body.honorarium_notes, 2000),
      additional_notes: s(body.additional_notes, 4000),
      submitted_user_agent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
    };

    const { data: created, error } = await db
      .from("bishop_booking_requests")
      .insert(insert)
      .select("id, request_number, event_date, event_end_date, start_time, event_name")
      .single();

    if (error) {
      // The blocked-weekday trigger raises check_violation. It should be
      // unreachable — both checks above ran already — but if it fires, the
      // church gets its message rather than a 500.
      if (error.code === "23514" || /not available on/i.test(error.message)) {
        return json({ error: "The Bishop is not available on that day. Please choose another date." }, 400);
      }
      console.error("bishop-booking-submit: insert failed", error);
      return json({ error: "We could not record your request. Please try again or call the church office." }, 500);
    }

    const when = formatWhen(created.event_date, created.event_end_date, created.start_time);

    // Email is best-effort from here: the request is already safely recorded.
    const results: Record<string, unknown> = {};
    if (emailConfigured()) {
      const { data: internal } = await db
        .from("bishop_booking_internal_settings")
        .select("notification_emails, secretary_email, auto_acknowledge")
        .eq("id", 1)
        .maybeSingle();

      if (internal?.auto_acknowledge !== false) {
        results.acknowledgement = await sendEmail({
          to: contact_email,
          subject: `We have your invitation — ${created.request_number}`,
          replyTo: internal?.secretary_email || undefined,
          html: acknowledgementEmail({
            contactName: required.contact_name!,
            churchName: required.church_name!,
            requestNumber: created.request_number,
            eventName: created.event_name,
            when,
            responseNote: settings?.response_time_note ?? "",
          }),
        });
      }

      const deskRecipients = [
        ...(internal?.notification_emails ?? []),
        ...(internal?.secretary_email ? [internal.secretary_email] : []),
      ].filter(Boolean);

      if (deskRecipients.length) {
        const site = (Deno.env.get("SITE_URL") ?? "https://ccacbmore.com").replace(/\/$/, "");
        results.desk = await sendEmail({
          to: Array.from(new Set(deskRecipients)),
          subject: `New engagement request — ${required.church_name} (${created.request_number})`,
          replyTo: contact_email,
          html: deskNotificationEmail({
            requestNumber: created.request_number,
            churchName: required.church_name!,
            pastorName: required.pastor_name!,
            affiliation: insert.affiliation,
            city: required.church_city!,
            state: required.church_state!,
            postalCode: required.church_postal_code,
            address: insert.church_address,
            website: insert.church_website,
            contactName: required.contact_name!,
            contactRole: insert.contact_role,
            contactEmail: contact_email,
            contactPhone: required.contact_phone!,
            preferred: insert.preferred_contact_method,
            eventName: created.event_name,
            eventType: insert.event_type_other
              ? `${event_type} — ${insert.event_type_other}`
              : event_type,
            serviceRole: insert.service_role_other
              ? `${service_role} — ${insert.service_role_other}`
              : service_role,
            apparel: insert.apparel_notes ? `${apparel} — ${insert.apparel_notes}` : apparel,
            when,
            attendance: insert.expected_attendance,
            theme: insert.theme,
            venue: [insert.venue_name, insert.venue_address].filter(Boolean).join(", ") || null,
            travel: insert.travel_arrangement,
            airport: insert.nearest_airport,
            party: insert.armor_bearer_count,
            notes: insert.additional_notes,
            deskUrl: `${site}/dashboard/engagements/${created.id}`,
          }),
        });
      }
    }

    return json({ ok: true, request_number: created.request_number, email: results });
  } catch (err) {
    console.error("bishop-booking-submit failed", err);
    return json({ error: "Something went wrong. Please try again or call the church office." }, 500);
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

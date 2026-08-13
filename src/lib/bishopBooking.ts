import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/**
 * Shared contracts for the Bishop's engagement booking system.
 *
 * RECONSTRUCTED. The original planning conversation produced a version of this
 * file that never reached the repo, so these schemas were rebuilt from the
 * feature description. Where the original made a choice this file cannot know
 * — exact field names, enum spellings — this is the definition the migration,
 * the edge functions and the UI in this branch all agree on. If the original
 * turns up, reconcile against this file first: everything else keys off it.
 */

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * The desk workflow, in order. `upcoming` is deliberately NOT a stored status —
 * it is `accepted` with a future event date, derived at read time. Storing it
 * would mean a scheduled job to flip rows, and a row that silently disagrees
 * with the calendar.
 */
export const BOOKING_STATUSES = [
  "new",
  "under_review",
  "awaiting_bishop",
  "tentatively_held",
  "accepted",
  "declined",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  new: "New",
  under_review: "Under Review",
  awaiting_bishop: "Awaiting Bishop",
  tentatively_held: "Tentatively Held",
  accepted: "Accepted",
  declined: "Declined",
};

/** Summary buckets on the desk dashboard. "Upcoming" is derived — see above. */
export const SUMMARY_BUCKETS = [
  "new",
  "under_review",
  "awaiting_bishop",
  "tentatively_held",
  "accepted",
  "upcoming",
] as const;

export type SummaryBucket = (typeof SUMMARY_BUCKETS)[number];

export const BUCKET_LABELS: Record<SummaryBucket, string> = {
  ...STATUS_LABELS,
  upcoming: "Upcoming",
};

/** Which desk action moves a request to which status. */
export const STATUS_ACTIONS = [
  { action: "review", to: "under_review", label: "Mark Under Review" },
  { action: "request_information", to: "under_review", label: "Request Information" },
  { action: "send_to_bishop", to: "awaiting_bishop", label: "Send to Bishop" },
  { action: "tentative_hold", to: "tentatively_held", label: "Tentative Hold" },
  { action: "accept", to: "accepted", label: "Accept" },
  { action: "decline", to: "declined", label: "Decline" },
] as const;

export type BookingAction = (typeof STATUS_ACTIONS)[number]["action"];

// ---------------------------------------------------------------------------
// Enums used by the public form
// ---------------------------------------------------------------------------

export const EVENT_TYPES = [
  "revival",
  "conference",
  "anniversary",
  "installation",
  "ordination",
  "musical",
  "banquet",
  "funeral",
  "wedding",
  "other",
] as const;

export const EVENT_TYPE_LABELS: Record<(typeof EVENT_TYPES)[number], string> = {
  revival: "Revival",
  conference: "Conference",
  anniversary: "Church / Pastoral Anniversary",
  installation: "Installation",
  ordination: "Ordination",
  musical: "Musical",
  banquet: "Banquet",
  funeral: "Funeral",
  wedding: "Wedding",
  other: "Other",
};

export const SERVICE_ROLES = [
  "preach",
  "teach",
  "keynote",
  "officiate",
  "panel",
  "greetings",
  "other",
] as const;

export const SERVICE_ROLE_LABELS: Record<(typeof SERVICE_ROLES)[number], string> = {
  preach: "Preach",
  teach: "Teach / Workshop",
  keynote: "Keynote address",
  officiate: "Officiate",
  panel: "Panel or Q&A",
  greetings: "Bring greetings",
  other: "Other",
};

export const TRAVEL_ARRANGEMENTS = ["host_arranges", "bishop_arranges", "not_required"] as const;

export const TRAVEL_LABELS: Record<(typeof TRAVEL_ARRANGEMENTS)[number], string> = {
  host_arranges: "The inviting church will arrange and cover travel",
  bishop_arranges: "Please have the Bishop's office arrange travel (invoiced to us)",
  not_required: "No travel required — this is local",
};

// ---------------------------------------------------------------------------
// Public submission schema (the 5-step form)
// ---------------------------------------------------------------------------

const requiredText = (label: string, max = 200) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`);

const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

/**
 * Sunday is blocked here, in the DB trigger, and nowhere else. Doing it in one
 * place only would let the other path through — the form can be bypassed by
 * posting straight at the function, and the trigger fires too late to give the
 * visitor a useful message.
 */
export const isSunday = (isoDate: string) => {
  // Parse as local calendar date. `new Date("2026-08-16")` is parsed as UTC and
  // reports the wrong weekday for anyone west of Greenwich.
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return false;
  return new Date(y, m - 1, d).getDay() === 0;
};

export const step1ChurchSchema = z.object({
  church_name: requiredText("Church name"),
  pastor_name: requiredText("Pastor's name"),
  church_website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || /^https?:\/\/.+/i.test(v), "Enter a full URL, including https://"),
  church_address: requiredText("Church address", 300),
  church_city: requiredText("City", 120),
  church_state: requiredText("State", 60),
  church_postal_code: requiredText("ZIP / postal code", 20),
  affiliation: optionalText(200),
});

export const step2ContactSchema = z.object({
  contact_name: requiredText("Contact name"),
  contact_role: optionalText(120),
  contact_email: z
    .string({ required_error: "An email address is required", invalid_type_error: "An email address is required" })
    .trim()
    .email("Enter a valid email address")
    .max(255),
  contact_phone: requiredText("Contact phone", 40),
  preferred_contact_method: z.enum(["email", "phone", "either"]).default("either"),
});

export const step3EventSchema = z
  .object({
    event_type: z.enum(EVENT_TYPES, { required_error: "Choose an event type", invalid_type_error: "Choose an event type" }),
    event_type_other: optionalText(160),
    event_name: requiredText("Event name", 250),
    service_role: z.enum(SERVICE_ROLES, { required_error: "Choose a role", invalid_type_error: "Choose a role" }),
    service_role_other: optionalText(160),
    event_date: z
      .string({ required_error: "Choose a date", invalid_type_error: "Choose a date" })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    event_end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    start_time: z
      .string({ required_error: "Choose a start time", invalid_type_error: "Choose a start time" })
      .regex(/^\d{2}:\d{2}$/, "Choose a start time"),
    expected_attendance: z.coerce.number().int().min(0).max(1000000).optional(),
    venue_name: optionalText(200),
    venue_address: optionalText(300),
    theme: optionalText(300),
  })
  .refine((v) => !isSunday(v.event_date), {
    path: ["event_date"],
    message:
      "The Bishop is with his own congregation on Sundays. Please choose another day of the week.",
  })
  .refine((v) => v.event_type !== "other" || !!v.event_type_other, {
    path: ["event_type_other"],
    message: "Tell us what kind of event this is",
  })
  .refine((v) => v.service_role !== "other" || !!v.service_role_other, {
    path: ["service_role_other"],
    message: "Tell us what you are asking the Bishop to do",
  })
  .refine((v) => !v.event_end_date || v.event_end_date >= v.event_date, {
    path: ["event_end_date"],
    message: "The end date cannot be before the start date",
  });

export const step4LogisticsSchema = z.object({
  travel_arrangement: z.enum(TRAVEL_ARRANGEMENTS),
  nearest_airport: optionalText(120),
  accommodation_notes: optionalText(2000),
  armor_bearer_count: z.coerce.number().int().min(0).max(20).default(0),
  honorarium_notes: optionalText(2000),
});

export const step5ReviewSchema = z.object({
  additional_notes: optionalText(4000),
  /** Consent is recorded because the desk emails the contact about the request. */
  consent_to_contact: z.literal(true, {
    errorMap: () => ({ message: "Please confirm we may contact you about this request" }),
  }),
  /** Honeypot. Real people never see this field; bots fill it in. */
  website_url: z.string().max(0).optional().or(z.literal("")),
});

export const bookingSubmissionSchema = step1ChurchSchema
  .merge(step2ContactSchema)
  .merge(step4LogisticsSchema)
  .merge(step5ReviewSchema)
  .and(step3EventSchema);

export type BookingSubmission = z.infer<typeof bookingSubmissionSchema>;

/** The steps, in order, with the schema that gates leaving each one. */
export const FORM_STEPS = [
  { id: 1, title: "Your Church", schema: step1ChurchSchema },
  { id: 2, title: "Contact", schema: step2ContactSchema },
  { id: 3, title: "The Event", schema: step3EventSchema },
  { id: 4, title: "Travel & Logistics", schema: step4LogisticsSchema },
  { id: 5, title: "Review & Send", schema: step5ReviewSchema },
] as const;

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------
//
// Derived from the generated schema rather than hand-written. These were
// maintained by hand while the migration was unapplied and `supabase gen types`
// could not run; the first regeneration immediately caught a mismatch
// (request_number was nullable in the database but non-null here). Deriving them
// makes that class of drift impossible.

type Tables = Database["public"]["Tables"];

export type BookingRequest = Tables["bishop_booking_requests"]["Row"];
export type BookingNote = Tables["bishop_booking_notes"]["Row"];
export type BookingActivity = Tables["bishop_booking_activity"]["Row"];
export type BookingAttachment = Tables["bishop_booking_attachments"]["Row"];
export type PublicSettings = Tables["bishop_booking_public_settings"]["Row"];
export type InternalSettings = Tables["bishop_booking_internal_settings"]["Row"];
export type DeskUser = Tables["bishop_booking_authorized_users"]["Row"];

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export function isUpcoming(r: Pick<BookingRequest, "status" | "event_date">, today = new Date()) {
  if (r.status !== "accepted") return false;
  const [y, m, d] = r.event_date.split("-").map(Number);
  return new Date(y, m - 1, d) >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export function bucketCounts(rows: Pick<BookingRequest, "status" | "event_date">[]) {
  const counts = Object.fromEntries(SUMMARY_BUCKETS.map((b) => [b, 0])) as Record<
    SummaryBucket,
    number
  >;
  for (const r of rows) {
    if (r.status in counts) counts[r.status as SummaryBucket] += 1;
    if (isUpcoming(r)) counts.upcoming += 1;
  }
  return counts;
}

export function formatEventWhen(r: Pick<BookingRequest, "event_date" | "event_end_date" | "start_time">) {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  const time = (() => {
    const [h, min] = r.start_time.split(":").map(Number);
    const dt = new Date(2000, 0, 1, h, min);
    return dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  })();
  return r.event_end_date && r.event_end_date !== r.event_date
    ? `${fmt(r.event_date)} – ${fmt(r.event_end_date)} · ${time}`
    : `${fmt(r.event_date)} · ${time}`;
}

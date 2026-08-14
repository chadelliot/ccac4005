import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { functionsBase, anonKey } from "@/lib/bishopDb";
import { HostCourtesies } from "@/components/bishop/HostCourtesies";
import {
  FORM_STEPS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  SERVICE_ROLES,
  SERVICE_ROLE_LABELS,
  TRAVEL_ARRANGEMENTS,
  TRAVEL_LABELS,
  APPAREL,
  APPAREL_LABELS,
  type PublicSettings,
} from "@/lib/bishopBooking";

type Values = Record<string, string | number | boolean | undefined>;
type Errors = Record<string, string>;

const INITIAL: Values = {
  preferred_contact_method: "either",
  travel_arrangement: "host_arranges",
  armor_bearer_count: 0,
  consent_to_contact: false,
  website_url: "",
};

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "result"; available: boolean | null; message: string };

/**
 * Three steps, not five.
 *
 * Required fields are exactly those the paper "Host Ministry Information" sheet
 * asked for — that sheet is what this replaces, and the office ran on it for
 * years. Everything the web form added on top is optional, so a host can send a
 * request in one sitting without hunting for a flight number they have not
 * booked yet.
 */
export function InviteBishopForm({
  settings,
  onSubmitted,
}: {
  settings: PublicSettings | null;
  /** Lets the page drop the pre-submission sidebar once the request is in. */
  onSubmitted?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Values>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [availability, setAvailability] = useState<Availability>({ state: "idle" });
  const headingRef = useRef<HTMLHeadingElement>(null);

  const set = (name: string, value: Values[string]) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: "" } : e));
  };

  // Moving between steps swaps the whole panel. Without moving focus, a screen
  // reader stays on the button that is no longer there and never announces the
  // new step.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const current = FORM_STEPS.find((s) => s.id === step)!;

  const validateStep = (): boolean => {
    const result = (current.schema as z.ZodTypeAny).safeParse(values);
    if (result.success) {
      setErrors({});
      return true;
    }
    const next: Errors = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!next[key]) next[key] = issue.message;
    }
    setErrors(next);
    return false;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(FORM_STEPS.length, s + 1));
  };
  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  };

  // Availability is advisory. A busy date does not block submission — the desk
  // may still want the request — so this only ever renders a note.
  const checkAvailability = async (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !functionsBase()) return;
    setAvailability({ state: "checking" });
    try {
      const res = await fetch(`${functionsBase()}/bishop-availability?date=${date}`, {
        headers: { apikey: anonKey() },
      });
      const data = await res.json();
      setAvailability({
        state: "result",
        available: data.available ?? null,
        message: data.message ?? "",
      });
    } catch {
      setAvailability({ state: "idle" });
    }
  };

  const submit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${functionsBase()}/bishop-booking-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey() },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data?.error ?? "We could not send your request. Please try again.");
        return;
      }
      setSent(true);
      onSubmitted?.();
    } catch {
      setSubmitError("We could not reach the church's server. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="border border-border bg-card p-6 sm:p-10 lg:p-12">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="h-9 w-9 shrink-0 text-gold-deep" />
          <div className="min-w-0">
            <h2 className="font-display text-3xl lg:text-4xl leading-tight">
              Your invitation is with us.
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed max-w-2xl">
              {settings?.response_time_note?.trim() ||
                "The Bishop's office will review your request and be in touch."}{" "}
              This is an acknowledgement of receipt, not a confirmation — the engagement is
              confirmed only when the office tells you so directly.
            </p>
          </div>
        </div>

        <HostCourtesies />
      </div>
    );
  }

  return (
    <div className="border border-border bg-card">
      <Stepper step={step} />

      <div className="p-6 lg:p-10">
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl lg:text-3xl outline-none">
          {current.title}
        </h2>

        <div className="mt-8 space-y-6">
          {step === 1 && (
            <>
              <Field label="Church name" name="church_name" errors={errors} required>
                <Input value={str(values.church_name)} onChange={(e) => set("church_name", e.target.value)} />
              </Field>
              <Field label="Pastor's name" name="pastor_name" errors={errors} required>
                <Input value={str(values.pastor_name)} onChange={(e) => set("pastor_name", e.target.value)} />
              </Field>
              <div className="grid gap-6 sm:grid-cols-3">
                <Field label="City" name="church_city" errors={errors} required>
                  <Input value={str(values.church_city)} onChange={(e) => set("church_city", e.target.value)} />
                </Field>
                <Field label="State" name="church_state" errors={errors} required>
                  <Input value={str(values.church_state)} onChange={(e) => set("church_state", e.target.value)} />
                </Field>
                <Field label="ZIP" name="church_postal_code" errors={errors} required>
                  <Input value={str(values.church_postal_code)} onChange={(e) => set("church_postal_code", e.target.value)} />
                </Field>
              </div>
              <Field label="Street address" name="church_address" errors={errors} hint="Optional">
                <Input value={str(values.church_address)} onChange={(e) => set("church_address", e.target.value)} />
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Church website" name="church_website" errors={errors} hint="Optional">
                  <Input
                    placeholder="https://"
                    value={str(values.church_website)}
                    onChange={(e) => set("church_website", e.target.value)}
                  />
                </Field>
                <Field label="Organisation or fellowship" name="affiliation" errors={errors} hint="Optional">
                  <Input value={str(values.affiliation)} onChange={(e) => set("affiliation", e.target.value)} />
                </Field>
              </div>

              <div className="!mt-10 border-t border-border pt-8 space-y-6">
                <div className="eyebrow text-[10px] text-gold-deep">Who should we speak to?</div>
                <Field label="Your name" name="contact_name" errors={errors} required>
                  <Input value={str(values.contact_name)} onChange={(e) => set("contact_name", e.target.value)} />
                </Field>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Email" name="contact_email" errors={errors} required>
                    <Input type="email" value={str(values.contact_email)} onChange={(e) => set("contact_email", e.target.value)} />
                  </Field>
                  <Field label="Phone" name="contact_phone" errors={errors} required>
                    <Input type="tel" value={str(values.contact_phone)} onChange={(e) => set("contact_phone", e.target.value)} />
                  </Field>
                </div>
                <Field label="Your role" name="contact_role" errors={errors} hint="Optional">
                  <Input
                    placeholder="Armor bearer, secretary, event chair…"
                    value={str(values.contact_role)}
                    onChange={(e) => set("contact_role", e.target.value)}
                  />
                </Field>
                <Field label="Best way to reach you" name="preferred_contact_method" errors={errors}>
                  <Radios
                    name="preferred_contact_method"
                    value={str(values.preferred_contact_method)}
                    onChange={(v) => set("preferred_contact_method", v)}
                    options={[
                      { value: "either", label: "Either is fine" },
                      { value: "email", label: "Email" },
                      { value: "phone", label: "Phone" },
                    ]}
                  />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Kind of event" name="event_type" errors={errors} required>
                  <Select value={str(values.event_type)} onChange={(v) => set("event_type", v)}>
                    <option value="">Choose…</option>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
                    ))}
                  </Select>
                </Field>
                {values.event_type === "other" ? (
                  <Field label="Tell us what kind" name="event_type_other" errors={errors} required>
                    <Input value={str(values.event_type_other)} onChange={(e) => set("event_type_other", e.target.value)} />
                  </Field>
                ) : (
                  <div />
                )}
              </div>

              <Field label="Event name" name="event_name" errors={errors} required>
                <Input
                  placeholder="52nd Church Anniversary"
                  value={str(values.event_name)}
                  onChange={(e) => set("event_name", e.target.value)}
                />
              </Field>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="What are you asking the Bishop to do?" name="service_role" errors={errors} required>
                  <Select value={str(values.service_role)} onChange={(v) => set("service_role", v)}>
                    <option value="">Choose…</option>
                    {SERVICE_ROLES.map((r) => (
                      <option key={r} value={r}>{SERVICE_ROLE_LABELS[r]}</option>
                    ))}
                  </Select>
                </Field>
                {values.service_role === "other" ? (
                  <Field label="Please describe" name="service_role_other" errors={errors} required>
                    <Input value={str(values.service_role_other)} onChange={(e) => set("service_role_other", e.target.value)} />
                  </Field>
                ) : (
                  <div />
                )}
              </div>

              {/* On the paper sheet, and asked for in the courtesies — the Bishop
                  requests a briefing on proper attire for ministry. */}
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Expected attire" name="apparel" errors={errors} required>
                  <Select value={str(values.apparel)} onChange={(v) => set("apparel", v)}>
                    <option value="">Choose…</option>
                    {APPAREL.map((a) => (
                      <option key={a} value={a}>{APPAREL_LABELS[a]}</option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Attire notes"
                  name="apparel_notes"
                  errors={errors}
                  hint={values.apparel === "other" ? undefined : "Optional"}
                >
                  <Input value={str(values.apparel_notes)} onChange={(e) => set("apparel_notes", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                <Field label="Date" name="event_date" errors={errors} required>
                  <Input
                    type="date"
                    value={str(values.event_date)}
                    onChange={(e) => {
                      set("event_date", e.target.value);
                      setAvailability({ state: "idle" });
                    }}
                    onBlur={(e) => checkAvailability(e.target.value)}
                  />
                </Field>
                <Field label="End date" name="event_end_date" errors={errors} hint="Multi-day only">
                  <Input type="date" value={str(values.event_end_date)} onChange={(e) => set("event_end_date", e.target.value)} />
                </Field>
                <Field label="Start time" name="start_time" errors={errors} required>
                  <Input type="time" value={str(values.start_time)} onChange={(e) => set("start_time", e.target.value)} />
                </Field>
              </div>

              <AvailabilityNote availability={availability} />

              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Expected attendance" name="expected_attendance" errors={errors} hint="Optional">
                  <Input
                    type="number"
                    min={0}
                    value={str(values.expected_attendance)}
                    onChange={(e) => set("expected_attendance", e.target.value)}
                  />
                </Field>
                <Field label="Theme" name="theme" errors={errors} hint="Optional">
                  <Input value={str(values.theme)} onChange={(e) => set("theme", e.target.value)} />
                </Field>
              </div>
              <Field label="Venue" name="venue_name" errors={errors} hint="Optional — if not at your church">
                <Input value={str(values.venue_name)} onChange={(e) => set("venue_name", e.target.value)} />
              </Field>
              <Field label="Venue address" name="venue_address" errors={errors} hint="Optional">
                <Input value={str(values.venue_address)} onChange={(e) => set("venue_address", e.target.value)} />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                None of this is required. If arrangements are not made yet, send the request and
                the office will follow up.
              </p>

              <Field label="Travel" name="travel_arrangement" errors={errors}>
                <Radios
                  name="travel_arrangement"
                  value={str(values.travel_arrangement)}
                  onChange={(v) => set("travel_arrangement", v)}
                  options={TRAVEL_ARRANGEMENTS.map((t) => ({ value: t, label: TRAVEL_LABELS[t] }))}
                />
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Nearest airport" name="nearest_airport" errors={errors} hint="Optional">
                  <Input placeholder="BWI, DCA…" value={str(values.nearest_airport)} onChange={(e) => set("nearest_airport", e.target.value)} />
                </Field>
                <Field label="Travelling party" name="armor_bearer_count" errors={errors} hint="Besides the Bishop">
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={str(values.armor_bearer_count)}
                    onChange={(e) => set("armor_bearer_count", e.target.value)}
                  />
                </Field>
              </div>
              <Field
                label="Accommodation"
                name="accommodation_notes"
                errors={errors}
                hint={settings?.accommodation_policy?.trim() ? undefined : "Optional"}
              >
                {settings?.accommodation_policy?.trim() && (
                  <p className="mb-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {settings.accommodation_policy}
                  </p>
                )}
                <Textarea
                  rows={3}
                  placeholder="Hotel, or what you are able to provide"
                  value={str(values.accommodation_notes)}
                  onChange={(e) => set("accommodation_notes", e.target.value)}
                />
              </Field>
              <Field
                label="Honorarium"
                name="honorarium_notes"
                errors={errors}
                hint={settings?.honorarium_policy?.trim() ? undefined : "Optional"}
              >
                {settings?.honorarium_policy?.trim() && (
                  <p className="mb-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {settings.honorarium_policy}
                  </p>
                )}
                <Textarea
                  rows={3}
                  value={str(values.honorarium_notes)}
                  onChange={(e) => set("honorarium_notes", e.target.value)}
                />
              </Field>
              <Field label="Anything else the Bishop should know?" name="additional_notes" errors={errors} hint="Optional">
                <Textarea rows={4} value={str(values.additional_notes)} onChange={(e) => set("additional_notes", e.target.value)} />
              </Field>

              <Summary values={values} />

              {/* Honeypot: off-screen rather than display:none, which some bots
                  now detect and skip. Never announced, never tab-reachable. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="website_url">Leave this field empty</label>
                <input
                  id="website_url"
                  name="website_url"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={str(values.website_url)}
                  onChange={(e) => set("website_url", e.target.value)}
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={values.consent_to_contact === true}
                  onCheckedChange={(c) => set("consent_to_contact", c === true)}
                  className="mt-1"
                />
                <span className="text-sm text-muted-foreground leading-relaxed">
                  You may contact me by email or phone about this invitation.
                </span>
              </label>
              {errors.consent_to_contact && (
                <p className="text-sm text-live">{errors.consent_to_contact}</p>
              )}

              {submitError && (
                <div className="border border-live/40 bg-live/5 px-4 py-3 text-sm text-foreground flex gap-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-live" />
                  <span>{submitError}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between gap-4 border-t border-border pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={step === 1 || submitting}
            className="eyebrow"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          {step < FORM_STEPS.length ? (
            <Button type="button" onClick={goNext} className="bg-night text-night-foreground hover:bg-night/90 rounded-none px-8 eyebrow">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="bg-gold text-gold-foreground hover:bg-gold/90 rounded-none px-8 eyebrow"
            >
              {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>) : "Send Invitation"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap border-b border-border">
      {FORM_STEPS.map((s) => {
        const done = s.id < step;
        const active = s.id === step;
        return (
          <li
            key={s.id}
            aria-current={active ? "step" : undefined}
            className={`flex-1 min-w-[9rem] px-4 py-4 border-r border-border last:border-r-0 ${
              active ? "bg-night text-night-foreground" : done ? "bg-secondary" : ""
            }`}
          >
            <div className={`eyebrow text-[10px] ${active ? "text-gold" : "text-muted-foreground"}`}>
              Step {s.id} of {FORM_STEPS.length}
            </div>
            <div className={`mt-1 text-sm ${active ? "" : done ? "text-foreground" : "text-muted-foreground"}`}>
              {s.title}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  label, name, errors, required, hint, children,
}: {
  label: string; name: string; errors: Errors; required?: boolean; hint?: string;
  children: React.ReactNode;
}) {
  const error = errors[name];
  return (
    <div>
      <Label htmlFor={name} className="eyebrow text-[10px] text-muted-foreground">
        {label}
        {required && <span className="text-live"> *</span>}
        {hint && <span className="normal-case tracking-normal text-muted-foreground/70"> — {hint}</span>}
      </Label>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-2 text-sm text-live">{error}</p>}
    </div>
  );
}

/** Native select, styled to match Input — the Radix Select is overkill here and
 *  loses the mobile OS picker, which matters on a form filled out on a phone. */
function Select({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
    >
      {children}
    </select>
  );
}

function Radios({
  name, value, onChange, options,
}: {
  name: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <label key={o.value} className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mt-1 accent-[oklch(0.52_0.14_75)]"
          />
          <span className="text-sm leading-relaxed">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function AvailabilityNote({ availability }: { availability: Availability }) {
  if (availability.state === "idle") return null;
  if (availability.state === "checking") {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the Bishop's calendar…
      </p>
    );
  }
  const { available, message } = availability;
  const tone =
    available === true
      ? "border-gold-deep/30 bg-gold/10"
      : available === false
        ? "border-live/40 bg-live/5"
        : "border-border bg-secondary";
  return <div className={`border px-4 py-3 text-sm text-foreground ${tone}`}>{message}</div>;
}

function Summary({ values }: { values: Values }) {
  const rows = useMemo(
    () =>
      [
        ["Church", values.church_name],
        ["Pastor", values.pastor_name],
        ["Where", [values.church_city, values.church_state].filter(Boolean).join(", ")],
        ["Contact", values.contact_name],
        ["Email", values.contact_email],
        ["Phone", values.contact_phone],
        ["Event", values.event_name],
        ["Date", values.event_date],
        ["Start", values.start_time],
      ].filter(([, v]) => v !== undefined && v !== ""),
    [values],
  );

  return (
    <div className="border border-border bg-secondary p-5">
      <div className="eyebrow text-[10px] text-muted-foreground mb-4">Please check these details</div>
      <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={String(k)} className="flex gap-3 text-sm">
            <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
            <dd className="min-w-0 break-words">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const str = (v: Values[string]): string => (v === undefined || v === null ? "" : String(v));

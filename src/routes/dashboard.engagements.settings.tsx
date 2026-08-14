import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { InternalSettings, PublicSettings } from "@/lib/bishopBooking";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/engagements/settings")({
  component: BishopSettings,
});

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function BishopSettings() {
  const [pub, setPub] = useState<PublicSettings | null>(null);
  const [internal, setInternal] = useState<InternalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"public" | "internal" | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("bishop_booking_public_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("bishop_booking_internal_settings").select("*").eq("id", 1).maybeSingle(),
    ]).then(([p, i]) => {
      if (!active) return;
      setPub(p.data ?? null);
      setInternal(i.data ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const savePublic = async () => {
    if (!pub) return;
    setSaving("public");
    const { id: _id, updated_at: _u, ...patch } = pub;
    const { error } = await supabase
      .from("bishop_booking_public_settings")
      .update(patch)
      .eq("id", 1);
    setSaving(null);
    error ? toast.error(`Could not save: ${error.message}`) : toast.success("Public settings saved.");
  };

  const saveInternal = async () => {
    if (!internal) return;
    setSaving("internal");
    const { id: _id, updated_at: _u, ...patch } = internal;
    const { error } = await supabase
      .from("bishop_booking_internal_settings")
      .update(patch)
      .eq("id", 1);
    setSaving(null);
    error ? toast.error(`Could not save: ${error.message}`) : toast.success("Internal settings saved.");
  };

  if (loading) {
    return <div className="px-6 lg:px-10 py-12 eyebrow text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-12 max-w-4xl">
      <div className="eyebrow text-gold-deep">— Bishop's Desk</div>
      <h1 className="font-display text-4xl lg:text-5xl mt-2">Settings</h1>

      <div className="mt-6 border border-gold-deep/30 bg-gold/10 p-4 flex gap-3 text-sm">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-gold-deep" />
        <p className="leading-relaxed">
          The policy fields below start empty on purpose. Whatever is entered here is what visiting
          churches read on the invitation page and receive in the acceptance email — so a
          placeholder left in by mistake would go out as though it were policy.
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      <section className="mt-10">
        <h2 className="font-display text-2xl">Public — shown on the invitation page</h2>

        <div className="mt-6 space-y-6 border border-border bg-card p-6">
          <FieldRow label="Accepting requests">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={pub?.accepting_requests ?? true}
                onCheckedChange={(c) =>
                  setPub((s) => (s ? { ...s, accepting_requests: c === true } : s))
                }
              />
              <span className="text-sm text-muted-foreground">
                When unticked, the form is replaced with a closed notice.
              </span>
            </label>
          </FieldRow>

          <FieldRow label="Page heading">
            <Input
              value={pub?.intro_heading ?? ""}
              onChange={(e) => setPub((s) => (s ? { ...s, intro_heading: e.target.value } : s))}
            />
          </FieldRow>

          <FieldRow label="Introduction">
            <Textarea
              rows={4}
              value={pub?.intro_body ?? ""}
              onChange={(e) => setPub((s) => (s ? { ...s, intro_body: e.target.value } : s))}
            />
          </FieldRow>

          <FieldRow label="Notice required (days)" hint="Requests closer than this are refused.">
            <Input
              type="number"
              min={0}
              className="max-w-32"
              value={pub?.lead_time_days ?? 30}
              onChange={(e) =>
                setPub((s) => (s ? { ...s, lead_time_days: Number(e.target.value) || 0 } : s))
              }
            />
          </FieldRow>

          <FieldRow
            label="Days closed"
            hint="Sunday is closed because the Bishop is with his own congregation. Unticking it here removes that protection everywhere — the form, the API and the database trigger all read this list."
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEEKDAYS.map((d, i) => {
                const on = (pub?.blocked_weekdays ?? []).includes(i);
                return (
                  <label key={d} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={on}
                      onCheckedChange={(c) =>
                        setPub((s) => {
                          if (!s) return s;
                          const next = new Set(s.blocked_weekdays ?? []);
                          c === true ? next.add(i) : next.delete(i);
                          return { ...s, blocked_weekdays: [...next].sort() };
                        })
                      }
                    />
                    {d}
                  </label>
                );
              })}
            </div>
          </FieldRow>

          <FieldRow label="Accommodation policy">
            <Textarea
              rows={4}
              value={pub?.accommodation_policy ?? ""}
              onChange={(e) =>
                setPub((s) => (s ? { ...s, accommodation_policy: e.target.value } : s))
              }
            />
          </FieldRow>

          <FieldRow label="Travel policy">
            <Textarea
              rows={4}
              value={pub?.travel_policy ?? ""}
              onChange={(e) => setPub((s) => (s ? { ...s, travel_policy: e.target.value } : s))}
            />
          </FieldRow>

          <FieldRow label="Honorarium policy">
            <Textarea
              rows={4}
              value={pub?.honorarium_policy ?? ""}
              onChange={(e) => setPub((s) => (s ? { ...s, honorarium_policy: e.target.value } : s))}
            />
          </FieldRow>

          <FieldRow label="Response time note" hint="Shown after a request is sent.">
            <Textarea
              rows={2}
              value={pub?.response_time_note ?? ""}
              onChange={(e) => setPub((s) => (s ? { ...s, response_time_note: e.target.value } : s))}
            />
          </FieldRow>

          <Button
            onClick={savePublic}
            disabled={saving !== null}
            className="rounded-none eyebrow bg-night text-night-foreground hover:bg-night/90"
          >
            {saving === "public" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save public settings
          </Button>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mt-12">
        <h2 className="font-display text-2xl">Internal — the desk only</h2>

        <div className="mt-6 space-y-6 border border-border bg-card p-6">
          <FieldRow label="Secretary name">
            <Input
              value={internal?.secretary_name ?? ""}
              onChange={(e) =>
                setInternal((s) => (s ? { ...s, secretary_name: e.target.value } : s))
              }
            />
          </FieldRow>

          <FieldRow label="Secretary email" hint="Used as the reply-to on emails to churches.">
            <Input
              type="email"
              value={internal?.secretary_email ?? ""}
              onChange={(e) =>
                setInternal((s) => (s ? { ...s, secretary_email: e.target.value } : s))
              }
            />
          </FieldRow>

          <FieldRow label="Bishop email">
            <Input
              type="email"
              value={internal?.bishop_email ?? ""}
              onChange={(e) => setInternal((s) => (s ? { ...s, bishop_email: e.target.value } : s))}
            />
          </FieldRow>

          <FieldRow
            label="Notify on new requests"
            hint="One address per line. Everyone here is emailed when an invitation arrives."
          >
            <Textarea
              rows={3}
              value={(internal?.notification_emails ?? []).join("\n")}
              onChange={(e) =>
                setInternal((s) =>
                  s
                    ? {
                        ...s,
                        notification_emails: e.target.value
                          .split("\n")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      }
                    : s,
                )
              }
            />
          </FieldRow>

          <FieldRow
            label="Calendar ID"
            hint="Leave blank to use the GOOGLE_CALENDAR_ID secret. A dedicated engagements calendar is better than a personal one — availability treats every entry on it as busy."
          >
            <Input
              value={internal?.calendar_id ?? ""}
              onChange={(e) => setInternal((s) => (s ? { ...s, calendar_id: e.target.value } : s))}
            />
          </FieldRow>

          <FieldRow label="Tentative hold (days)">
            <Input
              type="number"
              min={0}
              className="max-w-32"
              value={internal?.tentative_hold_days ?? 14}
              onChange={(e) =>
                setInternal((s) =>
                  s ? { ...s, tentative_hold_days: Number(e.target.value) || 0 } : s,
                )
              }
            />
          </FieldRow>

          <FieldRow label="Auto-acknowledge">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={internal?.auto_acknowledge ?? true}
                onCheckedChange={(c) =>
                  setInternal((s) => (s ? { ...s, auto_acknowledge: c === true } : s))
                }
              />
              <span className="text-sm text-muted-foreground">
                Email the church a receipt as soon as their request arrives.
              </span>
            </label>
          </FieldRow>

          <Button
            onClick={saveInternal}
            disabled={saving !== null}
            className="rounded-none eyebrow bg-night text-night-foreground hover:bg-night/90"
          >
            {saving === "internal" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save internal settings
          </Button>
        </div>
      </section>
    </div>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="eyebrow text-[10px] text-muted-foreground">{label}</Label>
      {hint && <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

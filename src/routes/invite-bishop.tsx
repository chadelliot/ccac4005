import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";
import { InviteBishopForm } from "@/components/bishop/InviteBishopForm";
import { bishopDb } from "@/lib/bishopDb";
import type { PublicSettings } from "@/lib/bishopBooking";

export const Route = createFileRoute("/invite-bishop")({
  head: () => ({
    meta: [
      { title: "Invite Bishop Marcus — Christ Cathedral Apostolic Church" },
      {
        name: "description",
        content:
          "Request Bishop Justin O. Marcus for a revival, conference, anniversary or installation. Submit your invitation to the Bishop's office.",
      },
      { property: "og:title", content: "Invite Bishop Justin O. Marcus" },
      {
        property: "og:description",
        content: "Booking details and invitation request for churches inviting Bishop Marcus.",
      },
    ],
  }),
  component: InviteBishopPage,
});

function InviteBishopPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await bishopDb
          .from("bishop_booking_public_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle();
        if (active) setSettings(data ?? null);
      } catch {
        // Settings are decoration around the form, not a precondition for it.
        // If the table is unreachable — not yet migrated, network blip — the
        // page falls back to the built-in copy and the form still works.
        if (active) setSettings(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const closed = settings?.accepting_requests === false;

  return (
    <div className="min-h-screen sand-page text-foreground flex flex-col">
      <PageHero className="pt-32 pb-20">
        <div className="eyebrow text-gold mb-6">— Episcopal Engagements</div>
        <h1 className="display-hero text-5xl lg:text-7xl max-w-4xl">
          {settings?.intro_heading?.trim() || "Invite Bishop Marcus"}
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-night-foreground/70">
          {settings?.intro_body?.trim() ||
            "Bishop Justin O. Marcus receives invitations from churches across the country for revivals, conferences, anniversaries, installations and ordinations. Send the details below and the Bishop's office will be in touch."}
        </p>
      </PageHero>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
            <div>
              {loading ? (
                <div className="border border-border bg-card p-12">
                  <div className="eyebrow text-muted-foreground">Loading…</div>
                </div>
              ) : closed ? (
                <div className="border border-border bg-card p-8 lg:p-12">
                  <h2 className="font-display text-3xl">The calendar is closed just now.</h2>
                  <p className="mt-4 text-muted-foreground leading-relaxed max-w-xl">
                    The Bishop's office is not accepting new engagement requests at this time.
                    Please contact the church office if your invitation is urgent.
                  </p>
                </div>
              ) : (
                <InviteBishopForm settings={settings} />
              )}
            </div>

            <aside className="space-y-4">
              <PolicyCard
                title="Before you begin"
                body={
                  settings?.response_time_note?.trim() ||
                  "Please have your event date, venue and a contact number to hand. The form takes about five minutes."
                }
              />
              {settings && settings.lead_time_days > 0 && (
                <PolicyCard
                  title="Notice required"
                  body={`Invitations need at least ${settings.lead_time_days} days' notice.`}
                />
              )}
              <PolicyCard
                title="Sundays"
                body="Bishop Marcus is with his own congregation at Christ Cathedral on Sundays, so Sunday engagements cannot be accepted."
              />
              {settings?.travel_policy?.trim() && (
                <PolicyCard title="Travel" body={settings.travel_policy} />
              )}
              {settings?.accommodation_policy?.trim() && (
                <PolicyCard title="Accommodation" body={settings.accommodation_policy} />
              )}
              {settings?.honorarium_policy?.trim() && (
                <PolicyCard title="Honorarium" body={settings.honorarium_policy} />
              )}
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function PolicyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-border bg-card p-6">
      <div className="eyebrow text-gold-deep">{title}</div>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{body}</p>
    </div>
  );
}

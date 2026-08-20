import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Video, MessageCircle, Globe, Building2, ExternalLink, Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useCapabilities } from "@/lib/adminCapabilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/services")({
  head: () => ({ meta: [{ title: "Weekly Services — CCAC" }] }),
  component: WeeklyServicesPage,
});

type Platform = "zoom" | "facebook" | "other";

type ServiceRow = {
  id: string;
  title: string;
  day_of_week: number;
  start_time: string;
  location: string | null;
  is_virtual: boolean;
  virtual_platform: Platform | null;
  virtual_link: string | null;
  virtual_note: string | null;
  virtual_until: string | null;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Whether the stored override still applies, rather than merely being set. */
function virtualNow(s: ServiceRow) {
  return s.is_virtual && (!s.virtual_until || new Date(s.virtual_until) > new Date());
}

function prettyTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function WeeklyServicesPage() {
  const { user } = useSession();
  const { has, loading: capLoading } = useCapabilities(user);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ServiceRow | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("weekly_services")
      .select("id,title,day_of_week,start_time,location,is_virtual,virtual_platform,virtual_link,virtual_note,virtual_until")
      .order("sort_order", { ascending: true });
    setServices((data as ServiceRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!capLoading) load();
  }, [capLoading]);

  const backToInPerson = async (s: ServiceRow) => {
    const { error } = await supabase.rpc("clear_virtual_service", { _service_id: s.id });
    if (error) toast.error(error.message);
    else {
      toast.success(`${s.title} is back to meeting in person.`);
      load();
    }
  };

  if (capLoading || loading) return <div className="eyebrow text-muted-foreground">Loading…</div>;

  if (!has("events_review")) {
    return (
      <div className="max-w-lg">
        <div className="eyebrow text-accent mb-3">— Weekly Services</div>
        <h1 className="font-display text-4xl mb-4">Restricted</h1>
        <p className="text-muted-foreground">
          You need the Events permission to change where a service meets. Ask an admin with
          Admin Settings access.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <div className="eyebrow text-accent mb-3">— Weekly Services</div>
        <h1 className="font-display text-5xl">Where We're Meeting</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Standing gatherings. Announce that one is online this week and everyone signed up is
          notified, and the public share page updates so anyone can pass the link on.
        </p>
      </div>

      <div className="space-y-4">
        {services.map((s) => {
          const online = virtualNow(s);
          return (
            <div key={s.id} className="border border-border bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-display text-2xl">{s.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {DAYS[s.day_of_week]}s at {prettyTime(s.start_time)}
                  </div>

                  {online ? (
                    <div className="mt-4 border border-royal/30 bg-royal/5 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-royal">
                        <PlatformIcon platform={s.virtual_platform} />
                        Online this week
                        {s.virtual_platform === "zoom" && " · Zoom"}
                        {s.virtual_platform === "facebook" && " · Facebook group chat"}
                      </div>
                      {s.virtual_note && (
                        <p className="mt-1 text-xs text-muted-foreground">{s.virtual_note}</p>
                      )}
                      {s.virtual_link && <CopyableLink url={s.virtual_link} />}
                      {s.virtual_until && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Clears automatically after{" "}
                          {new Date(s.virtual_until).toLocaleString(undefined, {
                            weekday: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      In person{s.location ? ` · ${s.location}` : ""}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button onClick={() => setActive(s)}>
                    {online ? "Update details" : "Meet online this week"}
                  </Button>
                  {online && (
                    <Button variant="outline" onClick={() => backToInPerson(s)}>
                      Back to in person
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {active && (
        <AnnounceDialog
          service={active}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PlatformIcon({ platform }: { platform: Platform | null }) {
  if (platform === "zoom") return <Video className="h-3.5 w-3.5" />;
  if (platform === "facebook") return <MessageCircle className="h-3.5 w-3.5" />;
  return <Globe className="h-3.5 w-3.5" />;
}

function CopyableLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-sm bg-background px-2 py-1 text-xs">{url}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Copy link"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/**
 * The announce flow, which starts and ends in this app.
 *
 * Zoom is not connected as an integration on purpose. Zoom only lets an
 * unpublished app be installed by users inside the developer's own account, so
 * admins signing in with their own Zoom accounts would need a Marketplace
 * review — and it would then break precisely when someone's plan lapses or a
 * different person hosts. Opening Zoom and pasting the link back costs one
 * paste, works with any account, any host, any week, and cannot break on a
 * Tuesday evening. If that ever changes, OAuth slots in behind this same
 * button without redesigning the flow.
 */
function AnnounceDialog({
  service,
  onClose,
  onDone,
}: {
  service: ServiceRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [platform, setPlatform] = useState<Platform>(service.virtual_platform ?? "zoom");
  const [link, setLink] = useState(service.virtual_link ?? "");
  const [note, setNote] = useState(service.virtual_note ?? "");
  const [saving, setSaving] = useState(false);

  const announce = async () => {
    if (platform === "zoom" && !link.trim()) {
      toast.error("Paste the Zoom link so people can join.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("announce_virtual_service", {
      _service_id: service.id,
      _platform: platform,
      // undefined, not null: these are DEFAULT NULL arguments, and passing an
      // explicit null makes PostgREST send a null rather than omit the arg.
      _link: link.trim() || undefined,
      _note: note.trim() || undefined,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message ?? "Could not announce this.");
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const notified = row?.notified ?? 0;
    toast.success(
      `${service.title} is online this week. ${notified} ${notified === 1 ? "person" : "people"} notified.`,
    );
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{service.title} — meeting online</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Where are we meeting?</Label>
            <div className="grid grid-cols-3 gap-2">
              <PlatformChoice active={platform === "zoom"} onClick={() => setPlatform("zoom")} icon={<Video className="h-4 w-4" />} label="Zoom" />
              <PlatformChoice active={platform === "facebook"} onClick={() => setPlatform("facebook")} icon={<MessageCircle className="h-4 w-4" />} label="Group chat" />
              <PlatformChoice active={platform === "other"} onClick={() => setPlatform("other")} icon={<Globe className="h-4 w-4" />} label="Somewhere else" />
            </div>
          </div>

          {platform === "zoom" && (
            <div className="space-y-2 border border-border bg-secondary/40 p-4">
              <div className="text-sm font-medium">Get your Zoom link</div>
              <p className="text-xs text-muted-foreground">
                Schedule the meeting in your own Zoom account — any account, any host — then copy
                the invite link and paste it below.
              </p>
              <a
                href="https://zoom.us/meeting/schedule"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-royal underline"
              >
                Open Zoom to schedule <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="svc-link">
              {platform === "zoom" ? "Zoom join link" : platform === "facebook" ? "Group chat link" : "Link"}
              {platform !== "zoom" && <span className="ml-1 text-muted-foreground">(optional)</span>}
            </Label>
            <Input
              id="svc-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={platform === "zoom" ? "https://zoom.us/j/…" : "https://…"}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="svc-note">Anything to add? (optional)</Label>
            <Textarea
              id="svc-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Passcode, dial-in number, or a short word to the congregation."
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Everyone signed up is notified, and{" "}
            <span className="font-medium text-foreground">ccacbmore.com/bible-study</span> updates so
            anyone can share it. This clears itself once the service is over.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={announce} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Announce and notify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlatformChoice({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 border px-2 py-3 text-xs transition-colors ${
        active
          ? "border-night bg-night text-night-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

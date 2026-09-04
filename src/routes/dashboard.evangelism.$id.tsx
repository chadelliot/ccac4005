import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Phone, MapPin, Calendar, Trash2, X, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/lib/auth";
import { useCapabilities } from "@/lib/adminCapabilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteContactDialog } from "@/components/evangelism/DeleteContactDialog";
import { ContactActions } from "@/components/evangelism/ContactActions";
import { FocusToggle } from "@/components/evangelism/FocusToggle";
import { WitnessField } from "@/components/evangelism/WitnessField";
import { canEditContact } from "@/lib/contactPermissions";
import { ContactActivityPanel } from "@/components/evangelism/ContactActivityPanel";
import { geocodeAddress as geocodeFn } from "@/lib/evangelismGeocode";
import { STATUS_OPTIONS, statusLabel, type ContactStatus } from "@/lib/contactStatus";

export const Route = createFileRoute("/dashboard/evangelism/$id")({
  head: () => ({ meta: [{ title: "Contact — CCAC" }] }),
  component: ContactDetail,
});

type Contact = {
  id: string;
  added_by: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  where_met: string | null;
  notes: string | null;
  prayer_request: string | null;
  visited: boolean;
  baptized: boolean;
  holy_ghost: boolean;
  gospel_shared: boolean;
  status: string;
  created_at: string;
  met_on: string | null;
  gender: string | null;
  is_focus: boolean;
  witness_id: string | null;
};

type FollowUp = {
  id: string;
  due_date: string;
  touch_number: number;
  completed: boolean;
  completed_at: string | null;
};

const editSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().max(80).nullable(),
  phone: z.string().trim().max(40).nullable(),
  address: z.string().trim().max(200).nullable(),
  where_met: z.string().trim().max(120).nullable(),
  prayer_request: z.string().trim().max(1000).nullable(),
  // The day the soul was actually met. Editable because it gets recorded wrong
  // — typed from memory days later, or copied from the wrong row — and it drives
  // which month the harvest list files them under.
  met_on: z.string().trim().min(1, "Witness date is required"),
  gender: z.enum(["male", "female"]).nullable(),
  status: z.enum(STATUS_OPTIONS),
});

function ContactDetail() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { isAdmin } = useRoles(user);
  const { has } = useCapabilities(user);
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ContactStatus>("new");
  const [gender, setGender] = useState<string>("unknown");
  // Bumped when an outreach is logged so the panel re-reads itself without
  // reloading the contact and follow-ups alongside it.
  const [activityKey, setActivityKey] = useState(0);

  useEffect(() => {
    if (contact) {
      setStatus((contact.status as ContactStatus) ?? "new");
      setGender(contact.gender ?? "unknown");
    }
  }, [contact]);

  const [witnessName, setWitnessName] = useState<string | null>(null);

  const load = async () => {
    const [{ data: c }, { data: f }] = await Promise.all([
      supabase.from("evangelism_contacts").select("*").eq("id", id).maybeSingle(),
      supabase.from("contact_follow_ups").select("*").eq("contact_id", id).order("due_date"),
    ]);
    setContact(c as Contact | null);
    setFollowUps((f ?? []) as FollowUp[]);

    // Looked up by id rather than embedded, so the field shows the current name
    // even when it was changed on another screen a moment ago.
    const wid = (c as Contact | null)?.witness_id ?? null;
    if (wid) {
      const { data: w } = await supabase
        .from("witnesses")
        .select("name")
        .eq("id", wid)
        .maybeSingle();
      setWitnessName(w?.name ?? null);
    } else {
      setWitnessName(null);
    }
  };

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [id]);

  if (!contact) {
    return <div className="eyebrow text-muted-foreground">Loading...</div>;
  }

  const canEdit = user?.id === contact.added_by || isAdmin;

  const updateFlag = async (
    field: "visited" | "baptized" | "holy_ghost" | "gospel_shared",
    value: boolean,
  ) => {
    // Exactly the four flags this sets. Partial<Contact> dragged in every
    // column of the local row type, and Record<string, boolean> is too loose
    // for the generated update type, which rejects excess properties.
    const patch: {
      visited?: boolean;
      baptized?: boolean;
      holy_ghost?: boolean;
      gospel_shared?: boolean;
    } = { [field]: value };
    const { error } = await supabase.from("evangelism_contacts").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    if (contact) setContact({ ...contact, [field]: value });
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = editSchema.safeParse({
      first_name: fd.get("first_name"),
      last_name: (fd.get("last_name") as string) || null,
      phone: (fd.get("phone") as string) || null,
      address: (fd.get("address") as string) || null,
      where_met: (fd.get("where_met") as string) || null,
      prayer_request: (fd.get("prayer_request") as string) || null,
      met_on: fd.get("met_on") as string,
      gender: gender === "unknown" ? null : (gender as "male" | "female"),
      status,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const addressChanged =
      (parsed.data.address ?? null) !== (contact?.address ?? null) ||
      (parsed.data.where_met ?? null) !== (contact?.where_met ?? null);
    // Notes are no longer edited from this form. They are dated entries on the
    // activity timeline now, so the column is not carried here at all — writing
    // it back would overwrite the running account with a stale copy.
    const { error } = await supabase.from("evangelism_contacts").update(parsed.data).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    if (addressChanged) {
      const q = parsed.data.address || parsed.data.where_met;
      if (q) {
        geocodeFn({ data: { query: q } })
          .then(async (r) => {
            if (r.ok && r.latitude != null && r.longitude != null) {
              await supabase
                .from("evangelism_contacts")
                .update({
                  latitude: r.latitude,
                  longitude: r.longitude,
                  city: r.city,
                  region: r.region,
                  country: r.country,
                  geocoded_at: new Date().toISOString(),
                })
                .eq("id", id);
            }
          })
          .catch(() => {});
      }
    }
    load();
  };

  return (
    <div className="max-w-6xl space-y-8">
      <Link
        to="/dashboard/evangelism"
        className="eyebrow text-muted-foreground inline-flex items-center gap-2 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> All Contacts
      </Link>

      {/* Single column until there is genuinely room for two. Below lg the
          aside falls underneath the profile rather than squeezing beside it,
          which is where this page is mostly read — on a phone, outdoors. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-8 min-w-0">
          <div>
            <div className="eyebrow text-accent mb-2">— Profile</div>
            <h1 className="font-display text-5xl">
              {contact.first_name} {contact.last_name}
            </h1>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
              {contact.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {contact.phone}
                </span>
              )}
              {contact.where_met && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {contact.where_met}
                </span>
              )}
              {/* The date they were met, not the date the record was typed. */}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Met {new Date(contact.met_on ?? contact.created_at).toLocaleDateString()}
              </span>
              {/* Correctable here too — the same field the contact list uses. */}
              <span className="flex items-center gap-1">
                <UserCheck className="h-4 w-4" />
                <WitnessField
                  contactId={contact.id}
                  witnessName={witnessName}
                  canEdit={canEditContact(contact.added_by, user?.id, has("evangelism_management"))}
                  onSaved={(name) => setWitnessName(name)}
                />
              </span>
            </div>

            {/* Directly under the name, where a thumb lands: reaching this soul
                is the point of opening their profile. */}
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <ContactActions
                contactId={contact.id}
                phone={contact.phone}
                firstName={contact.first_name}
                status={contact.status}
                onLogged={() => setActivityKey((k) => k + 1)}
              />
              {/* Beside the actions, because deciding to concentrate on someone
                  and reaching out to them are the same moment. */}
              {canEditContact(contact.added_by, user?.id, has("evangelism_management")) && (
                <FocusToggle
                  contactId={contact.id}
                  value={contact.is_focus}
                  withLabel
                  onChange={(next) => setContact({ ...contact, is_focus: next })}
                />
              )}
            </div>
          </div>

          {/* Spiritual journey */}
          <div className="bg-card border border-border p-6">
            <div className="eyebrow text-accent mb-5">— Spiritual Journey</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <FlagRow
                label="Gospel shared"
                value={contact.gospel_shared}
                disabled={!canEdit}
                onChange={(v) => updateFlag("gospel_shared", v)}
              />
              <FlagRow
                label="Visited the church"
                value={contact.visited}
                disabled={!canEdit}
                onChange={(v) => updateFlag("visited", v)}
              />
              <FlagRow
                label="Baptized in Jesus' name"
                value={contact.baptized}
                disabled={!canEdit}
                onChange={(v) => updateFlag("baptized", v)}
              />
              <FlagRow
                label="Filled with the Holy Ghost"
                value={contact.holy_ghost}
                disabled={!canEdit}
                onChange={(v) => updateFlag("holy_ghost", v)}
              />
            </div>
          </div>

          {/* Follow-ups */}
          <div className="bg-card border border-border p-6">
            <div className="eyebrow text-accent mb-5">— Follow-ups</div>
            {followUps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No follow-ups yet. Tick "Set a follow-up" when you add a note to create one.
              </p>
            ) : (
              <div className="space-y-2">
                {followUps.map((f) => (
                  <div
                    key={f.id}
                    className={`flex flex-wrap items-center justify-between gap-3 p-3 border ${f.completed ? "bg-muted border-border opacity-60" : "border-border"}`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium">Follow-up {f.touch_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(f.due_date + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                    {f.completed ? (
                      <Badge variant="secondary">Done</Badge>
                    ) : (
                      canEdit && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            type="date"
                            defaultValue={f.due_date}
                            className="h-8 w-[150px]"
                            onChange={async (e) => {
                              const newDate = e.target.value;
                              if (!newDate || newDate === f.due_date) return;
                              const { error } = await supabase
                                .from("contact_follow_ups")
                                .update({ due_date: newDate })
                                .eq("id", f.id);
                              if (error) return toast.error(error.message);
                              toast.success("Rescheduled");
                              load();
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const { error } = await supabase
                                .from("contact_follow_ups")
                                .update({ completed: true, completed_at: new Date().toISOString() })
                                .eq("id", f.id);
                              if (error) return toast.error(error.message);
                              load();
                            }}
                          >
                            Mark complete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              if (!confirm(`Cancel touch ${f.touch_number}?`)) return;
                              const { error } = await supabase
                                .from("contact_follow_ups")
                                .delete()
                                .eq("id", f.id);
                              if (error) return toast.error(error.message);
                              toast.success("Cancelled");
                              load();
                            }}
                            title="Cancel touch"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit form */}
          {canEdit && (
            <form onSubmit={handleSave} className="bg-card border border-border p-6 space-y-4">
              <div className="eyebrow text-accent mb-2">— Edit Profile</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First name</Label>
                  <Input
                    name="first_name"
                    defaultValue={contact.first_name}
                    required
                    maxLength={80}
                  />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input name="last_name" defaultValue={contact.last_name ?? ""} maxLength={80} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <Input name="phone" defaultValue={contact.phone ?? ""} maxLength={40} />
                </div>
                <div>
                  <Label>Where we met</Label>
                  <Input name="where_met" defaultValue={contact.where_met ?? ""} maxLength={120} />
                </div>
                <div>
                  <Label>Date witnessed</Label>
                  <Input
                    name="met_on"
                    type="date"
                    defaultValue={(contact.met_on ?? contact.created_at).slice(0, 10)}
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input name="address" defaultValue={contact.address ?? ""} maxLength={200} />
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Not recorded is a choice, not a blank — someone met once
                        at a mall door may simply never have been asked. */}
                    <SelectItem value="unknown">Not recorded</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ContactStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prayer request</Label>
                <Textarea
                  name="prayer_request"
                  defaultValue={contact.prayer_request ?? ""}
                  rows={2}
                  maxLength={1000}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={busy}
                  className="bg-night text-night-foreground hover:bg-night/90 rounded-none px-8 eyebrow"
                >
                  {busy ? "Saving..." : "Save Changes"}
                </Button>
                <DeleteContactDialog
                  contactId={id}
                  contactName={`${contact.first_name}${contact.last_name ? " " + contact.last_name : ""}`}
                  onDeleted={() => navigate({ to: "/dashboard/evangelism" })}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 rounded-none"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </form>
          )}
        </div>

        {/* Sticky on a wide screen: the history stays in view while someone
            scrolls the follow-up schedule and decides whether to call. */}
        <aside className="lg:sticky lg:top-6">
          <ContactActivityPanel contactId={contact.id} refreshKey={activityKey} />
        </aside>
      </div>
    </div>
  );
}

function FlagRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between p-4 border border-border rounded-sm cursor-pointer hover:bg-muted/30">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

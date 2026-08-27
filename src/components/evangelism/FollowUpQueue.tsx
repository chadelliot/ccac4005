import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Calendar, ChevronRight, CheckCircle2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContactActions } from "@/components/evangelism/ContactActions";

/**
 * The follow-ups you have committed to, with the note behind each one.
 *
 * Shared by the Follow-ups tab on the Evangelism Overview and by the standalone
 * page the dashboard cards link to, so there is one queue rather than two views
 * disagreeing about what is outstanding.
 *
 * It lists follow-up records — not contacts. The tab used to render every soul
 * in the book with "0/0 touches complete" beside them, which read as eighty-five
 * pending follow-ups when the table in fact held one.
 */
type FollowUpRow = {
  id: string;
  due_date: string;
  touch_number: number;
  completed: boolean;
  contact_id: string;
  activity_id: string | null;
  contact_activity: { note: string | null } | null;
  evangelism_contacts: {
    id: string;
    first_name: string;
    last_name: string | null;
    phone: string | null;
    where_met: string | null;
    status: string | null;
    is_focus: boolean | null;
  } | null;
};

export function FollowUpQueue() {
  const { user } = useSession();
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [filter, setFilter] = useState<"due" | "upcoming" | "done">("due");

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("contact_follow_ups")
      .select(
        "*, evangelism_contacts(id, first_name, last_name, phone, where_met, status, is_focus), contact_activity(note)",
      )
      .eq("assigned_to", user.id)
      .order("due_date");
    if (error) return toast.error(error.message);
    setRows((data ?? []) as FollowUpRow[]);
  };

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [user]);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = rows.filter((r) => {
    if (filter === "done") return r.completed;
    if (filter === "due") return !r.completed && r.due_date <= today;
    return !r.completed && r.due_date > today;
  });

  const markDone = async (id: string) => {
    const { error } = await supabase
      .from("contact_follow_ups")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Follow-up complete — well done!");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <FilterBtn active={filter === "due"} onClick={() => setFilter("due")}>
          Due now
        </FilterBtn>
        <FilterBtn active={filter === "upcoming"} onClick={() => setFilter("upcoming")}>
          Upcoming
        </FilterBtn>
        <FilterBtn active={filter === "done"} onClick={() => setFilter("done")}>
          Completed
        </FilterBtn>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-accent mb-4" />
          <div className="eyebrow text-muted-foreground">All caught up</div>
          <p className="text-sm text-muted-foreground mt-2">Nothing in this view right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Stacked rather than a single row: at iPhone width the name, the due
              date and three labelled buttons cannot share a line, and this page
              is used standing on a doorstep. Marking complete stays a deliberate
              press — texting or calling never completes a touch by itself, since
              a call that went to voicemail is not a follow-up made. */}
          {filtered.map((r) => (
            <div key={r.id} className="bg-card border border-border p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 flex-shrink-0 text-center">
                  <div className="eyebrow text-accent text-[10px]">Due</div>
                  <div className="font-display text-2xl leading-none">
                    {new Date(r.due_date + "T12:00:00").getDate()}
                  </div>
                  <div className="text-[10px] uppercase text-muted-foreground">
                    {new Date(r.due_date + "T12:00:00").toLocaleDateString(undefined, {
                      month: "short",
                    })}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    to="/dashboard/evangelism/$id"
                    params={{ id: r.contact_id }}
                    className="font-display text-xl hover:text-accent inline-flex items-center gap-2"
                  >
                    {/* Marked, not toggleable: this queue is for working the
                        list, and choosing who to concentrate on belongs with
                        the contact itself. */}
                    {r.evangelism_contacts?.is_focus && (
                      <Star className="h-4 w-4 text-accent" fill="currentColor" />
                    )}
                    {r.evangelism_contacts?.first_name} {r.evangelism_contacts?.last_name}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(r.due_date).toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {r.evangelism_contacts?.phone && <span>{r.evangelism_contacts.phone}</span>}
                  </div>
                </div>
                {r.completed && <Badge variant="secondary">Done</Badge>}
              </div>

              {/* Why this follow-up exists. Written when the commitment was
                  made, read on the day it comes due — "Touch 2, due Thursday"
                  tells you to ring someone and nothing about what to say. */}
              {r.contact_activity?.note && (
                <p className="mt-3 border-l-2 border-border pl-3 text-sm text-muted-foreground whitespace-pre-wrap">
                  {r.contact_activity.note}
                </p>
              )}

              <ContactActions
                contactId={r.contact_id}
                phone={r.evangelism_contacts?.phone}
                firstName={r.evangelism_contacts?.first_name}
                status={r.evangelism_contacts?.status}
                size="sm"
                className="mt-4"
              />

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Button asChild size="sm" variant="ghost" className="rounded-none h-8 px-3 text-xs">
                  <Link to="/dashboard/evangelism/$id" params={{ id: r.contact_id }}>
                    View profile
                  </Link>
                </Button>
                {!r.completed && (
                  <Button
                    onClick={() => markDone(r.id)}
                    size="sm"
                    className="bg-night text-night-foreground hover:bg-night/90 rounded-none eyebrow h-8 px-3"
                  >
                    Mark Complete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`eyebrow px-4 py-2 border ${active ? "bg-night text-night-foreground border-night" : "bg-card text-muted-foreground border-border hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

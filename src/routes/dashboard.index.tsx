import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { AdminActionItems } from "@/components/dashboard/AdminActionItems";
import { EvangelismThisWeek } from "@/components/evangelism/EvangelismThisWeek";
import { Users, Bell, Calendar } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

function DashboardOverview() {
  const { user } = useSession();
  const [stats, setStats] = useState({ contacts: 0, dueToday: 0, openTouches: 0 });
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ count: contacts }, { count: dueToday }, { count: openTouches }, { data: prof }] = await Promise.all([
        supabase.from("evangelism_contacts").select("id", { count: "exact", head: true }).eq("added_by", user.id),
        supabase.from("contact_follow_ups").select("id", { count: "exact", head: true }).eq("assigned_to", user.id).eq("completed", false).lte("due_date", today),
        supabase.from("contact_follow_ups").select("id", { count: "exact", head: true }).eq("assigned_to", user.id).eq("completed", false),
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      ]);
      setStats({ contacts: contacts ?? 0, dueToday: dueToday ?? 0, openTouches: openTouches ?? 0 });
      setName(prof?.display_name ?? "");
    })();
  }, [user]);

  return (
    <div className="space-y-10 max-w-6xl">
      <div>
        <div className="eyebrow text-accent mb-3">— Welcome back</div>
        <h1 className="font-display text-5xl">{name || "Member"}</h1>
        <p className="text-muted-foreground mt-3">Here's what's happening in your ministry today.</p>
      </div>

      {/* Above the personal stats on purpose: what is waiting on this admin
          should be the first thing they see, and it renders nothing at all for
          members, or for an admin whose queues happen to be empty. Each row is
          gated on the capability that governs it, so nobody is shown a queue
          they cannot act on. */}
      <AdminActionItems user={user} />

      {/* Above the personal stats and visible to every member, not just admins:
          the point is that evangelism is the first thing anyone sees after
          signing in. Renders nothing until a target is actually set. */}
      <EvangelismThisWeek />

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={<Users />} label="Contacts You've Added" value={stats.contacts} link="/dashboard/evangelism" />
        <StatCard icon={<Bell />} label="Follow-ups Due" value={stats.dueToday} link="/dashboard/follow-ups" highlight={stats.dueToday > 0} />
        <StatCard icon={<Calendar />} label="Open Touches" value={stats.openTouches} link="/dashboard/follow-ups" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Link to="/dashboard/evangelism" className="block bg-night text-night-foreground p-8 hover:bg-night/90 transition-colors">
          <div className="eyebrow text-gold mb-4">— Evangelism</div>
          <div className="font-display text-3xl mb-2">Add a contact</div>
          <p className="text-night-foreground/70 text-sm">Track everyone we meet, and never miss a follow-up.</p>
        </Link>
        <Link to="/dashboard/follow-ups" className="block bg-secondary text-foreground p-8 hover:bg-secondary/80 transition-colors">
          <div className="eyebrow text-accent mb-4">— Today</div>
          <div className="font-display text-3xl mb-2">Your follow-ups</div>
          <p className="text-muted-foreground text-sm">Calls scheduled for Mondays and Thursdays — three touches each.</p>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, link, highlight }: { icon: React.ReactNode; label: string; value: number; link: string; highlight?: boolean }) {
  return (
    <Link to={link as any} className={`block border p-6 transition-colors ${highlight ? "border-accent bg-accent/5" : "border-border bg-card hover:border-foreground/20"}`}>
      <div className={`mb-4 ${highlight ? "text-accent" : "text-muted-foreground"}`}>{icon}</div>
      <div className="font-display text-4xl">{value}</div>
      <div className="eyebrow text-muted-foreground mt-2">{label}</div>
    </Link>
  );
}

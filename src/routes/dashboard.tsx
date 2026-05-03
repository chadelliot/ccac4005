import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession, useRoles } from "@/lib/auth";
import { LayoutDashboard, Users, Bell, ArrowLeft, Calendar, UsersRound } from "lucide-react";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — CCAC" }],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, loading } = useSession();
  const { isAdmin } = useRoles(user);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="eyebrow text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <aside className="lg:w-64 lg:min-h-screen bg-night text-night-foreground p-6 lg:p-8 flex lg:flex-col justify-between gap-6">
        <div>
          <Link to="/" className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 flex items-center justify-center border border-gold/40 text-gold font-display">C</div>
            <div>
              <div className="font-display text-lg leading-none">CCAC</div>
              <div className="eyebrow text-[9px] text-gold/70">Member Portal</div>
            </div>
          </Link>
          <nav className="hidden lg:flex flex-col gap-1">
            <DashLink to="/dashboard" exact icon={<LayoutDashboard className="h-4 w-4" />}>Overview</DashLink>
            <DashLink to="/dashboard/events" icon={<Calendar className="h-4 w-4" />}>Events</DashLink>
            <DashLink to="/dashboard/groups" icon={<UsersRound className="h-4 w-4" />}>Groups</DashLink>
            <DashLink to="/dashboard/evangelism" icon={<Users className="h-4 w-4" />}>Evangelism</DashLink>
            <DashLink to="/dashboard/follow-ups" icon={<Bell className="h-4 w-4" />}>Follow-ups</DashLink>
          </nav>
        </div>
        <div className="hidden lg:block space-y-3">
          {isAdmin && <div className="eyebrow text-gold/70">Admin</div>}
          <div className="text-sm truncate">{user.email}</div>
          <Button onClick={handleSignOut} variant="outline" size="sm" className="w-full border-white/20 bg-transparent text-night-foreground hover:bg-white/10">
            Sign Out
          </Button>
          <Link to="/" className="eyebrow text-night-foreground/60 inline-flex items-center gap-2 hover:text-gold">
            <ArrowLeft className="h-3 w-3" /> Back to site
          </Link>
        </div>
      </aside>

      <main className="flex-1">
        <div className="border-b border-border bg-card px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="lg:hidden flex gap-3 overflow-x-auto">
            <DashLinkPill to="/dashboard" exact>Overview</DashLinkPill>
            <DashLinkPill to="/dashboard/events">Events</DashLinkPill>
            <DashLinkPill to="/dashboard/groups">Groups</DashLinkPill>
            <DashLinkPill to="/dashboard/evangelism">Evangelism</DashLinkPill>
            <DashLinkPill to="/dashboard/follow-ups">Follow-ups</DashLinkPill>
          </div>
          <div className="hidden lg:block" />
          <NotificationsBell />
        </div>
        <div className="p-6 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function DashLink({ to, icon, children, exact }: { to: string; icon: React.ReactNode; children: React.ReactNode; exact?: boolean }) {
  return (
    <Link
      to={to as any}
      activeOptions={{ exact }}
      className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-sm text-night-foreground/70 hover:bg-white/5 hover:text-night-foreground"
      activeProps={{ className: "bg-white/10 text-gold" }}
    >
      {icon}
      {children}
    </Link>
  );
}

function DashLinkPill({ to, children, exact }: { to: string; children: React.ReactNode; exact?: boolean }) {
  return (
    <Link
      to={to as any}
      activeOptions={{ exact }}
      className="px-3 py-1.5 text-xs eyebrow whitespace-nowrap rounded-sm text-muted-foreground"
      activeProps={{ className: "bg-night text-night-foreground" }}
    >
      {children}
    </Link>
  );
}

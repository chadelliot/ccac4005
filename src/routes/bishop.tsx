import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, CalendarCheck, Settings, ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/auth";
import { useBishopDesk } from "@/hooks/useBishopDesk";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bishop")({
  head: () => ({
    meta: [
      { title: "Bishop's Desk — CCAC" },
      // Private correspondence; keep it out of search results even though the
      // data behind it is already protected by RLS.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BishopDeskLayout,
});

function BishopDeskLayout() {
  const { user, loading: sessionLoading } = useSession();
  const desk = useBishopDesk(user);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionLoading && !user) navigate({ to: "/auth" });
  }, [user, sessionLoading, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (sessionLoading || !user || desk.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="eyebrow text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Signed in, but not on the desk roster. Deliberately says the desk exists
  // and they are not on it — the alternative, a 404, sends a legitimate
  // secretary who has simply not been added yet chasing a broken link.
  if (!desk.hasAccess) {
    return (
      <div className="min-h-screen sand-page flex items-center justify-center px-6">
        <div className="max-w-md text-center border border-border bg-card p-10">
          <ShieldAlert className="h-9 w-9 mx-auto text-gold-deep" />
          <h1 className="font-display text-3xl mt-5">The Bishop's Desk</h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            This area is limited to the Bishop and his office. If you should have access, ask a
            church administrator to add you.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">Signed in as {user.email}</p>
          <div className="mt-8 flex flex-col gap-3">
            <Button asChild variant="outline" className="rounded-none">
              <Link to="/dashboard">Go to the member portal</Link>
            </Button>
            <Button asChild variant="ghost" className="eyebrow">
              <Link to="/">Back to the site</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <aside className="lg:w-64 lg:min-h-screen bg-night text-night-foreground p-6 lg:p-8 flex lg:flex-col justify-between gap-6">
        <div>
          <Link to="/" className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 flex items-center justify-center border border-gold/40 text-gold font-display">
              C
            </div>
            <div>
              <div className="font-display text-lg leading-none">CCAC</div>
              <div className="eyebrow text-[9px] text-gold/70">Bishop's Desk</div>
            </div>
          </Link>
          <nav className="hidden lg:flex flex-col gap-1">
            <DeskLink to="/bishop/engagements" icon={<CalendarCheck className="h-4 w-4" />}>
              Engagements
            </DeskLink>
            <DeskLink to="/bishop/settings" icon={<Settings className="h-4 w-4" />}>
              Settings
            </DeskLink>
          </nav>
        </div>
        <div className="hidden lg:block space-y-3">
          {desk.isBishop && <div className="eyebrow text-gold/70">Bishop</div>}
          <div className="text-sm truncate">{desk.displayName || desk.email || user.email}</div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            className="w-full border-white/20 bg-transparent text-night-foreground hover:bg-white/10"
          >
            Sign Out
          </Button>
          <Link to="/" className="eyebrow text-night-foreground/60 inline-flex items-center gap-2 hover:text-gold">
            <ArrowLeft className="h-3 w-3" /> Back to site
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="lg:hidden border-b border-border bg-card px-6 py-4 flex gap-3 overflow-x-auto">
          <DeskPill to="/bishop/engagements">Engagements</DeskPill>
          <DeskPill to="/bishop/settings">Settings</DeskPill>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

function DeskLink({
  to,
  icon,
  children,
}: {
  to: "/bishop/engagements" | "/bishop/settings";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2.5 eyebrow text-night-foreground/70 hover:bg-white/10 hover:text-gold transition-colors"
      activeProps={{ className: "bg-white/10 text-gold" }}
    >
      {icon}
      {children}
    </Link>
  );
}

function DeskPill({
  to,
  children,
}: {
  to: "/bishop/engagements" | "/bishop/settings";
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="eyebrow whitespace-nowrap px-3 py-2 border border-border text-muted-foreground"
      activeProps={{ className: "border-night bg-night text-night-foreground" }}
    >
      {children}
    </Link>
  );
}

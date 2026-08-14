import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/auth";
import { useBishopDesk } from "@/hooks/useBishopDesk";
import { Button } from "@/components/ui/button";

/**
 * The Bishop's Desk, as a tab inside the member portal rather than a separate
 * application at /bishop.
 *
 * The dashboard layout above only checks that someone is signed in — every
 * member reaches it. Desk membership is checked here, and it is a genuinely
 * different trust boundary: reading a visiting church's correspondence and the
 * Bishop's private notes is not something the church's own admin role confers.
 *
 * This gates the UI only. Every table behind it carries its own RLS, so a
 * member who forced past this component would still read nothing.
 */
export const Route = createFileRoute("/dashboard/engagements")({
  component: EngagementsTab,
});

function EngagementsTab() {
  const { user } = useSession();
  const desk = useBishopDesk(user);

  if (desk.loading) {
    return <div className="px-6 lg:px-10 py-12 eyebrow text-muted-foreground">Loading…</div>;
  }

  // Says the desk exists and they are not on it. A 404 would send a secretary
  // who simply has not been added yet chasing a broken link.
  if (!desk.hasAccess) {
    return (
      <div className="px-6 lg:px-10 py-16 flex justify-center">
        <div className="max-w-md text-center border border-border bg-card p-10">
          <ShieldAlert className="h-9 w-9 mx-auto text-gold-deep" />
          <h1 className="font-display text-3xl mt-5">The Bishop's Desk</h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            This area is limited to the Bishop and his office. If you should have access, ask a
            church administrator to add you.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">Signed in as {user?.email}</p>
          <Button asChild variant="outline" className="rounded-none mt-8">
            <Link to="/dashboard">Back to the portal</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-border bg-card px-6 lg:px-10">
        <div className="flex gap-1">
          <TabLink to="/dashboard/engagements" exact>
            Requests
          </TabLink>
          <TabLink to="/dashboard/engagements/settings">Settings</TabLink>
        </div>
      </div>
      <Outlet />
    </div>
  );
}

function TabLink({
  to,
  exact,
  children,
}: {
  to: "/dashboard/engagements" | "/dashboard/engagements/settings";
  exact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="eyebrow px-4 py-4 border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
      activeProps={{ className: "border-gold-deep text-foreground" }}
    >
      {children}
    </Link>
  );
}

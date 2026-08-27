import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useSession } from "@/lib/auth";
import { useCapabilities } from "@/lib/adminCapabilities";

export const Route = createFileRoute("/dashboard/evangelism")({
  component: EvangelismLayout,
});

/**
 * The secondary menu for the Evangelism section.
 *
 * Follow-ups lives here rather than in the main sidebar. It stopped being a
 * standing obligation of its own when the three-touch schedule went — it is
 * now something you set while looking at a soul, so it belongs beside the
 * contacts rather than alongside Events and Finances.
 */
function EvangelismLayout() {
  const { user } = useSession();
  const { has } = useCapabilities(user);

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2">
        {has("evangelism_management") && (
          <SubLink to="/dashboard/evangelism/admin">Executive View</SubLink>
        )}
        <SubLink to="/dashboard/evangelism" exact>
          Contacts
        </SubLink>
        <SubLink to="/dashboard/evangelism/follow-ups">Follow-ups</SubLink>
      </nav>
      <Outlet />
    </div>
  );
}

function SubLink({
  to,
  exact,
  children,
}: {
  to: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact ?? false }}
      className="eyebrow border border-border bg-card px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{
        className:
          "eyebrow border border-night bg-night px-4 py-2 text-xs text-night-foreground transition-colors",
      }}
    >
      {children}
    </Link>
  );
}

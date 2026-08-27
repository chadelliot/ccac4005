import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/evangelism")({
  // No secondary nav here on purpose. The Evangelism Overview already carries
  // Map / All Contacts / Follow-ups / Witnesses as tabs, and a row of pills
  // above them was a second navigation for the same destinations.
  component: () => <Outlet />,
});

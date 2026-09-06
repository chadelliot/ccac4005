import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/planning")({
  // A bare outlet, matching Evangelism. The dashboard carries its own tabs;
  // a second row of navigation above them would be two menus disagreeing
  // about where you are.
  component: () => <Outlet />,
});

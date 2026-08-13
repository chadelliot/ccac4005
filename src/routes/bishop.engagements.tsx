import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pass-through layout. It exists so /bishop/engagements/$requestId nests
// correctly — without an Outlet here the detail route silently renders the
// list instead (the same trap that had /events/<id> showing the events index).
export const Route = createFileRoute("/bishop/engagements")({
  component: () => <Outlet />,
});

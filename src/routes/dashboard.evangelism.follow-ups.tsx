import { createFileRoute } from "@tanstack/react-router";
import { FollowUpQueue } from "@/components/evangelism/FollowUpQueue";

export const Route = createFileRoute("/dashboard/evangelism/follow-ups")({
  head: () => ({ meta: [{ title: "Follow-ups — CCAC" }] }),
  component: FollowUpsPage,
});

function FollowUpsPage() {
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <div className="eyebrow text-accent mb-2">— Follow-ups</div>
        <h1 className="font-display text-5xl">Your reminders</h1>
        <p className="text-muted-foreground mt-2">
          Follow-ups you set for yourself, with the note that prompted each one.
        </p>
      </div>
      <FollowUpQueue />
    </div>
  );
}

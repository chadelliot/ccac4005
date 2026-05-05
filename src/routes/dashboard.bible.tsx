import { createFileRoute } from "@tanstack/react-router";
import { BibleReader } from "@/components/bible/PassageView";

export const Route = createFileRoute("/dashboard/bible")({
  head: () => ({ meta: [{ title: "Bible (KJV) — CCAC" }] }),
  component: BiblePage,
});

function BiblePage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <div className="eyebrow text-accent mb-2">— Scripture</div>
        <h1 className="font-display text-5xl">King James Bible</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Hover any underlined word to see its Strong's number, original Hebrew or Greek, and definition.
        </p>
      </div>
      <BibleReader />
    </div>
  );
}

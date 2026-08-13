import { STATUS_LABELS, type BookingStatus } from "@/lib/bishopBooking";

/**
 * Neutral by default. Only the states that represent a settled decision carry
 * colour, so scanning a list picks out what has actually been resolved rather
 * than lighting up every row equally.
 */
const TONE: Record<BookingStatus, string> = {
  new: "border-night bg-night text-night-foreground",
  under_review: "border-border bg-secondary text-foreground",
  awaiting_bishop: "border-gold-deep/40 bg-gold/10 text-foreground",
  tentatively_held: "border-gold-deep/40 bg-gold/10 text-foreground",
  accepted: "border-gold-deep bg-gold-deep text-night-foreground",
  declined: "border-border bg-card text-muted-foreground",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-block border px-2.5 py-1 eyebrow text-[10px] ${TONE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

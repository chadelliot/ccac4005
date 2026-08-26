/**
 * The statuses a contact can hold, and the one that stops outreach.
 *
 * Shared rather than declared per page because "do not contact" is only worth
 * anything if every surface agrees. A list that honoured it and a table that
 * did not would be worse than neither — someone would trust the site and call
 * a person who asked to be left alone.
 */
export const STATUS_OPTIONS = [
  "new",
  "contacted",
  "visiting",
  "member",
  "cold",
  "do_not_contact",
] as const;

export type ContactStatus = (typeof STATUS_OPTIONS)[number];

const LABELS: Record<ContactStatus, string> = {
  new: "New",
  contacted: "Contacted",
  visiting: "Visiting",
  member: "Member",
  cold: "Cold",
  do_not_contact: "Do not contact",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "New";
  return LABELS[status as ContactStatus] ?? status;
}

/**
 * Whether this soul has asked to be left alone.
 *
 * Takes an unknown string on purpose: it is called with whatever the database
 * returned, and the honest answer for an unrecognised value is "no" — the
 * constraint on the column is what keeps unrecognised values from existing.
 */
export function isDoNotContact(status: string | null | undefined): boolean {
  return status === "do_not_contact";
}

/**
 * Who may change a contact.
 *
 * Mirrors the RLS policy on evangelism_contacts exactly — "Owner or evangelism
 * manager update contacts" — so the interface never offers a control the
 * database would refuse.
 *
 * Deliberately not the `leader` role. Leaders can read every contact, but the
 * update policy does not include them; showing them an editable field would
 * produce a control that fails on every save.
 */
export function canEditContact(
  addedBy: string | null | undefined,
  userId: string | null | undefined,
  hasEvangelismManagement: boolean,
): boolean {
  return hasEvangelismManagement || (!!userId && addedBy === userId);
}

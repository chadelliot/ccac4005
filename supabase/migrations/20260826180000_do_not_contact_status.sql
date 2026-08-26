-- ============================================================================
-- "Do not contact" becomes a status the site actually honours
-- ============================================================================
-- Someone can ask not to be called again. Until now there was nowhere to put
-- that, so it lived in a note that only admins could read and that no button
-- consulted — the next person to open the profile would see Text and Call and
-- press one.
--
-- The status column was plain text with no constraint, which is the other half
-- of the problem: 'do_not_contct' would have saved cleanly, shown as a status
-- nobody recognised, and left the contact buttons enabled. A wrong value here
-- means calling a person who asked to be left alone, so the set is now closed.
--
-- Every existing row is 'new', 'visiting' or 'contacted', all of which are in
-- the list below, so nothing needs correcting first.
-- ============================================================================

ALTER TABLE public.evangelism_contacts
  ADD CONSTRAINT evangelism_contacts_status_check
  CHECK (status IN ('new', 'contacted', 'visiting', 'member', 'cold', 'do_not_contact'));

COMMENT ON COLUMN public.evangelism_contacts.status IS
  'new | contacted | visiting | member | cold | do_not_contact. do_not_contact suppresses the Text, Call and Invite actions everywhere they appear.';

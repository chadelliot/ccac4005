-- ============================================================================
-- A follow-up remembers the note that prompted it
-- ============================================================================
-- "Touch 2, due Thursday" tells you to ring someone and nothing about why. The
-- reason was written down at the time — she asked about the women's group, he
-- wanted prayer for his mother — and then left behind on a different screen.
--
-- Linking the note to the task carries that context to the moment it is needed,
-- which is standing outside on Thursday looking at a list of names.
--
-- ON DELETE SET NULL rather than CASCADE: if the note ever goes, the commitment
-- to follow up does not. The task loses its context, not its existence.
-- ============================================================================

ALTER TABLE public.contact_follow_ups
  ADD COLUMN activity_id UUID REFERENCES public.contact_activity(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contact_follow_ups.activity_id IS
  'The note this follow-up was created from, if any. Read for context on the follow-up queue.';

CREATE INDEX contact_follow_ups_activity_idx
  ON public.contact_follow_ups (activity_id)
  WHERE activity_id IS NOT NULL;

-- No policy changes. Who may create and read a follow-up is already settled by
-- "Assignee or evangelism manager", and the note itself is still governed by
-- contact_activity's own rules — an embed of the note text is filtered by that
-- policy for whoever is asking, so linking a note here cannot widen who reads
-- it.

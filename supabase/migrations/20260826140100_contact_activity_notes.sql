-- ============================================================================
-- Notes become dated entries instead of one overwritten box
-- ============================================================================
-- The notes field was a single textarea: writing this week's visit over last
-- month's conversation, leaving no trace that either happened. What a follow-up
-- actually needs is both halves together — when someone was reached, and how it
-- went — which is the timeline this table already keeps.
--
-- So a note becomes an activity. It carries a date and an author like every
-- other entry, and the last line of the panel finally answers "when did anyone
-- last speak to this man, and what was said?"
--
-- Unlike a text or a call, a note is editable. That is not a contradiction of
-- the append-only rule: a call either happened or it didn't, but a note is
-- prose, and prose gets typed on a phone in a car park. Editing is narrowed
-- three ways — only 'note' rows, only by the person who wrote it, and only the
-- note column itself, enforced by a column-level GRANT rather than by trusting
-- the client to send a narrow patch. The date, the author and the kind cannot
-- be rewritten by anybody.
-- ============================================================================

ALTER TABLE public.contact_activity
  ADD COLUMN note TEXT,
  -- NULL until edited, so the panel can mark a note as revised without
  -- claiming every note was.
  ADD COLUMN updated_at TIMESTAMPTZ;

ALTER TABLE public.contact_activity
  ADD CONSTRAINT contact_activity_note_has_text
  CHECK (kind <> 'note' OR btrim(coalesce(note, '')) <> '');

-- ----------------------------------------------------------------------------
-- Notes stay with leadership
-- ----------------------------------------------------------------------------
-- Texts, calls and invites are visible to anyone who may see the contact — the
-- member who met someone should know they've already been called twice. Notes
-- are different: they carry what was said at the door about people who never
-- signed up for this site, and they were made admin-only deliberately. Moving
-- them into the timeline must not quietly undo that, so the restriction moves
-- with them.
DROP POLICY IF EXISTS "Activity visible with its contact" ON public.contact_activity;
CREATE POLICY "Activity visible with its contact" ON public.contact_activity
  FOR SELECT TO authenticated
  USING (
    (kind <> 'note' OR public.has_role(auth.uid(), 'admin'))
    AND EXISTS (
      SELECT 1 FROM public.evangelism_contacts c
      WHERE c.id = contact_activity.contact_id
    )
  );

-- Writing a note is an admin act for the same reason reading one is. Texts,
-- calls and invites remain open to anyone who may see the contact.
DROP POLICY IF EXISTS "Log your own outreach" ON public.contact_activity;
CREATE POLICY "Log your own outreach" ON public.contact_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (kind <> 'note' OR public.has_role(auth.uid(), 'admin'))
    AND EXISTS (
      SELECT 1 FROM public.evangelism_contacts c
      WHERE c.id = contact_activity.contact_id
    )
  );

-- ----------------------------------------------------------------------------
-- Editing, narrowly
-- ----------------------------------------------------------------------------
CREATE POLICY "Authors edit their own notes" ON public.contact_activity
  FOR UPDATE TO authenticated
  USING (kind = 'note' AND actor_id = auth.uid())
  WITH CHECK (kind = 'note' AND actor_id = auth.uid());

-- The column-level grant is what actually stops a rewritten date or a
-- reassigned author: RLS decides which rows, this decides which columns. A
-- statement touching anything but note is refused before any policy is
-- consulted. Still no DELETE policy — a note can be corrected, not erased.
GRANT UPDATE (note) ON public.contact_activity TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_contact_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Set here rather than by the client, so "edited" cannot be suppressed by
  -- whoever is doing the editing.
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER contact_activity_touch
  BEFORE UPDATE ON public.contact_activity
  FOR EACH ROW EXECUTE FUNCTION public.touch_contact_activity();

-- ----------------------------------------------------------------------------
-- Bring the existing notes across
-- ----------------------------------------------------------------------------
-- 27 contacts already carry a note. Left where they are they would simply
-- disappear from the page, which reads as data loss to the person who typed
-- them. Each becomes a note entry credited to whoever logged the contact and
-- dated to when the record was made — the most honest attribution available,
-- since the old column recorded neither.
--
-- evangelism_contacts.notes is deliberately not cleared. It is what gets sent
-- to the harvest sheet when a contact is first logged, and it stays the record
-- of what was written at that moment; the timeline is the running account from
-- here on.
INSERT INTO public.contact_activity (contact_id, actor_id, kind, note, created_at)
SELECT c.id, c.added_by, 'note', btrim(c.notes), c.created_at
FROM public.evangelism_contacts c
WHERE c.notes IS NOT NULL
  AND btrim(c.notes) <> ''
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = c.added_by)
  AND NOT EXISTS (
    SELECT 1 FROM public.contact_activity a
    WHERE a.contact_id = c.id AND a.kind = 'note'
  );

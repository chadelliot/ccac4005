-- ============================================================================
-- A favourite belongs to the person who starred it
-- ============================================================================
-- is_focus was a column on the contact, so starring a soul starred them for
-- everyone. That is the wrong shape for what the star means: "these are the
-- few I am working on" is a personal working set, and two people concentrating
-- on different souls is the normal case, not a conflict to resolve.
--
-- A join table gives each person their own list, and nobody sees anyone
-- else's — there is no read policy that would let them.
-- ============================================================================

CREATE TABLE public.contact_focus (
  contact_id UUID NOT NULL REFERENCES public.evangelism_contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, user_id)
);

-- The query this table exists to answer: "which souls has this person starred?"
CREATE INDEX contact_focus_user_idx ON public.contact_focus (user_id);

ALTER TABLE public.contact_focus ENABLE ROW LEVEL SECURITY;

-- Your own stars, and only your own. Deliberately not readable by evangelism
-- managers either: a private working set that leadership can read is not
-- private, and nothing in the app needs to know who starred whom.
CREATE POLICY "Read your own focus list" ON public.contact_focus
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Starring is not editing the contact. Anyone who may see a soul may keep them
-- on their own list, which is why this does not reuse the update policy on
-- evangelism_contacts — a member should be able to track the people they met
-- without being able to change anyone's record.
CREATE POLICY "Star a contact you can see" ON public.contact_focus
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.evangelism_contacts c WHERE c.id = contact_focus.contact_id
    )
  );

CREATE POLICY "Remove your own star" ON public.contact_focus
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.contact_focus FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.contact_focus TO authenticated;

-- ----------------------------------------------------------------------------
-- Carry the five existing stars across
-- ----------------------------------------------------------------------------
-- One account exists, so every star on the books was made by that person.
-- Attributing them to the sole profile is exact rather than a guess.
INSERT INTO public.contact_focus (contact_id, user_id)
SELECT c.id, p.id
FROM public.evangelism_contacts c
CROSS JOIN (SELECT id FROM public.profiles ORDER BY created_at LIMIT 1) p
WHERE c.is_focus
ON CONFLICT DO NOTHING;

DROP INDEX IF EXISTS public.evangelism_contacts_focus_idx;
ALTER TABLE public.evangelism_contacts DROP COLUMN is_focus;

-- ============================================================================
-- Actually restrict note edits to the note itself
-- ============================================================================
-- The previous migration claimed a column-level GRANT UPDATE (note) confined
-- editing to that one column. It did not, and the comment there is wrong.
--
-- Supabase applies default privileges to every new table in public, so
-- contact_activity was created with ALL — including UPDATE on every column and
-- DELETE — already granted to authenticated and to anon. A column-level grant
-- adds a privilege; it cannot subtract one that is already held. GRANT
-- SELECT, INSERT likewise added nothing that was not already there.
--
-- The gap was narrow but real: with an UPDATE policy now in place for notes, an
-- author could rewrite their own note's created_at and backdate it, or move it
-- to a different contact. On a page whose whole purpose is "when did anyone
-- last speak to this man", a timestamp that can be quietly changed is the one
-- field that must not be.
--
-- Verified against the live database before and after: before, an UPDATE
-- setting created_at on 27 note rows succeeded; after, it is refused.
-- ============================================================================

-- anon should never have held any of this. Policies are all TO authenticated,
-- so RLS was already refusing it — but a table where the anonymous role holds
-- DELETE is one policy edit away from being a problem.
REVOKE ALL ON public.contact_activity FROM anon;

REVOKE ALL ON public.contact_activity FROM authenticated;
GRANT SELECT, INSERT ON public.contact_activity TO authenticated;

-- Now this line means what the last migration said it meant.
GRANT UPDATE (note) ON public.contact_activity TO authenticated;

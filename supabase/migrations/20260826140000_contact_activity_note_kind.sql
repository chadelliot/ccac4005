-- ============================================================================
-- 'note' becomes a kind of activity
-- ============================================================================
-- Alone in its own migration on purpose. Postgres will not let a new enum
-- value be used in the same transaction that adds it (55P04, "unsafe use of
-- new value"), and the next migration both constrains and inserts rows with
-- this one. Splitting the file is the split transaction.
-- ============================================================================

ALTER TYPE public.contact_activity_kind ADD VALUE IF NOT EXISTS 'note';

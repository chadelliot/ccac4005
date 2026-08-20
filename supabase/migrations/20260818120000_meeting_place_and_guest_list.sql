-- ============================================================================
-- Where we're meeting this week, and who's coming
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Meeting place for a weekly service
-- ----------------------------------------------------------------------------
-- Bible study is sometimes on Zoom, sometimes in the Facebook group chat, and
-- usually in the building. The platform is stored separately from the link so
-- the site can label it properly — "Join on Zoom" and "Open the group chat" are
-- different invitations, and a bare URL tells a visitor neither.
ALTER TABLE public.weekly_services
  ADD COLUMN IF NOT EXISTS virtual_platform TEXT
    CHECK (virtual_platform IS NULL OR virtual_platform IN ('zoom', 'facebook', 'other'));

COMMENT ON COLUMN public.weekly_services.virtual_platform IS
  'zoom | facebook | other. Drives the wording and icon of the join link.';

-- ----------------------------------------------------------------------------
-- 2. Public guest list
-- ----------------------------------------------------------------------------
-- Who is coming, for anyone with the event link — the Partiful behaviour.
--
-- A function rather than a relaxed policy on event_guest_rsvps, because that
-- table holds email addresses. No policy can return "this column but not that
-- one", so opening it for reads would expose the email of every person who
-- RSVP'd to a church event. This returns first names only; the email column is
-- not in the result type and cannot be selected through it.
--
-- The join to events is the authorisation: a guest list is readable only for an
-- event that is already approved and public. A private or pending event returns
-- nothing, even to a caller who knows its id.
CREATE OR REPLACE FUNCTION public.event_guest_list(_event_id UUID)
RETURNS TABLE (first_name TEXT, response TEXT, is_member BOOLEAN)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Guests who RSVP'd without an account.
  SELECT
    NULLIF(split_part(btrim(g.name), ' ', 1), '') AS first_name,
    g.response,
    false AS is_member
  FROM public.event_guest_rsvps g
  JOIN public.events e ON e.id = g.event_id
  WHERE g.event_id = _event_id
    AND e.status = 'approved'
    AND e.is_public
    AND g.response IN ('going', 'maybe')

  UNION ALL

  -- Signed-in members.
  SELECT
    NULLIF(split_part(btrim(COALESCE(p.display_name, '')), ' ', 1), '') AS first_name,
    r.response,
    true AS is_member
  FROM public.event_rsvps r
  JOIN public.events e ON e.id = r.event_id
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.event_id = _event_id
    AND e.status = 'approved'
    AND e.is_public
    AND r.response IN ('going', 'maybe');
$$;

REVOKE EXECUTE ON FUNCTION public.event_guest_list(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_guest_list(UUID) TO anon, authenticated;

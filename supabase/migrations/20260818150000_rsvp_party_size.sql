-- ============================================================================
-- How many are coming, not just who
-- ============================================================================
-- Seats, meals and giveaways are planned against head count. One row per RSVP
-- undercounts a family of five as a single guest, which is the number that
-- matters when you are buying food.
--
-- party_size counts the whole party INCLUDING the person replying, so a lone
-- guest is 1 and "me plus three" is 4. Storing the +N instead would make every
-- read do arithmetic and invite an off-by-one at exactly the moment it costs
-- somebody a meal.
--
-- Capped at 20: the UI offers up to "+4 or more", and anything beyond a score
-- of people arriving as one party is a coach booking that deserves a phone
-- call rather than a form.
-- ============================================================================

ALTER TABLE public.event_guest_rsvps
  ADD COLUMN IF NOT EXISTS party_size SMALLINT NOT NULL DEFAULT 1
    CHECK (party_size BETWEEN 1 AND 20);

ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS party_size SMALLINT NOT NULL DEFAULT 1
    CHECK (party_size BETWEEN 1 AND 20);

COMMENT ON COLUMN public.event_guest_rsvps.party_size IS
  'Total attending in this party, including the person replying. 1 means just them.';
COMMENT ON COLUMN public.event_rsvps.party_size IS
  'Total attending in this party, including the person replying. 1 means just them.';

-- Recreated to carry party_size through. Still first names only, still no
-- email column in the return type, still gated on the event being approved and
-- public by the join.
DROP FUNCTION IF EXISTS public.event_guest_list(UUID);

CREATE FUNCTION public.event_guest_list(_event_id UUID)
RETURNS TABLE (first_name TEXT, response TEXT, is_member BOOLEAN, party_size SMALLINT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NULLIF(split_part(btrim(g.name), ' ', 1), '') AS first_name,
    g.response,
    false AS is_member,
    g.party_size
  FROM public.event_guest_rsvps g
  JOIN public.events e ON e.id = g.event_id
  WHERE g.event_id = _event_id
    AND e.status = 'approved'
    AND e.is_public
    AND g.response IN ('going', 'maybe')

  UNION ALL

  SELECT
    NULLIF(split_part(btrim(COALESCE(p.display_name, '')), ' ', 1), '') AS first_name,
    r.response,
    true AS is_member,
    r.party_size
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

-- Head count for planners. Admins and leaders read the RSVP tables directly,
-- but every screen that needs "how many meals" would otherwise re-derive it.
CREATE OR REPLACE FUNCTION public.event_headcount(_event_id UUID)
RETURNS TABLE (going INTEGER, maybe INTEGER, parties INTEGER)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH all_rsvps AS (
    SELECT g.response, g.party_size FROM public.event_guest_rsvps g
    JOIN public.events e ON e.id = g.event_id
    WHERE g.event_id = _event_id AND e.status = 'approved' AND e.is_public
    UNION ALL
    SELECT r.response, r.party_size FROM public.event_rsvps r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.event_id = _event_id AND e.status = 'approved' AND e.is_public
  )
  SELECT
    COALESCE(SUM(party_size) FILTER (WHERE response = 'going'), 0)::INTEGER,
    COALESCE(SUM(party_size) FILTER (WHERE response = 'maybe'), 0)::INTEGER,
    COUNT(*)::INTEGER
  FROM all_rsvps;
$$;

REVOKE EXECUTE ON FUNCTION public.event_headcount(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_headcount(UUID) TO anon, authenticated;

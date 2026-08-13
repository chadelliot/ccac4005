-- Bishop's engagement booking system.
--
-- RECONSTRUCTED: the migration produced in the original planning conversation
-- never reached the repo. This is a rebuild from the feature description, using
-- the same filename deliberately — if the original turns up, git will surface it
-- as a conflict on one file rather than leaving two divergent schemas.
--
-- Shape of the thing: an outside church submits an invitation through a public
-- form. Nothing about that path touches the database directly — submissions go
-- through an edge function holding the service role, so `anon` needs no write
-- grant anywhere in here. The Bishop's desk (a small named group, separate from
-- the church's own admin/leader roles) works the request through a status
-- pipeline and, on accept, writes it to Google Calendar.

-- ---------------------------------------------------------------------------
-- 0. Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.bishop_booking_status AS ENUM (
    'new', 'under_review', 'awaiting_bishop', 'tentatively_held', 'accepted', 'declined'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bishop_event_type AS ENUM (
    'revival', 'conference', 'anniversary', 'installation', 'ordination',
    'musical', 'banquet', 'funeral', 'wedding', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bishop_service_role AS ENUM (
    'preach', 'teach', 'keynote', 'officiate', 'panel', 'greetings', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bishop_travel_arrangement AS ENUM (
    'host_arranges', 'bishop_arranges', 'not_required'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bishop_note_visibility AS ENUM ('secretary', 'bishop');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 1. Desk access
-- ---------------------------------------------------------------------------
-- Deliberately NOT reusing user_roles. A church admin manages events and
-- members; that is not the same trust boundary as reading a visiting church's
-- private correspondence and the Bishop's own notes. This is its own list.

CREATE TABLE IF NOT EXISTS public.bishop_booking_authorized_users (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  display_name text,
  -- Bishop-visibility notes are readable only by rows flagged here.
  is_bishop    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bishop_booking_authorized_users ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER so policies on the table itself can call it without
-- recursing through that table's own RLS.
CREATE OR REPLACE FUNCTION public.has_bishop_desk_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bishop_booking_authorized_users WHERE user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_bishop(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bishop_booking_authorized_users
    WHERE user_id = _user_id AND is_bishop
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_bishop_desk_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_bishop(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_bishop_desk_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_bishop(uuid) TO authenticated;

DROP POLICY IF EXISTS "desk reads the desk roster" ON public.bishop_booking_authorized_users;
CREATE POLICY "desk reads the desk roster"
  ON public.bishop_booking_authorized_users FOR SELECT TO authenticated
  USING (public.has_bishop_desk_access(auth.uid()));

-- Only church admins can hand out desk access; a desk member cannot add peers.
DROP POLICY IF EXISTS "admins manage the desk roster" ON public.bishop_booking_authorized_users;
CREATE POLICY "admins manage the desk roster"
  ON public.bishop_booking_authorized_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 2. Settings
-- ---------------------------------------------------------------------------
-- Split in two on purpose. The public half is served to anonymous visitors on
-- the invitation page (policy text, lead time, whether the desk is open at all).
-- The internal half holds addresses and is desk-only. One table with mixed
-- sensitivity would mean either leaking the secretary's inbox or hiding the
-- accommodation policy from the people who need to read it before applying.

CREATE TABLE IF NOT EXISTS public.bishop_booking_public_settings (
  id                 smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  intro_heading      text NOT NULL DEFAULT 'Invite Bishop Marcus',
  intro_body         text NOT NULL DEFAULT '',
  -- How far ahead a request must be filed. Enforced in the form and the
  -- submit function; kept here so the desk can change it without a deploy.
  lead_time_days     integer NOT NULL DEFAULT 30 CHECK (lead_time_days >= 0),
  accommodation_policy text NOT NULL DEFAULT '',
  honorarium_policy    text NOT NULL DEFAULT '',
  travel_policy        text NOT NULL DEFAULT '',
  response_time_note   text NOT NULL DEFAULT '',
  -- 0 = Sunday. The Bishop is with his own congregation then. Stored as an
  -- array so the desk can close other days without a migration.
  blocked_weekdays   smallint[] NOT NULL DEFAULT ARRAY[0]::smallint[],
  accepting_requests boolean NOT NULL DEFAULT true,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Seeded empty on purpose. The real accommodation, honorarium and travel
-- policies are the Bishop's to write and get entered through the desk settings
-- screen — a placeholder here would be indistinguishable from a real policy the
-- moment it rendered on the public page.
INSERT INTO public.bishop_booking_public_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.bishop_booking_public_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads public booking settings" ON public.bishop_booking_public_settings;
CREATE POLICY "anyone reads public booking settings"
  ON public.bishop_booking_public_settings FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "desk edits public booking settings" ON public.bishop_booking_public_settings;
CREATE POLICY "desk edits public booking settings"
  ON public.bishop_booking_public_settings FOR UPDATE TO authenticated
  USING (public.has_bishop_desk_access(auth.uid()))
  WITH CHECK (public.has_bishop_desk_access(auth.uid()));

CREATE TABLE IF NOT EXISTS public.bishop_booking_internal_settings (
  id                  smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secretary_name      text NOT NULL DEFAULT '',
  secretary_email     text NOT NULL DEFAULT '',
  bishop_email        text NOT NULL DEFAULT '',
  -- Everyone who gets told when a new request lands.
  notification_emails text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- Falls back to the GOOGLE_CALENDAR_ID secret when blank.
  calendar_id         text NOT NULL DEFAULT '',
  tentative_hold_days integer NOT NULL DEFAULT 14 CHECK (tentative_hold_days >= 0),
  auto_acknowledge    boolean NOT NULL DEFAULT true,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.bishop_booking_internal_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.bishop_booking_internal_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desk reads internal booking settings" ON public.bishop_booking_internal_settings;
CREATE POLICY "desk reads internal booking settings"
  ON public.bishop_booking_internal_settings FOR SELECT TO authenticated
  USING (public.has_bishop_desk_access(auth.uid()));

DROP POLICY IF EXISTS "desk edits internal booking settings" ON public.bishop_booking_internal_settings;
CREATE POLICY "desk edits internal booking settings"
  ON public.bishop_booking_internal_settings FOR UPDATE TO authenticated
  USING (public.has_bishop_desk_access(auth.uid()))
  WITH CHECK (public.has_bishop_desk_access(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bishop_booking_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Human-quotable reference for phone and email: BE-2026-0007.
  request_number text UNIQUE,
  status         public.bishop_booking_status NOT NULL DEFAULT 'new',

  church_name        text NOT NULL,
  pastor_name        text NOT NULL,
  church_website     text,
  church_address     text NOT NULL,
  church_city        text NOT NULL,
  church_state       text NOT NULL,
  church_postal_code text NOT NULL,
  affiliation        text,

  contact_name             text NOT NULL,
  contact_role             text,
  contact_email            text NOT NULL,
  contact_phone            text NOT NULL,
  preferred_contact_method text NOT NULL DEFAULT 'either'
    CHECK (preferred_contact_method IN ('email', 'phone', 'either')),

  event_type          public.bishop_event_type NOT NULL,
  event_type_other    text,
  event_name          text NOT NULL,
  service_role        public.bishop_service_role NOT NULL,
  service_role_other  text,
  event_date          date NOT NULL,
  event_end_date      date,
  start_time          time NOT NULL,
  expected_attendance integer CHECK (expected_attendance IS NULL OR expected_attendance >= 0),
  venue_name          text,
  venue_address       text,
  theme               text,

  travel_arrangement  public.bishop_travel_arrangement NOT NULL DEFAULT 'host_arranges',
  nearest_airport     text,
  accommodation_notes text,
  armor_bearer_count  integer NOT NULL DEFAULT 0 CHECK (armor_bearer_count >= 0),
  honorarium_notes    text,
  additional_notes    text,

  -- Set by bishop-booking-accept once the calendar write succeeds.
  calendar_event_id text,
  decided_at        timestamptz,
  decided_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Retained for abuse investigation only; never shown in the UI.
  submitted_ip_hash text,
  submitted_user_agent text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_end_after_start CHECK (event_end_date IS NULL OR event_end_date >= event_date)
);

CREATE INDEX IF NOT EXISTS bishop_requests_status_idx ON public.bishop_booking_requests (status);
CREATE INDEX IF NOT EXISTS bishop_requests_event_date_idx ON public.bishop_booking_requests (event_date);
CREATE INDEX IF NOT EXISTS bishop_requests_created_idx ON public.bishop_booking_requests (created_at DESC);

ALTER TABLE public.bishop_booking_requests ENABLE ROW LEVEL SECURITY;

-- No anon policy of any kind. The public form posts to an edge function that
-- holds the service role, which bypasses RLS. Granting anon INSERT here would
-- let anyone write arbitrary rows straight past the rate limiter and the
-- Sunday check the function performs before it ever gets to the trigger.
DROP POLICY IF EXISTS "desk reads requests" ON public.bishop_booking_requests;
CREATE POLICY "desk reads requests"
  ON public.bishop_booking_requests FOR SELECT TO authenticated
  USING (public.has_bishop_desk_access(auth.uid()));

DROP POLICY IF EXISTS "desk updates requests" ON public.bishop_booking_requests;
CREATE POLICY "desk updates requests"
  ON public.bishop_booking_requests FOR UPDATE TO authenticated
  USING (public.has_bishop_desk_access(auth.uid()))
  WITH CHECK (public.has_bishop_desk_access(auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Request number + Sunday guard + updated_at
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.bishop_booking_request_seq;

CREATE OR REPLACE FUNCTION public.assign_bishop_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number :=
      'BE-' || to_char(now() AT TIME ZONE 'America/New_York', 'YYYY') || '-' ||
      lpad(nextval('public.bishop_booking_request_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

/**
 * The Bishop pastors Christ Cathedral on Sundays, so a Sunday engagement is
 * never bookable. This is the last line of defence — the form and the submit
 * function both check first so the visitor gets a sentence instead of a 500 —
 * but it is the only one that cannot be bypassed.
 *
 * Reads the blocked days from settings so the desk can close, say, Wednesdays
 * for Bible study without a schema change.
 */
CREATE OR REPLACE FUNCTION public.enforce_bishop_blocked_weekdays()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  blocked smallint[];
  dow smallint;
BEGIN
  SELECT blocked_weekdays INTO blocked
  FROM public.bishop_booking_public_settings WHERE id = 1;

  IF blocked IS NULL OR array_length(blocked, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- EXTRACT(DOW) is 0=Sunday, matching JavaScript's getDay().
  dow := EXTRACT(DOW FROM NEW.event_date)::smallint;

  IF dow = ANY (blocked) THEN
    RAISE EXCEPTION
      'The Bishop is not available on % — that weekday is closed for engagements.',
      to_char(NEW.event_date, 'FMDay')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_bishop_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_bishop_request_number ON public.bishop_booking_requests;
CREATE TRIGGER trg_assign_bishop_request_number
  BEFORE INSERT ON public.bishop_booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.assign_bishop_request_number();

DROP TRIGGER IF EXISTS trg_enforce_bishop_blocked_weekdays ON public.bishop_booking_requests;
CREATE TRIGGER trg_enforce_bishop_blocked_weekdays
  BEFORE INSERT OR UPDATE OF event_date ON public.bishop_booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_bishop_blocked_weekdays();

DROP TRIGGER IF EXISTS trg_touch_bishop_requests ON public.bishop_booking_requests;
CREATE TRIGGER trg_touch_bishop_requests
  BEFORE UPDATE ON public.bishop_booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_bishop_updated_at();

DROP TRIGGER IF EXISTS trg_touch_bishop_public_settings ON public.bishop_booking_public_settings;
CREATE TRIGGER trg_touch_bishop_public_settings
  BEFORE UPDATE ON public.bishop_booking_public_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_bishop_updated_at();

DROP TRIGGER IF EXISTS trg_touch_bishop_internal_settings ON public.bishop_booking_internal_settings;
CREATE TRIGGER trg_touch_bishop_internal_settings
  BEFORE UPDATE ON public.bishop_booking_internal_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_bishop_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Notes
-- ---------------------------------------------------------------------------
-- Never public, never shown to the inviting church. Two visibilities: notes the
-- secretary and Bishop share, and notes only the Bishop sees.

CREATE TABLE IF NOT EXISTS public.bishop_booking_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid NOT NULL REFERENCES public.bishop_booking_requests(id) ON DELETE CASCADE,
  author_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_email text,
  body         text NOT NULL CHECK (length(btrim(body)) > 0),
  visibility   public.bishop_note_visibility NOT NULL DEFAULT 'secretary',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bishop_notes_request_idx ON public.bishop_booking_notes (request_id, created_at DESC);

ALTER TABLE public.bishop_booking_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desk reads notes it is cleared for" ON public.bishop_booking_notes;
CREATE POLICY "desk reads notes it is cleared for"
  ON public.bishop_booking_notes FOR SELECT TO authenticated
  USING (
    public.has_bishop_desk_access(auth.uid())
    AND (visibility = 'secretary' OR public.is_bishop(auth.uid()))
  );

DROP POLICY IF EXISTS "desk writes its own notes" ON public.bishop_booking_notes;
CREATE POLICY "desk writes its own notes"
  ON public.bishop_booking_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_bishop_desk_access(auth.uid())
    AND author_id = auth.uid()
    AND (visibility = 'secretary' OR public.is_bishop(auth.uid()))
  );

-- An author may retract their own note; nobody edits anyone else's.
DROP POLICY IF EXISTS "authors delete their own notes" ON public.bishop_booking_notes;
CREATE POLICY "authors delete their own notes"
  ON public.bishop_booking_notes FOR DELETE TO authenticated
  USING (public.has_bishop_desk_access(auth.uid()) AND author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Activity timeline
-- ---------------------------------------------------------------------------
-- Append-only. No UPDATE or DELETE policy exists, so even a desk user cannot
-- rewrite the history of who decided what.

CREATE TABLE IF NOT EXISTS public.bishop_booking_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES public.bishop_booking_requests(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action      text NOT NULL,
  from_status public.bishop_booking_status,
  to_status   public.bishop_booking_status,
  detail      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bishop_activity_request_idx ON public.bishop_booking_activity (request_id, created_at DESC);

ALTER TABLE public.bishop_booking_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desk reads activity" ON public.bishop_booking_activity;
CREATE POLICY "desk reads activity"
  ON public.bishop_booking_activity FOR SELECT TO authenticated
  USING (public.has_bishop_desk_access(auth.uid()));

DROP POLICY IF EXISTS "desk appends activity" ON public.bishop_booking_activity;
CREATE POLICY "desk appends activity"
  ON public.bishop_booking_activity FOR INSERT TO authenticated
  WITH CHECK (public.has_bishop_desk_access(auth.uid()) AND actor_id = auth.uid());

/**
 * Status changes are logged by trigger rather than by the client, so a
 * transition can never happen without a corresponding timeline entry — including
 * transitions made by an edge function running as the service role, where
 * auth.uid() is null and no client-side logging code is involved.
 */
CREATE OR REPLACE FUNCTION public.log_bishop_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.bishop_booking_activity (request_id, actor_id, action, to_status, detail)
    VALUES (NEW.id, NULL, 'submitted', NEW.status, 'Request received from ' || NEW.church_name);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.bishop_booking_activity
      (request_id, actor_id, actor_email, action, from_status, to_status)
    VALUES (
      NEW.id,
      auth.uid(),
      (SELECT email FROM public.bishop_booking_authorized_users WHERE user_id = auth.uid()),
      'status_changed',
      OLD.status,
      NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_bishop_status_change ON public.bishop_booking_requests;
CREATE TRIGGER trg_log_bishop_status_change
  AFTER INSERT OR UPDATE OF status ON public.bishop_booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_bishop_status_change();

-- ---------------------------------------------------------------------------
-- 7. Attachments
-- ---------------------------------------------------------------------------
-- Rows only; the bytes live in Storage. Creating the bucket is a dashboard/CLI
-- step, deliberately not done here so this migration stays pure schema.

CREATE TABLE IF NOT EXISTS public.bishop_booking_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid NOT NULL REFERENCES public.bishop_booking_requests(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name    text NOT NULL,
  content_type text,
  size_bytes   bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  uploaded_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bishop_attachments_request_idx ON public.bishop_booking_attachments (request_id);

ALTER TABLE public.bishop_booking_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "desk reads attachments" ON public.bishop_booking_attachments;
CREATE POLICY "desk reads attachments"
  ON public.bishop_booking_attachments FOR SELECT TO authenticated
  USING (public.has_bishop_desk_access(auth.uid()));

DROP POLICY IF EXISTS "desk manages attachments" ON public.bishop_booking_attachments;
CREATE POLICY "desk manages attachments"
  ON public.bishop_booking_attachments FOR ALL TO authenticated
  USING (public.has_bishop_desk_access(auth.uid()))
  WITH CHECK (public.has_bishop_desk_access(auth.uid()));

-- ---------------------------------------------------------------------------
-- 8. Rate limiting
-- ---------------------------------------------------------------------------
-- Written only by the submit function under the service role. RLS is enabled
-- with no policies at all, which denies every client role outright — the
-- service role bypasses RLS, so the function still works. Deliberate: the IP
-- hashes in here are the one thing in this schema that a desk user has no
-- business reading either.

CREATE TABLE IF NOT EXISTS public.bishop_booking_rate_limit (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 of (ip + a server-side salt). Never the raw address.
  ip_hash    text NOT NULL,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bishop_rate_limit_ip_idx ON public.bishop_booking_rate_limit (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS bishop_rate_limit_created_idx ON public.bishop_booking_rate_limit (created_at);

ALTER TABLE public.bishop_booking_rate_limit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bishop_booking_rate_limit FROM anon, authenticated;

-- Housekeeping helper; call from a scheduled job if pg_cron is enabled.
CREATE OR REPLACE FUNCTION public.prune_bishop_rate_limit(_older_than interval DEFAULT interval '7 days')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE removed integer;
BEGIN
  DELETE FROM public.bishop_booking_rate_limit WHERE created_at < now() - _older_than;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prune_bishop_rate_limit(interval) FROM PUBLIC, anon, authenticated;

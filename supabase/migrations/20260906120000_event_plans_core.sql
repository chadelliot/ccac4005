-- ============================================================================
-- Event Planning Center: the plan record, its modules, and its templates
-- ============================================================================
-- A plan is deliberately NOT a column set bolted onto public.events.
--
-- events carries a public anonymous read policy — the congregation and the open
-- internet read it. Planning carries budgets, speaker phone numbers, honoraria
-- and internal notes. Putting those on the same row makes every future policy
-- edit a chance to publish the church's spending, and the two records do not
-- even share a lifecycle: a plan exists as a draft months before anything is
-- announced, and a weekly service is announced without ever needing a plan.
--
-- So: a plan links to an event when there is one, and stands alone when there
-- is not. Publishing stays the separate act it already was.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Templates
-- ----------------------------------------------------------------------------
-- A template is data, not code. Six event types with different tasks and
-- timelines should not be six branches in the application — new ones get added
-- by inserting rows, and a template that turns out to be wrong is corrected in
-- one place rather than hunted through the interface.
CREATE TABLE public.event_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,

  -- Modules switched on by default when this template is chosen. The planner
  -- can add or remove any of them before submitting.
  default_modules TEXT[] NOT NULL DEFAULT '{}',

  -- How far out this kind of event normally starts. A revival service needs
  -- six weeks; a vendor festival needs sixteen.
  lead_weeks SMALLINT NOT NULL DEFAULT 6,

  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.event_plan_template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.event_plan_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,

  -- Weeks before the event this is due. Numeric so "the day after" (-0.4) and
  -- "two days before" (0.3) are expressible without a second unit column.
  weeks_before NUMERIC(4,1) NOT NULL DEFAULT 2,

  priority TEXT NOT NULL DEFAULT 'normal',

  -- Only generated when the plan has this module switched on. NULL means the
  -- task belongs to every event of this type.
  module_key TEXT,

  sort_order SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE public.event_plan_template_program_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.event_plan_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_minutes SMALLINT NOT NULL DEFAULT 10,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- The plan
-- ----------------------------------------------------------------------------
CREATE TABLE public.event_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title TEXT NOT NULL,
  template_id UUID REFERENCES public.event_plan_templates(id) ON DELETE SET NULL,

  -- Why it exists. Kept as first-class columns rather than a notes blob,
  -- because the old planning documents buried the purpose in a paragraph and
  -- the answer to "what is this for" is the thing a reviewer needs first.
  purpose TEXT,
  desired_outcome TEXT,
  theme TEXT,
  scripture TEXT,

  -- Who is responsible. group_id is the hosting ministry; owner_id is the one
  -- person accountable, which the old documents most often left unclear.
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  supporting_team TEXT,

  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  location TEXT,
  venue_kind TEXT NOT NULL DEFAULT 'ccac'
    CHECK (venue_kind IN ('ccac', 'offsite', 'outdoor')),

  audience TEXT,
  attendance_goal INTEGER CHECK (attendance_goal IS NULL OR attendance_goal >= 0),
  visibility TEXT NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal', 'invited', 'public')),
  registration_required BOOLEAN NOT NULL DEFAULT false,

  -- Cents, matching public.expenses. Money in floating point is how a budget
  -- ends up eleven cents out and nobody can say why.
  budget_estimate_cents INTEGER CHECK (budget_estimate_cents IS NULL OR budget_estimate_cents >= 0),
  budget_approved_cents INTEGER CHECK (budget_approved_cents IS NULL OR budget_approved_cents >= 0),

  -- Two axes, on purpose.
  --
  -- Where the work has got to, and whether leadership has signed it off, are
  -- different questions with different answers: a plan can be approved and
  -- still be half-built, and a finished plan can be sitting unread. Collapsing
  -- them into one column forces a false order on them and makes "approved but
  -- not ready" impossible to express.
  planning_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (planning_status IN (
      'draft', 'planning', 'ready', 'completed', 'archived', 'postponed', 'cancelled'
    )),
  approval_status TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK (approval_status IN (
      'not_submitted', 'submitted', 'under_review', 'revisions_requested', 'approved'
    )),

  -- The public calendar entry, once there is one. Nullable both ways: a plan
  -- may never be published, and most events never had a plan.
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,

  -- Historical events recreated from the old Google Docs. The document stays
  -- where it is and is linked, never imported over.
  source_document_url TEXT,
  is_historical BOOLEAN NOT NULL DEFAULT false,

  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT event_plans_ends_after_starts
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE TRIGGER event_plans_set_updated_at
  BEFORE UPDATE ON public.event_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX event_plans_starts_at_idx ON public.event_plans (starts_at DESC NULLS LAST);
CREATE INDEX event_plans_owner_idx ON public.event_plans (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX event_plans_group_idx ON public.event_plans (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX event_plans_approval_idx ON public.event_plans (approval_status)
  WHERE approval_status IN ('submitted', 'under_review');

-- ----------------------------------------------------------------------------
-- Modules
-- ----------------------------------------------------------------------------
-- Which optional sections this event actually needs. Rows rather than eighteen
-- booleans: the set will grow, and a new module should not be a migration on a
-- table that already holds every plan.
CREATE TABLE public.event_plan_modules (
  plan_id UUID NOT NULL REFERENCES public.event_plans(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, module_key)
);

COMMENT ON TABLE public.event_plan_modules IS
  'Optional planning modules switched on for a plan: guest_ministry, food, registration, promotion, children_youth, transportation, outdoor, vendors, fundraising, gifts, photography, evangelism_followup, multi_day.';

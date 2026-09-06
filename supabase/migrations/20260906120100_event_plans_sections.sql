-- ============================================================================
-- Event Planning Center: the sections of a plan
-- ============================================================================
-- One table per section of the workspace. Each hangs off event_plans and
-- cascades with it, so deleting a plan cannot leave orphaned budget lines or a
-- run of show for an event that no longer exists.
--
-- Statuses are TEXT with CHECK constraints rather than enums throughout. That
-- matches evangelism_contacts.status, and it means adding a value later is one
-- constraint swap instead of a migration that cannot use its own new value in
-- the transaction that adds it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tasks
-- ----------------------------------------------------------------------------
CREATE TABLE public.event_plan_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.event_plans(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'leadership' CHECK (category IN (
    'leadership', 'program', 'speaker', 'promotion', 'registration', 'hospitality',
    'food', 'purchasing', 'equipment', 'facilities', 'music', 'media', 'evangelism',
    'transportation', 'volunteers', 'safety', 'setup', 'cleanup', 'follow_up'
  )),

  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,

  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'in_progress', 'blocked', 'awaiting_approval', 'completed', 'not_needed'
  )),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),

  -- "Cannot start until that is done." Self-referencing and nullable; ON DELETE
  -- SET NULL so removing a task never takes its dependants with it.
  depends_on_id UUID REFERENCES public.event_plan_tasks(id) ON DELETE SET NULL,

  notes TEXT,
  requires_approval BOOLEAN NOT NULL DEFAULT false,

  -- Proof of completion, in the private receipts bucket that already exists.
  evidence_path TEXT,

  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Which module generated this, so switching a module off can offer to remove
  -- the tasks it brought with it. NULL for tasks somebody typed themselves.
  module_key TEXT,

  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A task cannot depend on itself; the readiness pass would never terminate.
  CONSTRAINT event_plan_tasks_no_self_dependency CHECK (depends_on_id IS NULL OR depends_on_id <> id)
);

CREATE TRIGGER event_plan_tasks_set_updated_at
  BEFORE UPDATE ON public.event_plan_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX event_plan_tasks_plan_idx ON public.event_plan_tasks (plan_id, sort_order);
-- "What is assigned to me and still open" is the query behind My Tasks.
CREATE INDEX event_plan_tasks_assignee_idx ON public.event_plan_tasks (assigned_to, due_date)
  WHERE status NOT IN ('completed', 'not_needed');

-- Stamp completion rather than trusting the client to send a matching pair.
CREATE OR REPLACE FUNCTION public.event_plan_task_stamp_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status <> 'completed') THEN
    NEW.completed_at := now();
    NEW.completed_by := auth.uid();
  ELSIF NEW.status <> 'completed' THEN
    -- Reopened. Clearing both keeps "completed on" from describing a task that
    -- is open again.
    NEW.completed_at := NULL;
    NEW.completed_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER event_plan_tasks_completion
  BEFORE INSERT OR UPDATE ON public.event_plan_tasks
  FOR EACH ROW EXECUTE FUNCTION public.event_plan_task_stamp_completion();

-- ----------------------------------------------------------------------------
-- Program / order of service
-- ----------------------------------------------------------------------------
CREATE TABLE public.event_plan_program_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.event_plans(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  duration_minutes SMALLINT NOT NULL DEFAULT 10
    CHECK (duration_minutes >= 0 AND duration_minutes <= 600),

  -- Who is doing it. A name as well as an id because the praise team and a
  -- visiting preacher rarely have accounts on this site.
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_name TEXT,

  notes TEXT,
  confirmed BOOLEAN NOT NULL DEFAULT false,

  -- Start times are derived from the event start and the running total, so
  -- inserting an item at the top does not require rewriting every time below
  -- it. Order is the only thing stored.
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER event_plan_program_items_set_updated_at
  BEFORE UPDATE ON public.event_plan_program_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX event_plan_program_plan_idx ON public.event_plan_program_items (plan_id, sort_order);

-- ----------------------------------------------------------------------------
-- Budget and purchasing
-- ----------------------------------------------------------------------------
CREATE TABLE public.event_plan_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.event_plans(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),

  estimated_cents INTEGER CHECK (estimated_cents IS NULL OR estimated_cents >= 0),
  actual_cents INTEGER CHECK (actual_cents IS NULL OR actual_cents >= 0),

  -- The distinction the old documents never made: a table the church already
  -- owns and a table somebody has to go and buy both appeared as "tables".
  source TEXT NOT NULL DEFAULT 'purchase'
    CHECK (source IN ('owned', 'borrowed', 'donated', 'purchase', 'rental')),

  vendor TEXT,
  purchaser_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  purchase_by DATE,
  purchase_status TEXT NOT NULL DEFAULT 'to_do'
    CHECK (purchase_status IN ('not_needed', 'to_do', 'ordered', 'purchased', 'received')),
  reimbursement_status TEXT NOT NULL DEFAULT 'not_applicable'
    CHECK (reimbursement_status IN ('not_applicable', 'pending', 'submitted', 'reimbursed')),

  -- Private receipts bucket, same as public.expenses.
  receipt_path TEXT,
  notes TEXT,

  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER event_plan_budget_items_set_updated_at
  BEFORE UPDATE ON public.event_plan_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX event_plan_budget_plan_idx ON public.event_plan_budget_items (plan_id, sort_order);

-- ----------------------------------------------------------------------------
-- People and participation
-- ----------------------------------------------------------------------------
CREATE TABLE public.event_plan_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.event_plans(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  person_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN (
    'speaker', 'prayer_leader', 'musician', 'praise_team', 'facilitator',
    'performer', 'participant', 'volunteer', 'vendor', 'honoree', 'guest'
  )),

  -- Guest ministers and vendors are not members, so their details live here.
  -- Read access is the plan's, which keeps a visiting preacher's mobile number
  -- off any screen a general member can open.
  phone TEXT,
  email TEXT,

  invitation_status TEXT NOT NULL DEFAULT 'not_invited'
    CHECK (invitation_status IN ('not_invited', 'invited', 'declined')),
  confirmation_status TEXT NOT NULL DEFAULT 'unconfirmed'
    CHECK (confirmation_status IN ('unconfirmed', 'confirmed', 'cancelled')),

  arrival_time TEXT,
  requirements TEXT,
  notes TEXT,

  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER event_plan_people_set_updated_at
  BEFORE UPDATE ON public.event_plan_people
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX event_plan_people_plan_idx ON public.event_plan_people (plan_id, sort_order);

-- ----------------------------------------------------------------------------
-- Communications and promotion (one row per plan)
-- ----------------------------------------------------------------------------
CREATE TABLE public.event_plan_promotion (
  plan_id UUID PRIMARY KEY REFERENCES public.event_plans(id) ON DELETE CASCADE,

  flyer_required BOOLEAN NOT NULL DEFAULT false,
  creative_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  draft_due DATE,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  promo_starts_on DATE,
  promo_ends_on DATE,

  -- website, announcements, text, email, facebook, instagram, printed_flyer,
  -- partner_churches, community_groups
  channels TEXT[] NOT NULL DEFAULT '{}',

  registration_url TEXT,
  announcement_schedule TEXT,
  reminder_schedule TEXT,
  copy TEXT,

  approval_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (approval_status IN ('not_started', 'in_review', 'approved', 'revisions_requested')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER event_plan_promotion_set_updated_at
  BEFORE UPDATE ON public.event_plan_promotion
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Day-of checklist
-- ----------------------------------------------------------------------------
-- Separate from tasks on purpose. Planning tasks are weeks of preparation;
-- this is the list somebody reads off a phone while the doors are opening, and
-- mixing them means the person unlocking the building scrolls past sixteen
-- promotional deadlines to find "unlock the building".
CREATE TABLE public.event_plan_dayof_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.event_plans(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  at_time TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_name TEXT,
  notes TEXT,

  done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  done_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX event_plan_dayof_plan_idx ON public.event_plan_dayof_items (plan_id, sort_order);

CREATE OR REPLACE FUNCTION public.event_plan_dayof_stamp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.done AND (TG_OP = 'INSERT' OR NOT OLD.done) THEN
    NEW.done_at := now();
    NEW.done_by := auth.uid();
  ELSIF NOT NEW.done THEN
    NEW.done_at := NULL;
    NEW.done_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER event_plan_dayof_items_stamp
  BEFORE INSERT OR UPDATE ON public.event_plan_dayof_items
  FOR EACH ROW EXECUTE FUNCTION public.event_plan_dayof_stamp();

-- ----------------------------------------------------------------------------
-- Post-event report (one row per plan)
-- ----------------------------------------------------------------------------
CREATE TABLE public.event_plan_reports (
  plan_id UUID PRIMARY KEY REFERENCES public.event_plans(id) ON DELETE CASCADE,

  actual_attendance INTEGER CHECK (actual_attendance IS NULL OR actual_attendance >= 0),
  visitors INTEGER CHECK (visitors IS NULL OR visitors >= 0),
  registrations INTEGER CHECK (registrations IS NULL OR registrations >= 0),

  -- Spiritual response. Counts only, never names: who came to the altar is not
  -- a field on a planning record, and the souls themselves are kept in the
  -- evangelism module behind its own permissions.
  salvations INTEGER CHECK (salvations IS NULL OR salvations >= 0),
  baptisms INTEGER CHECK (baptisms IS NULL OR baptisms >= 0),
  prayer_requests INTEGER CHECK (prayer_requests IS NULL OR prayer_requests >= 0),
  followup_contacts INTEGER CHECK (followup_contacts IS NULL OR followup_contacts >= 0),

  offering_cents INTEGER CHECK (offering_cents IS NULL OR offering_cents >= 0),
  actual_expense_cents INTEGER CHECK (actual_expense_cents IS NULL OR actual_expense_cents >= 0),

  outcomes TEXT,
  what_worked TEXT,
  what_did_not_work TEXT,
  remaining_supplies TEXT,
  recommendations TEXT,

  -- Whether next year should start from this one.
  make_template BOOLEAN NOT NULL DEFAULT false,

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER event_plan_reports_set_updated_at
  BEFORE UPDATE ON public.event_plan_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Approval history
-- ----------------------------------------------------------------------------
-- Append-only, like contact_activity: there is no UPDATE or DELETE policy for
-- it below. A record of who approved what, which can be quietly rewritten
-- afterwards, is not a record.
CREATE TABLE public.event_plan_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.event_plans(id) ON DELETE CASCADE,

  action TEXT NOT NULL CHECK (action IN (
    'submitted', 'under_review', 'approved', 'revisions_requested', 'withdrawn'
  )),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX event_plan_approvals_plan_idx
  ON public.event_plan_approvals (plan_id, created_at DESC);

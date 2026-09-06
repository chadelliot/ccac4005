-- ============================================================================
-- Event Planning Center: who may see and change a plan
-- ============================================================================
-- Ten tables share one access rule, so the rule is written once as a function
-- and every policy calls it. Restating a four-part condition ten times gives
-- ten chances to get it wrong, and the copy that drifts is the one that leaks —
-- a budget or a guest minister's phone number, in this case.
--
-- No new identity system. This maps the roles in the brief onto what the site
-- already has:
--
--   Senior Leadership -> the events_review capability, already the people who
--                        approve events for the public calendar
--   Event Owner       -> event_plans.owner_id
--   Ministry Leader   -> leader of the hosting group
--   Task Assignee     -> assigned on any task in the plan
--
-- SECURITY DEFINER so the helpers read the underlying tables without RLS. That
-- also stops the obvious recursion: the policy on event_plan_tasks calls a
-- function that reads event_plan_tasks, which would otherwise re-enter the
-- same policy forever.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_view_event_plan(_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_plans p
    WHERE p.id = _plan_id
      AND (
        public.has_capability(auth.uid(), 'events_review')
        OR p.owner_id = auth.uid()
        OR p.created_by = auth.uid()
        OR (p.group_id IS NOT NULL AND public.is_group_leader(auth.uid(), p.group_id))
        -- Someone carrying a task on this event can see the event. Being asked
        -- to buy the decorations without being allowed to read what the
        -- decorations are for is not a permission model, it is an obstacle.
        OR EXISTS (
          SELECT 1 FROM public.event_plan_tasks t
          WHERE t.plan_id = p.id AND t.assigned_to = auth.uid()
        )
      )
  );
$$;

-- Editing is narrower than viewing: a task assignee reads the plan and updates
-- their own tasks, but does not rewrite the budget.
CREATE OR REPLACE FUNCTION public.can_edit_event_plan(_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_plans p
    WHERE p.id = _plan_id
      AND (
        public.has_capability(auth.uid(), 'events_review')
        OR p.owner_id = auth.uid()
        OR p.created_by = auth.uid()
        OR (p.group_id IS NOT NULL AND public.is_group_leader(auth.uid(), p.group_id))
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_event_plan(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_event_plan(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_event_plan(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_event_plan(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- Default privileges have to be revoked, not assumed
-- ----------------------------------------------------------------------------
-- Supabase grants ALL on every new table in public to anon and authenticated.
-- Granting SELECT afterwards adds nothing and subtracts nothing, so each table
-- is stripped first and given back only what it needs. Learned the hard way on
-- contact_activity, where a column-level grant appeared to restrict updates and
-- did not.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'event_plans', 'event_plan_modules', 'event_plan_tasks', 'event_plan_program_items',
    'event_plan_budget_items', 'event_plan_people', 'event_plan_promotion',
    'event_plan_dayof_items', 'event_plan_reports', 'event_plan_approvals',
    'event_plan_templates', 'event_plan_template_tasks', 'event_plan_template_program_items'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- The plan itself
-- ----------------------------------------------------------------------------
CREATE POLICY "View plans you are part of" ON public.event_plans
  FOR SELECT TO authenticated USING (public.can_view_event_plan(id));

-- Any signed-in member may propose an event, the same way they may already
-- submit one to the public calendar. It arrives as a draft owned by them.
CREATE POLICY "Members create plans" ON public.event_plans
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners and leadership update plans" ON public.event_plans
  FOR UPDATE TO authenticated
  USING (public.can_edit_event_plan(id))
  WITH CHECK (public.can_edit_event_plan(id));

-- Deleting a plan takes its tasks, budget and history with it, so it stays
-- with leadership and the person who created it.
CREATE POLICY "Creator or leadership delete plans" ON public.event_plans
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_capability(auth.uid(), 'events_review'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_plans TO authenticated;

-- ----------------------------------------------------------------------------
-- Sections that follow the plan exactly
-- ----------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'event_plan_modules', 'event_plan_program_items', 'event_plan_budget_items',
    'event_plan_people', 'event_plan_promotion', 'event_plan_dayof_items',
    'event_plan_reports'
  ]
  LOOP
    EXECUTE format($f$
      CREATE POLICY "View with the plan" ON public.%I
        FOR SELECT TO authenticated USING (public.can_view_event_plan(plan_id));
      CREATE POLICY "Edit with the plan" ON public.%I
        FOR INSERT TO authenticated WITH CHECK (public.can_edit_event_plan(plan_id));
      CREATE POLICY "Update with the plan" ON public.%I
        FOR UPDATE TO authenticated
        USING (public.can_edit_event_plan(plan_id))
        WITH CHECK (public.can_edit_event_plan(plan_id));
      CREATE POLICY "Delete with the plan" ON public.%I
        FOR DELETE TO authenticated USING (public.can_edit_event_plan(plan_id));
    $f$, t, t, t, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END;
$$;

-- The day-of checklist is the exception: anyone who can see the plan may tick
-- an item off. On the day, whoever is holding the phone is the one who unlocked
-- the door, and stopping to work out whether they count as an editor is how a
-- checklist stops being used.
DROP POLICY "Update with the plan" ON public.event_plan_dayof_items;
CREATE POLICY "Anyone on the plan ticks the checklist" ON public.event_plan_dayof_items
  FOR UPDATE TO authenticated
  USING (public.can_view_event_plan(plan_id))
  WITH CHECK (public.can_view_event_plan(plan_id));

-- ----------------------------------------------------------------------------
-- Tasks: viewers read, editors manage, assignees update their own
-- ----------------------------------------------------------------------------
CREATE POLICY "View tasks with the plan" ON public.event_plan_tasks
  FOR SELECT TO authenticated USING (public.can_view_event_plan(plan_id));

CREATE POLICY "Editors create tasks" ON public.event_plan_tasks
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_event_plan(plan_id));

-- An assignee may move their own task along without being able to touch
-- anybody else's, or to reassign it away from themselves.
CREATE POLICY "Editors and assignees update tasks" ON public.event_plan_tasks
  FOR UPDATE TO authenticated
  USING (public.can_edit_event_plan(plan_id) OR assigned_to = auth.uid())
  WITH CHECK (public.can_edit_event_plan(plan_id) OR assigned_to = auth.uid());

CREATE POLICY "Editors delete tasks" ON public.event_plan_tasks
  FOR DELETE TO authenticated USING (public.can_edit_event_plan(plan_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_plan_tasks TO authenticated;

-- ----------------------------------------------------------------------------
-- Approval history: append-only
-- ----------------------------------------------------------------------------
CREATE POLICY "View approval history with the plan" ON public.event_plan_approvals
  FOR SELECT TO authenticated USING (public.can_view_event_plan(plan_id));

-- Submitting is the owner's act; deciding is leadership's. Both are recorded
-- here, so the insert allows either and records who did it.
CREATE POLICY "Record your own approval action" ON public.event_plan_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      (action IN ('submitted', 'withdrawn') AND public.can_edit_event_plan(plan_id))
      OR (action IN ('under_review', 'approved', 'revisions_requested')
          AND public.has_capability(auth.uid(), 'events_review'))
    )
  );

-- No UPDATE or DELETE policy, deliberately.
GRANT SELECT, INSERT ON public.event_plan_approvals TO authenticated;

-- ----------------------------------------------------------------------------
-- Templates: readable by everyone signed in, editable by leadership
-- ----------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'event_plan_templates', 'event_plan_template_tasks', 'event_plan_template_program_items'
  ]
  LOOP
    EXECUTE format($f$
      CREATE POLICY "Anyone signed in reads templates" ON public.%I
        FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Leadership manages templates" ON public.%I
        FOR ALL TO authenticated
        USING (public.has_capability(auth.uid(), 'events_review'))
        WITH CHECK (public.has_capability(auth.uid(), 'events_review'));
    $f$, t, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END;
$$;

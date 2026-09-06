-- ============================================================================
-- Task and budget totals per plan
-- ============================================================================
-- The dashboard needs progress and overdue counts for every plan on one screen.
-- Without this it would fetch every task of every event to count them in the
-- browser — which works at four plans and stops working at forty, and ships a
-- volunteer the whole church's task list to render a progress bar.
--
-- security_invoker so the rollup is computed only over the plans the caller may
-- already read. A member with one assigned task sees the numbers for that one
-- event and no others.
-- ============================================================================

CREATE VIEW public.event_plan_rollup
WITH (security_invoker = true) AS
SELECT
  p.id AS plan_id,
  count(t.id) FILTER (WHERE t.status <> 'not_needed') AS task_total,
  count(t.id) FILTER (WHERE t.status = 'completed') AS task_done,
  count(t.id) FILTER (
    WHERE t.status NOT IN ('completed', 'not_needed')
      AND t.due_date IS NOT NULL
      AND t.due_date < CURRENT_DATE
  ) AS task_overdue,
  count(t.id) FILTER (WHERE t.status = 'blocked') AS task_blocked,
  coalesce(b.estimated_cents, 0) AS budget_estimated_cents,
  coalesce(b.actual_cents, 0) AS budget_actual_cents,
  coalesce(b.unpurchased, 0) AS budget_unpurchased
FROM public.event_plans p
LEFT JOIN public.event_plan_tasks t ON t.plan_id = p.id
LEFT JOIN LATERAL (
  SELECT
    sum(i.estimated_cents * i.quantity) AS estimated_cents,
    sum(i.actual_cents * i.quantity) AS actual_cents,
    -- Things somebody still has to go and get. Items the church already owns
    -- or has been given are not outstanding work.
    count(*) FILTER (
      WHERE i.source IN ('purchase', 'rental')
        AND i.purchase_status IN ('to_do', 'ordered')
    ) AS unpurchased
  FROM public.event_plan_budget_items i
  WHERE i.plan_id = p.id
) b ON true
GROUP BY p.id, b.estimated_cents, b.actual_cents, b.unpurchased;

COMMENT ON VIEW public.event_plan_rollup IS
  'Task progress and budget totals per plan. security_invoker: only covers plans the caller may read.';

GRANT SELECT ON public.event_plan_rollup TO authenticated;

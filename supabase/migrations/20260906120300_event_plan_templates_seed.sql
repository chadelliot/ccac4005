-- ============================================================================
-- Event Planning Center: the six starting templates
-- ============================================================================
-- Seeded as data so a wrong deadline is a row to fix, not a deployment. Task
-- timings are weeks before the event; the application converts them to dates
-- against the real event date and compresses them when an event is created too
-- close to happen on the full schedule.
--
-- Idempotent — re-running replaces the seeded set rather than doubling it.
-- ============================================================================

DELETE FROM public.event_plan_templates WHERE key IN (
  'worship_service', 'prayer_revival', 'workshop', 'fellowship', 'outreach', 'public_vendor'
);

INSERT INTO public.event_plan_templates (key, name, description, default_modules, lead_weeks, sort_order)
VALUES
  ('worship_service', 'Special Worship Service',
   'A service outside the normal Sunday rhythm — anniversary, musical, or a visiting minister.',
   ARRAY['guest_ministry', 'promotion', 'photography'], 8, 1),

  ('prayer_revival', 'Prayer or Revival Service',
   'Consecutive nights of prayer and preaching, with an altar call each night.',
   ARRAY['guest_ministry', 'promotion', 'evangelism_followup', 'multi_day'], 8, 2),

  ('workshop', 'Workshop or Training',
   'Teaching with a facilitator, handouts and a registration list.',
   ARRAY['registration', 'food', 'promotion'], 6, 3),

  ('fellowship', 'Fellowship or Appreciation Event',
   'A meal or a night of honour — banquets, appreciation services, church family gatherings.',
   ARRAY['food', 'gifts', 'promotion', 'photography'], 8, 4),

  ('outreach', 'Community Outreach',
   'Going out to the neighbourhood: street evangelism, a block giveaway, a park service.',
   ARRAY['outdoor', 'evangelism_followup', 'food', 'promotion', 'transportation'], 6, 5),

  ('public_vendor', 'Large Public or Vendor Event',
   'Open to the public with vendors, permits and money changing hands.',
   ARRAY['vendors', 'outdoor', 'registration', 'promotion', 'food', 'fundraising', 'photography'], 16, 6);

-- ----------------------------------------------------------------------------
-- Tasks
-- ----------------------------------------------------------------------------
-- module_key ties a task to a module: it is only generated when that module is
-- switched on. NULL means every event of this type gets it.
INSERT INTO public.event_plan_template_tasks
  (template_id, title, category, weeks_before, priority, module_key, sort_order)
SELECT t.id, x.title, x.category, x.weeks_before, x.priority, x.module_key, x.sort_order
FROM public.event_plan_templates t
JOIN (VALUES
  -- Shared spine: every event needs an owner, a date, a room and a sign-off.
  ('*', 'Confirm date, time and location',                'leadership',     8.0, 'high',     NULL,                   1),
  ('*', 'Submit plan for leadership approval',            'leadership',     6.0, 'critical', NULL,                   2),
  ('*', 'Confirm event owner and supporting team',        'leadership',     6.0, 'high',     NULL,                   3),
  ('*', 'Draft the order of service',                     'program',        3.0, 'high',     NULL,                   4),
  ('*', 'Confirm setup team and arrival time',            'setup',          1.0, 'high',     NULL,                   5),
  ('*', 'Confirm cleanup team and lockup',                'cleanup',        1.0, 'normal',   NULL,                   6),
  ('*', 'Final walkthrough of the program',               'program',        0.5, 'high',     NULL,                   7),
  ('*', 'Post-event report and lessons learned',          'follow_up',     -0.4, 'normal',   NULL,                   8),

  -- Modules, generated only when switched on.
  ('*', 'Invite guest minister and confirm in writing',   'speaker',        8.0, 'critical', 'guest_ministry',       10),
  ('*', 'Confirm honorarium and travel arrangements',     'speaker',        4.0, 'high',     'guest_ministry',       11),
  ('*', 'Confirm speaker arrival time and needs',         'speaker',        1.0, 'high',     'guest_ministry',       12),
  ('*', 'Brief the designer on the flyer',                'promotion',      6.0, 'high',     'promotion',            20),
  ('*', 'Approve final flyer',                            'promotion',      4.0, 'high',     'promotion',            21),
  ('*', 'Begin announcements and social posts',           'promotion',      3.0, 'normal',   'promotion',            22),
  ('*', 'Send final reminder',                            'promotion',      0.3, 'normal',   'promotion',            23),
  ('*', 'Open registration',                              'registration',   5.0, 'high',     'registration',         30),
  ('*', 'Take final headcount',                           'registration',   1.0, 'high',     'registration',         31),
  ('*', 'Plan the menu and quantities',                   'food',           4.0, 'high',     'food',                 40),
  ('*', 'Confirm servers and kitchen team',               'food',           2.0, 'normal',   'food',                 41),
  ('*', 'Buy food and supplies',                          'purchasing',     0.5, 'high',     'food',                 42),
  ('*', 'Confirm children''s supervision and ratios',     'safety',         3.0, 'critical', 'children_youth',       50),
  ('*', 'Arrange transportation and drivers',             'transportation', 3.0, 'high',     'transportation',       60),
  ('*', 'Weather contingency and rain plan',              'safety',         2.0, 'critical', 'outdoor',              70),
  ('*', 'Confirm outdoor power, sound and shelter',       'equipment',      2.0, 'high',     'outdoor',              71),
  ('*', 'Send vendor agreements and collect fees',        'leadership',    10.0, 'critical', 'vendors',              80),
  ('*', 'Confirm permits and insurance',                  'safety',         8.0, 'critical', 'vendors',              81),
  ('*', 'Publish vendor placement map',                   'facilities',     2.0, 'normal',   'vendors',              82),
  ('*', 'Reconcile vendor payments',                      'purchasing',    -0.4, 'high',     'vendors',              83),
  ('*', 'Confirm photographer or videographer',           'media',          3.0, 'normal',   'photography',          90),
  ('*', 'Prepare visitor cards and follow-up plan',       'evangelism',     2.0, 'high',     'evangelism_followup', 100),
  ('*', 'Enter visitors and assign follow-up',            'follow_up',     -0.3, 'high',     'evangelism_followup', 101),
  ('*', 'Recruit and confirm volunteers',                 'volunteers',     4.0, 'high',     'volunteers',          110),
  ('*', 'Order gifts and plaques',                        'purchasing',     4.0, 'normal',   'gifts',               120),
  ('*', 'Set fundraising goal and collection method',     'leadership',     6.0, 'high',     'fundraising',         130),
  ('*', 'Confirm each day''s schedule and staffing',      'program',        2.0, 'high',     'multi_day',           140)
) AS x(scope, title, category, weeks_before, priority, module_key, sort_order)
  ON x.scope = '*'
WHERE t.key IN ('worship_service', 'prayer_revival', 'workshop', 'fellowship', 'outreach', 'public_vendor');

-- Type-specific tasks on top of the shared spine.
INSERT INTO public.event_plan_template_tasks
  (template_id, title, category, weeks_before, priority, sort_order)
SELECT t.id, x.title, x.category, x.weeks_before, x.priority, x.sort_order
FROM public.event_plan_templates t
JOIN (VALUES
  ('prayer_revival', 'Set the prayer themes for each night',   'program',    4.0, 'high',   200),
  ('prayer_revival', 'Confirm MC and prayer leaders',          'program',    3.0, 'high',   201),
  ('prayer_revival', 'Confirm praise team and rehearsal',      'music',      3.0, 'high',   202),
  ('prayer_revival', 'Pre-service outreach in the area',       'evangelism', 2.0, 'normal', 203),

  ('workshop',       'Write learning objectives',              'program',    5.0, 'high',   200),
  ('workshop',       'Prepare lesson plan and exercises',      'program',    3.0, 'high',   201),
  ('workshop',       'Print handouts and materials',           'purchasing', 1.0, 'normal', 202),
  ('workshop',       'Prepare follow-up materials',            'follow_up', -0.3, 'normal', 203),

  ('outreach',       'Confirm outreach location and permission','facilities', 5.0, 'critical', 200),
  ('outreach',       'Prepare evangelism materials and tracts', 'evangelism', 3.0, 'high',   201),
  ('outreach',       'Set up prayer station',                   'evangelism', 1.0, 'normal', 202),
  ('outreach',       'Plan games or activities',                'program',    2.0, 'normal', 203),

  ('worship_service','Confirm musicians and rehearsal',         'music',      3.0, 'high',   200),
  ('worship_service','Confirm sound, projection and streaming', 'media',      2.0, 'high',   201),

  ('fellowship',     'Confirm decorations and table settings',  'facilities', 3.0, 'normal', 200),
  ('fellowship',     'Confirm honourees and citations',         'program',    4.0, 'high',   201),

  ('public_vendor',  'Publish restricted-item policy',          'safety',     8.0, 'high',   200),
  ('public_vendor',  'Public promotion beyond the church',      'promotion',  6.0, 'high',   201),
  ('public_vendor',  'Food safety and handling plan',           'safety',     3.0, 'critical', 202),
  ('public_vendor',  'Financial reconciliation',                'purchasing',-0.4, 'critical', 203)
) AS x(key, title, category, weeks_before, priority, sort_order)
  ON x.key = t.key;

-- ----------------------------------------------------------------------------
-- Program items
-- ----------------------------------------------------------------------------
INSERT INTO public.event_plan_template_program_items
  (template_id, title, duration_minutes, sort_order)
SELECT t.id, x.title, x.minutes, x.sort_order
FROM public.event_plan_templates t
JOIN (VALUES
  ('worship_service', 'Welcome',            5, 1),
  ('worship_service', 'Opening prayer',     5, 2),
  ('worship_service', 'Praise and worship',25, 3),
  ('worship_service', 'Scripture',          5, 4),
  ('worship_service', 'Offering',          10, 5),
  ('worship_service', 'Preached word',     40, 6),
  ('worship_service', 'Altar call',        15, 7),
  ('worship_service', 'Announcements',      5, 8),
  ('worship_service', 'Benediction',        5, 9),

  ('prayer_revival',  'Welcome',            5, 1),
  ('prayer_revival',  'Opening prayer',    10, 2),
  ('prayer_revival',  'Praise and worship',20, 3),
  ('prayer_revival',  'Corporate prayer',  20, 4),
  ('prayer_revival',  'Scripture',          5, 5),
  ('prayer_revival',  'Preached word',     35, 6),
  ('prayer_revival',  'Altar call',        20, 7),
  ('prayer_revival',  'Benediction',        5, 8),

  ('workshop',        'Welcome and prayer',  10, 1),
  ('workshop',        'Introductions',       10, 2),
  ('workshop',        'Teaching session',    45, 3),
  ('workshop',        'Exercise or discussion',30, 4),
  ('workshop',        'Questions',           15, 5),
  ('workshop',        'Refreshments',        20, 6),
  ('workshop',        'Closing prayer',       5, 7),

  ('fellowship',      'Welcome',            10, 1),
  ('fellowship',      'Opening prayer',      5, 2),
  ('fellowship',      'Meal',               45, 3),
  ('fellowship',      'Presentation',       20, 4),
  ('fellowship',      'Remarks',            15, 5),
  ('fellowship',      'Benediction',         5, 6),

  ('outreach',        'Team prayer and briefing',15, 1),
  ('outreach',        'Setup',                   30, 2),
  ('outreach',        'Outreach',               120, 3),
  ('outreach',        'Prayer station',         120, 4),
  ('outreach',        'Cleanup',                 30, 5),
  ('outreach',        'Debrief',                 15, 6),

  ('public_vendor',   'Vendor setup',        90, 1),
  ('public_vendor',   'Gates open',           5, 2),
  ('public_vendor',   'Welcome and prayer',  10, 3),
  ('public_vendor',   'Programme',          180, 4),
  ('public_vendor',   'Closing',             15, 5),
  ('public_vendor',   'Vendor breakdown',    60, 6)
) AS x(key, title, minutes, sort_order)
  ON x.key = t.key;

-- finance_management was added after the migration that seeded existing admins
-- with every capability, so nobody holds it and the finance screens would be
-- unreachable — including by the person who needs to grant it to anyone else.
--
-- Granted only to admin_management holders, not to all admins. Finance is the
-- most sensitive area in the application and the capability system exists
-- precisely so it is not handed out by default; whoever runs Admin Settings can
-- pass it on deliberately.
INSERT INTO public.admin_capability_grants (user_id, capability)
SELECT g.user_id, 'finance_management'::public.admin_capability
FROM public.admin_capability_grants g
WHERE g.capability = 'admin_management'
ON CONFLICT DO NOTHING;

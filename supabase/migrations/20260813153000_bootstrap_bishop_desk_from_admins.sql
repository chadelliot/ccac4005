-- One-time bootstrap of the Bishop's Desk roster.
--
-- The desk roster is deliberately independent of user_roles: holding 'admin'
-- is not meant to confer standing access to a visiting church's correspondence
-- or the Bishop's private notes. That separation is the point of the table.
--
-- But an empty roster cannot be filled through the UI, because the UI is behind
-- the roster. Something has to seed the first member. Seeding it from the
-- existing admins is the narrowest bootstrap available: those accounts already
-- administer the church's data, the grant is recorded explicitly as a row here,
-- and it can be revoked without touching anyone's role.
--
-- This is a bootstrap, not a rule. Nothing re-runs it, no trigger keeps the two
-- in step, and a later admin gets no desk access from this migration.
--
-- No email address is hardcoded: this repository is intended to become public,
-- and a committed address is a harvesting target. The join finds the accounts
-- by role instead.

DO $$
DECLARE
  admin_count integer;
  inserted_count integer;
  roster_count integer;
BEGIN
  SELECT count(*) INTO admin_count
  FROM public.user_roles WHERE role = 'admin';

  INSERT INTO public.bishop_booking_authorized_users (user_id, email, display_name, is_bishop)
  SELECT
    ur.user_id,
    u.email,
    COALESCE(NULLIF(btrim(p.display_name), ''), u.email),
    -- Never granted here. Bishop-visibility notes are a deliberate second
    -- step, set by hand for the Bishop's own account only.
    false
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin'
  ON CONFLICT (user_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  SELECT count(*) INTO roster_count FROM public.bishop_booking_authorized_users;

  RAISE NOTICE 'bishop desk bootstrap: % admin role rows found, % added to the roster, % on the roster now',
    admin_count, inserted_count, roster_count;

  IF roster_count = 0 THEN
    RAISE WARNING 'bishop desk bootstrap added nobody — no account holds the admin role, so the desk is still unreachable. Grant desk access by hand before publishing the invitation page.';
  END IF;
END $$;

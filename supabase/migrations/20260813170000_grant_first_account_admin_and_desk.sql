-- Bootstrap the first real account on the new CCAC project.
--
-- The project was created with schema but no data, so there was no admin and no
-- Bishop's Desk member — and neither can be granted through the UI, because
-- both screens are behind the very permissions being granted. Something has to
-- seed the first one.
--
-- Keyed to "the only account that exists" rather than to an email address. Two
-- reasons: this repository is intended to become public, and a committed
-- address is a harvesting target; and an identifier that has to be kept in sync
-- with reality is a footgun in a file that runs unattended.
--
-- Guarded deliberately. If the count is anything other than exactly one, this
-- does nothing and says so, rather than guessing which of several accounts
-- should hold administrative rights over the church's data.

DO $$
DECLARE
  user_count  integer;
  target      uuid;
  admin_added integer := 0;
  desk_added  integer := 0;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;

  IF user_count = 0 THEN
    RAISE WARNING 'bootstrap: no accounts exist yet — nothing granted.';
    RETURN;
  END IF;

  IF user_count > 1 THEN
    RAISE WARNING 'bootstrap: % accounts exist — refusing to guess which should be admin. Grant by hand.', user_count;
    RETURN;
  END IF;

  SELECT id INTO target FROM auth.users LIMIT 1;

  -- user_roles has no unique constraint on (user_id, role), so ON CONFLICT has
  -- nothing to bite on. Guard with NOT EXISTS instead, which also makes the
  -- migration safe to re-run.
  INSERT INTO public.user_roles (user_id, role)
  SELECT target, 'admin'::public.app_role
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = target AND role = 'admin'::public.app_role
  );
  GET DIAGNOSTICS admin_added = ROW_COUNT;

  INSERT INTO public.bishop_booking_authorized_users (user_id, email, display_name, is_bishop)
  SELECT
    u.id,
    u.email,
    COALESCE(NULLIF(btrim(p.display_name), ''), u.email),
    -- Not the Bishop's own account, so no access to Bishop-only notes. That
    -- flag is set by hand for him alone.
    false
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = target
  ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS desk_added = ROW_COUNT;

  RAISE NOTICE 'bootstrap: 1 account found; admin role rows added %, desk roster rows added %',
    admin_added, desk_added;
END $$;

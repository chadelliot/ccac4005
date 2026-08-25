-- Adding the capability has to be its own migration. Postgres refuses to use a
-- new enum value in the transaction that created it ("unsafe use of new value"),
-- and each migration runs in one transaction — so the policies that reference
-- 'finance_management' must land in a later one.
--
-- Finance is its own trust boundary rather than part of a general admin role:
-- someone who reviews events has no reason to see what the church pays its
-- musicians.
ALTER TYPE public.admin_capability ADD VALUE IF NOT EXISTS 'finance_management';

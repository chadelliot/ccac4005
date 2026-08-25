-- ============================================================================
-- Church finances: expenses, payees and receipts
-- ============================================================================
-- What the church spends, categorised, with the receipt attached — the record
-- an accountant needs at year end and the church needs if it is ever asked.
--
-- Amounts are stored in CENTS as integers. Money in floating point accumulates
-- rounding error the moment it is summed, and a year-end total that is a few
-- cents out is a year-end total nobody can reconcile.
--
-- Deliberately separate from giving. Contributions involve donor records,
-- written acknowledgements and statements that assert tax-deductible status —
-- a different privacy boundary and a different compliance question, and the
-- church's 501(c)(3) determination has not yet come back.
-- ============================================================================

-- The finance_management capability is added by the migration immediately
-- before this one; Postgres will not let a new enum value be used in the same
-- transaction that creates it.

-- ----------------------------------------------------------------------------
-- Categories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  -- Whether spending here typically goes to a person who may need a 1099.
  commonly_1099 BOOLEAN NOT NULL DEFAULT false,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.expense_categories (name, description, commonly_1099, sort_order)
SELECT * FROM (VALUES
  ('Utilities',            'Electric, gas, water, internet, phone.',                       false, 1),
  ('Rent & Facilities',    'Rent, mortgage, repairs, cleaning, security.',                 false, 2),
  ('Music & Worship',      'Musicians, sound engineers, instrument hire and repair.',      true,  3),
  ('Guest Ministry',       'Honoraria, travel and lodging for visiting ministers.',        true,  4),
  ('Food & Hospitality',   'Meals for services, events and outreach.',                     false, 5),
  ('Outreach & Evangelism','Tracts, supplies and costs of going out.',                     false, 6),
  ('Benevolence',          'Assistance given to individuals and families in need.',        false, 7),
  ('Office & Admin',       'Supplies, postage, software, bank and processing fees.',       false, 8),
  ('Insurance',            'Property, liability and any other cover.',                     false, 9),
  ('Professional Fees',    'Accounting, legal and other professional services.',           true, 10),
  ('Missions & Giving',    'Support sent to other ministries and missions.',               false, 11),
  ('Transport',            'Vehicle costs, fuel, and travel that is not guest ministry.',  false, 12),
  ('Equipment',            'Purchases expected to last beyond the year.',                  false, 13),
  ('Other',                'Anything that does not fit above — review these at year end.', false, 99)
) AS v(name, description, commonly_1099, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories c WHERE c.name = v.name);

-- ----------------------------------------------------------------------------
-- Payees
-- ----------------------------------------------------------------------------
-- Who the money went to. Kept as its own table so a year's payments to one
-- musician can be totalled — the number that decides whether a 1099-NEC is
-- required is the annual total per person, not any single payment.
CREATE TABLE IF NOT EXISTS public.payees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'individual' CHECK (kind IN ('individual', 'business')),
  email TEXT,
  phone TEXT,
  address TEXT,
  -- Whether a W-9 has been collected. The tax identification number itself is
  -- deliberately NOT stored: it is the most sensitive number a person has, this
  -- application has no need to read it back, and holding it would make every
  -- future breach materially worse. Keep the signed W-9 wherever the church
  -- keeps its paper records.
  w9_on_file BOOLEAN NOT NULL DEFAULT false,
  w9_received_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payees_name_idx ON public.payees (lower(name));

-- ----------------------------------------------------------------------------
-- Expenses
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spent_on DATE NOT NULL,
  -- Cents. See the note at the top of this file.
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category_id UUID REFERENCES public.expense_categories(id),
  payee_id UUID REFERENCES public.payees(id),
  -- Free text for one-off vendors not worth a payee record.
  vendor TEXT,
  description TEXT,
  payment_method TEXT CHECK (payment_method IN ('cash','check','card','transfer','other')),
  check_number TEXT,
  receipt_path TEXT,
  -- Set when a human has confirmed the figures, whether typed or read from a
  -- photograph. An unreviewed row should never reach a tax return.
  reviewed BOOLEAN NOT NULL DEFAULT false,
  entered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_spent_on_idx ON public.expenses (spent_on DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON public.expenses (category_id, spent_on);
CREATE INDEX IF NOT EXISTS expenses_payee_idx ON public.expenses (payee_id, spent_on);

-- ----------------------------------------------------------------------------
-- Access
-- ----------------------------------------------------------------------------
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Categories are a shared vocabulary, readable by any signed-in member.
CREATE POLICY "Members view expense categories" ON public.expense_categories
  FOR SELECT TO authenticated USING (is_active);

-- Everything with a figure or a person attached is finance-only. Not leadership,
-- not admins generally — what the church pays people is nobody else's business.
CREATE POLICY "Finance manages categories" ON public.expense_categories
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'finance_management'))
  WITH CHECK (public.has_capability(auth.uid(), 'finance_management'));

CREATE POLICY "Finance manages payees" ON public.payees
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'finance_management'))
  WITH CHECK (public.has_capability(auth.uid(), 'finance_management'));

CREATE POLICY "Finance manages expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'finance_management'))
  WITH CHECK (public.has_capability(auth.uid(), 'finance_management'));

GRANT SELECT ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories, public.payees, public.expenses TO authenticated;

-- ----------------------------------------------------------------------------
-- Receipts
-- ----------------------------------------------------------------------------
-- Private, unlike event flyers. A receipt can carry a card's last four digits,
-- an address, a signature. Served through signed URLs to finance holders only.
INSERT INTO storage.buckets (id, name, public)
SELECT 'receipts', 'receipts', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'receipts');

CREATE POLICY "Finance reads receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND public.has_capability(auth.uid(), 'finance_management'));

CREATE POLICY "Finance uploads receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND public.has_capability(auth.uid(), 'finance_management'));

CREATE POLICY "Finance replaces receipts" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND public.has_capability(auth.uid(), 'finance_management'));

CREATE POLICY "Finance removes receipts" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND public.has_capability(auth.uid(), 'finance_management'));

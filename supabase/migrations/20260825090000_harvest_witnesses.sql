-- ============================================================================
-- Put the harvest list's witnesses in the right place
-- ============================================================================
-- The import put "Who Witnessed" into co_witness, which is the "Alongside"
-- field for a second witness. It belongs in witness_id — that is the person who
-- actually witnessed to the soul, and the only name the church wants to see
-- against a contact.
--
-- Fifteen spellings, nine people. "Evg Bri", "Evg. Bri", "Evg.Bri" and "Evang
-- Bri" are one person written four ways; leaving them distinct would split her
-- fifteen souls across four rows in every report. Pairs like "Jayla
-- Stevenson/Victoria" become a primary witness plus a genuine second one, which
-- is what co_witness is actually for.
-- ============================================================================

INSERT INTO public.witnesses (name)
SELECT n FROM (VALUES
  ('Pastor Parker'), ('Jayla Stevenson'), ('Kechera Tilghman'), ('Evg. Bri'),
  ('Bishop'), ('Brittny'), ('Co-Pastor Brandi Marcus'), ('First'), ('Saffie'),
  ('Victoria')
) AS v(n)
WHERE NOT EXISTS (SELECT 1 FROM public.witnesses w WHERE w.name = v.n);

-- Map every raw spelling onto its person, and split the pairs.
WITH mapping(raw, primary_name, second_name) AS (VALUES
  ('Pastor Parker',               'Pastor Parker',           NULL),
  ('Jayla Stevenson',             'Jayla Stevenson',         NULL),
  ('Kechera Tilghman',            'Kechera Tilghman',        NULL),
  ('Bishop',                      'Bishop',                  NULL),
  ('Brittny',                     'Brittny',                 NULL),
  ('Co-Pastor Brandi Marcus',     'Co-Pastor Brandi Marcus', NULL),
  ('First',                       'First',                   NULL),
  ('Saffie',                      'Saffie',                  NULL),
  -- One person, four spellings.
  ('Evg Bri',                     'Evg. Bri',                NULL),
  ('Evg. Bri',                    'Evg. Bri',                NULL),
  ('Evg.Bri',                     'Evg. Bri',                NULL),
  ('Evang Bri',                   'Evg. Bri',                NULL),
  -- Genuine pairs: the first name led, the second was alongside.
  ('Jayla Stevenson/Victoria',    'Jayla Stevenson',         'Victoria'),
  ('Evg Bri/Brittny',             'Evg. Bri',                'Brittny'),
  -- A handoff rather than a pair, but Jayla made the contact.
  ('Sis. Jayla -> Pastor Parker', 'Jayla Stevenson',         'Pastor Parker')
)
UPDATE public.evangelism_contacts c
SET witness_id = w.id,
    co_witness = m.second_name
FROM mapping m
JOIN public.witnesses w ON w.name = m.primary_name
WHERE c.source = 'harvest_sheet_2026'
  AND c.co_witness = m.raw;

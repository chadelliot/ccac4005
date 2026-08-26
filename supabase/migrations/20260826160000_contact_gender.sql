-- ============================================================================
-- Gender on a contact, so the harvest can be segmented
-- ============================================================================
-- The men's and women's ministries need to know who is theirs to follow up.
--
-- NULL is a first-class value here, not a gap to be filled by guessing harder.
-- The column is a record of something someone knows, and "we haven't asked" is
-- the honest state for a name met once at a mall door.
-- ============================================================================

ALTER TABLE public.evangelism_contacts
  ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female'));

COMMENT ON COLUMN public.evangelism_contacts.gender IS
  'male | female | NULL when not known. Set from the dropdown on the contact.';

CREATE INDEX evangelism_contacts_gender_idx
  ON public.evangelism_contacts (gender)
  WHERE gender IS NOT NULL;

-- ----------------------------------------------------------------------------
-- A first pass over the 84 souls already logged
-- ----------------------------------------------------------------------------
-- These are inferences, not records. Two signals were used: the given name, and
-- who witnessed to them — outreach pairs off by gender more often than not, so
-- Pastor Parker's column is mostly men and Evg. Bri's mostly women.
--
-- The name wins wherever the two disagree, because the witness signal is a
-- tendency and a name is usually evidence: Jayla witnessed to Eian, Brian, Ryan
-- and Cymon, and Co-Pastor Brandi to Tim. Reading those off the witness would
-- have got five people wrong.
--
-- Anything genuinely ambiguous is left NULL rather than guessed: "Elder
-- Shannon" (unisex name behind a church title), "Angel", and "Mayowa & Monique"
-- (one row holding what looks like a couple). Someone who knows them can pick
-- from the dropdown in a second; a wrong guess sitting in the record looks like
-- a fact and gets acted on.
-- ----------------------------------------------------------------------------

UPDATE public.evangelism_contacts SET gender = 'male'
WHERE gender IS NULL AND first_name IN (
  -- Witnessed by Pastor Parker or Bishop, and male by name
  'Anthony', 'Antoine', 'Bernard', 'Dwayne', 'Elijah', 'Ernest', 'John',
  'Kameron', 'Keon', 'King', 'Marquis', 'Mike', 'Pete', 'Phil', 'Reese',
  'Ricky', 'Ronald', 'Ryen', 'Tay', 'Theron', 'Kavon', 'Tommy', 'Travis',
  -- Male by name despite a woman witnessing — the exceptions that matter
  'Brian', 'Eian', 'Ryan', 'Cymon', 'Tim', 'DeShawn', 'Michael'
);

UPDATE public.evangelism_contacts SET gender = 'female'
WHERE gender IS NULL AND first_name IN (
  'Adrianna', 'Arletta', 'Brianca', 'Brittany', 'Dajai', 'Dejah', 'Icis',
  'Jakeelah', 'Kacey', 'Kadija', 'Konstance', 'Mira', 'Natalie', 'Nicole',
  'Pam', 'Raya', 'Samia', 'Saron', 'Tierra', 'Treyana', 'Valerie',
  'Deasia', 'Janay', 'Kayla', 'Rukia', 'Shay', 'Tammy', 'Tina', 'Whitney',
  'Jasmine', 'Kiera', 'Kirah', 'Kristen', 'Petra', 'Rachel', 'Rokea',
  'Sasha', 'Shamia', 'Tiara', 'Veronica', 'Vondelier', 'Zella',
  'Rayshawna', 'Destiny'
);

-- "Ms Hill" — the title is the evidence, not the name.
UPDATE public.evangelism_contacts SET gender = 'female'
WHERE gender IS NULL AND first_name = 'Ms' AND last_name = 'Hill';

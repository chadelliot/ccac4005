-- The south-eastern quadrant was named "Coldstream, Clifton Park & Darley Park",
-- but Clifton Park sits outside the territory: the church's route runs along the
-- park's western edge, so the park is the boundary rather than ground inside it.
-- Naming a quadrant after somewhere it does not contain would send a team to the
-- wrong side of the line. Coldstream Homestead Montebello and Darley Park are
-- both genuinely inside, so the name now says only what is true.
UPDATE public.evangelism_zones
SET name = 'Coldstream Homestead Montebello & Darley Park',
    description = 'West of Clifton Park, down toward 1401 E North Avenue. The park itself is the eastern boundary.'
WHERE name = 'Coldstream, Clifton Park & Darley Park';

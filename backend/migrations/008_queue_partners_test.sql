-- Manual queue / test partners (idempotent)

UPDATE restaurants SET
  name = 'Test',
  phone = '+17326665066',
  queue_enabled = true,
  call_eligible = true,
  is_queue_open = true
WHERE id = 1 OR LOWER(TRIM(name)) = 'test';

-- Exactly one SriRangam on the queue tab (id 2)
UPDATE restaurants SET queue_enabled = false
WHERE LOWER(name) LIKE '%srirangam%' AND id <> 2;

UPDATE restaurants SET
  name = 'SriRangam Veg Restaurant',
  queue_enabled = true
WHERE id = 2;

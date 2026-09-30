-- ============================================================
-- WASTEPILOT — Remove duplicate customers
-- Run in Supabase SQL Editor AFTER running wastepilot_complete_setup.sql
-- ============================================================

-- STEP 0: Count before
SELECT
  'Before dedup' AS step,
  (SELECT COUNT(*) FROM customers) AS customers,
  (SELECT COUNT(*) FROM subscriptions) AS subscriptions,
  (SELECT COUNT(*) FROM billing_charges) AS billing_charges,
  (SELECT COUNT(*) FROM collection_schedules) AS schedules;

-- ============================================================
-- STEP 1: Delete duplicate customers (those WITHOUT subscriber_id)
-- Keep the oldest record per (last_name, first_name, phone, sector_id, org_id)
-- Cascades to: subscriptions, billing_charges, payments, collection_schedules
-- ============================================================
DELETE FROM customers
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY
          org_id,
          LOWER(TRIM(last_name)),
          LOWER(TRIM(COALESCE(first_name, ''))),
          COALESCE(phone, ''),
          COALESCE(sector_id::TEXT, ''),
          COALESCE(concession, '')
        ORDER BY created_at ASC
      ) AS rn
    FROM customers
    WHERE subscriber_id IS NULL
  ) ranked
  WHERE rn > 1
);

-- ============================================================
-- STEP 2: Delete duplicate subscriptions
-- (customers WITH subscriber_id may have extra subscriptions from re-imports)
-- Keep oldest active subscription per customer
-- ============================================================
DELETE FROM subscriptions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY org_id, customer_id, status
        ORDER BY created_at ASC
      ) AS rn
    FROM subscriptions
  ) ranked
  WHERE rn > 1
);

-- ============================================================
-- STEP 3: Delete duplicate collection schedules
-- ============================================================
DELETE FROM collection_schedules
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY org_id, customer_id, scheduled_date
        ORDER BY created_at ASC
      ) AS rn
    FROM collection_schedules
  ) ranked
  WHERE rn > 1
);

-- ============================================================
-- STEP 4: Count after + verify
-- ============================================================
SELECT
  'After dedup' AS step,
  (SELECT COUNT(*) FROM customers) AS customers,
  (SELECT COUNT(*) FROM subscriptions) AS subscriptions,
  (SELECT COUNT(*) FROM billing_charges) AS billing_charges,
  (SELECT COUNT(*) FROM collection_schedules) AS schedules;

-- Show customer count by sector
SELECT
  s.name AS sector,
  COUNT(c.id) AS customers
FROM customers c
LEFT JOIN sectors s ON s.id = c.sector_id
GROUP BY s.name
ORDER BY s.name;

-- ============================================================
-- FIX: Give casyaz2000@gmail.com access to admin's org data
-- Run this ONCE in Supabase SQL Editor (use the service role)
-- ============================================================

-- STEP 1 — See what orgs exist and which one has data
SELECT
  o.id,
  o.name,
  o.slug,
  o.created_by,
  u.email AS owner_email,
  (SELECT COUNT(*) FROM customers c WHERE c.org_id = o.id) AS customer_count
FROM organizations o
JOIN auth.users u ON u.id = o.created_by
ORDER BY customer_count DESC;

-- STEP 2 — See casyaz2000's current org memberships
SELECT
  om.org_id,
  o.name,
  om.role,
  (SELECT COUNT(*) FROM customers c WHERE c.org_id = o.id) AS customers
FROM org_members om
JOIN organizations o ON o.id = om.org_id
WHERE om.user_id = (SELECT id FROM auth.users WHERE email = 'casyaz2000@gmail.com');

-- STEP 3 — Add casyaz2000 as admin of the MAIN org (replace the UUID below)
-- First run STEP 1 above to find the org_id that has your customers.
-- Then uncomment and run:

/*
INSERT INTO org_members (org_id, user_id, role)
SELECT
  '<PASTE-MAIN-ORG-ID-HERE>',
  id,
  'admin'
FROM auth.users
WHERE email = 'casyaz2000@gmail.com'
ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'admin';
*/

-- STEP 4 (optional but recommended) — Delete the empty org casyaz2000 created
-- This removes the empty org so there's only one org to choose from.
-- Only run if the org has 0 customers (verify with STEP 1 first).

/*
DELETE FROM organizations
WHERE id IN (
  SELECT om.org_id
  FROM org_members om
  JOIN organizations o ON o.id = om.org_id
  WHERE om.user_id = (SELECT id FROM auth.users WHERE email = 'casyaz2000@gmail.com')
    AND om.role = 'owner'
    AND (SELECT COUNT(*) FROM customers c WHERE c.org_id = om.org_id) = 0
);
*/

-- STEP 5 — Verify: casyaz2000 should now see exactly 1 org with customers
SELECT
  om.org_id,
  o.name,
  om.role,
  (SELECT COUNT(*) FROM customers c WHERE c.org_id = o.id) AS customers
FROM org_members om
JOIN organizations o ON o.id = om.org_id
WHERE om.user_id = (SELECT id FROM auth.users WHERE email = 'casyaz2000@gmail.com');

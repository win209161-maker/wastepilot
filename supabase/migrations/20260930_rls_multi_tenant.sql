-- Row Level Security: multi-tenant isolation for WastePilot
-- Run this in Supabase SQL Editor for project fiftiotizthtwayudpkj
--
-- IMPORTANT: drops ALL old permissive policies first, then replaces with
-- org-scoped policies. Safe to re-run (all statements are idempotent).

-- ─── Enable RLS on all tables ─────────────────────────────────────────────────
ALTER TABLE customers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors               ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_charges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations   ENABLE ROW LEVEL SECURITY;

-- ─── Drop ALL old policies (temp, user_id-based, and any leftovers) ───────────
-- temp_allow_all (from wastepilot_complete_setup.sql)
DROP POLICY IF EXISTS "temp_allow_all"              ON customers;
DROP POLICY IF EXISTS "temp_allow_all"              ON sectors;
DROP POLICY IF EXISTS "temp_allow_all"              ON subscriptions;
DROP POLICY IF EXISTS "temp_allow_all"              ON billing_charges;
DROP POLICY IF EXISTS "temp_allow_all"              ON payments;
DROP POLICY IF EXISTS "temp_allow_all"              ON payment_allocations;
DROP POLICY IF EXISTS "temp_allow_all"              ON collection_schedules;

-- Allow all for authenticated (broad old policies)
DROP POLICY IF EXISTS "Allow all for authenticated" ON customers;
DROP POLICY IF EXISTS "Allow all for authenticated" ON sectors;
DROP POLICY IF EXISTS "Allow all for authenticated" ON subscriptions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON billing_charges;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payments;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payment_allocations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON collection_schedules;

-- user_id-based single-tenant policies (from multi_tenant_migration.sql)
DROP POLICY IF EXISTS "Users manage own customers"           ON customers;
DROP POLICY IF EXISTS "Users manage own sectors"             ON sectors;
DROP POLICY IF EXISTS "Users manage own subscriptions"       ON subscriptions;
DROP POLICY IF EXISTS "Users manage own billing_charges"     ON billing_charges;
DROP POLICY IF EXISTS "Users manage own payments"            ON payments;
DROP POLICY IF EXISTS "Users manage own payment_allocations" ON payment_allocations;
DROP POLICY IF EXISTS "Users manage own collection_schedules" ON collection_schedules;

-- Old org/member policies on organizations and org_members
DROP POLICY IF EXISTS "org_read"    ON organizations;
DROP POLICY IF EXISTS "org_update"  ON organizations;
DROP POLICY IF EXISTS "member_read" ON org_members;

-- Previous tenant_ policies (clean re-create)
DROP POLICY IF EXISTS "tenant_customers"            ON customers;
DROP POLICY IF EXISTS "tenant_sectors"              ON sectors;
DROP POLICY IF EXISTS "tenant_subscriptions"        ON subscriptions;
DROP POLICY IF EXISTS "tenant_billing_charges"      ON billing_charges;
DROP POLICY IF EXISTS "tenant_payments"             ON payments;
DROP POLICY IF EXISTS "tenant_collection_schedules" ON collection_schedules;
DROP POLICY IF EXISTS "tenant_organizations"        ON organizations;
DROP POLICY IF EXISTS "tenant_org_members"          ON org_members;
DROP POLICY IF EXISTS "tenant_payment_allocations"  ON payment_allocations;

-- ─── Create clean org-scoped policies ─────────────────────────────────────────

CREATE POLICY "tenant_customers" ON customers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = customers.org_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = customers.org_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_sectors" ON sectors FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = sectors.org_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = sectors.org_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_subscriptions" ON subscriptions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = subscriptions.org_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = subscriptions.org_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_billing_charges" ON billing_charges FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = billing_charges.org_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = billing_charges.org_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_payments" ON payments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = payments.org_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = payments.org_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_collection_schedules" ON collection_schedules FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = collection_schedules.org_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = collection_schedules.org_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_organizations" ON organizations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = organizations.id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = organizations.id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- org_members: users see only their own rows (avoids circular reference)
CREATE POLICY "tenant_org_members" ON org_members FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- payment_allocations: no org_id column — join via payments
CREATE POLICY "tenant_payment_allocations" ON payment_allocations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payments p
      JOIN org_members om ON om.org_id = p.org_id
      WHERE p.id = payment_allocations.payment_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM payments p
      JOIN org_members om ON om.org_id = p.org_id
      WHERE p.id = payment_allocations.payment_id
        AND om.user_id = auth.uid()
    )
  );

-- ─── Verify: show active policies ─────────────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'customers','sectors','subscriptions','billing_charges',
    'payments','collection_schedules','organizations','org_members','payment_allocations'
  )
ORDER BY tablename, policyname;

-- WastePilot — Multi-Tenant Migration
-- Run this if the ORIGINAL schema is already applied (tables exist without org_id)
-- Steps:
--   1. Run this SQL in Supabase SQL Editor
--   2. Open the app — you'll see the "Create Organisation" screen
--   3. Create your org → your existing data is still visible (you'll be prompted to claim it)
--   4. Run the claim block at the bottom of this file to attach existing data to your org

-- ============================================================
-- 1. New tables
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);

-- ============================================================
-- 2. Helper function and create_org
-- ============================================================
CREATE OR REPLACE FUNCTION current_user_orgs()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION create_org(p_name TEXT, p_slug TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO organizations (name, slug, created_by)
  VALUES (p_name, p_slug, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO org_members (org_id, user_id, role)
  VALUES (v_id, auth.uid(), 'owner');

  RETURN v_id;
END;
$$;

-- ============================================================
-- 3. Add org_id columns to existing tables
--    Default to NULL temporarily; we'll fill them below
-- ============================================================
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE billing_charges ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE collection_schedules ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================================
-- 4. Drop old unique constraints (they're being replaced)
-- ============================================================
ALTER TABLE sectors DROP CONSTRAINT IF EXISTS sectors_code_key;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_subscriber_id_key;

-- ============================================================
-- 5. New unique indexes (org-scoped)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_sectors_org_code ON sectors(org_id, code) WHERE org_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_org_subscriber
  ON customers (org_id, subscriber_id)
  WHERE subscriber_id IS NOT NULL AND org_id IS NOT NULL;

-- New indexes
CREATE INDEX IF NOT EXISTS idx_sectors_org_id ON sectors(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_org_id ON customers(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_charges_org_id ON billing_charges(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_collection_schedules_org_id ON collection_schedules(org_id);

-- ============================================================
-- 6. Drop old RLS policies
-- ============================================================
DROP POLICY IF EXISTS "Allow all for authenticated" ON sectors;
DROP POLICY IF EXISTS "Allow all for authenticated" ON customers;
DROP POLICY IF EXISTS "Allow all for authenticated" ON subscriptions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON billing_charges;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payments;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payment_allocations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON collection_schedules;

-- ============================================================
-- 7. Temporary: allow all authenticated while data has no org_id
--    REMOVE THESE after running the claim block below
-- ============================================================
CREATE POLICY "temp_allow_all" ON sectors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all" ON subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all" ON billing_charges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all" ON payment_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all" ON collection_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_read" ON organizations FOR SELECT TO authenticated
  USING (id IN (SELECT current_user_orgs()));
CREATE POLICY "org_update" ON organizations FOR UPDATE TO authenticated
  USING (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'owner'))
  WITH CHECK (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'owner'));
CREATE POLICY "member_read" ON org_members FOR SELECT TO authenticated
  USING (org_id IN (SELECT current_user_orgs()));

-- ============================================================
-- CLAIM BLOCK — run AFTER creating your org in the app UI
-- Replace <YOUR_ORG_ID> with the UUID from organizations table
-- ============================================================
-- Step 1: Get your org ID
-- SELECT id FROM organizations WHERE created_by = auth.uid();
--
-- Step 2: Assign all existing data to your org
-- UPDATE sectors SET org_id = '<YOUR_ORG_ID>' WHERE org_id IS NULL;
-- UPDATE customers SET org_id = '<YOUR_ORG_ID>' WHERE org_id IS NULL;
-- UPDATE subscriptions SET org_id = '<YOUR_ORG_ID>' WHERE org_id IS NULL;
-- UPDATE billing_charges SET org_id = '<YOUR_ORG_ID>' WHERE org_id IS NULL;
-- UPDATE payments SET org_id = '<YOUR_ORG_ID>' WHERE org_id IS NULL;
-- UPDATE collection_schedules SET org_id = '<YOUR_ORG_ID>' WHERE org_id IS NULL;
--
-- Step 3: Make org_id required and enforce final RLS
-- Run supabase_multi_tenant_finalize.sql

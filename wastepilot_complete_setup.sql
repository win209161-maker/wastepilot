-- ============================================================
-- WASTEPILOT — COMPLETE SETUP (run once in Supabase SQL Editor)
-- This creates multi-tenant support AND gives casyaz2000 access
-- ============================================================

-- ============================================================
-- PART 1: Create multi-tenant tables
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
-- PART 2: Helper functions
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

CREATE OR REPLACE FUNCTION get_org_members(p_org_id UUID)
RETURNS TABLE(user_id UUID, email TEXT, role TEXT, joined_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT om.user_id, u.email::TEXT, om.role::TEXT, om.created_at
  FROM org_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE om.org_id = p_org_id ORDER BY om.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION add_org_member(p_org_id UUID, p_email TEXT, p_role TEXT DEFAULT 'member')
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_caller_role TEXT; v_user_id UUID;
BEGIN
  SELECT role INTO v_caller_role FROM org_members WHERE org_id = p_org_id AND user_id = auth.uid();
  IF v_caller_role NOT IN ('owner', 'admin') THEN RETURN 'error:not_authorized'; END IF;
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NULL THEN RETURN 'error:user_not_found'; END IF;
  INSERT INTO org_members (org_id, user_id, role)
  VALUES (p_org_id, v_user_id, p_role)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION remove_org_member(p_org_id UUID, p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_caller_role TEXT; v_target_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM org_members WHERE org_id = p_org_id AND user_id = auth.uid();
  IF v_caller_role NOT IN ('owner', 'admin') THEN RETURN 'error:not_authorized'; END IF;
  SELECT role INTO v_target_role FROM org_members WHERE org_id = p_org_id AND user_id = p_user_id;
  IF v_target_role = 'owner' THEN RETURN 'error:cannot_remove_owner'; END IF;
  DELETE FROM org_members WHERE org_id = p_org_id AND user_id = p_user_id;
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION join_org_by_slug(p_slug TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = p_slug;
  IF v_org_id IS NULL THEN RETURN 'error:not_found'; END IF;
  INSERT INTO org_members (org_id, user_id, role)
  VALUES (v_org_id, auth.uid(), 'member')
  ON CONFLICT (org_id, user_id) DO NOTHING;
  RETURN 'ok';
END;
$$;

-- ============================================================
-- PART 3: Add org_id to existing tables (nullable first)
-- ============================================================
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE billing_charges ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE collection_schedules ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Drop old single-tenant unique constraints
ALTER TABLE sectors DROP CONSTRAINT IF EXISTS sectors_code_key;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_subscriber_id_key;

-- New org-scoped unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_sectors_org_code ON sectors(org_id, code) WHERE org_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_org_subscriber ON customers (org_id, subscriber_id) WHERE subscriber_id IS NOT NULL AND org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sectors_org_id ON sectors(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_org_id ON customers(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_charges_org_id ON billing_charges(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_collection_schedules_org_id ON collection_schedules(org_id);

-- ============================================================
-- PART 4: RLS — temp permissive while data has no org_id yet
-- ============================================================
DROP POLICY IF EXISTS "Allow all for authenticated" ON sectors;
DROP POLICY IF EXISTS "Allow all for authenticated" ON customers;
DROP POLICY IF EXISTS "Allow all for authenticated" ON subscriptions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON billing_charges;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payments;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payment_allocations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON collection_schedules;
DROP POLICY IF EXISTS "temp_allow_all" ON sectors;
DROP POLICY IF EXISTS "temp_allow_all" ON customers;
DROP POLICY IF EXISTS "temp_allow_all" ON subscriptions;
DROP POLICY IF EXISTS "temp_allow_all" ON billing_charges;
DROP POLICY IF EXISTS "temp_allow_all" ON payments;
DROP POLICY IF EXISTS "temp_allow_all" ON payment_allocations;
DROP POLICY IF EXISTS "temp_allow_all" ON collection_schedules;

CREATE POLICY "temp_allow_all" ON sectors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all" ON subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all" ON billing_charges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all" ON payment_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "temp_allow_all" ON collection_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_read" ON organizations;
DROP POLICY IF EXISTS "org_update" ON organizations;
DROP POLICY IF EXISTS "member_read" ON org_members;

CREATE POLICY "org_read" ON organizations FOR SELECT TO authenticated
  USING (id IN (SELECT current_user_orgs()));
CREATE POLICY "org_update" ON organizations FOR UPDATE TO authenticated
  USING (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner','admin')))
  WITH CHECK (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner','admin')));
CREATE POLICY "member_read" ON org_members FOR SELECT TO authenticated
  USING (org_id IN (SELECT current_user_orgs()));

-- ============================================================
-- PART 5: Create the org and add BOTH accounts
-- ============================================================
DO $$
DECLARE
  v_org_id UUID;
  v_admin_id UUID;
  v_casyaz_id UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@wastepilot.app';
  SELECT id INTO v_casyaz_id FROM auth.users WHERE email = 'casyaz2000@gmail.com';

  -- Check if org already exists (idempotent)
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    -- Create the org owned by admin
    INSERT INTO organizations (name, slug, created_by)
    VALUES ('WastePilot Conakry', 'wastepilot-conakry', v_admin_id)
    RETURNING id INTO v_org_id;
  END IF;

  -- Add admin as owner
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO org_members (org_id, user_id, role)
    VALUES (v_org_id, v_admin_id, 'owner')
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'owner';
  END IF;

  -- Add casyaz2000 as admin
  IF v_casyaz_id IS NOT NULL THEN
    INSERT INTO org_members (org_id, user_id, role)
    VALUES (v_org_id, v_casyaz_id, 'admin')
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'admin';
  ELSE
    RAISE NOTICE 'casyaz2000@gmail.com not found — they need to log in once first, then re-run PART 5 only';
  END IF;

  -- Assign ALL existing data to this org
  UPDATE sectors SET org_id = v_org_id WHERE org_id IS NULL;
  UPDATE customers SET org_id = v_org_id WHERE org_id IS NULL;
  UPDATE subscriptions SET org_id = v_org_id WHERE org_id IS NULL;
  UPDATE billing_charges SET org_id = v_org_id WHERE org_id IS NULL;
  UPDATE payments SET org_id = v_org_id WHERE org_id IS NULL;
  UPDATE collection_schedules SET org_id = v_org_id WHERE org_id IS NULL;

  RAISE NOTICE 'Done. Org ID: %', v_org_id;
END;
$$;

-- ============================================================
-- VERIFY — run this to confirm everything worked
-- ============================================================
SELECT
  o.name,
  o.slug,
  om.role,
  u.email,
  (SELECT COUNT(*) FROM customers c WHERE c.org_id = o.id) AS customers,
  (SELECT COUNT(*) FROM payments p WHERE p.org_id = o.id) AS payments
FROM org_members om
JOIN organizations o ON o.id = om.org_id
JOIN auth.users u ON u.id = om.user_id
ORDER BY om.role;

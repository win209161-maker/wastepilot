-- WastePilot Database Schema — Multi-Tenant
-- Run this in Supabase SQL Editor (fresh deployment)
-- For existing deployments, run supabase_multi_tenant_migration.sql instead

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORG MEMBERS
-- ============================================================
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
-- HELPER: current user's org IDs
-- ============================================================
CREATE OR REPLACE FUNCTION current_user_orgs()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid()
$$;

-- ============================================================
-- CREATE ORG (atomic: org + owner membership + default sectors)
-- ============================================================
CREATE OR REPLACE FUNCTION create_org(p_name TEXT, p_slug TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO organizations (name, slug, created_by)
  VALUES (p_name, p_slug, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO org_members (org_id, user_id, role)
  VALUES (v_id, auth.uid(), 'owner');

  INSERT INTO sectors (org_id, name, code, description) VALUES
    (v_id, 'Alpha Yaya',  'AY',  'Quartier Alpha Yaya'),
    (v_id, 'Koloma 1 Est','K1E', 'Koloma 1 Est'),
    (v_id, 'Koloma 2',    'K2',  'Koloma 2');

  RETURN v_id;
END;
$$;

-- ============================================================
-- SECTORS
-- ============================================================
CREATE TABLE IF NOT EXISTS sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_sectors_org_id ON sectors(org_id);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscriber_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  neighborhood TEXT,
  sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
  concession TEXT,
  reference TEXT,
  address TEXT,
  request_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'paused', 'cancelled')),
  suspension_date DATE,
  suspension_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique subscriber_id per org (NULLs are allowed to repeat)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_org_subscriber
  ON customers (org_id, subscriber_id)
  WHERE subscriber_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_org_id ON customers(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_sector_id ON customers(sector_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  monthly_price INTEGER NOT NULL CHECK (monthly_price > 0),
  start_date DATE NOT NULL,
  end_date DATE,
  billing_day INTEGER NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  service_frequency TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'paused', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================================
-- BILLING CHARGES
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  billing_period TEXT NOT NULL CHECK (billing_period ~ '^\d{4}-\d{2}$'),
  monthly_price INTEGER NOT NULL CHECK (monthly_price > 0),
  months_billed INTEGER NOT NULL DEFAULT 1 CHECK (months_billed > 0),
  amount_due INTEGER NOT NULL CHECK (amount_due >= 0),
  amount_paid INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance INTEGER GENERATED ALWAYS AS (amount_due - amount_paid) STORED,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'partial', 'unpaid', 'overdue', 'waived')),
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, billing_period),
  CONSTRAINT valid_payment CHECK (amount_paid <= amount_due)
);

CREATE INDEX IF NOT EXISTS idx_billing_charges_org_id ON billing_charges(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_charges_customer_id ON billing_charges(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_charges_subscription_id ON billing_charges(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_charges_billing_period ON billing_charges(billing_period);
CREATE INDEX IF NOT EXISTS idx_billing_charges_status ON billing_charges(status);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'other')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);

-- ============================================================
-- PAYMENT ALLOCATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  charge_id UUID NOT NULL REFERENCES billing_charges(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payment_id, charge_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_charge_id ON payment_allocations(charge_id);

-- ============================================================
-- COLLECTION SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS collection_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  assigned_worker TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'missed', 'rescheduled', 'cancelled')),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_schedules_org_id ON collection_schedules(org_id);
CREATE INDEX IF NOT EXISTS idx_collection_schedules_customer_id ON collection_schedules(customer_id);
CREATE INDEX IF NOT EXISTS idx_collection_schedules_scheduled_date ON collection_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_collection_schedules_status ON collection_schedules(status);

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER billing_charges_updated_at BEFORE UPDATE ON billing_charges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER collection_schedules_updated_at BEFORE UPDATE ON collection_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: auto-update billing charge status
-- ============================================================
CREATE OR REPLACE FUNCTION update_charge_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'waived' THEN
    RETURN NEW;
  END IF;
  IF NEW.amount_paid = 0 THEN
    IF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
      NEW.status = 'overdue';
    ELSE
      NEW.status = 'unpaid';
    END IF;
  ELSIF NEW.amount_paid >= NEW.amount_due THEN
    NEW.status = 'paid';
  ELSE
    NEW.status = 'partial';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_charge_status_trigger
  BEFORE INSERT OR UPDATE OF amount_paid, amount_due, due_date
  ON billing_charges
  FOR EACH ROW EXECUTE FUNCTION update_charge_status();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_schedules ENABLE ROW LEVEL SECURITY;

-- organizations: members can read; owners can update
CREATE POLICY "org_read" ON organizations FOR SELECT TO authenticated
  USING (id IN (SELECT current_user_orgs()));
CREATE POLICY "org_update" ON organizations FOR UPDATE TO authenticated
  USING (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'owner'))
  WITH CHECK (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role = 'owner'));

-- org_members: members can read their own orgs' member list
CREATE POLICY "member_read" ON org_members FOR SELECT TO authenticated
  USING (org_id IN (SELECT current_user_orgs()));

-- All data tables: full access for org members
CREATE POLICY "org_access" ON sectors FOR ALL TO authenticated
  USING (org_id IN (SELECT current_user_orgs()))
  WITH CHECK (org_id IN (SELECT current_user_orgs()));

CREATE POLICY "org_access" ON customers FOR ALL TO authenticated
  USING (org_id IN (SELECT current_user_orgs()))
  WITH CHECK (org_id IN (SELECT current_user_orgs()));

CREATE POLICY "org_access" ON subscriptions FOR ALL TO authenticated
  USING (org_id IN (SELECT current_user_orgs()))
  WITH CHECK (org_id IN (SELECT current_user_orgs()));

CREATE POLICY "org_access" ON billing_charges FOR ALL TO authenticated
  USING (org_id IN (SELECT current_user_orgs()))
  WITH CHECK (org_id IN (SELECT current_user_orgs()));

CREATE POLICY "org_access" ON payments FOR ALL TO authenticated
  USING (org_id IN (SELECT current_user_orgs()))
  WITH CHECK (org_id IN (SELECT current_user_orgs()));

-- payment_allocations: no direct org_id; access via payment ownership
CREATE POLICY "org_access" ON payment_allocations FOR ALL TO authenticated
  USING (payment_id IN (
    SELECT id FROM payments WHERE org_id IN (SELECT current_user_orgs())
  ))
  WITH CHECK (payment_id IN (
    SELECT id FROM payments WHERE org_id IN (SELECT current_user_orgs())
  ));

CREATE POLICY "org_access" ON collection_schedules FOR ALL TO authenticated
  USING (org_id IN (SELECT current_user_orgs()))
  WITH CHECK (org_id IN (SELECT current_user_orgs()));

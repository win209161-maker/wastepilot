-- WastePilot Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SECTORS
-- ============================================================
CREATE TABLE IF NOT EXISTS sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed sectors from existing data
INSERT INTO sectors (name, code, description) VALUES
  ('Alpha Yaya', 'AY', 'Quartier Alpha Yaya'),
  ('Koloma 1 Est', 'K1E', 'Koloma 1 Est / K1 E'),
  ('Koloma 2', 'K2', 'Koloma 2')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscriber_id TEXT UNIQUE,
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

CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_sector_id ON customers(sector_id);
CREATE INDEX IF NOT EXISTS idx_customers_subscriber_id ON customers(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================================
-- BILLING CHARGES
-- billing_period format: 'YYYY-MM' (e.g. '2026-01')
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX IF NOT EXISTS idx_billing_charges_customer_id ON billing_charges(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_charges_subscription_id ON billing_charges(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_charges_billing_period ON billing_charges(billing_period);
CREATE INDEX IF NOT EXISTS idx_billing_charges_status ON billing_charges(status);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'other')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);

-- ============================================================
-- PAYMENT ALLOCATIONS
-- Maps payments to specific billing charges
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
-- ROW LEVEL SECURITY (enable when auth is configured)
-- ============================================================
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_schedules ENABLE ROW LEVEL SECURITY;

-- Temporary: allow all authenticated users full access
-- Replace with role-based policies after auth is set up
CREATE POLICY "Allow all for authenticated" ON sectors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON billing_charges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON payment_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON collection_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA (realistic test data based on actual Excel)
-- ============================================================
DO $$
DECLARE
  ay_id UUID;
  k1e_id UUID;
  k2_id UUID;
  c1_id UUID; c2_id UUID; c3_id UUID; c4_id UUID; c5_id UUID;
  c6_id UUID; c7_id UUID; c8_id UUID;
  s1_id UUID; s2_id UUID; s3_id UUID; s4_id UUID; s5_id UUID;
  s6_id UUID; s7_id UUID; s8_id UUID;
BEGIN
  SELECT id INTO ay_id FROM sectors WHERE code = 'AY';
  SELECT id INTO k1e_id FROM sectors WHERE code = 'K1E';
  SELECT id INTO k2_id FROM sectors WHERE code = 'K2';

  -- Customers
  INSERT INTO customers (id, subscriber_id, first_name, last_name, phone, neighborhood, sector_id, concession, reference, request_date, status)
  VALUES
    (uuid_generate_v4(), 'FC25/AY/09/0001', 'Abdel Aziz', 'DIALLO', '624826118', 'AY', ay_id, 'Garage Diafodeya', 'rue 1er arrêt', '2025-09-13', 'active'),
    (uuid_generate_v4(), 'FC25/AY/09/0002', 'Amadou Djouldé', 'BALDE', '611011166', 'AY', ay_id, 'Diafodeya Garage', 'rue 1er arrêt', '2025-09-10', 'active'),
    (uuid_generate_v4(), 'FC25/AY/01/0042', 'Oumou Sabana', 'BALDE', '624710107', 'AY', ay_id, 'Fatoumata Diaraye', 'rue 1er arrêt', '2025-01-29', 'active'),
    (uuid_generate_v4(), 'FC25/AY/03/0065', 'Fatoumata Binta', 'BARRY', '621396227', 'AY', ay_id, 'Benak', 'rue 1er arrêt', '2025-03-04', 'active'),
    (uuid_generate_v4(), 'FC25/AY/12/0001', 'Fatoumata', 'CAMARA', '622335092', 'AY', ay_id, 'Gaucher ya', 'route nationale', '2025-12-28', 'active'),
    (uuid_generate_v4(), NULL, 'Mabéty', 'BANGOURA', '620891918', 'K1 E', k1e_id, 'Bangoura Mory Fodé', '6ème', '2025-06-23', 'active'),
    (uuid_generate_v4(), NULL, 'Fanta', 'CAMARA', '621900316', 'K1 E', k1e_id, 'N''Faly Cité 6ème', '6ème', '2025-09-12', 'active'),
    (uuid_generate_v4(), NULL, 'Ousmane', 'CAMARA', '629125041', 'K1 E', k1e_id, NULL, '6ème', '2025-10-20', 'suspended')
  RETURNING id INTO c1_id;

  -- We need individual IDs, so let's re-select them
  SELECT id INTO c1_id FROM customers WHERE subscriber_id = 'FC25/AY/09/0001';
  SELECT id INTO c2_id FROM customers WHERE subscriber_id = 'FC25/AY/09/0002';
  SELECT id INTO c3_id FROM customers WHERE subscriber_id = 'FC25/AY/01/0042';
  SELECT id INTO c4_id FROM customers WHERE subscriber_id = 'FC25/AY/03/0065';
  SELECT id INTO c5_id FROM customers WHERE subscriber_id = 'FC25/AY/12/0001';
  SELECT id INTO c6_id FROM customers WHERE phone = '620891918';
  SELECT id INTO c7_id FROM customers WHERE phone = '621900316';
  SELECT id INTO c8_id FROM customers WHERE phone = '629125041';

  -- Subscriptions
  INSERT INTO subscriptions (id, customer_id, monthly_price, start_date, status)
  VALUES
    (uuid_generate_v4(), c1_id, 20000, '2025-09-01', 'active'),
    (uuid_generate_v4(), c2_id, 20000, '2025-09-01', 'active'),
    (uuid_generate_v4(), c3_id, 20000, '2025-01-01', 'active'),
    (uuid_generate_v4(), c4_id, 20000, '2025-03-01', 'active'),
    (uuid_generate_v4(), c5_id, 25000, '2025-12-01', 'active'),
    (uuid_generate_v4(), c6_id, 20000, '2025-06-01', 'active'),
    (uuid_generate_v4(), c7_id, 20000, '2025-09-01', 'active'),
    (uuid_generate_v4(), c8_id, 20000, '2025-10-01', 'suspended')
  RETURNING id INTO s1_id;

  SELECT id INTO s1_id FROM subscriptions WHERE customer_id = c1_id;
  SELECT id INTO s2_id FROM subscriptions WHERE customer_id = c2_id;
  SELECT id INTO s3_id FROM subscriptions WHERE customer_id = c3_id;
  SELECT id INTO s4_id FROM subscriptions WHERE customer_id = c4_id;
  SELECT id INTO s5_id FROM subscriptions WHERE customer_id = c5_id;
  SELECT id INTO s6_id FROM subscriptions WHERE customer_id = c6_id;
  SELECT id INTO s7_id FROM subscriptions WHERE customer_id = c7_id;
  SELECT id INTO s8_id FROM subscriptions WHERE customer_id = c8_id;

  -- Billing charges for 2026-01 (January)
  INSERT INTO billing_charges (customer_id, subscription_id, billing_period, monthly_price, months_billed, amount_due, amount_paid)
  VALUES
    (c1_id, s1_id, '2026-01', 20000, 1, 20000, 20000),
    (c2_id, s2_id, '2026-01', 20000, 2, 40000, 0),
    (c3_id, s3_id, '2026-01', 20000, 1, 20000, 20000),
    (c4_id, s4_id, '2026-01', 20000, 1, 20000, 20000),
    (c5_id, s5_id, '2026-01', 25000, 1, 25000, 25000),
    (c6_id, s6_id, '2026-01', 20000, 1, 20000, 20000),
    (c7_id, s7_id, '2026-01', 20000, 1, 20000, 20000),
    (c8_id, s8_id, '2026-01', 20000, 1, 20000, 0);

  -- Billing charges for 2026-02 (February)
  INSERT INTO billing_charges (customer_id, subscription_id, billing_period, monthly_price, months_billed, amount_due, amount_paid)
  VALUES
    (c1_id, s1_id, '2026-02', 20000, 1, 20000, 20000),
    (c2_id, s2_id, '2026-02', 20000, 1, 20000, 0),
    (c3_id, s3_id, '2026-02', 20000, 1, 20000, 0),
    (c4_id, s4_id, '2026-02', 20000, 1, 20000, 20000),
    (c5_id, s5_id, '2026-02', 25000, 1, 25000, 0),
    (c6_id, s6_id, '2026-02', 20000, 1, 20000, 20000),
    (c7_id, s7_id, '2026-02', 20000, 1, 20000, 10000);

  -- Billing charges for 2026-09 (current month)
  INSERT INTO billing_charges (customer_id, subscription_id, billing_period, monthly_price, months_billed, amount_due, amount_paid)
  VALUES
    (c1_id, s1_id, '2026-09', 25000, 1, 25000, 0),
    (c2_id, s2_id, '2026-09', 25000, 1, 25000, 0),
    (c3_id, s3_id, '2026-09', 25000, 1, 25000, 25000),
    (c4_id, s4_id, '2026-09', 25000, 1, 25000, 0),
    (c5_id, s5_id, '2026-09', 25000, 4, 100000, 0),
    (c6_id, s6_id, '2026-09', 25000, 3, 75000, 0),
    (c7_id, s7_id, '2026-09', 25000, 1, 25000, 25000);

END $$;

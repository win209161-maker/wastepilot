-- ============================================================
-- WastePilot — Enable Multi-tenancy (Safe Re-run)
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fiftiotizthtwayudpkj/sql/new
--
-- AFTER running this SQL:
-- → Log in as Barry → go to Settings → click "Réclamer les données existantes"
-- → Barry's data will be restored. New users see only their own data.
-- ============================================================

-- Step 1: Drop current broad policies
DROP POLICY IF EXISTS "Allow all for authenticated" ON sectors;
DROP POLICY IF EXISTS "Allow all for authenticated" ON customers;
DROP POLICY IF EXISTS "Allow all for authenticated" ON subscriptions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON billing_charges;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payments;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payment_allocations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON collection_schedules;

-- Also clean up any leftover user policies
DROP POLICY IF EXISTS "Users manage own sectors" ON sectors;
DROP POLICY IF EXISTS "Users manage own customers" ON customers;
DROP POLICY IF EXISTS "Users manage own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users manage own billing_charges" ON billing_charges;
DROP POLICY IF EXISTS "Users manage own payments" ON payments;
DROP POLICY IF EXISTS "Users manage own payment_allocations" ON payment_allocations;
DROP POLICY IF EXISTS "Users manage own collection_schedules" ON collection_schedules;

-- Step 2: User sees only their own sectors
CREATE POLICY "Users manage own sectors" ON sectors FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Step 3: User sees only their own customers
CREATE POLICY "Users manage own customers" ON customers FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Step 4: Child tables scoped through customer ownership
CREATE POLICY "Users manage own subscriptions" ON subscriptions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = subscriptions.customer_id AND customers.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = subscriptions.customer_id AND customers.user_id = auth.uid()
  ));

CREATE POLICY "Users manage own billing_charges" ON billing_charges FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = billing_charges.customer_id AND customers.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = billing_charges.customer_id AND customers.user_id = auth.uid()
  ));

CREATE POLICY "Users manage own payments" ON payments FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = payments.customer_id AND customers.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = payments.customer_id AND customers.user_id = auth.uid()
  ));

CREATE POLICY "Users manage own payment_allocations" ON payment_allocations FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM billing_charges bc
    JOIN customers c ON c.id = bc.customer_id
    WHERE bc.id = payment_allocations.charge_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM billing_charges bc
    JOIN customers c ON c.id = bc.customer_id
    WHERE bc.id = payment_allocations.charge_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users manage own collection_schedules" ON collection_schedules FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = collection_schedules.customer_id AND customers.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = collection_schedules.customer_id AND customers.user_id = auth.uid()
  ));

-- Step 5: Ensure claim function exists (SECURITY DEFINER bypasses RLS to assign NULL rows)
CREATE OR REPLACE FUNCTION claim_unclaimed_data()
RETURNS int AS $$
DECLARE
  claimed_customers int;
  claimed_sectors int;
BEGIN
  UPDATE customers SET user_id = auth.uid() WHERE user_id IS NULL;
  GET DIAGNOSTICS claimed_customers = ROW_COUNT;
  UPDATE sectors SET user_id = auth.uid() WHERE user_id IS NULL;
  GET DIAGNOSTICS claimed_sectors = ROW_COUNT;
  RETURN claimed_customers + claimed_sectors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION claim_unclaimed_data() TO authenticated;

-- Confirm columns exist
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name IN ('customers','sectors') AND column_name = 'user_id';

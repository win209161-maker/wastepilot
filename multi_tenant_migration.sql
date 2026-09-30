-- ============================================================
-- WastePilot — Multi-tenancy Migration
-- Run this in Supabase SQL Editor (once, as admin)
-- After running, click "Réclamer les données existantes"
-- in Settings to assign your account to existing data.
-- ============================================================

-- 1. Add user_id columns to root tables (nullable, defaults to auth.uid())
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE sectors
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- 2. Drop old broad "allow all authenticated" policies
DROP POLICY IF EXISTS "Allow all for authenticated" ON sectors;
DROP POLICY IF EXISTS "Allow all for authenticated" ON customers;
DROP POLICY IF EXISTS "Allow all for authenticated" ON subscriptions;
DROP POLICY IF EXISTS "Allow all for authenticated" ON billing_charges;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payments;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payment_allocations;
DROP POLICY IF EXISTS "Allow all for authenticated" ON collection_schedules;

-- 3. Sectors: user sees only their own sectors
CREATE POLICY "Users manage own sectors"
  ON sectors FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Customers: user sees only their own customers
CREATE POLICY "Users manage own customers"
  ON customers FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Subscriptions: scoped through customer ownership
CREATE POLICY "Users manage own subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = subscriptions.customer_id
        AND customers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = subscriptions.customer_id
        AND customers.user_id = auth.uid()
    )
  );

-- 6. Billing charges: scoped through customer ownership
CREATE POLICY "Users manage own billing_charges"
  ON billing_charges FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = billing_charges.customer_id
        AND customers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = billing_charges.customer_id
        AND customers.user_id = auth.uid()
    )
  );

-- 7. Payments: scoped through customer ownership
CREATE POLICY "Users manage own payments"
  ON payments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = payments.customer_id
        AND customers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = payments.customer_id
        AND customers.user_id = auth.uid()
    )
  );

-- 8. Payment allocations: scoped through billing_charges → customers
CREATE POLICY "Users manage own payment_allocations"
  ON payment_allocations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM billing_charges bc
      JOIN customers c ON c.id = bc.customer_id
      WHERE bc.id = payment_allocations.charge_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM billing_charges bc
      JOIN customers c ON c.id = bc.customer_id
      WHERE bc.id = payment_allocations.charge_id
        AND c.user_id = auth.uid()
    )
  );

-- 9. Collection schedules: scoped through customer ownership
CREATE POLICY "Users manage own collection_schedules"
  ON collection_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = collection_schedules.customer_id
        AND customers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = collection_schedules.customer_id
        AND customers.user_id = auth.uid()
    )
  );

-- 10. RPC to claim unclaimed (NULL user_id) data for the current user
--     Call this via: supabase.rpc('claim_unclaimed_data')
--     SECURITY DEFINER bypasses RLS so it can update NULL-user_id rows
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

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION claim_unclaimed_data() TO authenticated;

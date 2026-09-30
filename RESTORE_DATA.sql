-- ============================================================
-- RESTORE DATA — Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/fiftiotizthtwayudpkj/sql/new
-- This restores all your data immediately.
-- ============================================================

-- Step 1: Drop the new restrictive policies
DROP POLICY IF EXISTS "Users manage own sectors" ON sectors;
DROP POLICY IF EXISTS "Users manage own customers" ON customers;
DROP POLICY IF EXISTS "Users manage own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users manage own billing_charges" ON billing_charges;
DROP POLICY IF EXISTS "Users manage own payments" ON payments;
DROP POLICY IF EXISTS "Users manage own payment_allocations" ON payment_allocations;
DROP POLICY IF EXISTS "Users manage own collection_schedules" ON collection_schedules;

-- Step 2: Restore the original "all authenticated users" policies
CREATE POLICY "Allow all for authenticated" ON sectors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON billing_charges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON payment_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON collection_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Step 3: Confirm data is still there
SELECT 'customers' AS table_name, COUNT(*) AS rows FROM customers
UNION ALL
SELECT 'sectors', COUNT(*) FROM sectors
UNION ALL
SELECT 'billing_charges', COUNT(*) FROM billing_charges
UNION ALL
SELECT 'payments', COUNT(*) FROM payments;

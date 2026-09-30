-- Row Level Security: multi-tenant isolation for WastePilot
-- Apply this in the Supabase SQL editor for project fiftiotizthtwayudpkj
-- Fixed: use EXISTS subqueries instead of set-returning current_user_orgs()

-- Enable RLS on all tables
ALTER TABLE customers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors               ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_charges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations   ENABLE ROW LEVEL SECURITY;

-- ─── customers ────────────────────────────────────────────────────────────────
CREATE POLICY "tenant_customers" ON customers
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = customers.org_id
        AND om.user_id = auth.uid()
    )
  );

-- ─── sectors ──────────────────────────────────────────────────────────────────
CREATE POLICY "tenant_sectors" ON sectors
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = sectors.org_id
        AND om.user_id = auth.uid()
    )
  );

-- ─── subscriptions ────────────────────────────────────────────────────────────
CREATE POLICY "tenant_subscriptions" ON subscriptions
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = subscriptions.org_id
        AND om.user_id = auth.uid()
    )
  );

-- ─── billing_charges ──────────────────────────────────────────────────────────
CREATE POLICY "tenant_billing_charges" ON billing_charges
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = billing_charges.org_id
        AND om.user_id = auth.uid()
    )
  );

-- ─── payments ─────────────────────────────────────────────────────────────────
CREATE POLICY "tenant_payments" ON payments
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = payments.org_id
        AND om.user_id = auth.uid()
    )
  );

-- ─── collection_schedules ─────────────────────────────────────────────────────
CREATE POLICY "tenant_collection_schedules" ON collection_schedules
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = collection_schedules.org_id
        AND om.user_id = auth.uid()
    )
  );

-- ─── organizations ────────────────────────────────────────────────────────────
CREATE POLICY "tenant_organizations" ON organizations
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = organizations.id
        AND om.user_id = auth.uid()
    )
  );

-- ─── org_members ──────────────────────────────────────────────────────────────
-- Direct check on user_id to avoid circular reference with org_members itself
CREATE POLICY "tenant_org_members" ON org_members
  USING (user_id = auth.uid());

-- ─── payment_allocations ──────────────────────────────────────────────────────
-- No org_id column — join via payments
CREATE POLICY "tenant_payment_allocations" ON payment_allocations
  USING (
    EXISTS (
      SELECT 1 FROM payments p
      JOIN org_members om ON om.org_id = p.org_id
      WHERE p.id = payment_allocations.payment_id
        AND om.user_id = auth.uid()
    )
  );

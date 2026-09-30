-- WastePilot — Delete org function
-- Run once in Supabase SQL Editor
-- Only the org OWNER can call this — deletes everything (CASCADE handles all child tables)

CREATE OR REPLACE FUNCTION delete_org(p_org_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM org_members
  WHERE org_id = p_org_id AND user_id = auth.uid();

  IF v_role IS NULL OR v_role != 'owner' THEN
    RETURN 'error:not_owner';
  END IF;

  -- One delete cascades to: org_members, sectors, customers,
  -- subscriptions, billing_charges, payments, payment_allocations,
  -- collection_schedules
  DELETE FROM organizations WHERE id = p_org_id;

  RETURN 'ok';
END;
$$;

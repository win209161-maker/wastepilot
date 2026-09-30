-- WastePilot — Member Management Functions
-- Run this in Supabase SQL Editor
-- Enables: adding members by email, listing members, removing members, joining by slug

-- ============================================================
-- get_org_members: returns members with their emails
-- ============================================================
CREATE OR REPLACE FUNCTION get_org_members(p_org_id UUID)
RETURNS TABLE(user_id UUID, email TEXT, role TEXT, joined_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT om.user_id, u.email::TEXT, om.role::TEXT, om.created_at
  FROM org_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE om.org_id = p_org_id
  ORDER BY om.created_at;
END;
$$;

-- ============================================================
-- add_org_member: add a user by email to an org
-- Caller must be owner or admin of the org
-- ============================================================
CREATE OR REPLACE FUNCTION add_org_member(p_org_id UUID, p_email TEXT, p_role TEXT DEFAULT 'member')
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_role TEXT;
  v_user_id UUID;
BEGIN
  SELECT role INTO v_caller_role
  FROM org_members
  WHERE org_id = p_org_id AND user_id = auth.uid();

  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RETURN 'error:not_authorized';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  IF v_user_id IS NULL THEN
    RETURN 'error:user_not_found';
  END IF;

  INSERT INTO org_members (org_id, user_id, role)
  VALUES (p_org_id, v_user_id, p_role)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  RETURN 'ok';
END;
$$;

-- ============================================================
-- remove_org_member: remove a member (owner cannot be removed)
-- ============================================================
CREATE OR REPLACE FUNCTION remove_org_member(p_org_id UUID, p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  SELECT role INTO v_caller_role
  FROM org_members WHERE org_id = p_org_id AND user_id = auth.uid();

  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RETURN 'error:not_authorized';
  END IF;

  SELECT role INTO v_target_role
  FROM org_members WHERE org_id = p_org_id AND user_id = p_user_id;

  IF v_target_role = 'owner' THEN
    RETURN 'error:cannot_remove_owner';
  END IF;

  DELETE FROM org_members WHERE org_id = p_org_id AND user_id = p_user_id;
  RETURN 'ok';
END;
$$;

-- ============================================================
-- QUICK FIX — run this RIGHT NOW to add casyaz2000@gmail.com
-- to the same org as admin@wastepilot.app
-- (after running the functions above)
-- ============================================================
-- 1. Find the org ID (run this first, copy the result):
--    SELECT id, name FROM organizations LIMIT 5;
--
-- 2. Add casyaz2000@gmail.com as admin:
--    SELECT add_org_member('<paste-org-id-here>', 'casyaz2000@gmail.com', 'admin');
--
-- Expected result: 'ok'
-- If you get 'error:user_not_found', the user hasn't signed up yet —
-- have them log in once (to create their auth account), then run step 2 again.

-- ============================================================
-- join_org_by_slug: lets any authenticated user join an org
-- by entering its slug — the slug acts as a join code
-- ============================================================
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

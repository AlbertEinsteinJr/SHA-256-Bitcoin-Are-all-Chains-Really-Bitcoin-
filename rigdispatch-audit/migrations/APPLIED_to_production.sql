-- RigDispatch launch-hardening migrations APPLIED to Supabase project rlxgltbiotpmtmfxlfht
-- on 2026-06-03 via MCP. Mirror these into the rigdispatch repo's supabase/migrations history.
-- Each block was applied as a separate named migration.

-- =====================================================================
-- a2: directory RLS policies + token-keyed subscription read RPC  (#2)
-- =====================================================================
DROP POLICY IF EXISTS dir_subscriptions_service ON public.dir_subscriptions;
CREATE POLICY dir_subscriptions_service ON public.dir_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS dir_listing_contacts_service ON public.dir_listing_contacts;
CREATE POLICY dir_listing_contacts_service ON public.dir_listing_contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.dir_subscription_status(p_token uuid)
RETURNS TABLE (listing_id uuid, plan text, status text, current_period_end timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT s.listing_id, s.plan, s.status, s.current_period_end
  FROM public.dir_subscriptions s
  JOIN public.dir_listings l ON l.id = s.listing_id
  WHERE l.dashboard_token = p_token;
$$;
REVOKE EXECUTE ON FUNCTION public.dir_subscription_status(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.dir_subscription_status(uuid) TO authenticated, service_role;

-- =====================================================================
-- a3: pin search_path on all flagged functions  (#4)
-- =====================================================================
ALTER FUNCTION public.can_access_job(uuid)               SET search_path = public, pg_catalog;
ALTER FUNCTION public.current_user_id()                  SET search_path = public, pg_catalog;
ALTER FUNCTION public.has_role(user_role)                SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_admin()                         SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_fleet_manager(uuid)             SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_fleet_member(uuid)              SET search_path = public, pg_catalog;
ALTER FUNCTION public.find_nearby_mechanics(double precision, double precision, integer, text)                         SET search_path = public, pg_catalog;
ALTER FUNCTION public.find_nearby_parts_stores(double precision, double precision, double precision, integer)          SET search_path = public, pg_catalog;
ALTER FUNCTION public.find_nearby_providers(double precision, double precision, double precision, integer)             SET search_path = public, pg_catalog;
ALTER FUNCTION public.find_nearby_service_providers(double precision, double precision, double precision, integer, text, boolean) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_service_provider_meta()        SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_service_provider_states()      SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_surge_multiplier(double precision, double precision, integer)                                SET search_path = public, pg_catalog;
ALTER FUNCTION public.upsert_mechanic_location(uuid, double precision, double precision, double precision, double precision) SET search_path = public, pg_catalog;

-- =====================================================================
-- a4 / a4b / a4c: revoke anon EXECUTE on security-definer helpers  (#5)
-- (revoke from PUBLIC because anon inherits via PUBLIC; re-grant to the roles that need it)
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.can_access_job(uuid)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin()             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(user_role)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_id()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_fleet_manager(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_fleet_member(uuid)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_access_job(uuid)   TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.is_admin()             TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.has_role(user_role)    TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.current_user_id()      TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.is_fleet_manager(uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.is_fleet_member(uuid)  TO authenticated, service_role;

-- =====================================================================
-- a7: explicit service_role policies on deny-by-default locked tables
-- (cosmetic — service_role bypasses RLS; clears rls_enabled_no_policy lint)
-- =====================================================================
DO $$
DECLARE t text;
  tbls text[] := ARRAY[
    'rigdispatch_shops','rigdispatch_seats','rigdispatch_customer_accounts','rigdispatch_customer_seats',
    'rigdispatch_trucks','rigdispatch_trailers','rigdispatch_work_orders','rigdispatch_payments',
    'rigdispatch_mechanic_estimates','rigdispatch_mechanic_responses','rigdispatch_mechanic_dispatch_tokens',
    'rigdispatch_broadcast_log','rigdispatch_preferred_vendors','parts_order_items'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS service_role ON public.%I', t);
    EXECUTE format('CREATE POLICY service_role ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- =====================================================================
-- a5: consolidate duplicate permissive policies  (#10)
-- Full statements are in 10_consolidate_permissive_policies.sql (identical to applied).
-- =====================================================================
-- See sibling file: 10_consolidate_permissive_policies.sql

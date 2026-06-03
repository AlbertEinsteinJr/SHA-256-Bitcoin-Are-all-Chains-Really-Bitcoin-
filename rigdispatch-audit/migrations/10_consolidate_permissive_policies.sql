-- a5 (#10) — APPLIED to production. Collapses overlapping permissive policies so each
-- (table, role, action) has exactly one policy. Effective access preserved (SELECT predicates
-- OR-merged; ALL policies split into write-only, their read predicate folded into the SELECT policy).

-- jobs: 4 SELECT -> 1
DROP POLICY IF EXISTS jobs_select_admin ON public.jobs;
DROP POLICY IF EXISTS jobs_select_fleet ON public.jobs;
DROP POLICY IF EXISTS jobs_select_mechanic ON public.jobs;
DROP POLICY IF EXISTS jobs_select_trucker ON public.jobs;
CREATE POLICY jobs_select ON public.jobs FOR SELECT TO public USING (
  is_admin()
  OR ((fleet_id IS NOT NULL) AND is_fleet_member(fleet_id))
  OR (mechanic_id = current_user_id())
  OR ((status = 'offered'::job_status) AND has_role('mechanic'::user_role))
  OR (trucker_id = current_user_id()));

-- users: 2 SELECT -> 1
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_select_job_participants ON public.users;
CREATE POLICY users_select ON public.users FOR SELECT TO public USING (
  (id = current_user_id()) OR is_admin()
  OR EXISTS (SELECT 1 FROM jobs
    WHERE ((jobs.trucker_id = current_user_id()) AND (jobs.mechanic_id = users.id))
       OR ((jobs.mechanic_id = current_user_id()) AND (jobs.trucker_id = users.id))));

-- vehicles: 2 SELECT -> 1
DROP POLICY IF EXISTS vehicles_select_own ON public.vehicles;
DROP POLICY IF EXISTS vehicles_select_mechanic ON public.vehicles;
CREATE POLICY vehicles_select ON public.vehicles FOR SELECT TO public USING (
  (owner_id = current_user_id()) OR is_admin()
  OR EXISTS (SELECT 1 FROM jobs
    WHERE (jobs.vehicle_id = vehicles.id) AND (jobs.mechanic_id = current_user_id())
      AND (jobs.status <> ALL (ARRAY['cancelled'::job_status, 'disputed'::job_status]))));

-- fleet_members: split ALL into writes; fold read predicate into select
DROP POLICY IF EXISTS fleet_members_modify ON public.fleet_members;
DROP POLICY IF EXISTS fleet_members_select ON public.fleet_members;
CREATE POLICY fleet_members_select ON public.fleet_members FOR SELECT TO public USING (
  is_fleet_member(fleet_id) OR is_fleet_manager(fleet_id) OR is_admin());
CREATE POLICY fleet_members_insert ON public.fleet_members FOR INSERT TO public WITH CHECK (is_fleet_manager(fleet_id) OR is_admin());
CREATE POLICY fleet_members_update ON public.fleet_members FOR UPDATE TO public USING (is_fleet_manager(fleet_id) OR is_admin());
CREATE POLICY fleet_members_delete ON public.fleet_members FOR DELETE TO public USING (is_fleet_manager(fleet_id) OR is_admin());

-- mechanic_skills: select already true; split ALL into writes
DROP POLICY IF EXISTS mechanic_skills_modify ON public.mechanic_skills;
CREATE POLICY mechanic_skills_write_ins ON public.mechanic_skills FOR INSERT TO public WITH CHECK (
  (EXISTS (SELECT 1 FROM mechanic_profiles WHERE mechanic_profiles.id = mechanic_skills.mechanic_id AND mechanic_profiles.user_id = current_user_id())) OR is_admin());
CREATE POLICY mechanic_skills_write_upd ON public.mechanic_skills FOR UPDATE TO public USING (
  (EXISTS (SELECT 1 FROM mechanic_profiles WHERE mechanic_profiles.id = mechanic_skills.mechanic_id AND mechanic_profiles.user_id = current_user_id())) OR is_admin());
CREATE POLICY mechanic_skills_write_del ON public.mechanic_skills FOR DELETE TO public USING (
  (EXISTS (SELECT 1 FROM mechanic_profiles WHERE mechanic_profiles.id = mechanic_skills.mechanic_id AND mechanic_profiles.user_id = current_user_id())) OR is_admin());

-- parts: fold owner read into public read; split ALL into writes
DROP POLICY IF EXISTS "Store owner manage parts" ON public.parts;
DROP POLICY IF EXISTS "Public read parts" ON public.parts;
CREATE POLICY parts_select ON public.parts FOR SELECT TO public USING (
  (is_active = true) OR (store_id IN (SELECT parts_stores.id FROM parts_stores WHERE parts_stores.user_id = (SELECT auth.uid()))));
CREATE POLICY parts_write_ins ON public.parts FOR INSERT TO public WITH CHECK (
  store_id IN (SELECT parts_stores.id FROM parts_stores WHERE parts_stores.user_id = (SELECT auth.uid())));
CREATE POLICY parts_write_upd ON public.parts FOR UPDATE TO public USING (
  store_id IN (SELECT parts_stores.id FROM parts_stores WHERE parts_stores.user_id = (SELECT auth.uid())));
CREATE POLICY parts_write_del ON public.parts FOR DELETE TO public USING (
  store_id IN (SELECT parts_stores.id FROM parts_stores WHERE parts_stores.user_id = (SELECT auth.uid())));

-- parts_inventory: select & modify share qual; keep select, split modify into writes
DROP POLICY IF EXISTS parts_inventory_modify ON public.parts_inventory;
CREATE POLICY parts_inventory_write_ins ON public.parts_inventory FOR INSERT TO public WITH CHECK (
  (EXISTS (SELECT 1 FROM mechanic_profiles WHERE mechanic_profiles.id = parts_inventory.mechanic_id AND mechanic_profiles.user_id = current_user_id())) OR is_admin());
CREATE POLICY parts_inventory_write_upd ON public.parts_inventory FOR UPDATE TO public USING (
  (EXISTS (SELECT 1 FROM mechanic_profiles WHERE mechanic_profiles.id = parts_inventory.mechanic_id AND mechanic_profiles.user_id = current_user_id())) OR is_admin());
CREATE POLICY parts_inventory_write_del ON public.parts_inventory FOR DELETE TO public USING (
  (EXISTS (SELECT 1 FROM mechanic_profiles WHERE mechanic_profiles.id = parts_inventory.mechanic_id AND mechanic_profiles.user_id = current_user_id())) OR is_admin());

-- parts_stores: fold owner read into public read; split ALL into writes
DROP POLICY IF EXISTS "Owner manage store" ON public.parts_stores;
DROP POLICY IF EXISTS "Public read stores" ON public.parts_stores;
CREATE POLICY parts_stores_select ON public.parts_stores FOR SELECT TO public USING (
  (is_active = true) OR ((SELECT auth.uid()) = user_id));
CREATE POLICY parts_stores_write_ins ON public.parts_stores FOR INSERT TO public WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY parts_stores_write_upd ON public.parts_stores FOR UPDATE TO public USING ((SELECT auth.uid()) = user_id);
CREATE POLICY parts_stores_write_del ON public.parts_stores FOR DELETE TO public USING ((SELECT auth.uid()) = user_id);

-- products: select true; split ALL(service_role) into writes
DROP POLICY IF EXISTS "Service role can manage products" ON public.products;
CREATE POLICY products_write_ins ON public.products FOR INSERT TO public WITH CHECK ((SELECT auth.role()) = 'service_role');
CREATE POLICY products_write_upd ON public.products FOR UPDATE TO public USING ((SELECT auth.role()) = 'service_role');
CREATE POLICY products_write_del ON public.products FOR DELETE TO public USING ((SELECT auth.role()) = 'service_role');

-- promo_codes: keep select; split ALL(is_admin) into writes
DROP POLICY IF EXISTS promo_codes_modify ON public.promo_codes;
CREATE POLICY promo_codes_write_ins ON public.promo_codes FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY promo_codes_write_upd ON public.promo_codes FOR UPDATE TO public USING (is_admin());
CREATE POLICY promo_codes_write_del ON public.promo_codes FOR DELETE TO public USING (is_admin());

-- providers: select true; split ALL(admin jwt) into writes
DROP POLICY IF EXISTS providers_admin_all ON public.providers;
CREATE POLICY providers_write_ins ON public.providers FOR INSERT TO public WITH CHECK (((SELECT auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY providers_write_upd ON public.providers FOR UPDATE TO public USING (((SELECT auth.jwt()) ->> 'role') = 'admin');
CREATE POLICY providers_write_del ON public.providers FOR DELETE TO public USING (((SELECT auth.jwt()) ->> 'role') = 'admin');

-- service_categories: select true; split ALL(is_admin) into writes
DROP POLICY IF EXISTS service_categories_modify ON public.service_categories;
CREATE POLICY service_categories_write_ins ON public.service_categories FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY service_categories_write_upd ON public.service_categories FOR UPDATE TO public USING (is_admin());
CREATE POLICY service_categories_write_del ON public.service_categories FOR DELETE TO public USING (is_admin());

-- service_providers: select stays true; merge UPDATE(admin + own); admin INSERT/DELETE
DROP POLICY IF EXISTS "Admin full access" ON public.service_providers;
DROP POLICY IF EXISTS "Users can update own profile" ON public.service_providers;
CREATE POLICY service_providers_update ON public.service_providers FOR UPDATE TO public USING (
  ((SELECT auth.uid()) = user_id)
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.role = 'admin'::user_role));
CREATE POLICY service_providers_admin_ins ON public.service_providers FOR INSERT TO public WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.role = 'admin'::user_role));
CREATE POLICY service_providers_admin_del ON public.service_providers FOR DELETE TO public USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.role = 'admin'::user_role));

-- user_roles: keep select; split ALL(is_admin) into writes
DROP POLICY IF EXISTS user_roles_admin ON public.user_roles;
CREATE POLICY user_roles_write_ins ON public.user_roles FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY user_roles_write_upd ON public.user_roles FOR UPDATE TO public USING (is_admin());
CREATE POLICY user_roles_write_del ON public.user_roles FOR DELETE TO public USING (is_admin());

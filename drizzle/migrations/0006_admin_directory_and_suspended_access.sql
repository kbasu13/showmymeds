CREATE OR REPLACE FUNCTION public.is_account_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND (banned_until IS NULL OR banned_until <= now())) $$;
REVOKE ALL ON FUNCTION public.is_account_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_active() TO authenticated;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','medicines','dose_logs','caregiver_links','premium_users','user_roles','discount_codes','discount_redemptions'] LOOP
    EXECUTE format('CREATE POLICY "active accounts only" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_account_active()) WITH CHECK (public.is_account_active())', t);
  END LOOP;
END $$;
CREATE POLICY "active accounts storage access" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_account_active()) WITH CHECK (public.is_account_active());
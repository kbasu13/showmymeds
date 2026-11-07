CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_account_active() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
DO $$ DECLARE signature text; definition text; BEGIN
  FOREACH signature IN ARRAY ARRAY['public.accept_invite(text)','public.activate_premium_paid(text,text)','public.check_discount(text)'] LOOP
    SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
    definition := regexp_replace(definition, '\mbegin\M', E'begin\n  if not public.is_account_active() then raise exception ''Account access is suspended.''; end if;', 'i');
    EXECUTE definition;
  END LOOP;
END $$;
CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  percent int NOT NULL CHECK (percent IN (75,50,25,10)),
  max_uses int,
  used_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT ALL ON public.discount_codes TO service_role;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage codes" ON public.discount_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.discount_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  plan text,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);
GRANT SELECT ON public.discount_redemptions TO authenticated;
GRANT ALL ON public.discount_redemptions TO service_role;
ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin redemptions" ON public.discount_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.check_discount(_code text) RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare c public.discount_codes;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into c from discount_codes where code = upper(trim(_code));
  if not found or not c.active then raise exception 'This code is not valid.'; end if;
  if c.expires_at is not null and c.expires_at < now() then raise exception 'This code has expired.'; end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then raise exception 'This code has been used up.'; end if;
  if exists (select 1 from discount_redemptions where code_id = c.id and user_id = auth.uid()) then
    raise exception 'You have already used this code. Please use a new one.'; end if;
  return c.percent;
end $$;

CREATE OR REPLACE FUNCTION public.redeem_discount(_code text, _plan text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare p int; cid uuid;
begin
  p := public.check_discount(_code);
  select id into cid from discount_codes where code = upper(trim(_code)) for update;
  insert into discount_redemptions(code_id, user_id, plan) values (cid, auth.uid(), _plan);
  update discount_codes set used_count = used_count + 1 where id = cid;
  return p;
end $$;

CREATE OR REPLACE FUNCTION public.admin_list_premium()
RETURNS TABLE(user_id uuid, email text, display_name text, granted_at timestamptz, expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'admins only'; end if;
  return query select p.user_id, u.email::text, pr.display_name, p.granted_at, p.expires_at
    from premium_users p join auth.users u on u.id = p.user_id left join profiles pr on pr.id = p.user_id
    order by p.granted_at desc;
end $$;

CREATE OR REPLACE FUNCTION public.admin_grant_premium(_email text, _expires timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare uid uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'admins only'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(_email));
  if uid is null then raise exception 'No user with that email.'; end if;
  insert into premium_users(user_id, expires_at) values (uid, _expires)
    on conflict (user_id) do update set expires_at = excluded.expires_at, granted_at = now();
end $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_premium(_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'admins only'; end if;
  delete from premium_users where user_id = _user;
end $$;

REVOKE EXECUTE ON FUNCTION public.check_discount(text), public.redeem_discount(text,text), public.admin_list_premium(),
  public.admin_grant_premium(text,timestamptz), public.admin_revoke_premium(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_discount(text), public.redeem_discount(text,text), public.admin_list_premium(),
  public.admin_grant_premium(text,timestamptz), public.admin_revoke_premium(uuid) TO authenticated;
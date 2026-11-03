CREATE OR REPLACE FUNCTION public.activate_premium_paid(_plan text, _code text) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare exp timestamptz; cur timestamptz; base timestamptz;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if _plan not in ('monthly','yearly','lifetime') then raise exception 'Unknown plan'; end if;
  if _code is not null and length(trim(_code)) > 0 then perform public.redeem_discount(_code, _plan); end if;
  select expires_at into cur from premium_users where user_id = auth.uid();
  base := greatest(coalesce(cur, now()), now());
  exp := case _plan when 'monthly' then base + interval '1 month' when 'yearly' then base + interval '1 year' else null end;
  insert into premium_users(user_id, expires_at) values (auth.uid(), exp)
    on conflict (user_id) do update set expires_at = excluded.expires_at, granted_at = now();
  return exp;
end $$;
REVOKE EXECUTE ON FUNCTION public.activate_premium_paid(text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.activate_premium_paid(text,text) TO authenticated;